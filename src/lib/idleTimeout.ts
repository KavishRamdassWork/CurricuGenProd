/**
 * Idle sign-out policy. Pure functions only (no React, no browser APIs) so the timing rules can be
 * unit-tested; the UI lives in components/IdleLogout.tsx.
 *
 * Why client-side: Clerk's own inactivity timeout counts an open tab as active because the SDK keeps
 * refreshing its token, so it would not sign out a teacher who walked away from a shared school
 * computer. A timer on real user input (mouse, keyboard, touch, scroll) does.
 */

/** Sign the user out after this long with no activity in any tab. */
export const IDLE_TIMEOUT_MS = 60 * 60 * 1000;

/** Warn this long before signing out, so unsaved work and a deliberate "stay signed in" are possible. */
export const IDLE_WARNING_MS = 2 * 60 * 1000;

/** localStorage key holding the last-activity timestamp (ms), shared by every open tab. */
export const IDLE_STORAGE_KEY = 'cg:lastActivity';

export type IdleState = 'active' | 'warning' | 'expired';

/**
 * Where the user is in the idle countdown. Based on timestamps rather than a running counter so it stays
 * correct when the laptop sleeps or a background tab's timers are throttled: on wake, a long gap
 * immediately reads as 'expired'.
 */
export function idleState(lastActivityMs: number, nowMs: number): IdleState {
  const idle = nowMs - lastActivityMs;
  if (idle >= IDLE_TIMEOUT_MS) return 'expired';
  if (idle >= IDLE_TIMEOUT_MS - IDLE_WARNING_MS) return 'warning';
  return 'active';
}

/** Whole seconds left before sign-out (never negative). */
export function secondsUntilSignOut(lastActivityMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((lastActivityMs + IDLE_TIMEOUT_MS - nowMs) / 1000));
}
