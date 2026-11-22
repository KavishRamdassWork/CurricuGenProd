import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { addMonths, lapseExpiredPro } from '../../src/lib/proExpiry';

/**
 * Cancelling a Pro subscription must keep Pro until the end of the month already paid for
 * (Refund Policy 4.4), then return the user to FREE. Hits a real local Postgres, like the credit tests.
 */
const dbUrl = process.env.DATABASE_URL ?? '';
const isLocalDb = /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(dbUrl);

test.describe('addMonths', () => {
  test('adds calendar months and clamps to month end', () => {
    expect(addMonths(new Date('2026-01-15T10:00:00Z'), 1).toISOString()).toBe('2026-02-15T10:00:00.000Z');
    expect(addMonths(new Date('2026-01-31T10:00:00Z'), 1).toISOString()).toBe('2026-02-28T10:00:00.000Z');
    expect(addMonths(new Date('2028-01-31T10:00:00Z'), 1).toISOString()).toBe('2028-02-29T10:00:00.000Z');
    expect(addMonths(new Date('2026-12-20T10:00:00Z'), 1).toISOString()).toBe('2027-01-20T10:00:00.000Z');
  });
});

test.describe('Pro access after cancellation', () => {
  test.skip(!isLocalDb, 'DATABASE_URL must point at a local test database');

  const PASSPHRASE = process.env.PAYFAST_PASSPHRASE || '';
  const prisma = new PrismaClient();
  const clerkIds: string[] = [];

  async function makeUser(plan: 'FREE' | 'PRO' | 'BETA', proExpiresAt: Date | null = null) {
    const clerkId = `expiry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    clerkIds.push(clerkId);
    return prisma.user.create({ data: { clerkId, email: `${clerkId}@expiry.test`, plan, proExpiresAt } });
  }

  async function addPayment(clerkId: string, createdAt: Date, status = 'COMPLETE') {
    await prisma.payment.create({
      data: { pfPaymentId: `pf_${clerkId}_${createdAt.getTime()}`, clerkId, status, amountGross: '180.00', createdAt },
    });
  }

  function sign(data: Record<string, string>): string {
    let out = '';
    for (const key in data) if (data[key] !== '') out += `${key}=${encodeURIComponent(data[key].trim()).replace(/%20/g, '+')}&`;
    let s = out.slice(0, -1);
    if (PASSPHRASE) s += `&passphrase=${encodeURIComponent(PASSPHRASE.trim()).replace(/%20/g, '+')}`;
    return crypto.createHash('md5').update(s).digest('hex');
  }

  async function notify(request: import('@playwright/test').APIRequestContext, clerkId: string, payment_status: string, extra: Record<string, string> = {}) {
    const data: Record<string, string> = { payment_status, item_name: 'CurricuGen Pro Subscription (1 Month)', custom_str1: clerkId, ...extra };
    data.signature = sign(data);
    return request.post('/api/webhooks/payfast', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: new URLSearchParams(data).toString(),
    });
  }

  const reload = (clerkId: string) => prisma.user.findUniqueOrThrow({ where: { clerkId } });
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

  test.afterAll(async () => {
    await prisma.payment.deleteMany({ where: { clerkId: { in: clerkIds } } });
    await prisma.user.deleteMany({ where: { clerkId: { in: clerkIds } } });
    await prisma.$disconnect();
  });

  test('cancelling mid-period keeps Pro and schedules the end of the paid month', async ({ request }) => {
    const user = await makeUser('PRO');
    const paidAt = daysAgo(10);
    await addPayment(user.clerkId, paidAt);

    const res = await notify(request, user.clerkId, 'CANCELLED');
    expect(res.status()).toBe(200);

    const after = await reload(user.clerkId);
    expect(after.plan).toBe('PRO');
    expect(after.proExpiresAt?.toISOString()).toBe(addMonths(paidAt, 1).toISOString());
  });

  test('a COMPLETE payment is not rewritten by a later CANCELLED notification for the same payment id', async ({ request }) => {
    const user = await makeUser('PRO');
    await addPayment(user.clerkId, daysAgo(5));
    const pfPaymentId = `pf_${user.clerkId}_${Math.floor(Math.random() * 1e9)}`;
    await prisma.payment.create({ data: { pfPaymentId, clerkId: user.clerkId, status: 'COMPLETE', amountGross: '180.00' } });

    await notify(request, user.clerkId, 'CANCELLED', { pf_payment_id: pfPaymentId });

    expect((await prisma.payment.findUniqueOrThrow({ where: { pfPaymentId } })).status).toBe('COMPLETE');
    expect((await reload(user.clerkId)).plan).toBe('PRO');
  });

  test('cancelling with no paid time left ends Pro immediately', async ({ request }) => {
    const user = await makeUser('PRO');
    await addPayment(user.clerkId, daysAgo(60));

    await notify(request, user.clerkId, 'CANCELLED');

    const after = await reload(user.clerkId);
    expect(after.plan).toBe('FREE');
    expect(after.proExpiresAt).toBeNull();
  });

  test('a failed payment returns the user to FREE straight away', async ({ request }) => {
    const user = await makeUser('PRO');
    await addPayment(user.clerkId, daysAgo(2));

    await notify(request, user.clerkId, 'FAILED');

    expect((await reload(user.clerkId)).plan).toBe('FREE');
  });

  test('paying again clears a scheduled end', async ({ request }) => {
    const user = await makeUser('PRO', new Date(Date.now() + 10 * 86_400_000));

    const res = await notify(request, user.clerkId, 'COMPLETE', { amount_gross: '180.00' });
    expect(res.status()).toBe(200);

    const after = await reload(user.clerkId);
    expect(after.plan).toBe('PRO');
    expect(after.proExpiresAt).toBeNull();
  });

  test('cancelling never touches a BETA tester', async ({ request }) => {
    const user = await makeUser('BETA');
    await addPayment(user.clerkId, daysAgo(3));

    await notify(request, user.clerkId, 'CANCELLED');

    const after = await reload(user.clerkId);
    expect(after.plan).toBe('BETA');
    expect(after.proExpiresAt).toBeNull();
  });

  test('lapseExpiredPro downgrades only users whose scheduled end has passed', async () => {
    const expired = await makeUser('PRO', new Date(Date.now() - 1000));
    const stillPaid = await makeUser('PRO', new Date(Date.now() + 86_400_000));
    const active = await makeUser('PRO');
    const beta = await makeUser('BETA', new Date(Date.now() - 1000));

    for (const u of [expired, stillPaid, active, beta]) await lapseExpiredPro({ id: u.id });

    expect((await reload(expired.clerkId)).plan).toBe('FREE');
    expect((await reload(expired.clerkId)).proExpiresAt).toBeNull();
    expect((await reload(stillPaid.clerkId)).plan).toBe('PRO');
    expect((await reload(active.clerkId)).plan).toBe('PRO');
    expect((await reload(beta.clerkId)).plan).toBe('BETA');
  });
});
