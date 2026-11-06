"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/app/components/navbar";
import { createClient } from "@/lib/supabase/client";

interface Subtopic {
  id: string;
  topic_name: string;
  position: number;
}

interface Topic {
  id: string;
  topic_name: string;
  position: number;
  subtopics: Subtopic[];
}

interface Unit {
  id: string;
  unit_name: string;
  unit_title: string;
  position: number;
  topics: Topic[];
}

interface Subject {
  id: string;
  name: string;
  units: Unit[];
}

interface DocumentItem {
  id: string;
  file_name: string;
}

export default function TopicMapPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchingData, setFetchingData] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({});
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});

  // 1. Initial auth check & document loading
  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

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

      setLoading(false);
    };

    init();
  }, [router]);

  // 2. Fetch subjects, units, and topics for the selected document
  useEffect(() => {
    if (!selectedDocId) {
      setSubjects([]);
      return;
    }

    const loadHierarchy = async () => {
      setFetchingData(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // Fetch subjects for this document
      const { data: rawSubjects } = await supabase
        .from("subjects")
        .select("id, name")
        .eq("document_id", selectedDocId)
        .eq("user_id", user.id);

      if (!rawSubjects || rawSubjects.length === 0) {
        setSubjects([]);
        setFetchingData(false);
        return;
      }

      const subjectIds = rawSubjects.map((s) => s.id);

      // Fetch units for these subjects
      const { data: rawUnits } = await supabase
        .from("syllabus_units")
        .select("id, subject_id, unit_name, unit_title, position")
        .in("subject_id", subjectIds)
        .eq("user_id", user.id)
        .order("position", { ascending: true });

      const unitIds = rawUnits ? rawUnits.map((u) => u.id) : [];

      // Fetch topics and subtopics for these units
      let rawTopics: any[] = [];
      if (unitIds.length > 0) {
        const { data: topicsData } = await supabase
          .from("syllabus_topics")
          .select("id, unit_id, topic_name, position, parent_topic_id")
          .in("unit_id", unitIds)
          .eq("user_id", user.id)
          .order("position", { ascending: true });

        if (topicsData) {
          rawTopics = topicsData;
        }
      }

      // Build hierarchy
      const initialUnitsExpanded: Record<string, boolean> = {};
      const initialSubjectsExpanded: Record<string, boolean> = {};

      const hierarchy: Subject[] = rawSubjects.map((subj) => {
        initialSubjectsExpanded[subj.id] = true;

        const subjectUnits = (rawUnits || [])
          .filter((u) => u.subject_id === subj.id)
          .map((unit) => {
            initialUnitsExpanded[unit.id] = true;

            const unitTopics = rawTopics.filter(
              (t) => t.unit_id === unit.id && t.parent_topic_id === null
            );

            const topicsWithSubtopics: Topic[] = unitTopics.map((topic) => {
              const subtopics = rawTopics
                .filter((t) => t.parent_topic_id === topic.id)
                .map((sub) => ({
                  id: sub.id,
                  topic_name: sub.topic_name,
                  position: sub.position,
                }));

              return {
                id: topic.id,
                topic_name: topic.topic_name,
                position: topic.position,
                subtopics,
              };
            });

            return {
              id: unit.id,
              unit_name: unit.unit_name,
              unit_title: unit.unit_title,
              position: unit.position,
              topics: topicsWithSubtopics,
            };
          });

        return {
          id: subj.id,
          name: subj.name,
          units: subjectUnits,
        };
      });

      setSubjects(hierarchy);
      setExpandedUnits(initialUnitsExpanded);
      setExpandedSubjects(initialSubjectsExpanded);
      setFetchingData(false);
    };

    loadHierarchy();
  }, [selectedDocId]);

  // Compute counts
  const counts = useMemo(() => {
    let subjectCount = subjects.length;
    let unitCount = 0;
    let topicCount = 0;
    let subtopicCount = 0;

    subjects.forEach((subj) => {
      unitCount += subj.units.length;
      subj.units.forEach((unit) => {
        topicCount += unit.topics.length;
        unit.topics.forEach((t) => {
          subtopicCount += t.subtopics.length;
        });
      });
    });

    return { subjectCount, unitCount, topicCount, subtopicCount };
  }, [subjects]);

  // Filter hierarchy based on search query
  const filteredSubjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return subjects;

    return subjects
      .map((subj) => {
        const matchingUnits = subj.units
          .map((unit) => {
            const unitMatches =
              unit.unit_name.toLowerCase().includes(q) ||
              unit.unit_title.toLowerCase().includes(q);

            const matchingTopics = unit.topics
              .map((topic) => {
                const topicMatches = topic.topic_name.toLowerCase().includes(q);
                const matchingSubtopics = topic.subtopics.filter((sub) =>
                  sub.topic_name.toLowerCase().includes(q)
                );

                if (topicMatches || matchingSubtopics.length > 0 || unitMatches) {
                  return {
                    ...topic,
                    subtopics: topicMatches ? topic.subtopics : matchingSubtopics,
                  };
                }
                return null;
              })
              .filter(Boolean) as Topic[];

            if (unitMatches || matchingTopics.length > 0) {
              return {
                ...unit,
                topics: matchingTopics,
              };
            }
            return null;
          })
          .filter(Boolean) as Unit[];

        if (matchingUnits.length > 0 || subj.name.toLowerCase().includes(q)) {
          return {
            ...subj,
            units: matchingUnits,
          };
        }
        return null;
      })
      .filter(Boolean) as Subject[];
  }, [subjects, searchQuery]);

  // Expand / Collapse Toggles
  const toggleUnit = (unitId: string) => {
    setExpandedUnits((prev) => ({
      ...prev,
      [unitId]: !prev[unitId],
    }));
  };

  const toggleSubject = (subjectId: string) => {
    setExpandedSubjects((prev) => ({
      ...prev,
      [subjectId]: !prev[subjectId],
    }));
  };

  const expandAll = () => {
    const allUnits: Record<string, boolean> = {};
    const allSubjects: Record<string, boolean> = {};
    subjects.forEach((s) => {
      allSubjects[s.id] = true;
      s.units.forEach((u) => {
        allUnits[u.id] = true;
      });
    });
    setExpandedUnits(allUnits);
    setExpandedSubjects(allSubjects);
  };

  const collapseAll = () => {
    setExpandedUnits({});
    setExpandedSubjects({});
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-zinc-500 text-sm">
            <svg
              className="animate-spin h-5 w-5 text-indigo-600"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8z"
              />
            </svg>
            Loading Topic Map...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <Navbar />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {/* Header Section */}
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 mb-2">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Curriculum Knowledge Architecture
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Interactive Topic Map
            </h1>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Explore your syllabus decomposition across subjects, units, modules, and subtopics.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {documents.length > 0 ? (
              <div className="flex items-center gap-2">
                <label
                  htmlFor="docSelect"
                  className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                >
                  Material:
                </label>
                <select
                  id="docSelect"
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 shadow-xs focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.file_name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <Link
                href="/upload"
                className="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition shadow-xs"
              >
                + Upload Study Material
              </Link>
            )}
          </div>
        </div>

        {/* Metric Counts Bar */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Subjects
            </span>
            <div className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {counts.subjectCount}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Units / Modules
            </span>
            <div className="mt-1 text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {counts.unitCount}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Core Topics
            </span>
            <div className="mt-1 text-2xl font-bold text-purple-600 dark:text-purple-400">
              {counts.topicCount}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Subtopics & Skills
            </span>
            <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {counts.subtopicCount}
            </div>
          </div>
        </div>

        {/* Search & Tree Controls */}
        <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <svg
              className="absolute left-3.5 top-3 h-4 w-4 text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search topics, units, or subtopics..."
              className="w-full rounded-xl border border-zinc-300 bg-white pl-10 pr-9 py-2.5 text-xs text-zinc-900 shadow-xs focus:border-indigo-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 text-xs font-bold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={expandAll}
              className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* Tree Content View */}
        {fetchingData ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900 shadow-xs">
            <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
              <div className="h-2 w-2 rounded-full bg-indigo-600 animate-ping" />
              Loading curriculum structure...
            </div>
          </div>
        ) : filteredSubjects.length > 0 ? (
          <div className="space-y-6">
            {filteredSubjects.map((subject) => {
              const isSubjExpanded = expandedSubjects[subject.id] !== false;

              return (
                <div
                  key={subject.id}
                  className="rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden"
                >
                  {/* Subject Header */}
                  <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/70 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-800/40">
                    <button
                      onClick={() => toggleSubject(subject.id)}
                      className="flex items-center gap-3 text-left focus:outline-none"
                    >
                      <svg
                        className={`h-4 w-4 text-zinc-400 transition-transform ${
                          isSubjExpanded ? "rotate-90" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                          Subject
                        </span>
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                          {subject.name}
                        </h2>
                      </div>
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-indigo-100/80 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300">
                        {subject.units.length} Unit{subject.units.length !== 1 ? "s" : ""}
                      </span>
                      <Link
                        href="/chat"
                        className="hidden sm:inline-flex rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                      >
                        Ask in Chat →
                      </Link>
                    </div>
                  </div>

                  {/* Units Tree */}
                  {isSubjExpanded && (
                    <div className="p-6 space-y-4">
                      {subject.units.length > 0 ? (
                        subject.units.map((unit) => {
                          const isUnitExpanded = expandedUnits[unit.id] !== false;

                          return (
                            <div
                              key={unit.id}
                              className="rounded-xl border border-zinc-200/90 dark:border-zinc-800/90 overflow-hidden bg-white dark:bg-zinc-900/60"
                            >
                              {/* Unit Header */}
                              <div
                                onClick={() => toggleUnit(unit.id)}
                                className="flex cursor-pointer items-center justify-between bg-zinc-50/50 hover:bg-zinc-100/60 dark:bg-zinc-800/30 dark:hover:bg-zinc-800/60 px-5 py-3.5 transition"
                              >
                                <div className="flex items-center gap-3">
                                  <svg
                                    className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${
                                      isUnitExpanded ? "rotate-90" : ""
                                    }`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                      d="M9 5l7 7-7 7"
                                    />
                                  </svg>
                                  <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                    {unit.unit_name}
                                  </span>
                                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                    {unit.unit_title || "Course Section"}
                                  </span>
                                </div>

                                <div className="flex items-center gap-3">
                                  <span className="text-[11px] font-medium text-zinc-400">
                                    {unit.topics.length} Topic{unit.topics.length !== 1 ? "s" : ""}
                                  </span>
                                </div>
                              </div>

                              {/* Topics & Subtopics List */}
                              {isUnitExpanded && (
                                <div className="p-5 divide-y divide-zinc-100 dark:divide-zinc-800/60">
                                  {unit.topics.length > 0 ? (
                                    unit.topics.map((topic, tIdx) => (
                                      <div
                                        key={topic.id}
                                        className={`py-3 ${tIdx === 0 ? "pt-1" : ""} ${
                                          tIdx === unit.topics.length - 1 ? "pb-1" : ""
                                        }`}
                                      >
                                        <div className="flex items-start justify-between gap-4">
                                          <div className="flex items-start gap-2.5">
                                            <div className="mt-1 h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
                                            <div>
                                              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                                                {topic.topic_name}
                                              </span>

                                              {/* Subtopic Pills */}
                                              {topic.subtopics.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1.5 pl-0.5">
                                                  {topic.subtopics.map((sub) => (
                                                    <span
                                                      key={sub.id}
                                                      className="rounded-md border border-zinc-200/80 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-300"
                                                    >
                                                      {sub.topic_name}
                                                    </span>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-1.5 shrink-0">
                                            <Link
                                              href="/quiz"
                                              className="rounded-md bg-zinc-100 hover:bg-zinc-200 px-2 py-1 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 transition"
                                            >
                                              Quiz
                                            </Link>
                                          </div>
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="py-3 text-center text-xs text-zinc-400 italic">
                                      No specific subtopics extracted for this unit.
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-6 text-center text-xs text-zinc-400">
                          No units recorded for this subject.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900/50 shadow-xs">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 mb-3">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            {searchQuery ? (
              <>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  No Matching Topics Found
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  No topics or units matched &ldquo;{searchQuery}&rdquo;. Try another term.
                </p>
                <button
                  onClick={() => setSearchQuery("")}
                  className="mt-3 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  Clear search
                </button>
              </>
            ) : (
              <>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  No Syllabus Analysis Available
                </h3>
                <p className="mt-1 max-w-sm text-xs text-zinc-500">
                  This document has not been analyzed yet. Head over to <strong>Study Materials</strong> and run Step 4 (Analyze Topics).
                </p>
                <Link
                  href="/upload"
                  className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition shadow-xs"
                >
                  Go to Study Materials →
                </Link>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
