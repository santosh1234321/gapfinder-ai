import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateEmbedding } from "@/lib/gemini/client";
import { groq } from "@/lib/groq/client";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please log in first." },
        { status: 401 }
      );
    }

    const { documentId, questionCount = 5 } = await request.json();

    if (typeof documentId !== "string" || !documentId) {
      return NextResponse.json(
        { error: "A valid document ID is required." },
        { status: 400 }
      );
    }

    const count = Math.max(3, Math.min(Number(questionCount) || 5, 10));

    // Verify document ownership
    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("id, file_name")
      .eq("id", documentId)
      .eq("user_id", user.id)
      .single();

    if (documentError || !document) {
      return NextResponse.json(
        { error: "Document not found or access denied." },
        { status: 404 }
      );
    }

    // Check if document chunks exist for this document
    const { data: documentChunks, error: chunksError } = await supabase
      .from("document_chunks")
      .select("id, content, chunk_index")
      .eq("document_id", documentId)
      .eq("user_id", user.id)
      .order("chunk_index");

    if (chunksError || !documentChunks || documentChunks.length === 0) {
      return NextResponse.json(
        {
          error:
            "No processed document chunks found. Please go to the Upload page and click 'Generate Embeddings' for this document first.",
        },
        { status: 400 }
      );
    }

    // Fetch the subject associated with this document
    const { data: subject, error: subjectError } = await supabase
      .from("subjects")
      .select("id, name")
      .eq("document_id", documentId)
      .eq("user_id", user.id)
      .single();

    if (subjectError || !subject) {
      return NextResponse.json(
        {
          error:
            "Please analyze the syllabus on the Upload page before generating a quiz.",
        },
        { status: 400 }
      );
    }

    // Fetch syllabus units
    const { data: units, error: unitsError } = await supabase
      .from("syllabus_units")
      .select("id, unit_name, unit_title, position")
      .eq("subject_id", subject.id)
      .eq("user_id", user.id)
      .order("position");

    if (unitsError || !units || units.length === 0) {
      return NextResponse.json(
        { error: "No syllabus units found. Please re-run syllabus analysis." },
        { status: 400 }
      );
    }

    // Fetch main topics from each unit
    const { data: topics, error: topicsError } = await supabase
      .from("syllabus_topics")
      .select("id, unit_id, topic_name, position")
      .in("unit_id", units.map((unit) => unit.id))
      .eq("user_id", user.id)
      .is("parent_topic_id", null)
      .order("position");

    if (topicsError || !topics || topics.length === 0) {
      return NextResponse.json(
        { error: "No syllabus topics found. Please re-run syllabus analysis." },
        { status: 400 }
      );
    }

    // Prepare topic list for question distribution
    const topicDetails = topics.map((topic) => {
      const unit = units.find((item) => item.id === topic.unit_id);

      return {
        topicId: topic.id,
        topicName: topic.topic_name,
        unitName: unit?.unit_name || "Course Module",
        unitTitle: unit?.unit_title || "",
      };
    });

    // Retrieve relevant syllabus material for topics (up to 8 sample topics)
    const sourceMap: Record<string, any[]> = {};
    const sampleTopics = topicDetails.slice(0, 8);

    for (const topic of sampleTopics) {
      try {
        const embedding = await generateEmbedding(
          `${topic.unitName}: ${topic.unitTitle}. Topic: ${topic.topicName}`
        );

        const { data: matches, error: retrievalError } = await supabase.rpc(
          "match_document_chunks",
          {
            query_embedding: `[${embedding.join(",")}]`,
            match_count: 2,
            filter_document_id: documentId,
          }
        );

        if (!retrievalError && matches && matches.length > 0) {
          sourceMap[topic.topicId] = matches;
        }
      } catch (err) {
        console.warn(`Topic retrieval skipped for ${topic.topicName}:`, err);
      }
    }

    let availableTopics = topicDetails.filter(
      (topic) => sourceMap[topic.topicId]?.length > 0
    );

    // Fallback: If vector similarity returned 0 matches (e.g. curriculum schemes, tables, course codes),
    // use the document's actual stored chunks directly so question generation remains grounded and succeeds!
    if (availableTopics.length === 0) {
      availableTopics = topicDetails.slice(0, Math.min(count, topicDetails.length));
      availableTopics.forEach((topic, idx) => {
        const assignedChunk = documentChunks[idx % documentChunks.length];
        sourceMap[topic.topicId] = assignedChunk ? [assignedChunk] : [documentChunks[0]];
      });
    }

    const topicContext = availableTopics
      .map((topic) => {
        const sources = (sourceMap[topic.topicId] || [documentChunks[0]])
          .map((source: any) => source.content)
          .join("\n\n");

        return `
Topic ID: ${topic.topicId}
Unit / Section: ${topic.unitName} - ${topic.unitTitle}
Topic: ${topic.topicName}

Supporting material:
${sources}
        `.trim();
      })
      .join("\n\n--------------------\n\n");

    const systemPrompt = `
You are GapFinder AI, an academic diagnostic assessment generator.

Generate exactly ${count} multiple-choice questions using ONLY the supplied curriculum topics and supporting study material.

Guidelines:
1. Cover as many available topics as possible.
2. If the document is a curriculum scheme (like course schemes, regulations, credits), questions must test factual details explicitly present in the text (such as course codes, semester structures, credits, course categories, prerequisites, electives, or scheme rules).
3. Associate every question with one exact Topic ID from the supplied list.
4. Use four answer options labelled A, B, C and D.
5. Exactly one option must be correct.
6. Do not introduce facts absent from the supporting material.
7. Do not generate duplicate questions.
8. Provide a concise explanation grounded directly in the material.

Return valid JSON in this structure:
{
  "questions": [
    {
      "question": "Question text",
      "topic_id": "Exact Topic ID",
      "topic_name": "Exact topic name",
      "unit_name": "Unit or section name",
      "options": {
        "A": "Option A",
        "B": "Option B",
        "C": "Option C",
        "D": "Option D"
      },
      "correct_answer": "A",
      "explanation": "Explanation based on the material"
    }
  ]
}
`.trim();

    let completion;
    try {
      completion = await groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: topicContext },
        ],
      });
    } catch (groqErr) {
      console.warn("Primary model error, falling back to llama-3.3-70b-versatile:", groqErr);
      completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: topicContext },
        ],
      });
    }

    const result = completion.choices[0]?.message?.content;

    if (!result) {
      throw new Error("Question generation returned an empty response.");
    }

    const parsed = JSON.parse(result);

    if (
      !parsed ||
      !Array.isArray(parsed.questions) ||
      parsed.questions.length === 0
    ) {
      throw new Error(
        "The AI did not generate questions in the requested format."
      );
    }

    // Validate and normalize all questions before returning them
    const validQuestions = parsed.questions
      .slice(0, count)
      .map((question: any, index: number) => {
        const topic =
          availableTopics.find((item) => item.topicId === question.topic_id) ||
          availableTopics[index % availableTopics.length];

        if (
          typeof question.question !== "string" ||
          !question.options ||
          !["A", "B", "C", "D"].every(
            (key) => typeof question.options[key] === "string"
          ) ||
          !["A", "B", "C", "D"].includes(question.correct_answer)
        ) {
          throw new Error(
            `Invalid question structure at question ${index + 1}.`
          );
        }

        return {
          id: `question-${index + 1}`,
          question: question.question,
          topic_id: topic.topicId,
          topic_name: topic.topicName,
          unit_name: topic.unitName,
          options: question.options,
          correct_answer: question.correct_answer,
          explanation:
            typeof question.explanation === "string"
              ? question.explanation
              : "Based on the uploaded curriculum material.",
        };
      });

    return NextResponse.json({
      success: true,
      subject: subject.name,
      documentName: document.file_name,
      questionCount: validQuestions.length,
      questions: validQuestions,
    });
  } catch (error) {
    console.error("Diagnostic question generation error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate diagnostic questions.",
      },
      { status: 500 }
    );
  }
}
