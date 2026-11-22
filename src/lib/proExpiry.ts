/**
 * Keeps Pro access running to the end of the paid period after a subscription is cancelled.
 *
 * PayFast tells us about a cancellation immediately, but the customer has paid for the whole month.
 * The webhook therefore schedules the end (`User.proExpiresAt`) instead of downgrading on the spot,
 * and `lapseExpiredPro` performs the downgrade once that moment has passed.
 *
 * Kept free of Clerk/Next imports so it can be tested directly against a database.
 */
import { prisma } from '@/lib/prisma';

/** `date` plus `months` calendar months, clamped to month end (31 Jan + 1 month = 28/29 Feb, not 3 Mar). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const daysInTarget = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, daysInTarget));
  return d;
}

/**
 * Return a user whose scheduled Pro end has passed to the FREE plan. One conditional UPDATE, so it is
 * cheap to call on every request that reads the plan and safe to race. No-op for everyone else.
 */
export async function lapseExpiredPro(where: { id: string } | { clerkId: string }, now: Date = new Date()): Promise<void> {
  await prisma.user.updateMany({
    where: { ...where, plan: 'PRO', proExpiresAt: { not: null, lte: now } },
    data: { plan: 'FREE', proExpiresAt: null },
  });
}
