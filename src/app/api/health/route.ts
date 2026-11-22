/**
 * GET /api/health
 *
 * Public liveness/readiness probe. Deliberately cheap and leaks nothing:
 *   - no outbound Gemini call (an anonymous caller must not be able to burn paid quota)
 *   - no key material or raw upstream error text in the response
 *
 * Checks: required env vars are present, and the database answers `SELECT 1`.
 * Responds 200 when ready, 503 when not, so load balancers / uptime monitors can use it directly.
 *
 * To verify the Gemini key end-to-end, use the manual script in debug-scripts/ instead.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const REQUIRED_ENV = ['GEMINI_API_KEY', 'DATABASE_URL', 'CLERK_SECRET_KEY'] as const;

export async function GET() {
  const missingEnv = REQUIRED_ENV.filter((name) => !process.env[name]);

  let database: 'ok' | 'error' = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    database = 'error';
    console.error('[HEALTH] database check failed:', error);
  }

  const ready = missingEnv.length === 0 && database === 'ok';
  if (!ready && missingEnv.length > 0) {
    console.error('[HEALTH] missing env vars:', missingEnv.join(', '));
  }

  return NextResponse.json(
    { status: ready ? 'ok' : 'error', database, config: missingEnv.length === 0 ? 'ok' : 'error' },
    { status: ready ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }
  );
}
