"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/app/components/navbar";
import { createClient } from "@/lib/supabase/client";

interface DocumentRecord {
  id: string;
  file_name: string;
  file_size: number;
  processing_status: string;
  created_at: string;
  subjects?: { name: string }[];
}

export default function DashboardPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchDashboardData = async () => {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setEmail(user.email ?? "");

      // Fetch user's uploaded documents with associated subjects
      const { data: docs } = await supabase
        .from("documents")
        .select(`
          id,
          file_name,
          file_size,
          processing_status,
          created_at,
          subjects (name)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (docs) {
        setDocuments(docs as any);
      }

      setLoading(false);
    };

    fetchDashboardData();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-zinc-500 text-sm">
            <svg className="animate-spin h-5 w-5 text-indigo-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Loading your dashboard...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <Navbar />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <div className="mb-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                Academic Knowledge Assistant
              </span>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
                Welcome back!
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Signed in as <span className="font-medium text-zinc-700 dark:text-zinc-300">{email}</span>
              </p>
            </div>

            <div className="flex gap-3">
              <Link
                href="/upload"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Upload Material
              </Link>
            </div>
          </div>
        </div>

        {/* Action Cards */}
        <div className="mb-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Link
            href="/upload"
            className="group relative rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs transition hover:border-indigo-400 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-600"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 mb-4 group-hover:scale-105 transition-transform">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Upload Study Materials
            </h2>
            <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Upload your syllabus or curriculum scheme PDF for automated text extraction, topic indexing, and vector embeddings.
            </p>
            <span className="mt-4 inline-flex items-center text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:underline">
              Go to Upload →
            </span>
          </Link>

          <Link
            href="/chat"
            className="group relative rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs transition hover:border-indigo-400 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-600"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 mb-4 group-hover:scale-105 transition-transform">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              AI Study Assistant
            </h2>
            <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Ask questions about course codes, prerequisites, credits, and syllabus topics with strict source citations.
            </p>
            <span className="mt-4 inline-flex items-center text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:underline">
              Start Chatting →
            </span>
          </Link>

          <Link
            href="/quiz"
            className="group relative rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs transition hover:border-indigo-400 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-600"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400 mb-4 group-hover:scale-105 transition-transform">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Diagnostic Assessment
            </h2>
            <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Take a 5-question multiple choice quiz to pinpoint weak areas and receive personalized revision recommendations.
            </p>
            <span className="mt-4 inline-flex items-center text-xs font-semibold text-purple-600 dark:text-purple-400 group-hover:underline">
              Take Assessment →
            </span>
          </Link>
        </div>

        {/* Uploaded Materials Table */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                Uploaded Study Materials
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Your syllabus documents and curriculum schemes stored in Supabase.
              </p>
            </div>
            <Link
              href="/upload"
              className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
            >
              + Add New
            </Link>
          </div>

          {documents.length > 0 ? (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {documents.map((doc) => {
                const subject = doc.subjects?.[0]?.name;
                const formattedDate = new Date(doc.created_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                });
                const sizeInMb = (doc.file_size / (1024 * 1024)).toFixed(2);

                return (
                  <div
                    key={doc.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {doc.file_name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {subject && (
                            <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                              Subject: {subject}
                            </span>
                          )}
                          <span className="text-[11px] text-zinc-400">
                            {sizeInMb} MB • Uploaded {formattedDate}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href="/chat"
                        className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition"
                      >
                        Ask AI
                      </Link>
                      <Link
                        href="/quiz"
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition shadow-xs"
                      >
                        Take Quiz
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No study materials uploaded yet.
              </p>
              <Link
                href="/upload"
                className="mt-3 inline-block rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition"
              >
                Upload your first syllabus
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
