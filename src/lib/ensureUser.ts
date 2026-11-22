/**
 * Find-or-create the DB row for a Clerk user.
 *
 * Several paths can create a user at the same moment (the Clerk `user.created` webhook, the first
 * /api/user/me call, the first generation request). All of them go through an upsert keyed on the
 * unique `clerkId`, so whichever lands second just reads the row the first one wrote instead of
 * failing with a unique-constraint error.
 *
 * `email` is also unique, so a missing email must never be stored as '' (two such users would
 * collide). A per-user placeholder keeps the constraint satisfied until the webhook's
 * `user.updated`/`user.created` supplies the real address.
 */
import { prisma } from '@/lib/prisma';
import { Plan } from '@prisma/client';

export function placeholderEmail(clerkId: string): string {
  return `${clerkId}@pending.invalid`;
}

export function resolvePlanForEmail(email: string | null | undefined): Plan {
  if (!email) return 'FREE';
  const betaEmails = (process.env.BETA_TESTER_EMAILS || '')
    .toLowerCase()
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
  return betaEmails.includes(email.toLowerCase()) ? 'BETA' : 'FREE';
}

export interface ClerkProfile {
  clerkId: string;
  email?: string | null;
  name?: string | null;
  imageUrl?: string | null;
}

export async function ensureDbUser<S extends Record<string, boolean>>(profile: ClerkProfile, select: S) {
  const email = profile.email || placeholderEmail(profile.clerkId);
  return prisma.user.upsert({
    where: { clerkId: profile.clerkId },
    // Existing rows are left untouched here: the webhook owns profile updates.
    update: {},
    create: {
      clerkId: profile.clerkId,
      email,
      name: profile.name || null,
      imageUrl: profile.imageUrl || null,
      plan: resolvePlanForEmail(profile.email),
      generationsLeft: 10,
      imagesLeft: 1,
      lastGenerationDate: new Date(),
    },
    select,
  });
}
