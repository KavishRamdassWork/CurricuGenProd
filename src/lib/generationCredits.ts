/**
 * Daily generation credits, per effective plan (FREE 10, BETA 200, PRO 300 - see src/lib/plans.ts).
 *
 * A credit is *reserved* before the AI call and *refunded* if the call fails. Each step is a single
 * conditional UPDATE, so the database - not the application - decides who gets the last credit.
 * The old flow (read the balance, call the AI, decrement afterwards) let parallel requests all pass
 * the check before any decrement landed.
 *
 * Usage is stored as a count *up* (`generationsUsedToday`) and compared against the ceiling of the
 * plan that applies on this request, so a plan change (for example beta granted by env list) takes
 * effect immediately without rewriting any stored balance.
 *
 * Kept free of Clerk/Next imports so it can be tested directly against a database.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { DAILY_GENERATION_LIMITS, startOfDay, type EffectivePlan } from '@/lib/plans';

export const FREE_DAILY_GENERATIONS = DAILY_GENERATION_LIMITS.FREE;

/**
 * Atomically take one generation credit under `plan`'s daily ceiling. Returns the credits remaining
 * after this one, or null when the ceiling is already reached.
 *
 * 1. New day: reset the counter. The WHERE clause only matches while `lastGenerationDate` is still
 *    before today, so when several requests race across midnight exactly one of them performs the
 *    reset (the others see the stamp it wrote and skip it - otherwise a late reset would wipe an
 *    increment that had already landed).
 * 2. Take a credit only while `generationsUsedToday < limit`. Prisma's `update` with a non-unique
 *    filter throws P2025 when nothing matches, which is how "ceiling reached" is reported here.
 */
export async function reserveGenerationCredit(
  userId: string,
  plan: EffectivePlan,
  now: Date = new Date(),
): Promise<number | null> {
  const limit = DAILY_GENERATION_LIMITS[plan];

  await prisma.user.updateMany({
    where: {
      id: userId,
      OR: [{ lastGenerationDate: null }, { lastGenerationDate: { lt: startOfDay(now) } }],
    },
    data: { generationsUsedToday: 0, lastGenerationDate: now },
  });

  try {
    const updated = await prisma.user.update({
      where: { id: userId, generationsUsedToday: { lt: limit } },
      data: { generationsUsedToday: { increment: 1 }, lastGenerationDate: now },
      select: { generationsUsedToday: true },
    });
    return limit - updated.generationsUsedToday;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') return null;
    throw error;
  }
}

/**
 * Give back a reserved credit after a failed generation. Only decrements while the counter is above
 * zero, so a refund that lands after the midnight reset can never push it negative. Never throws: a
 * failed refund must not turn into a second error on top of the generation failure the caller is
 * already handling.
 */
export async function refundGenerationCredit(userId: string): Promise<void> {
  try {
    await prisma.user.updateMany({
      where: { id: userId, generationsUsedToday: { gt: 0 } },
      data: { generationsUsedToday: { decrement: 1 } },
    });
  } catch (error) {
    console.error('Failed to refund generation credit:', error);
  }
}

// ─── Image credits ──────────────────────────────────────────────────────────
// Same reserve-then-refund design as text generations: the old flow read the balance, generated the
// image, then decremented, so parallel requests could all pass the check.

/** Daily image allowance per plan. */
export const IMAGE_LIMITS: Record<string, number> = { FREE: 1, PRO: 10, BETA: 10 };

export function dailyImageLimit(plan: string): number {
  return IMAGE_LIMITS[plan] ?? 1;
}

/**
 * Atomically take one image credit. Returns the credits remaining, or null when none are left.
 * A new day resets the balance to the plan's allowance; only one racing request performs the reset
 * (the WHERE clause stops matching once `lastImageDate` is today).
 */
export async function reserveImageCredit(userId: string, plan: string, now: Date = new Date()): Promise<number | null> {
  const limit = dailyImageLimit(plan);

  await prisma.user.updateMany({
    where: {
      id: userId,
      OR: [{ lastImageDate: null }, { lastImageDate: { lt: startOfDay(now) } }],
    },
    data: { imagesLeft: limit, lastImageDate: now },
  });

  try {
    const updated = await prisma.user.update({
      where: { id: userId, imagesLeft: { gt: 0 } },
      data: { imagesLeft: { decrement: 1 }, lastImageDate: now },
      select: { imagesLeft: true },
    });
    return updated.imagesLeft;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') return null;
    throw error;
  }
}

/** Give back a reserved image credit after a failed generation. Capped at the plan allowance; never throws. */
export async function refundImageCredit(userId: string, plan: string): Promise<void> {
  try {
    await prisma.user.updateMany({
      where: { id: userId, imagesLeft: { lt: dailyImageLimit(plan) } },
      data: { imagesLeft: { increment: 1 } },
    });
  } catch (error) {
    console.error('Failed to refund image credit:', error);
  }
}
