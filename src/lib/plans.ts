/**
 * Plan resolution and daily generation limits.
 *
 * Beta access is decided per request from the BETA_TESTER_EMAILS env list; the database `plan` column
 * is never changed for beta. The env list is the source of truth, so adding an email grants beta on
 * the next request and removing it revokes beta on the next request, for new and existing accounts.
 *
 * Pure (no database or framework imports) so it can be tested directly.
 */

export type EffectivePlan = 'FREE' | 'BETA' | 'PRO';

export const DAILY_GENERATION_LIMITS: Record<EffectivePlan, number> = {
  FREE: 10,
  BETA: 200,
  PRO: 300,
};

const PLACEHOLDER_EMAIL_SUFFIX = '@pending.invalid';

/** Comma-separated env list -> trimmed, lower-cased, non-empty entries. */
export function betaEmails(env: string | undefined = process.env.BETA_TESTER_EMAILS): string[] {
  return (env || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * The plan that applies right now. PRO is PRO. Otherwise the user is BETA only while their email is on
 * the env list (placeholder emails never count), whatever the stored plan says.
 */
export function effectivePlan(
  dbPlan: string,
  email: string | null | undefined,
  env: string | undefined = process.env.BETA_TESTER_EMAILS,
): EffectivePlan {
  if (dbPlan === 'PRO') return 'PRO';
  const normalised = (email || '').trim().toLowerCase();
  if (!normalised || normalised.endsWith(PLACEHOLDER_EMAIL_SUFFIX)) return 'FREE';
  return betaEmails(env).includes(normalised) ? 'BETA' : 'FREE';
}

/** Midnight (server local time) of the day containing `now`. */
export function startOfDay(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Generations left today: the whole limit if none were used today, otherwise limit minus used (floored at 0). */
export function generationsRemaining(
  plan: EffectivePlan,
  usedToday: number,
  lastGenerationDate: Date | null,
  now: Date = new Date(),
): number {
  const limit = DAILY_GENERATION_LIMITS[plan];
  if (!lastGenerationDate || lastGenerationDate < startOfDay(now)) return limit;
  return Math.max(0, limit - usedToday);
}
