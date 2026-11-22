import { test, expect } from '@playwright/test';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { classifyGenerationError, generationDisabled, handleGenerationError } from '../../src/lib/generationErrors';
import { MAX_CAPPED_REFUNDS_PER_DAY, reserveGenerationCredit } from '../../src/lib/generationCredits';
import { ContentBlockedError, MalformedOutputError } from '../../src/lib/outputScreen';

function zodError(): unknown {
  try {
    z.object({ a: z.string() }).parse({ a: 1 });
  } catch (error) {
    return error;
  }
  throw new Error('expected parse to fail');
}

test.describe('classifyGenerationError', () => {
  test('Zod validation error -> 400, refund', () => {
    const result = classifyGenerationError(zodError());
    expect(result.status).toBe(400);
    expect(result.body.error).toBe('Invalid request data.');
    expect(result.refund).toBe(true);
    expect(result.blockedReason).toBeUndefined();
  });

  test('ContentBlockedError SAFETY -> 422 CONTENT_BLOCKED, no refund', () => {
    const result = classifyGenerationError(new ContentBlockedError('SAFETY'));
    expect(result.status).toBe(422);
    expect(result.body.code).toBe('CONTENT_BLOCKED');
    expect(result.body.error).toMatch(/rephras/i);
    expect(result.body.error).toMatch(/classroom/i);
    expect(result.refund).toBe(false);
    expect(result.blockedReason).toBe('SAFETY');
  });

  test('ContentBlockedError LEAK -> 422 CONTENT_BLOCKED, no refund, no leak detail', () => {
    const result = classifyGenerationError(new ContentBlockedError('LEAK'));
    expect(result.status).toBe(422);
    expect(result.body.code).toBe('CONTENT_BLOCKED');
    expect(result.refund).toBe(false);
    expect(result.blockedReason).toBe('LEAK');
    expect(result.body.error).not.toContain('LEAK');
  });

  test('MalformedOutputError -> 500 unusable result, refund', () => {
    const result = classifyGenerationError(new MalformedOutputError('missing heading X'));
    expect(result.status).toBe(500);
    expect(result.body.error).toBe('Generation produced an unusable result. Please try again.');
    expect(result.body.error).not.toContain('missing heading X');
    expect(result.refund).toBe(true);
  });

  test('unknown error -> 500 generic, refund, raw message never returned', () => {
    const result = classifyGenerationError(new Error('secret db detail'));
    expect(result.status).toBe(500);
    expect(result.body.error).toBe('Generation failed. Please try again.');
    expect(result.body.error).not.toContain('secret db detail');
    expect(result.refund).toBe(true);
    expect(result.body.code).toBeUndefined();
  });

  test('refundCapped: only malformed/truncated output is a capped refund', () => {
    expect(classifyGenerationError(new MalformedOutputError()).refundCapped).toBe(true);
    expect(classifyGenerationError(new MalformedOutputError('Model output was truncated')).refundCapped).toBe(true);
    expect(classifyGenerationError(zodError()).refundCapped).toBe(false);
    expect(classifyGenerationError(new Error('x')).refundCapped).toBe(false);
    expect(classifyGenerationError('x').refundCapped).toBe(false);
    const blocked = classifyGenerationError(new ContentBlockedError('SAFETY'));
    expect(blocked.refund).toBe(false);
    expect(blocked.refundCapped).toBe(false);
  });

  test('non-Error thrown values are treated as generic failures', () => {
    for (const value of ['secret db detail', null, undefined, 42, { message: 'secret db detail' }]) {
      const result = classifyGenerationError(value);
      expect(result.status).toBe(500);
      expect(result.body.error).toBe('Generation failed. Please try again.');
      expect(result.refund).toBe(true);
    }
  });
});

test.describe('generationDisabled', () => {
  test('true only when AI_GENERATION_DISABLED is "true"', () => {
    const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;
    expect(generationDisabled(env({ AI_GENERATION_DISABLED: 'true' }))).toBe(true);
    expect(generationDisabled(env({ AI_GENERATION_DISABLED: 'false' }))).toBe(false);
    expect(generationDisabled(env({}))).toBe(false);
  });
});

