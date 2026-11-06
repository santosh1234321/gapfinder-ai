"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/app/components/navbar";
import { createClient } from "@/lib/supabase/client";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"info" | "success" | "error">("info");
  const [extractedText, setExtractedText] = useState("");
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [topicStructure, setTopicStructure] = useState<any>(null);
  const [savedDocumentId, setSavedDocumentId] = useState<string | null>(null);
  const [chunkCount, setChunkCount] = useState<number | null>(null);

  const router = useRouter();

  const setFeedback = (msg: string, type: "info" | "success" | "error" = "info") => {
    setMessage(msg);
    setMessageType(type);
  };

  // 1. Select and validate PDF
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];

    if (!selectedFile) return;

    if (selectedFile.type !== "application/pdf") {
      setFeedback("Please select a valid PDF file.", "error");
      setFile(null);
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setFeedback("PDF must be smaller than 10 MB.", "error");
      setFile(null);
      return;
    }

    setFile(selectedFile);
    setExtractedText("");
    setTopicStructure(null);
    setSavedDocumentId(null);
    setChunkCount(null);
    setCurrentStep(1);
    setFeedback(`Selected "${selectedFile.name}" (${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB). Ready to extract text.`, "success");
  };

  // 2. Extract text from PDF
  const handleExtract = async () => {
    if (!file) {
      setFeedback("Please select a PDF first.", "error");
      return;
    }

    setLoading(true);
    setFeedback("Extracting text with PDF parser...", "info");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "PDF extraction failed.");
      }

      setExtractedText(result.text);
      setPageCount(result.pageCount);
      setCurrentStep(2);
      setFeedback(
        `Extracted ${result.text.length.toLocaleString()} characters across ${result.pageCount} pages. Ready to save document.`,
        "success"
      );
    } catch (error: any) {
      setFeedback(error.message || "Failed to extract PDF text.", "error");
    } finally {
      setLoading(false);
    }
  };

  // 3. Save PDF and metadata to Supabase
  const handleSave = async () => {
    if (!file) {
      setFeedback("Please select a PDF first.", "error");
      return;
    }

    setLoading(true);
    setFeedback("Uploading PDF to Supabase Storage and recording metadata...", "info");

    const supabase = createClient();
    let filePath: string | null = null;

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push("/login");
        return;
      }

      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      filePath = `${user.id}/${Date.now()}-${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("study-materials")
        .upload(filePath, file, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: insertedDocument, error: databaseError } = await supabase
        .from("documents")
        .insert({
          user_id: user.id,
          file_name: file.name,
          storage_path: filePath,
          file_type: "application/pdf",
          file_size: file.size,
          processing_status: "uploaded",
        })
        .select("id")
        .single();

      if (databaseError) throw databaseError;

      if (!insertedDocument) {
        throw new Error("Document record was not returned.");
      }

      setSavedDocumentId(insertedDocument.id);
      setCurrentStep(3);
      setFeedback("PDF stored securely. Next: analyze syllabus and extract topics.", "success");
    } catch (error: any) {
      console.error("Document upload error:", error);
      setFeedback(error.message || "PDF save failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  // 4. Analyze syllabus and save topics
  const handleAnalyze = async () => {
    if (!extractedText || !savedDocumentId) {
      setFeedback("Please extract and save the document before analyzing.", "error");
      return;
    }

    setLoading(true);
    setFeedback("Analyzing academic structure with Groq LLM (subjects, units, topics)...", "info");

    try {
      const response = await fetch("/api/topics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: extractedText.slice(0, 28000), // Protect context limits
          documentId: savedDocumentId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Syllabus analysis failed.");
      }

      setTopicStructure(result.data);
      setCurrentStep(4);
      setFeedback(
        `Identified subject "${result.data?.subject || "Curriculum"}" with ${result.data?.units?.length || 0} modules! Next: generate vector embeddings.`,
        "success"
      );
    } catch (error: any) {
      setFeedback(error.message || "Failed to analyze syllabus.", "error");
    } finally {
      setLoading(false);
    }
  };

  // 5. Generate chunks and Gemini embeddings
  const handleGenerateEmbeddings = async () => {
    if (!extractedText || !savedDocumentId) {
      setFeedback("Please save the PDF first.", "error");
      return;
    }

    setLoading(true);
    setFeedback("Chunking document and generating 768-d Gemini embeddings...", "info");

    try {
      const response = await fetch("/api/chunks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: extractedText,
          documentId: savedDocumentId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Embedding generation failed.");
      }

      setChunkCount(result.chunkCount);
      setCurrentStep(5);
      setFeedback(
        `Successfully generated and indexed ${result.chunkCount} document chunks with Gemini embeddings in pgvector!`,
        "success"
      );
    } catch (error: any) {
      setFeedback(error.message || "Failed to generate embeddings.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <Navbar />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            Upload & Process Study Materials
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Upload course schemes, syllabi, or academic notes to index topics and prepare vector retrieval for AI Q&A and diagnostics.
          </p>
        </div>

        {/* Stepper Card */}
        <div className="mb-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-100 pb-5 dark:border-zinc-800">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Processing Pipeline
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Execute the steps in sequence to index your document.
              </p>
            </div>

            {/* Ready Shortcuts */}
            {savedDocumentId && (
              <div className="flex gap-2">
                <Link
                  href="/chat"
                  className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                >
                  Go to Chat →
                </Link>
                {chunkCount !== null && (
                  <Link
                    href="/quiz"
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition shadow-xs"
                  >
                    Take Quiz →
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Stepper Buttons */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-5">
            {/* Step 1: Select File */}
            <div className={`rounded-xl border p-3.5 transition-all ${
              file ? "border-indigo-500 bg-indigo-50/30 dark:border-indigo-700 dark:bg-indigo-950/20" : "border-zinc-200 dark:border-zinc-800"
            }`}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Step 1</div>
              <div className="mt-1 text-xs font-semibold text-zinc-900 dark:text-zinc-100">Select PDF</div>
              <label className="mt-3 block cursor-pointer rounded-lg bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1.5 text-center text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">
                {file ? "Change" : "Browse..."}
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleUpload}
                  disabled={loading}
                  className="hidden"
                />
              </label>
            </div>

            {/* Step 2: Extract Text */}
            <div className={`rounded-xl border p-3.5 transition-all ${
              extractedText ? "border-indigo-500 bg-indigo-50/30 dark:border-indigo-700 dark:bg-indigo-950/20" : "border-zinc-200 dark:border-zinc-800"
            }`}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Step 2</div>
              <div className="mt-1 text-xs font-semibold text-zinc-900 dark:text-zinc-100">Extract Text</div>
              <button
                type="button"
                onClick={handleExtract}
                disabled={loading || !file || !!extractedText}
                className="mt-3 w-full rounded-lg bg-indigo-600 px-2.5 py-1.5 text-center text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-40 transition"
              >
                {extractedText ? "Extracted ✓" : loading && currentStep === 1 ? "Extracting..." : "Extract"}
              </button>
            </div>

            {/* Step 3: Save PDF */}
            <div className={`rounded-xl border p-3.5 transition-all ${
              savedDocumentId ? "border-indigo-500 bg-indigo-50/30 dark:border-indigo-700 dark:bg-indigo-950/20" : "border-zinc-200 dark:border-zinc-800"
            }`}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Step 3</div>
              <div className="mt-1 text-xs font-semibold text-zinc-900 dark:text-zinc-100">Save Storage</div>
              <button
                type="button"
                onClick={handleSave}
                disabled={loading || !extractedText || !!savedDocumentId}
                className="mt-3 w-full rounded-lg bg-indigo-600 px-2.5 py-1.5 text-center text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-40 transition"
              >
                {savedDocumentId ? "Saved ✓" : loading && currentStep === 2 ? "Saving..." : "Save PDF"}
              </button>
            </div>

            {/* Step 4: Analyze Syllabus */}
            <div className={`rounded-xl border p-3.5 transition-all ${
              topicStructure ? "border-indigo-500 bg-indigo-50/30 dark:border-indigo-700 dark:bg-indigo-950/20" : "border-zinc-200 dark:border-zinc-800"
            }`}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Step 4</div>
              <div className="mt-1 text-xs font-semibold text-zinc-900 dark:text-zinc-100">Analyze Topics</div>
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={loading || !savedDocumentId}
                className="mt-3 w-full rounded-lg bg-indigo-600 px-2.5 py-1.5 text-center text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-40 transition"
              >
                {topicStructure ? "Analyzed ✓" : loading && currentStep === 3 ? "Analyzing..." : "Analyze"}
              </button>
            </div>

            {/* Step 5: Generate Embeddings */}
            <div className={`rounded-xl border p-3.5 transition-all ${
              chunkCount !== null ? "border-indigo-500 bg-indigo-50/30 dark:border-indigo-700 dark:bg-indigo-950/20" : "border-zinc-200 dark:border-zinc-800"
            }`}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Step 5</div>
              <div className="mt-1 text-xs font-semibold text-zinc-900 dark:text-zinc-100">Embeddings</div>
              <button
                type="button"
                onClick={handleGenerateEmbeddings}
                disabled={loading || !savedDocumentId}
                className="mt-3 w-full rounded-lg bg-indigo-600 px-2.5 py-1.5 text-center text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-40 transition"
              >
                {chunkCount !== null ? `${chunkCount} Chunks ✓` : loading && currentStep === 4 ? "Embedding..." : "Embed"}
              </button>
            </div>
          </div>

          {/* Feedback Message */}
          {message && (
            <div className={`mt-5 rounded-xl p-3.5 text-xs font-medium flex items-center gap-2 ${
              messageType === "error"
                ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-900"
                : messageType === "success"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900"
                : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900"
            }`}>
              <span>{message}</span>
            </div>
          )}
        </div>

        {/* Content Previews */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Syllabus Structure Analysis */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 flex flex-col">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-1">
              AI Syllabus Structure
            </h3>
            <p className="text-xs text-zinc-500 mb-4">
              Hierarchical breakdown of subjects, units, and topics.
            </p>

            {topicStructure ? (
              <div className="flex-1 overflow-y-auto max-h-[420px] space-y-4 pr-1">
                <div className="rounded-lg bg-indigo-50/70 p-3 text-xs font-semibold text-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-200">
                  Subject: {topicStructure.subject}
                </div>

                {topicStructure.units?.map((unit: any, uIdx: number) => (
                  <div key={uIdx} className="rounded-xl border border-zinc-200 p-3.5 text-xs dark:border-zinc-800">
                    <h4 className="font-bold text-zinc-900 dark:text-zinc-100">
                      {unit.unit_name}: {unit.unit_title}
                    </h4>

                    {unit.topics?.map((topic: any, tIdx: number) => (
                      <div key={tIdx} className="mt-2.5 pl-3 border-l-2 border-indigo-200 dark:border-indigo-900">
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">{topic.topic_name}</span>
                        {topic.subtopics && topic.subtopics.length > 0 && (
                          <ul className="mt-1 space-y-0.5 text-zinc-500 text-[11px] list-disc list-inside">
                            {topic.subtopics.map((sub: string, sIdx: number) => (
                              <li key={sIdx}>{sub}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                <p className="text-xs text-zinc-400">
                  Run Step 4 to extract and review syllabus topics.
                </p>
              </div>
            )}
          </section>

          {/* Extracted Text Preview */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Extracted Text Preview
              </h3>
              {pageCount && (
                <span className="text-[11px] text-zinc-400 font-medium">
                  {pageCount} Pages
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 mb-4">
              Cleaned raw text parsed from your PDF.
            </p>

            {extractedText ? (
              <pre className="flex-1 overflow-y-auto max-h-[420px] rounded-xl bg-zinc-50 p-4 font-mono text-[11px] text-zinc-700 whitespace-pre-wrap dark:bg-zinc-950 dark:text-zinc-300 border border-zinc-100 dark:border-zinc-800">
                {extractedText.slice(0, 4000)}
                {extractedText.length > 4000 ? "\n\n... [Remaining text indexed for chunks] ..." : ""}
              </pre>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                <p className="text-xs text-zinc-400">
                  Run Step 2 to extract raw text from your document.
                </p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
