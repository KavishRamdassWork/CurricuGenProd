import { test, expect } from '@playwright/test';
import {
  MAX_OUTPUT_TOKENS,
  SAFETY_SETTINGS,
  buildGenerateConfig,
  generateText,
  setModelRunner,
} from '../../src/lib/modelRunner';
import { ContentBlockedError, MalformedOutputError, type GenKind } from '../../src/lib/outputScreen';
import { CANARY } from '../../src/lib/promptSafety';

const ALL_KINDS: GenKind[] = [
  'blueprint',
  'lesson-plan',
  'worksheet',
  'assignment',
  'assessment',
  'memo',
  'presentation',
  'game',
  'resources',
  'refine',
  'analyze',
];

test.afterEach(() => {
  setModelRunner(null);
});

test.describe('generateText', () => {
  test('returns the screened text for a normal result', async () => {
    setModelRunner(async () => ({ text: 'Plain refined text.', finishReason: 'STOP' }));
    const out = await generateText({ kind: 'refine', parts: [{ text: 'x' }], temperature: 0.2 });
    expect(out).toBe('Plain refined text.');
  });

  test('passes the request through to the runner', async () => {
    let seenKind: string | undefined;
    setModelRunner(async (req) => {
      seenKind = req.kind;
      return { text: 'ok' };
    });
    await generateText({ kind: 'refine', parts: [], temperature: 0.1 });
    expect(seenKind).toBe('refine');
  });

  test('rejects with ContentBlockedError when the finish reason is SAFETY', async () => {
    setModelRunner(async () => ({ text: 'something', finishReason: 'SAFETY' }));
    await expect(generateText({ kind: 'refine', parts: [], temperature: 0.2 })).rejects.toBeInstanceOf(
      ContentBlockedError,
    );
  });

  test('rejects with ContentBlockedError when the prompt was blocked', async () => {
    setModelRunner(async () => ({ blockReason: 'PROHIBITED_CONTENT' }));
    await expect(generateText({ kind: 'refine', parts: [], temperature: 0.2 })).rejects.toBeInstanceOf(
      ContentBlockedError,
    );
  });

  test('rejects with MalformedOutputError for empty text', async () => {
    setModelRunner(async () => ({ text: '' }));
    await expect(generateText({ kind: 'refine', parts: [], temperature: 0.2 })).rejects.toBeInstanceOf(
      MalformedOutputError,
    );
  });
});

test.describe('buildGenerateConfig', () => {
  test('sets the token cap, temperature, system instruction and safety settings', () => {
    const config = buildGenerateConfig({ kind: 'memo', parts: [], temperature: 0.2 });
    expect(config.maxOutputTokens).toBe(MAX_OUTPUT_TOKENS.memo);
    expect(config.temperature).toBe(0.2);
    expect(String(config.systemInstruction)).toContain(CANARY);
    const settings = config.safetySettings ?? [];
    expect(new Set(settings.map((s) => s.category)).size).toBe(4);
    for (const s of settings) expect(s.threshold).toBe('BLOCK_MEDIUM_AND_ABOVE');
    expect(settings).toEqual(SAFETY_SETTINGS);
  });

  test('does not set JSON or thinking options by default', () => {
    const config = buildGenerateConfig({ kind: 'memo', parts: [], temperature: 0.2 });
    expect(config.responseMimeType).toBeUndefined();
    expect(config.responseSchema).toBeUndefined();
    expect(config.thinkingConfig).toBeUndefined();
  });

  test('json: true requests application/json and forwards the schema', () => {
    const schema = { type: 'OBJECT' };
    const config = buildGenerateConfig({ kind: 'blueprint', parts: [], temperature: 0.3, json: true, responseSchema: schema });
    expect(config.responseMimeType).toBe('application/json');
    expect(config.responseSchema).toBe(schema);
  });

  test('thinkingBudget is forwarded', () => {
    const config = buildGenerateConfig({ kind: 'blueprint', parts: [], temperature: 0.3, thinkingBudget: 2048 });
    expect(config.thinkingConfig?.thinkingBudget).toBe(2048);
  });
});

test.describe('MAX_OUTPUT_TOKENS', () => {
  test('every kind has a positive cap', () => {
    for (const kind of ALL_KINDS) {
      expect(MAX_OUTPUT_TOKENS[kind]).toBeGreaterThan(0);
    }
  });

  test('blueprint and assessment leave room for thinking tokens', () => {
    expect(MAX_OUTPUT_TOKENS.blueprint).toBe(16384);
    expect(MAX_OUTPUT_TOKENS.assessment).toBe(16384);
  });
});
