
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateEmbedding } from "@/lib/gemini/client";

function splitIntoChunks(
  text: string,
  chunkSize = 1200,
  overlap = 200
): string[] {
  const cleanedText = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  if (!cleanedText) return [];

  // Split the document into paragraphs and sentences.
  const paragraphs = cleanedText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const sentences: string[] = [];

  for (const paragraph of paragraphs) {
    const parts =
      paragraph.match(/[^.!?]+(?:[.!?]+["')\]]*|$)/g) || [paragraph];

    for (const part of parts) {
      const sentence = part.trim();

      if (!sentence) continue;

      // Split exceptionally long sentences at word boundaries.
      if (sentence.length > chunkSize) {
        const words = sentence.split(/\s+/);
        let current = "";

        for (const word of words) {
          if (current && (current + " " + word).length > chunkSize) {
            sentences.push(current);
            current = word;
          } else {
            current = current ? current + " " + word : word;
          }
        }

        if (current) sentences.push(current);
      } else {
        sentences.push(sentence);
      }
    }
  }

  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const candidate = current
      ? current + " " + sentence
      : sentence;

    if (candidate.length <= chunkSize) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current.trim());
    }

    // Retain a short overlap from the previous chunk.
    const previousWords = current.split(/\s+/);
    const overlapWords: string[] = [];
    let overlapLength = 0;

    for (let i = previousWords.length - 1; i >= 0; i--) {
      const word = previousWords[i];
      const addedLength = word.length + 1;

      if (overlapLength + addedLength > overlap) break;

      overlapWords.unshift(word);
      overlapLength += addedLength;
    }

    const overlapText = overlapWords.join(" ");

    current = overlapText
      ? overlapText + " " + sentence
      : sentence;
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.filter(Boolean);
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

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

    const { text, documentId } = await request.json();

    if (
      typeof text !== "string" ||
      text.trim().length < 50 ||
      text.length > 100000
    ) {
      return NextResponse.json(
        { error: "Text must contain between 50 and 100,000 characters." },
        { status: 400 }
      );
    }

    if (typeof documentId !== "string" || !documentId) {
      return NextResponse.json(
        { error: "A valid document ID is required." },
        { status: 400 }
      );
    }

    // Verify document ownership.
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

    const chunks = splitIntoChunks(text);

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "No usable text chunks were generated." },
        { status: 400 }
      );
    }

    // Generate embeddings before replacing existing chunks.
    const rows = [];

    for (let i = 0; i < chunks.length; i++) {
      const embedding = await generateEmbedding(chunks[i]);

      rows.push({
        document_id: documentId,
        user_id: user.id,
        chunk_index: i,
        content: chunks[i],
        embedding: `[${embedding.join(",")}]`,
      });
    }

    // Remove previous chunks for this document.
    const { error: deleteError } = await supabase
      .from("document_chunks")
      .delete()
      .eq("document_id", documentId)
      .eq("user_id", user.id);

    if (deleteError) {
      throw new Error(
        `Could not replace old chunks: ${deleteError.message}`
      );
    }

    // Save new chunks in batches.
    for (let i = 0; i < rows.length; i += 10) {
      const batch = rows.slice(i, i + 10);

      const { error: insertError } = await supabase
        .from("document_chunks")
        .insert(batch);

      if (insertError) {
        throw new Error(
          `Could not save chunks: ${insertError.message}`
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Sentence-aware chunks and embeddings saved successfully.",
      chunkCount: chunks.length,
    });
  } catch (error) {
    console.error("Chunk processing error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}