/**
 * handleGenerationError against a real local database: the response a route returns and what happens to
 * the reserved credit. Skips itself unless DATABASE_URL is local (same guard as generation-credits.spec.ts).
 */
const dbUrl = process.env.DATABASE_URL ?? '';
const isLocalDb = /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(dbUrl);

test.describe('handleGenerationError (DB-backed)', () => {
  test.skip(!isLocalDb, 'DATABASE_URL must point at a local test database');

  const prisma = new PrismaClient();
  const createdIds: string[] = [];
  const logged: string[] = [];
  const originalWarn = console.warn;
  const originalError = console.error;

  test.beforeEach(() => {
    logged.length = 0;
    console.warn = (...args: unknown[]) => void logged.push(args.map(String).join(' '));
    console.error = (...args: unknown[]) => void logged.push(args.map(String).join(' '));
  });

  test.afterEach(() => {
    console.warn = originalWarn;
    console.error = originalError;
  });

  test.afterAll(async () => {
    if (createdIds.length) await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.$disconnect();
  });

  /** A user who has just had one credit reserved (as requireGenerationAccess does). */
  async function userWithReservation(usedBefore = 3) {
    const id = `errors_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const user = await prisma.user.create({
      data: { clerkId: id, email: `${id}@errors.test`, generationsUsedToday: usedBefore, lastGenerationDate: new Date() },
    });
    createdIds.push(user.id);
    expect(await reserveGenerationCredit(user.id, 'FREE')).not.toBeNull();
    return user;
  }

  const used = async (id: string) => (await prisma.user.findUniqueOrThrow({ where: { id } })).generationsUsedToday;

  test('ContentBlockedError: 422 CONTENT_BLOCKED and the credit stays spent', async () => {
    const user = await userWithReservation();
    const res = await handleGenerationError(new ContentBlockedError('LEAK'), user, 'worksheet');
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe('CONTENT_BLOCKED');
    expect(JSON.stringify(body)).not.toContain('LEAK');
    expect(await used(user.id)).toBe(4);
    expect(logged).toHaveLength(1);
    expect(JSON.parse(logged[0])).toEqual({ event: 'content_blocked', route: 'worksheet', userId: user.id, reason: 'LEAK' });
  });

  test('MalformedOutputError: 500 and a capped refund; the 6th in a day keeps its credit', async () => {
    const user = await userWithReservation(0);
    for (let i = 0; i < MAX_CAPPED_REFUNDS_PER_DAY; i++) {
      if (i > 0) expect(await reserveGenerationCredit(user.id, 'FREE')).not.toBeNull();
      const res = await handleGenerationError(new MalformedOutputError('Missing section: X'), user, 'lesson-plan');
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe('Generation produced an unusable result. Please try again.');
      expect(JSON.stringify(body)).not.toContain('Missing section');
      expect(await used(user.id)).toBe(0);
    }

    expect(await reserveGenerationCredit(user.id, 'FREE')).not.toBeNull();
    const sixth = await handleGenerationError(new MalformedOutputError('Model output was truncated'), user, 'worksheet');
    expect(sixth.status).toBe(500);
    expect(await used(user.id)).toBe(1);
    // Logs carry the error class only, never its message.
    for (const line of logged) {
      expect(line).not.toContain('Missing section');
      expect(line).not.toContain('truncated');
    }
  });

  test('generic Error: 500 generic body, uncapped refund even after the capped allowance is used up', async () => {
    const user = await userWithReservation();
    await prisma.user.update({ where: { id: user.id }, data: { generationRefundsToday: MAX_CAPPED_REFUNDS_PER_DAY } });
    const res = await handleGenerationError(new Error('connection to db-host:5432 refused'), user, 'memo');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'Generation failed. Please try again.' });
    expect(await used(user.id)).toBe(3);
    expect(logged.join('\n')).not.toContain('db-host');
  });

  test('ZodError: 400 with an (uncapped) refund', async () => {
    const user = await userWithReservation();
    await prisma.user.update({ where: { id: user.id }, data: { generationRefundsToday: MAX_CAPPED_REFUNDS_PER_DAY } });
    const res = await handleGenerationError(zodError(), user, 'refine');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid request data.' });
    expect(await used(user.id)).toBe(3);
  });
});
