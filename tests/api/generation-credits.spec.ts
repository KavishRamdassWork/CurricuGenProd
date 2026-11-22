import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import {
  reserveGenerationCredit,
  refundGenerationCredit,
  reserveImageCredit,
  refundImageCredit,
  FREE_DAILY_GENERATIONS,
} from '../../src/lib/generationCredits';

/**
 * Concurrency tests for free-plan credit accounting. They hit a real Postgres on purpose: the guarantee
 * being tested is that the database decides who gets the last credit, which a mock cannot show.
 *
 * Runs only against a local database (see .env.test.example). It skips itself on anything else so it
 * can never write to a hosted/shared database by accident.
 */
const dbUrl = process.env.DATABASE_URL ?? '';
const isLocalDb = /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(dbUrl);

test.describe('Free-plan generation credits', () => {
  test.skip(!isLocalDb, 'DATABASE_URL must point at a local test database');

  const prisma = new PrismaClient();
  const createdIds: string[] = [];

  async function makeUser(data: { generationsLeft: number; lastGenerationDate: Date | null; plan?: 'FREE' | 'PRO' }) {
    const id = `credits_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const user = await prisma.user.create({
      data: { clerkId: id, email: `${id}@credits.test`, plan: data.plan ?? 'FREE', generationsLeft: data.generationsLeft, lastGenerationDate: data.lastGenerationDate },
    });
    createdIds.push(user.id);
    return user;
  }

  const balance = async (id: string) => (await prisma.user.findUniqueOrThrow({ where: { id } })).generationsLeft;

  test.afterAll(async () => {
    if (createdIds.length) await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.$disconnect();
  });

  test('parallel requests can never take more credits than the user has', async () => {
    const user = await makeUser({ generationsLeft: 10, lastGenerationDate: new Date() });

    const results = await Promise.all(Array.from({ length: 30 }, () => reserveGenerationCredit(user.id)));

    expect(results.filter(r => r !== null)).toHaveLength(10);
    expect(await balance(user.id)).toBe(0);
  });

  test('reports the remaining balance and refuses once it reaches zero', async () => {
    const user = await makeUser({ generationsLeft: 2, lastGenerationDate: new Date() });

    expect(await reserveGenerationCredit(user.id)).toBe(1);
    expect(await reserveGenerationCredit(user.id)).toBe(0);
    expect(await reserveGenerationCredit(user.id)).toBeNull();
    expect(await balance(user.id)).toBe(0); // never negative
  });

  test('requests racing across midnight reset the allowance exactly once', async () => {
    const yesterday = new Date(Date.now() - 36 * 60 * 60 * 1000);
    const user = await makeUser({ generationsLeft: 0, lastGenerationDate: yesterday });

    const results = await Promise.all(Array.from({ length: 25 }, () => reserveGenerationCredit(user.id)));

    // A reset that ran twice would overwrite decrements already taken and hand out extra credits.
    expect(results.filter(r => r !== null)).toHaveLength(FREE_DAILY_GENERATIONS);
    expect(await balance(user.id)).toBe(0);
  });

  test('a first-ever request (no previous date) starts a fresh allowance', async () => {
    const user = await makeUser({ generationsLeft: 0, lastGenerationDate: null });

    expect(await reserveGenerationCredit(user.id)).toBe(FREE_DAILY_GENERATIONS - 1);
  });

  test('a refund returns the credit, and never goes above the daily allowance', async () => {
    const user = await makeUser({ generationsLeft: 5, lastGenerationDate: new Date() });

    await reserveGenerationCredit(user.id);
    expect(await balance(user.id)).toBe(4);
    await refundGenerationCredit(user.id);
    expect(await balance(user.id)).toBe(5);

    const full = await makeUser({ generationsLeft: FREE_DAILY_GENERATIONS, lastGenerationDate: new Date() });
    await refundGenerationCredit(full.id);
    expect(await balance(full.id)).toBe(FREE_DAILY_GENERATIONS);
  });

  test('paid plans are never reserved against or refunded', async () => {
    const pro = await makeUser({ generationsLeft: 10, lastGenerationDate: new Date(), plan: 'PRO' });

    expect(await reserveGenerationCredit(pro.id)).toBeNull();
    await refundGenerationCredit(pro.id);
    expect(await balance(pro.id)).toBe(10);
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
    const owner = await makeUser({ generationsLeft: 10, lastGenerationDate: new Date() });
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
