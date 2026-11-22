'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useAuth, useClerk } from '@clerk/nextjs';
import { IDLE_STORAGE_KEY, idleState, secondsUntilSignOut } from '@/lib/idleTimeout';

/** Only write the shared timestamp this often; mousemove fires far faster than we need to know. */
const ACTIVITY_WRITE_INTERVAL_MS = 5_000;
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'scroll', 'touchstart', 'click'] as const;

/**
 * Signs a signed-in user out after a period with no activity in any tab (see lib/idleTimeout.ts for the
 * timings and the reasoning), with a warning first. Renders nothing unless the warning is showing.
 */
export default function IdleLogout() {
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Mirrors `secondsLeft !== null` for the event handlers, which must not re-subscribe on every tick.
  const warningVisible = useRef(false);
  const signingOut = useRef(false);

  useEffect(() => {
    if (!isSignedIn) return;

    let memoryFallback = Date.now();
    let lastWrite = 0;

    // localStorage can be blocked or throw (private windows, disabled site data); fall back to this tab only.
    const read = (): number => {
      try {
        const stored = Number(window.localStorage.getItem(IDLE_STORAGE_KEY));
        return Number.isFinite(stored) && stored > 0 ? stored : memoryFallback;
      } catch {
        return memoryFallback;
      }
    };
    const write = (timestamp: number) => {
      memoryFallback = timestamp;
      lastWrite = timestamp;
      try {
        window.localStorage.setItem(IDLE_STORAGE_KEY, String(timestamp));
      } catch {
        /* in-memory fallback above still works for this tab */
      }
    };

    // Loading the page is itself activity. This also discards a stale timestamp left by an earlier session.
    write(Date.now());

    const onActivity = () => {
      // While the warning is up only the explicit button counts, so a stray mouse nudge cannot hide it.
      if (warningVisible.current || signingOut.current) return;
      const now = Date.now();
      if (now - lastWrite >= ACTIVITY_WRITE_INTERVAL_MS) write(now);
    };

    const tick = () => {
      if (signingOut.current) return;
      const now = Date.now();
      const last = read();
      const state = idleState(last, now);

      if (state === 'expired') {
        signingOut.current = true;
        warningVisible.current = false;
        setSecondsLeft(null);
        void signOut({ redirectUrl: '/sign-in?reason=idle' });
      } else if (state === 'warning') {
        warningVisible.current = true;
        setSecondsLeft(secondsUntilSignOut(last, now));
      } else if (warningVisible.current) {
        // Activity in another tab cleared the warning.
        warningVisible.current = false;
        setSecondsLeft(null);
      }
    };

    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, onActivity, { passive: true, capture: true });
    // Timer-based, not a countdown, so it is correct after sleep; the extra triggers catch the wake-up fast.
    const interval = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    window.addEventListener('storage', tick);

    return () => {
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, onActivity, { capture: true });
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
      window.removeEventListener('storage', tick);
      warningVisible.current = false;
    };
  }, [isSignedIn, signOut]);

  const staySignedIn = () => {
    const now = Date.now();
    try {
      window.localStorage.setItem(IDLE_STORAGE_KEY, String(now));
    } catch {
      /* ignore: the effect's in-memory copy is refreshed by the next activity event */
    }
    warningVisible.current = false;
    setSecondsLeft(null);
  };

  const signOutNow = () => {
    signingOut.current = true;
    setSecondsLeft(null);
    void signOut({ redirectUrl: '/sign-in' });
  };

  if (!isSignedIn || secondsLeft === null) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="idle-title"
        aria-describedby="idle-desc"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl"
      >
        <h2 id="idle-title" className="text-lg font-bold text-white">
          Still there?
        </h2>
        <p id="idle-desc" className="mt-2 text-sm leading-relaxed text-slate-300">
          To keep your classrooms and learner information safe, you will be signed out in{' '}
          <strong className="tabular-nums text-white">
            {minutes}:{seconds}
          </strong>{' '}
          because there has been no activity. Your saved work is not lost.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={signOutNow}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/5"
          >
            Sign out now
          </button>
          <button
            type="button"
            autoFocus
            onClick={staySignedIn}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500"
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  );
}
