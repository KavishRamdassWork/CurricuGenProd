import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import Link from 'next/link';

/**
 * Root page: if not logged in, show a landing page with sign-in link.
 * If logged in, redirect to /dashboard.
 */
export default async function RootPage() {
  const { userId } = await auth();
  if (userId) redirect('/dashboard');

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col items-center justify-center p-8 text-center">
      <div className="max-w-3xl mx-auto">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-3xl mb-8 shadow-2xl shadow-blue-900/50">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>



        <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight mb-6 leading-none">
          CurricuGen<span className="text-blue-400"> Pro</span>
        </h1>

        <p className="text-xl text-slate-400 mb-4 max-w-2xl mx-auto leading-relaxed">
          The AI-powered curriculum engine built for teachers. Generate lesson plans, worksheets, tests, and assessments — in seconds.
        </p>

        <div className="flex flex-wrap gap-3 justify-center text-sm text-slate-400 mb-12">
          {['Lesson Plans', 'Worksheets', 'Formal Tests', 'Answer Keys', 'Slides', 'Games', 'Images', 'Assignments'].map(f => (
            <span key={f} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full">{f}</span>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/sign-up" className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-xl shadow-blue-900/30 transition-all hover:-translate-y-1 text-lg">
            Start Free — 10 Daily Generations
          </Link>
          <Link href="/sign-in" className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl transition-all hover:-translate-y-1 text-lg">
            Sign In
          </Link>
        </div>

        <div className="text-slate-500 text-sm mt-8 space-y-3">
          <p>No credit card required. Free plan includes 10 AI generations per day.</p>
          <p className="flex items-center justify-center gap-1.5 opacity-60">
            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
            Powered by Google Gemini AI
          </p>
        </div>
      </div>
    </main>
  );
}
