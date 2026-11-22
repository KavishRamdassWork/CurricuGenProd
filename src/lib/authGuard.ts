/**
 * Shared auth + credit guard for all /api/generate/* routes.
 * Returns the DB user if they are authorized to generate content.
 * Throws with a NextResponse on failure.
 */
import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import buildRateLimit from '@/lib/rateLimit';
import { reserveGenerationCredit, refundGenerationCredit, reserveImageCredit, refundImageCredit } from '@/lib/generationCredits';
import { ensureDbUser, type ClerkProfile } from '@/lib/ensureUser';
import { lapseExpiredPro } from '@/lib/proExpiry';
import { effectivePlan } from '@/lib/plans';
import { generationDisabled } from '@/lib/generationErrors';

// Separate limiters: a shared one made text generations eat into the (stricter) image budget.
const limiter = buildRateLimit({ uniqueTokenPerInterval: 5000, interval: 60000 });
const imageLimiter = buildRateLimit({ uniqueTokenPerInterval: 5000, interval: 60000 });

/** Profile used when the row has to be created before the Clerk webhook has arrived. */
async function clerkProfile(clerkId: string): Promise<ClerkProfile> {
  try {
    const user = await currentUser();
    if (user && user.id === clerkId) {
      return {
        clerkId,
        email: user.emailAddresses?.[0]?.emailAddress,
        name: [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
        imageUrl: user.imageUrl,
      };
    }
  } catch (error) {
    console.error('Could not load Clerk profile for new user:', error);
  }
  return { clerkId };
}

export type GuardResult =
  | { ok: true; dbUser: { id: string; plan: string; generationsLeft: number; imagesLeft?: number } }
  | { ok: false; response: NextResponse };

/** Kill-switch response (AI_GENERATION_DISABLED=true), returned before anything is reserved. */
function disabledResponse(): GuardResult {
  return {
    ok: false,
    response: NextResponse.json(
      { error: 'Generation is temporarily unavailable.', code: 'GENERATION_DISABLED' },
      { status: 503 }
    ),
  };
}

export async function requireGenerationAccess(): Promise<GuardResult> {
  if (generationDisabled()) return disabledResponse();

  const { userId } = await auth();

  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized — please sign in.' }, { status: 401 }),
    };
  }

  try {
    // 10 generations per minute per user
    await limiter.check(10, userId);
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 }),
    };
  }

  // A cancelled subscription keeps Pro to the end of the paid period; downgrade once that has passed.
  await lapseExpiredPro({ clerkId: userId });

  let dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, plan: true, generationsLeft: true, email: true, name: true },
  });

  // Auto-create user if not yet in DB (webhook race condition)
  if (!dbUser) {
    dbUser = await ensureDbUser(await clerkProfile(userId), {
      id: true, plan: true, generationsLeft: true, email: true, name: true,
    });
  }

  // The plan that applies on this request: PRO, or BETA while the email is on BETA_TESTER_EMAILS.
  const plan = effectivePlan(dbUser.plan, dbUser.email);

  // Reserve the credit now, atomically, for every plan (see generationCredits.ts). Routes pass
  // failures to handleGenerationError(), which refunds it unless the request itself was blocked.
  const remaining = await reserveGenerationCredit(dbUser.id, plan);

  if (remaining === null) {
    const body = plan === 'FREE'
      ? { error: 'Daily free generation limit reached. Come back tomorrow or upgrade to Pro for a much higher daily limit.', code: 'LIMIT_REACHED' }
      : { error: "You have reached today's fair-use limit. It resets tomorrow.", code: 'FAIR_USE_LIMIT' };
    return { ok: false, response: NextResponse.json(body, { status: 402 }) };
  }

  // Routes see the effective plan, not the stored one.
  return { ok: true, dbUser: { ...dbUser, plan, generationsLeft: remaining } };
}

/**
 * Return the credit reserved by requireGenerationAccess() when the generation failed. Every plan
 * reserves, so every plan is refunded; `plan` is kept only for call-site compatibility.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function refundGeneration(userId: string, plan?: string) {
  await refundGenerationCredit(userId);
}

/**
 * Auth + rate limit + atomic image-credit reservation. The credit is taken here, before the image is
 * generated; routes must call refundImage() if generation then fails so a failed request costs nothing.
 */
export async function requireImageAccess(): Promise<GuardResult> {
  if (generationDisabled()) return disabledResponse();

  const { userId } = await auth();

  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized — please sign in.' }, { status: 401 }),
    };
  }

  try {
    // Rate limit: max 3 image generation attempts per minute per user
    await imageLimiter.check(3, userId);
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 }),
    };
  }

  await lapseExpiredPro({ clerkId: userId });

  let dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, plan: true, email: true },
  });

  if (!dbUser) {
    dbUser = await ensureDbUser(await clerkProfile(userId), { id: true, plan: true, email: true });
  }

  const plan = effectivePlan(dbUser.plan, dbUser.email);
  const remaining = await reserveImageCredit(dbUser.id, plan);
  if (remaining === null) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Daily image limit reached. Come back tomorrow or upgrade to Pro.',
          code: 'IMAGE_LIMIT_REACHED',
        },
        { status: 402 }
      ),
    };
  }

  return { ok: true, dbUser: { id: dbUser.id, plan, generationsLeft: 0, imagesLeft: remaining } };
}

/** Return the credit reserved by requireImageAccess() when the image could not be generated. */
export async function refundImage(userId: string, plan: string) {
  await refundImageCredit(userId, plan);
}
