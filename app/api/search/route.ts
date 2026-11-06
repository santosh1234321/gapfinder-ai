
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateEmbedding } from "@/lib/gemini/client";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Verify logged-in user
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

    const { query, documentId, matchCount = 5 } =
      await request.json();

    if (
      typeof query !== "string" ||
      query.trim().length < 3 ||
      query.length > 2000
    ) {
      return NextResponse.json(
        { error: "Enter a query between 3 and 2,000 characters." },
        { status: 400 }
      );
    }

    if (
      documentId !== undefined &&
      documentId !== null &&
      (typeof documentId !== "string" || !documentId)
    ) {
      return NextResponse.json(
        { error: "Invalid document ID." },
        { status: 400 }
      );
    }

    // Generate an embedding for the student's query.
    const embedding = await generateEmbedding(query);

    // Retrieve the most relevant document chunks.
    const { data, error } = await supabase.rpc(
      "match_document_chunks",
      {
        query_embedding: `[${embedding.join(",")}]`,
        match_count: Math.max(
          1,
          Math.min(Number(matchCount) || 5, 10)
        ),
        filter_document_id: documentId || null,
      }
    );

    if (error) {
      throw new Error(`Semantic search failed: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      query,
      results: data || [],
      resultCount: data?.length || 0,
    });
  } catch (error) {
    console.error("Search API error:", error);

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
