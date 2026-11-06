import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-100 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-lg shadow-sm">
              G
            </div>
            <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              GapFinder <span className="text-indigo-600 dark:text-indigo-400">AI</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white transition"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 sm:py-28 border-b border-zinc-100 dark:border-zinc-800">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/60 px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300 mb-6">
            <span className="flex h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
            AI-Powered Academic Gap Discovery & Revision
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-6xl dark:text-zinc-50">
            Stop Guessing What to Revise. <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">
              Pinpoint Your Learning Gaps.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed">
            GapFinder AI transforms complex college syllabi, course schemes, and study notes into structured topics, grounded AI explanations, and diagnostic quizzes to reveal exactly what you know and what you need to study next.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="w-full sm:w-auto rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 transition flex items-center justify-center gap-2"
            >
              Start Assessing Gaps Free
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>

            <Link
              href="/dashboard"
              className="w-full sm:w-auto rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-6 py-3.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
            >
              Open Dashboard
            </Link>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-500 dark:text-zinc-400">
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-500 font-bold">✓</span> PDF Text & Topic Extraction
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-500 font-bold">✓</span> Grounded RAG with Excerpts
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-500 font-bold">✓</span> 5-Question Diagnostic Assessments
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-500 font-bold">✓</span> Personalized Revision Plans
            </div>
          </div>
        </div>
      </section>

      {/* Why Identify Academic Gaps */}
      <section className="py-16 sm:py-24 bg-zinc-50/50 dark:bg-zinc-900/30 border-b border-zinc-100 dark:border-zinc-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              The Problem With Traditional Study
            </h2>
            <h3 className="mt-2 text-2xl font-bold text-zinc-900 sm:text-3xl dark:text-zinc-50">
              Why Generic Chatbots Fail Students
            </h3>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              Generic LLMs hallucinate syllabus regulations, fabricate credit formulas, and produce endless walls of text without assessing what the student actually understands. GapFinder AI is engineered specifically for curriculum mastery.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="rounded-2xl border border-zinc-200 bg-white p-7 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400 font-bold text-sm mb-4">
                1
              </div>
              <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100">The Illusion of Competence</h4>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Rereading notes feels productive, but passive reading conceals blind spots. You only discover what you didn't know when the exam arrives.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-7 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 font-bold text-sm mb-4">
                2
              </div>
              <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Strict Source Grounding</h4>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                GapFinder AI grounds every response exclusively in your uploaded course scheme, preserving exact course codes, credits, and prerequisites.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-7 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 font-bold text-sm mb-4">
                3
              </div>
              <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Actionable Gap Action Plans</h4>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Diagnostic quizzes separate verified knowledge from gaps, generating an immediate priority revision list tailored to your weak points.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 sm:py-24 border-b border-zinc-100 dark:border-zinc-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Workflow
            </h2>
            <h3 className="mt-2 text-2xl font-bold text-zinc-900 sm:text-3xl dark:text-zinc-50">
              How GapFinder AI Works in 4 Steps
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Step 1</span>
              <h4 className="mt-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Upload Material</h4>
              <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
                Upload your syllabus, curriculum scheme, or lecture PDF with instant text parsing.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Step 2</span>
              <h4 className="mt-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">AI Topic Analysis</h4>
              <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
                Groq analyzes academic hierarchy into modules, units, subjects, and vector chunks.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Step 3</span>
              <h4 className="mt-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Grounded Q&A</h4>
              <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
                Ask questions and receive verifiable answers cited with real document excerpts.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Step 4</span>
              <h4 className="mt-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Diagnostic Assessment</h4>
              <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
                Take a 5-Q multiple-choice diagnostic to calculate scores and target weak areas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-indigo-600 text-white text-center">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="text-3xl font-extrabold sm:text-4xl tracking-tight">
            Ready to find your academic gaps?
          </h2>
          <p className="mt-4 text-sm sm:text-base text-indigo-100 max-w-xl mx-auto">
            Create your account now and start studying smarter with grounded AI assistance.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link
              href="/register"
              className="rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-indigo-600 shadow-md hover:bg-indigo-50 transition"
            >
              Create Free Account
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-indigo-400 px-6 py-3.5 text-sm font-semibold text-white hover:bg-indigo-700 transition"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-zinc-100 py-8 dark:border-zinc-800 text-center text-xs text-zinc-400">
        <p>© 2026 GapFinder AI. Engineered for intelligent academic gap identification.</p>
      </footer>
    </div>
  );
}
