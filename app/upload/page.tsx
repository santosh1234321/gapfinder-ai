
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [topicStructure, setTopicStructure] = useState<any>(null);
  const [savedDocumentId, setSavedDocumentId] = useState<string | null>(null);
  const [chunkCount, setChunkCount] = useState<number | null>(null);

  const router = useRouter();

  // Select and validate PDF
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];

    if (!selectedFile) return;

    if (selectedFile.type !== "application/pdf") {
      setMessage("Please select a PDF file.");
      setFile(null);
      setExtractedText("");
      setTopicStructure(null);
      setSavedDocumentId(null);
      setChunkCount(null);
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setMessage("PDF must be smaller than 10 MB.");
      setFile(null);
      setExtractedText("");
      setTopicStructure(null);
      setSavedDocumentId(null);
      setChunkCount(null);
      return;
    }

    setFile(selectedFile);
    setExtractedText("");
    setTopicStructure(null);
    setSavedDocumentId(null);
    setChunkCount(null);
    setMessage("PDF selected successfully!");
  };

  // Extract text from PDF
  const handleExtract = async () => {
    if (!file) {
      setMessage("Please select a PDF first.");
      return;
    }

    setLoading(true);
    setMessage("Extracting text...");

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
      setTopicStructure(null);
      setChunkCount(null);

      setMessage(
        `Successfully extracted text from ${result.pageCount} pages.`
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  };

  // Save PDF and metadata to Supabase
  const handleSave = async () => {
    if (!file) {
      setMessage("Please select a PDF first.");
      return;
    }

    setLoading(true);
    setMessage("Checking authentication...");

    const supabase = createClient();
    let filePath: string | null = null;

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        router.push("/login");
        return;
      }

      const safeFileName = file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );

      filePath = `${user.id}/${Date.now()}-${safeFileName}`;

      setMessage("Uploading PDF to Supabase Storage...");

      const { error: uploadError } = await supabase.storage
        .from("study-materials")
        .upload(filePath, file, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      setMessage("Saving document details...");

      const { data: insertedDocument, error: databaseError } =
        await supabase
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
      setMessage("PDF and document details successfully saved!");
    } catch (error) {
      console.error("Document upload error:", error);

      if (filePath) {
        const { data: existingDocument } = await supabase
          .from("documents")
          .select("id")
          .eq("storage_path", filePath)
          .maybeSingle();

        if (!existingDocument) {
          await supabase.storage
            .from("study-materials")
            .remove([filePath]);
        }
      }

      setMessage(
        error instanceof Error
          ? `Upload failed: ${error.message}`
          : "PDF upload failed."
      );
    } finally {
      setLoading(false);
    }
  };

  // Analyze syllabus and save topics
  const handleAnalyze = async () => {
    if (!extractedText) {
      setMessage("Please extract PDF text first.");
      return;
    }

    if (!savedDocumentId) {
      setMessage("Please save the PDF before analyzing it.");
      return;
    }

    setLoading(true);
    setMessage("AI is analyzing and saving your syllabus topics...");

    try {
      const response = await fetch("/api/topics", {
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
        throw new Error(result.error || "Syllabus analysis failed.");
      }

      setTopicStructure(result.data);
      setMessage("Syllabus analyzed and topics successfully saved!");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to analyze syllabus."
      );
    } finally {
      setLoading(false);
    }
  };

  // Generate chunks and Gemini embeddings
  const handleGenerateEmbeddings = async () => {
    if (!extractedText) {
      setMessage("Please extract PDF text first.");
      return;
    }

    if (!savedDocumentId) {
      setMessage("Please save the PDF before generating embeddings.");
      return;
    }

    setLoading(true);
    setMessage("Splitting document into chunks and generating Gemini embeddings...");

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

      setMessage(
        `Successfully generated and saved ${result.chunkCount} document chunks with Gemini embeddings!`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to generate embeddings."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <h1>Upload Study Material</h1>

      <p>
        Upload your syllabus, notes, or previous question papers.
      </p>

      <input
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleUpload}
        disabled={loading}
      />

      {file && <p>Selected file: {file.name}</p>}

      {file && (
        <>
          <button
            type="button"
            onClick={handleExtract}
            disabled={loading}
          >
            {loading ? "Processing..." : "Extract Text"}
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={loading || !!savedDocumentId}
          >
            {savedDocumentId
              ? "PDF Saved"
              : loading
                ? "Processing..."
                : "Save PDF"}
          </button>
        </>
      )}

      {extractedText && (
        <>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={loading || !savedDocumentId}
          >
            {loading ? "Processing..." : "Analyze Syllabus"}
          </button>

          <button
            type="button"
            onClick={handleGenerateEmbeddings}
            disabled={loading || !savedDocumentId}
          >
            {chunkCount !== null
              ? "Regenerate Embeddings"
              : loading
                ? "Processing..."
                : "Generate Embeddings"}
          </button>
        </>
      )}

      {message && <p>{message}</p>}

      {chunkCount !== null && (
        <p>
          Stored chunks: {chunkCount}
        </p>
      )}

      {extractedText && (
        <section>
          <h2>Extracted Text Preview</h2>

          <pre style={{ whiteSpace: "pre-wrap" }}>
            {extractedText.slice(0, 5000)}
          </pre>
        </section>
      )}

      {topicStructure && (
        <section>
          <h2>AI Syllabus Analysis</h2>

          <h3>Subject: {topicStructure.subject}</h3>

          {topicStructure.units.map((unit: any, index: number) => (
            <div key={index}>
              <h3>
                {unit.unit_name}: {unit.unit_title}
              </h3>

              {unit.topics.map((topic: any, topicIndex: number) => (
                <div key={topicIndex}>
                  <strong>{topic.topic_name}</strong>

                  <ul>
                    {topic.subtopics.map(
                      (subtopic: string, subIndex: number) => (
                        <li key={subIndex}>{subtopic}</li>
                      )
                    )}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
