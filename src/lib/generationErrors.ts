/**
 * Central mapping from a failed generation to the HTTP response the client sees.
 *
 * Safety blocks and canary hits keep the reserved credit (the request was the problem, so retrying
 * it must still cost something). Malformed or truncated model output gives it back, but only up to
 * MAX_CAPPED_REFUNDS_PER_DAY times a day (a user can provoke such output on purpose). Infrastructure
 * failures and invalid request data always give it back. Raw error messages never reach the client.
 */
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ContentBlockedError, MalformedOutputError } from '@/lib/outputScreen';
import { refundGenerationCredit } from '@/lib/generationCredits';

/** Kill switch: AI_GENERATION_DISABLED=true stops every generation before any credit is reserved. */
export function generationDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.AI_GENERATION_DISABLED || '').trim().toLowerCase() === 'true';
}

export type ClassifiedGenerationError = {
  status: number;
  body: { error: string; code?: string };
  refund: boolean;
  /** The refund counts against the daily capped-refund allowance (malformed/truncated output). */
  refundCapped: boolean;
  blockedReason?: string;
};

/** Pure: decide status, client-safe body and whether to refund. */
export function classifyGenerationError(error: unknown): ClassifiedGenerationError {
  if (error instanceof ZodError) {
    return { status: 400, body: { error: 'Invalid request data.' }, refund: true, refundCapped: false };
  }
  if (error instanceof ContentBlockedError) {
    return {
      status: 422,
      body: {
        error: 'This request could not be completed. Please rephrase it and keep it classroom-appropriate.',
        code: 'CONTENT_BLOCKED',
      },
      refund: false,
      refundCapped: false,
      blockedReason: error.reason,
    };
  }
  if (error instanceof MalformedOutputError) {
    return {
      status: 500,
      body: { error: 'Generation produced an unusable result. Please try again.' },
      refund: true,
      refundCapped: true,
    };
  }
  return { status: 500, body: { error: 'Generation failed. Please try again.' }, refund: true, refundCapped: false };
}

/**
 * Classify, refund the reserved credit when appropriate, log (user id, route and reason only - never
 * user text or the raw error message for blocks) and build the response.
 */
export async function handleGenerationError(
  error: unknown,
  user: { id: string },
  route: string,
): Promise<NextResponse> {
  const result = classifyGenerationError(error);

  if (result.refund) await refundGenerationCredit(user.id, { capped: result.refundCapped });

  if (result.blockedReason) {
    console.warn(JSON.stringify({ event: 'content_blocked', route, userId: user.id, reason: result.blockedReason }));
  } else if (result.status >= 500) {
    const name = error instanceof Error ? error.name : typeof error;
    console.error(JSON.stringify({ event: 'generation_failed', route, userId: user.id, error: name }));
  }

  return NextResponse.json(result.body, { status: result.status });
}
