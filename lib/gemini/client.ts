
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is missing from .env.local");
}

const gemini = new GoogleGenAI({ apiKey });

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text.trim()) {
    throw new Error("Cannot generate an embedding for empty text.");
  }

  const result = await gemini.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: {
      outputDimensionality: 768,
      taskType: "RETRIEVAL_DOCUMENT",
    },
  });

  const embedding = result.embeddings?.[0]?.values;

  if (!embedding || embedding.length !== 768) {
    throw new Error("Gemini returned an invalid embedding.");
  }

  return embedding;
}
