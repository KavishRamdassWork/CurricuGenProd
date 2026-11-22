import { test, expect } from '@playwright/test';
import { z } from 'zod';
import { classifyGenerationError, generationDisabled } from '../../src/lib/generationErrors';
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
