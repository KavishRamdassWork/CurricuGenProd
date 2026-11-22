import { test, expect } from '@playwright/test';
import {
  MAX_OUTPUT_TOKENS,
  SAFETY_SETTINGS,
  THINKING_BUDGET,
  buildGenerateConfig,
  generateText,
  setModelRunner,
  setModelRunnerObserver,
  toModelResult,
} from '../../src/lib/modelRunner';
import { BlockedReason, FinishReason } from '@google/genai';
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

test.describe('toModelResult', () => {
  test('maps text, finish reason, block reason and token usage', () => {
    const result = toModelResult({
      text: 'hello',
      candidates: [{ finishReason: FinishReason.MAX_TOKENS }],
      promptFeedback: { blockReason: BlockedReason.SAFETY },
      usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 900, thoughtsTokenCount: 1000 },
    });
    expect(result).toEqual({
      text: 'hello',
      finishReason: 'MAX_TOKENS',
      blockReason: 'SAFETY',
      usage: { promptTokens: 120, outputTokens: 900, thoughtTokens: 1000 },
    });
  });

  test('omits usage when the response has none', () => {
    const result = toModelResult({ text: 'x', candidates: [{ finishReason: FinishReason.STOP }] });
    expect(result).toEqual({ text: 'x', finishReason: 'STOP', blockReason: undefined });
    expect(result.usage).toBeUndefined();
  });
});

test.describe('setModelRunnerObserver', () => {
  test.afterEach(() => setModelRunnerObserver(null));

  test('sees each raw result before screening, including ones the screen rejects', async () => {
    const seen: Array<{ kind: string; finishReason?: string; outputTokens?: number }> = [];
    setModelRunnerObserver((req, result) => {
      seen.push({ kind: req.kind, finishReason: result.finishReason, outputTokens: result.usage?.outputTokens });
    });
    setModelRunner(async () => ({ text: 'ok', finishReason: 'STOP', usage: { outputTokens: 3 } }));
    await generateText({ kind: 'refine', parts: [], temperature: 0.2 });
    setModelRunner(async () => ({ text: 'cut', finishReason: 'MAX_TOKENS', usage: { outputTokens: 9 } }));
    await expect(generateText({ kind: 'worksheet', parts: [], temperature: 0.2 })).rejects.toBeInstanceOf(
      MalformedOutputError,
    );
    expect(seen).toEqual([
      { kind: 'refine', finishReason: 'STOP', outputTokens: 3 },
      { kind: 'worksheet', finishReason: 'MAX_TOKENS', outputTokens: 9 },
    ]);
  });

  test('an observer that throws does not change the outcome', async () => {
    setModelRunnerObserver(() => {
      throw new Error('observer bug');
    });
    setModelRunner(async () => ({ text: 'fine', finishReason: 'STOP' }));
    await expect(generateText({ kind: 'refine', parts: [], temperature: 0.2 })).resolves.toBe('fine');
  });
});

test.describe('buildGenerateConfig: instruction nonce', () => {
  test('the exception paragraph appears only when the request carries an instruction nonce', () => {
    const without = String(buildGenerateConfig({ kind: 'worksheet', parts: [], temperature: 0.4 }).systemInstruction);
    expect(without).not.toContain('Exception:');
    const nonce = 'abcdef012345';
    const withNonce = String(
      buildGenerateConfig({ kind: 'worksheet', parts: [], temperature: 0.4, instructionNonce: nonce }).systemInstruction,
    );
    expect(withNonce).toContain(`the block labelled instruction with id ${nonce};`);
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

  test('does not set JSON options by default', () => {
    const config = buildGenerateConfig({ kind: 'memo', parts: [], temperature: 0.2 });
    expect(config.responseMimeType).toBeUndefined();
    expect(config.responseSchema).toBeUndefined();
  });

  test('every kind gets an explicit thinking budget: 2048 for blueprint and assessment, 1024 otherwise', () => {
    for (const kind of ALL_KINDS) {
      const config = buildGenerateConfig({ kind, parts: [], temperature: 0.2 });
      const expected = kind === 'blueprint' || kind === 'assessment' ? 2048 : 1024;
      expect(THINKING_BUDGET[kind]).toBe(expected);
      expect(config.thinkingConfig?.thinkingBudget).toBe(expected);
    }
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

  test('every other kind keeps its old visible-output cap plus 1024 for its thinking budget', () => {
    const visible: Partial<Record<GenKind, number>> = {
      'lesson-plan': 8192,
      worksheet: 8192,
      assignment: 8192,
      memo: 8192,
      presentation: 8192,
      game: 6144,
      resources: 6144,
      refine: 16384,
      analyze: 4096,
    };
    for (const [kind, cap] of Object.entries(visible) as Array<[GenKind, number]>) {
      expect(MAX_OUTPUT_TOKENS[kind]).toBe(cap + 1024);
      expect(MAX_OUTPUT_TOKENS[kind] - THINKING_BUDGET[kind]).toBe(cap);
    }
  });
});
