
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

    const { documentId, questionCount = 10 } =
      await request.json();

    if (
      typeof documentId !== "string" ||
      !documentId
    ) {
      return NextResponse.json(
        { error: "A valid document ID is required." },
        { status: 400 }
      );
    }

    const count = Math.max(
      5,
      Math.min(Number(questionCount) || 10, 20)
    );

    // Verify document ownership
    const { data: document, error: documentError } =
      await supabase
        .from("documents")
        .select("id")
        .eq("id", documentId)
        .eq("user_id", user.id)
        .single();

    if (documentError || !document) {
      return NextResponse.json(
        { error: "Document not found or access denied." },
        { status: 404 }
      );
    }

    // Fetch the subject associated with this document
    const { data: subject, error: subjectError } =
      await supabase
        .from("subjects")
        .select("id, name")
        .eq("document_id", documentId)
        .eq("user_id", user.id)
        .single();

    if (subjectError || !subject) {
      return NextResponse.json(
        { error: "Analyze the syllabus before generating a quiz." },
        { status: 400 }
      );
    }

    // Fetch syllabus units
    const { data: units, error: unitsError } =
      await supabase
        .from("syllabus_units")
        .select("id, unit_name, unit_title, position")
        .eq("subject_id", subject.id)
        .eq("user_id", user.id)
        .order("position");

    if (unitsError || !units || units.length === 0) {
      return NextResponse.json(
        { error: "No syllabus units were found." },
        { status: 400 }
      );
    }

    // Fetch main topics from each unit
    const { data: topics, error: topicsError } =
      await supabase
        .from("syllabus_topics")
        .select("id, unit_id, topic_name, position")
        .in("unit_id", units.map((unit) => unit.id))
        .eq("user_id", user.id)
        .is("parent_topic_id", null)
        .order("position");

    if (topicsError || !topics || topics.length === 0) {
      return NextResponse.json(
        { error: "No syllabus topics were found." },
        { status: 400 }
      );
    }

    // Prepare topic list for question distribution
    const topicDetails = topics.map((topic) => {
      const unit = units.find(
        (item) => item.id === topic.unit_id
      );

      return {
        topicId: topic.id,
        topicName: topic.topic_name,
        unitName: unit?.unit_name || "Unknown unit",
        unitTitle: unit?.unit_title || "",
      };
    });

    // Retrieve relevant syllabus material for each topic.
    const sourceMap: Record<string, any[]> = {};

    for (const topic of topicDetails) {
      const embedding = await generateEmbedding(
        `${topic.unitName}: ${topic.unitTitle}. Topic: ${topic.topicName}`
      );

      const { data: matches, error: retrievalError } =
        await supabase.rpc("match_document_chunks", {
          query_embedding: `[${embedding.join(",")}]`,
          match_count: 2,
          filter_document_id: documentId,
        });

      if (retrievalError) {
        throw new Error(
          `Topic retrieval failed: ${retrievalError.message}`
        );
      }

      sourceMap[topic.topicId] = matches || [];
    }

    const availableTopics = topicDetails.filter(
      (topic) => sourceMap[topic.topicId]?.length > 0
    );

    if (availableTopics.length === 0) {
      return NextResponse.json(
        {
          error:
            "No relevant syllabus content was retrieved for question generation.",
        },
        { status: 400 }
      );
    }

    const topicContext = availableTopics.map((topic) => {
      const sources = sourceMap[topic.topicId]
        .map((source: any) => source.content)
        .join("\n\n");

      return `
Topic ID: ${topic.topicId}
Unit: ${topic.unitName} - ${topic.unitTitle}
Topic: ${topic.topicName}

Supporting syllabus material:
${sources}
      `.trim();
    }).join("\n\n--------------------\n\n");

    // Generate diagnostic questions
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `
You are GapFinder AI, an academic diagnostic assessment generator.

Generate exactly ${count} multiple-choice questions using ONLY
the supplied syllabus topics and supporting study material.

Requirements:

1. Cover as many available topics as possible.
2. Associate every question with one exact Topic ID.
3. Questions must test understanding, not just memorization.
4. Use four answer options labelled A, B, C and D.
5. Exactly one option must be correct.
6. Do not introduce facts absent from the supporting material.
7. Do not generate duplicate or nearly identical questions.
8. Use clear language appropriate for undergraduate students.
9. Provide a short explanation supported by the material.
10. Do not reveal the correct answer in the question text.

Return valid JSON in this structure:

{
  "questions": [
    {
      "question": "Question text",
      "topic_id": "Exact Topic ID",
      "topic_name": "Exact topic name",
      "unit_name": "Unit name",
      "options": {
        "A": "Option A",
        "B": "Option B",
        "C": "Option C",
        "D": "Option D"
      },
      "correct_answer": "A",
      "explanation": "Explanation based on the supplied material"
    }
  ]
}

Do not include markdown or additional text.
          `.trim(),
        },
        {
          role: "user",
          content: topicContext,
        },
      ],
    });

    const result = completion.choices[0]?.message?.content;

    if (!result) {
      throw new Error("Question generation returned an empty response.");
    }

    const parsed = JSON.parse(result);

    if (
      !parsed ||
      !Array.isArray(parsed.questions) ||
      parsed.questions.length !== count
    ) {
      throw new Error(
        "The AI did not generate the requested number of questions."
      );
    }

    // Validate all questions before returning them.
    const validQuestions = parsed.questions.map(
      (question: any, index: number) => {
        const topic = availableTopics.find(
          (item) => item.topicId === question.topic_id
        );

        if (
          !topic ||
          typeof question.question !== "string" ||
          typeof question.topic_name !== "string" ||
          typeof question.unit_name !== "string" ||
          typeof question.explanation !== "string" ||
          !question.options ||
          !["A", "B", "C", "D"].every(
            (key) => typeof question.options[key] === "string"
          ) ||
          !["A", "B", "C", "D"].includes(
            question.correct_answer
          )
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
          explanation: question.explanation,
        };
      }
    );

    return NextResponse.json({
      success: true,
      subject: subject.name,
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