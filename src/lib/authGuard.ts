/**
 * Shared auth + credit guard for all /api/generate/* routes.
 * Returns the DB user if they are authorized to generate content.
 * Throws with a NextResponse on failure.
 */
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import buildRateLimit from '@/lib/rateLimit';

const limiter = buildRateLimit({
  uniqueTokenPerInterval: 500,
  interval: 60000,
});

export type GuardResult =
  | { ok: true; dbUser: { id: string; plan: string; generationsLeft: number; imagesLeft?: number } }
  | { ok: false; response: NextResponse };

export async function requireGenerationAccess(): Promise<GuardResult> {
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

  let dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, plan: true, generationsLeft: true, lastGenerationDate: true, email: true, name: true },
  });

  // Auto-create user if not yet in DB (webhook race condition)
  if (!dbUser) {
    dbUser = await prisma.user.create({
      data: { clerkId: userId, email: '', plan: 'FREE', generationsLeft: 10, lastGenerationDate: new Date() },
      select: { id: true, plan: true, generationsLeft: true, lastGenerationDate: true, email: true, name: true },
    });
  }

  if (dbUser.plan === 'FREE') {
    const today = new Date().toDateString();
    const lastGen = dbUser.lastGenerationDate?.toDateString();

    if (lastGen !== today) {
      // Reset because it's a new day
      dbUser = await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          generationsLeft: 10,
          lastGenerationDate: new Date(),
        },
        select: { id: true, plan: true, generationsLeft: true, lastGenerationDate: true, email: true, name: true },
      });
    }

    if (dbUser.generationsLeft <= 0) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Daily free generation limit reached. Come back tomorrow or upgrade to Pro for unlimited generations.', code: 'LIMIT_REACHED' },
          { status: 402 }
        ),
      };
    }
  }

  return { ok: true, dbUser };
}

/** Decrement generation credit (only for FREE plan) */
export async function consumeGeneration(userId: string, plan: string) {
  if (plan === 'FREE') {
    await prisma.user.update({
      where: { id: userId },
      data: {
        generationsLeft: { decrement: 1 },
        lastGenerationDate: new Date()
      },
    });
  }
}

const IMAGE_LIMITS: Record<string, number> = { FREE: 1, PRO: 10, BETA: 10 };

export async function requireImageAccess(): Promise<GuardResult> {
  const { userId } = await auth();

  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized — please sign in.' }, { status: 401 }),
    };
  }

  try {
    // Rate limit: max 3 image generation attempts per minute per user
    await limiter.check(3, userId);
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 }),
    };
  }

  let dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, plan: true, imagesLeft: true, lastImageDate: true },
  });

  if (!dbUser) {
    dbUser = await prisma.user.create({
      data: {
        clerkId: userId,
        email: '',
        plan: 'FREE',
        generationsLeft: 10,
        imagesLeft: 1,
        lastGenerationDate: new Date(),
        lastImageDate: new Date(),
      },
      select: { id: true, plan: true, imagesLeft: true, lastImageDate: true },
    });
  }

  const dailyLimit = IMAGE_LIMITS[dbUser.plan] ?? 1;
  const today = new Date().toDateString();
  const lastImage = dbUser.lastImageDate?.toDateString();

  if (lastImage !== today) {
    dbUser = await prisma.user.update({
      where: { id: dbUser.id },
      data: { imagesLeft: dailyLimit, lastImageDate: new Date() },
      select: { id: true, plan: true, imagesLeft: true, lastImageDate: true },
    });
  }

  if (dbUser.imagesLeft <= 0) {
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

  return { ok: true, dbUser: { id: dbUser.id, plan: dbUser.plan, generationsLeft: 0, imagesLeft: dbUser.imagesLeft } };
}

export async function consumeImageGeneration(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      imagesLeft: { decrement: 1 },
      lastImageDate: new Date(),
    },
  });
}
