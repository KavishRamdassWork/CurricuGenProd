'use client';

import { useEffect } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Global unhandled error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-center space-y-8 font-sans">
      <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center shadow-[0_0_50px_-12px_rgba(239,68,68,0.3)]">
        <AlertTriangle className="w-12 h-12 text-red-500" />
      </div>
      
      <div className="max-w-md space-y-3">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Something went wrong!</h1>
        <p className="text-slate-400">
          We encountered an unexpected error. Please try refreshing or return to the dashboard.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
        <button
          onClick={() => reset()}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
        <button
          onClick={() => window.location.href = '/dashboard'}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-colors border border-slate-700"
        >
          <Home className="w-4 h-4" /> Go Home
        </button>
      </div>
    </div>
  );
}
