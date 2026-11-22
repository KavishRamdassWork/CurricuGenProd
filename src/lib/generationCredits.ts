/**
 * Free-plan generation credits.
 *
 * A credit is *reserved* before the AI call and *refunded* if the call fails. Each step is a single
 * conditional UPDATE, so the database - not the application - decides who gets the last credit.
 * The old flow (read the balance, call the AI, decrement afterwards) let parallel requests all pass
 * the check before any decrement landed.
 *
 * Kept free of Clerk/Next imports so it can be tested directly against a database.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const FREE_DAILY_GENERATIONS = 10;

/** Midnight (server local time) of the day containing `now`; matches the old toDateString() day boundary. */
function startOfDay(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Atomically take one credit from a FREE user. Returns the credits remaining, or null when none are left.
 *
 * 1. New day: reset the counter. The WHERE clause only matches while `lastGenerationDate` is still
 *    before today, so when several requests race across midnight exactly one of them performs the
 *    reset (the others see the stamp it wrote and skip it - otherwise a late reset would overwrite
 *    a decrement that had already landed).
 * 2. Take a credit only while `generationsLeft > 0`. Prisma's `update` with a non-unique filter
 *    throws P2025 when nothing matches, which is how "no credits left" is reported here.
 */
export async function reserveGenerationCredit(userId: string, now: Date = new Date()): Promise<number | null> {
  await prisma.user.updateMany({
    where: {
      id: userId,
      plan: 'FREE',
      OR: [{ lastGenerationDate: null }, { lastGenerationDate: { lt: startOfDay(now) } }],
    },
    data: { generationsLeft: FREE_DAILY_GENERATIONS, lastGenerationDate: now },
  });

  try {
    const updated = await prisma.user.update({
      where: { id: userId, plan: 'FREE', generationsLeft: { gt: 0 } },
      data: { generationsLeft: { decrement: 1 }, lastGenerationDate: now },
      select: { generationsLeft: true },
    });
    return updated.generationsLeft;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') return null;
    throw error;
  }
}

/**
 * Give back a reserved credit after a failed generation. Capped at the daily allowance so a refund
 * that lands after the midnight reset can never push a user above it. Never throws: a failed refund
 * must not turn into a second error on top of the generation failure the caller is already handling.
 */
export async function refundGenerationCredit(userId: string): Promise<void> {
  try {
    await prisma.user.updateMany({
      where: { id: userId, plan: 'FREE', generationsLeft: { lt: FREE_DAILY_GENERATIONS } },
      data: { generationsLeft: { increment: 1 } },
    });
  } catch (error) {
    console.error('Failed to refund generation credit:', error);
  }
}
