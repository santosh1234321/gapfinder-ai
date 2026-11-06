"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/app/components/navbar";
import { createClient } from "@/lib/supabase/client";

interface QuestionOption {
  A: string;
  B: string;
  C: string;
  D: string;
}

interface Question {
  id: string;
  question: string;
  topic_id: string;
  topic_name: string;
  unit_name: string;
  options: QuestionOption;
  correct_answer: "A" | "B" | "C" | "D";
  explanation: string;
}

interface DocumentItem {
  id: string;
  file_name: string;
}

interface GapAnalysisResult {
  score: number;
  total: number;
  percentage: number;
  strongTopics: string[];
  weakTopics: string[];
  recommendations: string[];
}

export default function QuizPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjectName, setSubjectName] = useState<string>("");
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, "A" | "B" | "C" | "D">>({});
  const [submitted, setSubmitted] = useState(false);
  const [gapResult, setGapResult] = useState<GapAnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: docs } = await supabase
        .from("documents")
        .select("id, file_name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (docs && docs.length > 0) {
        setDocuments(docs);
        setSelectedDocId(docs[0].id);
      }
      setInitialLoading(false);
    };

    init();
  }, [router]);

  const handleGenerateQuiz = async () => {
    if (!selectedDocId) {
      setErrorMessage("Please select a study material document first.");
      return;
    }

    setGenerating(true);
    setErrorMessage("");
    setQuestions([]);
    setSelectedAnswers({});
    setSubmitted(false);
    setGapResult(null);

    try {
      const res = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: selectedDocId,
          questionCount: 5,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate diagnostic quiz.");
      }

      if (!data.questions || data.questions.length === 0) {
        throw new Error("No questions were generated for this material.");
      }

      setQuestions(data.questions);
      setSubjectName(data.subject || "Academic Material");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to generate quiz.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectOption = (questionId: string, option: "A" | "B" | "C" | "D") => {
    if (submitted) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: option,
    }));
  };

  const handleSubmitQuiz = () => {
    if (Object.keys(selectedAnswers).length < questions.length) {
      if (!confirm("You have unanswered questions. Do you still want to submit?")) {
        return;
      }
    }

    let score = 0;
    const strongTopicsSet = new Set<string>();
    const weakTopicsSet = new Set<string>();

    questions.forEach((q) => {
      const isCorrect = selectedAnswers[q.id] === q.correct_answer;
      if (isCorrect) {
        score += 1;
        strongTopicsSet.add(q.topic_name || q.unit_name);
      } else {
        weakTopicsSet.add(q.topic_name || q.unit_name);
      }
    });

    const total = questions.length;
    const percentage = Math.round((score / total) * 100);

    // Filter out topics from strongTopics if they had any mistake
    const weakTopics = Array.from(weakTopicsSet);
    const strongTopics = Array.from(strongTopicsSet).filter((t) => !weakTopicsSet.has(t));

    // Generate personalized revision recommendations
    const recommendations: string[] = [];
    if (weakTopics.length > 0) {
      recommendations.push(
        `Focus revision on priority gaps: ${weakTopics.slice(0, 3).join(", ")}.`
      );
      recommendations.push(
        "Open the AI Assistant to ask specific questions about the course codes, prerequisites, and concepts missed."
      );
    } else {
      recommendations.push(
        "Excellent mastery! All diagnostic questions answered correctly on this document."
      );
      recommendations.push(
        "Proceed to explore advanced electives or review adjacent semester modules in your curriculum."
      );
    }

    recommendations.push(
      "Retake this 5-question diagnostic after revision to measure retention."
    );

    setGapResult({
      score,
      total,
      percentage,
      strongTopics,
      weakTopics,
      recommendations,
    });
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-zinc-500">Loading diagnostic assessments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <Navbar />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Diagnostic Knowledge Assessment
            </h1>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              5 targeted multiple-choice questions to identify academic knowledge gaps.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {documents.length > 0 ? (
              <>
                <select
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  disabled={generating}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.file_name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleGenerateQuiz}
                  disabled={generating}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-2"
                >
                  {generating ? (
                    <>
                      <div className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      Generating Quiz...
                    </>
                  ) : (
                    "Generate 5-Q Quiz"
                  )}
                </button>
              </>
            ) : (
              <Link
                href="/upload"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition"
              >
                + Upload Material First
              </Link>
            )}
          </div>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
            {errorMessage}
          </div>
        )}

        {/* Results & Gap Analysis Summary */}
        {submitted && gapResult && (
          <div className="mb-8 space-y-6 animate-fadeIn">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-md dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-100 pb-5 dark:border-zinc-800">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    Diagnostic Results
                  </span>
                  <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mt-0.5">
                    Score: {gapResult.score} / {gapResult.total} ({gapResult.percentage}%)
                  </h2>
                  <p className="text-xs text-zinc-500 mt-1">
                    Document: <span className="font-medium text-zinc-700 dark:text-zinc-300">{subjectName}</span>
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleGenerateQuiz}
                    className="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition shadow-sm"
                  >
                    Retake / New Questions
                  </button>
                  <Link
                    href="/chat"
                    className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                  >
                    Revise in Chat →
                  </Link>
                </div>
              </div>

              {/* Gap Breakdown: Strong vs Weak Areas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-950 dark:bg-emerald-950/20">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400 font-semibold text-sm mb-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Demonstrated Understanding ({gapResult.strongTopics.length})</span>
                  </div>
                  {gapResult.strongTopics.length > 0 ? (
                    <ul className="space-y-1 text-xs text-emerald-900 dark:text-emerald-300 list-disc list-inside">
                      {gapResult.strongTopics.map((t, idx) => (
                        <li key={idx} className="font-medium">{t}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-zinc-500">None identified in this run. Review all sections below.</p>
                  )}
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-950 dark:bg-amber-950/20">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400 font-semibold text-sm mb-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Knowledge Gaps Identified ({gapResult.weakTopics.length})</span>
                  </div>
                  {gapResult.weakTopics.length > 0 ? (
                    <ul className="space-y-1 text-xs text-amber-900 dark:text-amber-300 list-disc list-inside">
                      {gapResult.weakTopics.map((t, idx) => (
                        <li key={idx} className="font-medium">{t}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-zinc-500">No knowledge gaps detected for these questions!</p>
                  )}
                </div>
              </div>

              {/* Revision Recommendations */}
              <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4.5 dark:border-indigo-950 dark:bg-indigo-950/20">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 mb-2">
                  Personalized Revision Action Plan
                </h3>
                <ul className="space-y-2 text-xs text-zinc-700 dark:text-zinc-300">
                  {gapResult.recommendations.map((rec, rIdx) => (
                    <li key={rIdx} className="flex items-start gap-2">
                      <span className="text-indigo-600 font-bold">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Questions List */}
        {questions.length > 0 ? (
          <div className="space-y-6">
            {questions.map((q, idx) => {
              const selected = selectedAnswers[q.id];
              const isSubmitted = submitted;
              const isCorrect = selected === q.correct_answer;

              return (
                <div
                  key={q.id}
                  className={`rounded-2xl border p-6 transition-all ${
                    isSubmitted
                      ? isCorrect
                        ? "border-emerald-300 bg-emerald-50/20 dark:border-emerald-900/60 dark:bg-emerald-950/10"
                        : "border-red-300 bg-red-50/20 dark:border-red-900/60 dark:bg-red-950/10"
                      : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="inline-block rounded-md bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      Question {idx + 1} of {questions.length}
                    </span>
                    <span className="text-xs font-medium text-zinc-500 truncate max-w-[280px]">
                      {q.topic_name}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 leading-snug">
                    {q.question}
                  </h3>

                  <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {(["A", "B", "C", "D"] as const).map((optKey) => {
                      const optionText = q.options[optKey];
                      const isOptionSelected = selected === optKey;
                      const isOptionCorrect = q.correct_answer === optKey;

                      let btnStyle = "border-zinc-200 hover:border-indigo-400 dark:border-zinc-800";
                      if (isSubmitted) {
                        if (isOptionCorrect) {
                          btnStyle = "border-emerald-500 bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200 font-semibold";
                        } else if (isOptionSelected && !isOptionCorrect) {
                          btnStyle = "border-red-500 bg-red-100 text-red-900 dark:bg-red-950/80 dark:text-red-200 line-through";
                        } else {
                          btnStyle = "border-zinc-200 opacity-60 dark:border-zinc-800";
                        }
                      } else if (isOptionSelected) {
                        btnStyle = "border-indigo-600 bg-indigo-50 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200 font-semibold ring-1 ring-indigo-600";
                      }

                      return (
                        <button
                          key={optKey}
                          type="button"
                          disabled={submitted}
                          onClick={() => handleSelectOption(q.id, optKey)}
                          className={`flex items-start gap-3 rounded-xl border p-3 text-left text-xs transition-all ${btnStyle}`}
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 font-bold text-zinc-800 text-[10px] dark:bg-zinc-700 dark:text-zinc-200">
                            {optKey}
                          </span>
                          <span className="flex-1 leading-relaxed">{optionText}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Explanation after submission */}
                  {isSubmitted && (
                    <div className="mt-4 rounded-xl bg-zinc-100 p-3.5 text-xs text-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        Explanation:{" "}
                      </span>
                      {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}

            {!submitted && (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleSubmitQuiz}
                  className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-500"
                >
                  Submit Diagnostic Answers ({Object.keys(selectedAnswers).length}/{questions.length} answered)
                </button>
              </div>
            )}
          </div>
        ) : (
          !generating && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 mb-3">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Ready to Assess Your Learning?
              </h3>
              <p className="mt-1 max-w-sm text-xs text-zinc-500 dark:text-zinc-400">
                Select your uploaded syllabus or curriculum scheme above and click <strong>Generate 5-Q Quiz</strong>.
              </p>
            </div>
          )
        )}
      </main>
    </div>
  );
}
