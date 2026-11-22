import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import {
  reserveGenerationCredit,
  refundGenerationCredit,
  reserveImageCredit,
  refundImageCredit,
  FREE_DAILY_GENERATIONS,
} from '../../src/lib/generationCredits';
import { DAILY_GENERATION_LIMITS } from '../../src/lib/plans';

/**
 * Concurrency tests for per-plan credit accounting. They hit a real Postgres on purpose: the guarantee
 * being tested is that the database decides who gets the last credit, which a mock cannot show.
 *
 * Runs only against a local database (see .env.test.example). It skips itself on anything else so it
 * can never write to a hosted/shared database by accident.
 */
const dbUrl = process.env.DATABASE_URL ?? '';
const isLocalDb = /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(dbUrl);

test.describe('Per-plan generation credits', () => {
  test.skip(!isLocalDb, 'DATABASE_URL must point at a local test database');

  const prisma = new PrismaClient();
  const createdIds: string[] = [];

  async function makeUser(data: { generationsUsedToday: number; lastGenerationDate: Date | null; plan?: 'FREE' | 'PRO' }) {
    const id = `credits_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const user = await prisma.user.create({
      data: { clerkId: id, email: `${id}@credits.test`, plan: data.plan ?? 'FREE', generationsUsedToday: data.generationsUsedToday, lastGenerationDate: data.lastGenerationDate },
    });
    createdIds.push(user.id);
    return user;
  }

  /** Generations used today, as stored. */
  const used = async (id: string) => (await prisma.user.findUniqueOrThrow({ where: { id } })).generationsUsedToday;

  test.afterAll(async () => {
    if (createdIds.length) await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.$disconnect();
  });

  test('parallel requests can never take more credits than the FREE allowance', async () => {
    const user = await makeUser({ generationsUsedToday: 0, lastGenerationDate: new Date() });

    const results = await Promise.all(Array.from({ length: 15 }, () => reserveGenerationCredit(user.id, 'FREE')));

    expect(results.filter(r => r !== null)).toHaveLength(FREE_DAILY_GENERATIONS);
    expect(await used(user.id)).toBe(FREE_DAILY_GENERATIONS);
  });

  test('reports the remaining balance and refuses once the ceiling is reached', async () => {
    const user = await makeUser({ generationsUsedToday: 8, lastGenerationDate: new Date() });

    expect(await reserveGenerationCredit(user.id, 'FREE')).toBe(1);
    expect(await reserveGenerationCredit(user.id, 'FREE')).toBe(0);
    expect(await reserveGenerationCredit(user.id, 'FREE')).toBeNull();
    expect(await used(user.id)).toBe(FREE_DAILY_GENERATIONS); // never above the ceiling
  });

  test('requests racing across midnight reset the allowance exactly once', async () => {
    const yesterday = new Date(Date.now() - 36 * 60 * 60 * 1000);
    const user = await makeUser({ generationsUsedToday: FREE_DAILY_GENERATIONS, lastGenerationDate: yesterday });

    const results = await Promise.all(Array.from({ length: 25 }, () => reserveGenerationCredit(user.id, 'FREE')));

    // A reset that ran twice would wipe increments already taken and hand out extra credits.
    expect(results.filter(r => r !== null)).toHaveLength(FREE_DAILY_GENERATIONS);
    expect(await used(user.id)).toBe(FREE_DAILY_GENERATIONS);
  });

  test('a first-ever request (no previous date) starts a fresh allowance', async () => {
    const user = await makeUser({ generationsUsedToday: 7, lastGenerationDate: null });

    expect(await reserveGenerationCredit(user.id, 'FREE')).toBe(FREE_DAILY_GENERATIONS - 1);
    expect(await used(user.id)).toBe(1);
  });

  test('BETA ceiling is 200: the last credit is granted once, then refused', async () => {
    const user = await makeUser({ generationsUsedToday: DAILY_GENERATION_LIMITS.BETA - 1, lastGenerationDate: new Date() });

    expect(await reserveGenerationCredit(user.id, 'BETA')).toBe(0);
    expect(await reserveGenerationCredit(user.id, 'BETA')).toBeNull();
    expect(await used(user.id)).toBe(DAILY_GENERATION_LIMITS.BETA);
  });

  test('PRO ceiling is 300: the last credit is granted once, then refused', async () => {
    const user = await makeUser({ generationsUsedToday: DAILY_GENERATION_LIMITS.PRO - 1, lastGenerationDate: new Date(), plan: 'PRO' });

    expect(await reserveGenerationCredit(user.id, 'PRO')).toBe(0);
    expect(await reserveGenerationCredit(user.id, 'PRO')).toBeNull();
    expect(await used(user.id)).toBe(DAILY_GENERATION_LIMITS.PRO);
  });

  test('a FREE user out of credits today can generate at once when resolved as BETA', async () => {
    // The owner's situation: stored FREE, all 10 used today, then added to the beta list.
    const user = await makeUser({ generationsUsedToday: FREE_DAILY_GENERATIONS, lastGenerationDate: new Date() });

    expect(await reserveGenerationCredit(user.id, 'BETA')).toBe(DAILY_GENERATION_LIMITS.BETA - 11);
    expect(await used(user.id)).toBe(11);

    // Removed from the list again: above the FREE ceiling, so blocked until tomorrow (not reset).
    expect(await reserveGenerationCredit(user.id, 'FREE')).toBeNull();
    expect(await used(user.id)).toBe(11);
  });

  test('a refund returns the credit, and never goes below zero', async () => {
    const user = await makeUser({ generationsUsedToday: 5, lastGenerationDate: new Date() });

    expect(await reserveGenerationCredit(user.id, 'FREE')).toBe(4);
    expect(await used(user.id)).toBe(6);
    await refundGenerationCredit(user.id);
    expect(await used(user.id)).toBe(5);

    const fresh = await makeUser({ generationsUsedToday: 0, lastGenerationDate: new Date() });
    await refundGenerationCredit(fresh.id);
    expect(await used(fresh.id)).toBe(0);
  });

  test('a refund arriving after the new-day reset cannot push the counter below zero', async () => {
    const yesterday = new Date(Date.now() - 36 * 60 * 60 * 1000);
    const user = await makeUser({ generationsUsedToday: 3, lastGenerationDate: yesterday });

    // Today's first request resets and takes one; two late refunds (one from yesterday) follow.
    expect(await reserveGenerationCredit(user.id, 'FREE')).toBe(FREE_DAILY_GENERATIONS - 1);
    await refundGenerationCredit(user.id);
    await refundGenerationCredit(user.id);
    expect(await used(user.id)).toBe(0);
  });

  test('refunding an unknown user does not throw', async () => {
    await expect(refundGenerationCredit('no_such_user')).resolves.toBeUndefined();
  });

  // ─── Image credits ────────────────────────────────────────────────────────
  async function makeImageUser(data: { imagesLeft: number; lastImageDate: Date | null; plan?: 'FREE' | 'PRO' }) {
    const id = `images_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const user = await prisma.user.create({
      data: { clerkId: id, email: `${id}@credits.test`, plan: data.plan ?? 'FREE', imagesLeft: data.imagesLeft, lastImageDate: data.lastImageDate },
    });
    createdIds.push(user.id);
    return user;
  }
  const imageBalance = async (id: string) => (await prisma.user.findUniqueOrThrow({ where: { id } })).imagesLeft;

  test('parallel image requests can never take more credits than the user has', async () => {
    const user = await makeImageUser({ imagesLeft: 1, lastImageDate: new Date() });

    const results = await Promise.all(Array.from({ length: 20 }, () => reserveImageCredit(user.id, 'FREE')));

    expect(results.filter(r => r !== null)).toHaveLength(1);
    expect(await imageBalance(user.id)).toBe(0);
  });

  test('image requests racing across midnight reset the allowance exactly once', async () => {
    const yesterday = new Date(Date.now() - 36 * 60 * 60 * 1000);
    const user = await makeImageUser({ imagesLeft: 0, lastImageDate: yesterday, plan: 'PRO' });

    const results = await Promise.all(Array.from({ length: 12 }, () => reserveImageCredit(user.id, 'PRO')));

    // 12 racers vs a 10-credit allowance: kept modest so parallel test workers don't exhaust Postgres connections.
    expect(results.filter(r => r !== null)).toHaveLength(10); // PRO allowance
    expect(await imageBalance(user.id)).toBe(0);
  });

  test('an image refund returns the credit and never exceeds the plan allowance', async () => {
    const user = await makeImageUser({ imagesLeft: 1, lastImageDate: new Date() });

    expect(await reserveImageCredit(user.id, 'FREE')).toBe(0);
    await refundImageCredit(user.id, 'FREE');
    expect(await imageBalance(user.id)).toBe(1);
    await refundImageCredit(user.id, 'FREE');
    expect(await imageBalance(user.id)).toBe(1);
  });

  // ─── Optimistic locking (the conditional write the classroom PATCH route performs) ──
  test('a write against a stale version is rejected, a current one succeeds and bumps the version', async () => {
    const owner = await makeUser({ generationsUsedToday: 0, lastGenerationDate: new Date() });
    const room = await prisma.classroom.create({
      data: { userId: owner.id, name: 'Lock', subject: 'Maths', grade: '8', curriculum: 'CAPS' },
    });
    expect(room.version).toBe(0);

    const first = await prisma.classroom.update({
      where: { id: room.id, version: 0 },
      data: { savedLessons: { a: 1 }, version: { increment: 1 } },
    });
    expect(first.version).toBe(1);

    // A second device still holding version 0 must lose, and must not overwrite anything.
    await expect(
      prisma.classroom.update({
        where: { id: room.id, version: 0 },
        data: { savedLessons: { b: 2 }, version: { increment: 1 } },
      })
    ).rejects.toMatchObject({ code: 'P2025' });
    expect((await prisma.classroom.findUniqueOrThrow({ where: { id: room.id } })).savedLessons).toEqual({ a: 1 });

    // Two writers racing on the same version: exactly one wins.
    const racers = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        prisma.classroom.update({ where: { id: room.id, version: 1 }, data: { version: { increment: 1 } } })
      )
    );
    expect(racers.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  });
});
