
import { NextResponse } from "next/server";
import { groq } from "@/lib/groq/client";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please log in to analyze your syllabus." },
        { status: 401 }
      );
    }

    // 2. Receive document information
    const body = await request.json();
    const { text, documentId } = body;

    if (
      typeof text !== "string" ||
      text.trim().length < 50 ||
      typeof documentId !== "string"
    ) {
      return NextResponse.json(
        { error: "Valid syllabus text and document ID are required." },
        { status: 400 }
      );
    }

    if (text.length > 30000) {
      return NextResponse.json(
        { error: "Syllabus text is too large. Please use a smaller document." },
        { status: 400 }
      );
    }

    // 3. Verify document ownership
    const { data: document, error: documentError } = await supabase
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

    // 4. Extract syllabus structure using Groq
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "system",
          content: `
You are an academic syllabus analysis assistant.

Analyze the supplied syllabus and identify:
- Subject name
- Units or modules
- Topics under each unit
- Subtopics under each topic

Rules:
1. Use only information supported by the supplied text.
2. Do not invent missing topics or units.
3. Preserve the original academic terminology.
4. Use "Unknown" if the subject name is unclear.
5. Return empty arrays when information is unavailable.
6. Return valid JSON only.

Use this structure:

{
  "subject": "Subject name",
  "units": [
    {
      "unit_name": "Unit I",
      "unit_title": "Unit title",
      "topics": [
        {
          "topic_name": "Topic name",
          "subtopics": [
            "Subtopic 1",
            "Subtopic 2"
          ]
        }
      ]
    }
  ]
}
          `,
        },
        {
          role: "user",
          content: text,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const result = completion.choices[0]?.message?.content;

    if (!result) {
      throw new Error("Groq returned an empty response.");
    }

    const topicStructure = JSON.parse(result);

    if (
      typeof topicStructure.subject !== "string" ||
      !Array.isArray(topicStructure.units)
    ) {
      throw new Error("Invalid topic structure returned by AI.");
    }

    // 5. Validate the returned structure
    for (const unit of topicStructure.units) {
      if (
        typeof unit.unit_name !== "string" ||
        typeof unit.unit_title !== "string" ||
        !Array.isArray(unit.topics)
      ) {
        throw new Error("Groq returned an invalid unit structure.");
      }

      for (const topic of unit.topics) {
        if (
          typeof topic.topic_name !== "string" ||
          !Array.isArray(topic.subtopics) ||
          !topic.subtopics.every(
            (item: unknown) => typeof item === "string"
          )
        ) {
          throw new Error("Groq returned an invalid topic structure.");
        }
      }
    }

    // 6. Remove previous analysis for this document
    // Deleting the subject also deletes its units and topics
    // through the configured cascading foreign keys.
    const { error: deleteError } = await supabase
      .from("subjects")
      .delete()
      .eq("document_id", documentId)
      .eq("user_id", user.id);

    if (deleteError) {
      throw deleteError;
    }

    // 7. Save subject
    const { data: savedSubject, error: subjectError } =
      await supabase
        .from("subjects")
        .insert({
          document_id: documentId,
          user_id: user.id,
          name: topicStructure.subject,
        })
        .select("id")
        .single();

    if (subjectError || !savedSubject) {
      throw subjectError || new Error("Could not save subject.");
    }

    // 8. Save units, topics and subtopics
    for (let unitIndex = 0;
      unitIndex < topicStructure.units.length;
      unitIndex++
    ) {
      const unit = topicStructure.units[unitIndex];

      const { data: savedUnit, error: unitError } = await supabase
        .from("syllabus_units")
        .insert({
          subject_id: savedSubject.id,
          user_id: user.id,
          unit_name: unit.unit_name,
          unit_title: unit.unit_title,
          position: unitIndex,
        })
        .select("id")
        .single();

      if (unitError || !savedUnit) {
        throw unitError || new Error("Could not save syllabus unit.");
      }

      for (let topicIndex = 0;
        topicIndex < unit.topics.length;
        topicIndex++
      ) {
        const topic = unit.topics[topicIndex];

        // Save main topic
        const { data: savedTopic, error: topicError } =
          await supabase
            .from("syllabus_topics")
            .insert({
              unit_id: savedUnit.id,
              user_id: user.id,
              topic_name: topic.topic_name,
              position: topicIndex,
              parent_topic_id: null,
            })
            .select("id")
            .single();

        if (topicError || !savedTopic) {
          throw topicError || new Error("Could not save topic.");
        }

        // Save subtopics linked to their parent topic
        if (topic.subtopics.length > 0) {
          const subtopicRows = topic.subtopics.map(
            (subtopic: string, subIndex: number) => ({
              unit_id: savedUnit.id,
              user_id: user.id,
              topic_name: subtopic,
              position: subIndex,
              parent_topic_id: savedTopic.id,
            })
          );

          const { error: subtopicError } = await supabase
            .from("syllabus_topics")
            .insert(subtopicRows);

          if (subtopicError) {
            throw subtopicError;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Syllabus analyzed and saved successfully.",
      data: topicStructure,
      subjectId: savedSubject.id,
    });

  } catch (error) {
    console.error("Topic extraction and saving error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to analyze and save syllabus.",
      },
      { status: 500 }
    );
  }
}
