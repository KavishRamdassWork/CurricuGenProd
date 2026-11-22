import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  type GenerateContentConfig,
  type GenerateContentResponse,
  type Part,
} from '@google/genai';
import { buildSystemInstruction } from '@/lib/promptSafety';
import { screenOutput, type GenKind } from '@/lib/outputScreen';

// ─── Model Configuration ────────────────────────────────────────────────────
// Update GENERATION_MODEL here when Google announces a deprecation.
// Check: ai.google.dev/gemini-api/docs/deprecations
//
// History:
//   gemini-2.0-flash     → deprecated/retired June 1 2026
//   gemini-2.5-flash     → deprecated October 16 2026
//   gemini-3.5-flash     → active as of May 19 2026, no announced deprecation
//                           Pricing: $1.50 input / $9.00 output per 1M tokens
export const GENERATION_MODEL = 'gemini-3.5-flash';

/** Per-request ceiling for Gemini calls (ms). Routes declare maxDuration = 120 s to leave room for one retry. */
const GEMINI_REQUEST_TIMEOUT_MS = 55_000;

export function getAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured on the server.');
  // Bound every upstream call. Without a timeout a hung Gemini request holds the route (and the
  // user's reserved credit) until the platform kills it. Two attempts total: one retry absorbs a
  // transient 429/503 without multiplying worst-case latency, and stays inside GENERATION_MAX_SECONDS.
  return new GoogleGenAI({
    apiKey,
    httpOptions: { timeout: GEMINI_REQUEST_TIMEOUT_MS, retryOptions: { attempts: 2 } },
  });
}

/**
 * Thinking-token budget per kind, always set explicitly. Gemini 3.5 Flash thinks by default, and
 * thinking tokens count toward maxOutputTokens: without an explicit budget the model could spend an
 * unknown share of the cap thinking and truncate normal output (which is now rejected as malformed).
 * Blueprint and formal assessment keep the higher budget where accuracy matters most.
 */
export const THINKING_BUDGET: Record<GenKind, number> = {
  blueprint: 2048,
  'lesson-plan': 1024,
  worksheet: 1024,
  assignment: 1024,
  assessment: 2048,
  memo: 1024,
  presentation: 1024,
  game: 1024,
  resources: 1024,
  refine: 1024,
  analyze: 1024,
};

/**
 * Output token ceiling per kind (thinking + visible output). Each 1024-budget kind is its previous
 * visible-output cap plus 1024 of headroom for thinking; blueprint and assessment were already sized
 * for their 2048 budget. These values are not yet verified against the live model: the live smoke
 * test records finishReason and token usage per call so they can be checked.
 */
export const MAX_OUTPUT_TOKENS: Record<GenKind, number> = {
  blueprint: 16384,
  'lesson-plan': 9216,
  worksheet: 9216,
  assignment: 9216,
  assessment: 16384,
  memo: 9216,
  presentation: 9216,
  game: 7168,
  resources: 7168,
  refine: 17408,
  analyze: 5120,
};

export const SAFETY_SETTINGS = [
  HarmCategory.HARM_CATEGORY_HARASSMENT,
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
].map((category) => ({ category, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }));

export type ModelRequest = {
  kind: GenKind;
  parts: Part[];
  temperature: number;
  /** Overrides THINKING_BUDGET[kind] when given. */
  thinkingBudget?: number;
  json?: boolean;
  responseSchema?: unknown;
  /**
   * Nonce of this request's teacher-instruction fence, if it has one. Only then does the system
   * instruction contain the exception for that block, naming this exact nonce.
   */
  instructionNonce?: string;
};

export type ModelUsage = { promptTokens?: number; outputTokens?: number; thoughtTokens?: number };

export type ModelResult = {
  text?: string;
  finishReason?: string;
  blockReason?: string;
  usage?: ModelUsage;
};

export type ModelRunner = (req: ModelRequest) => Promise<ModelResult>;

export function buildGenerateConfig(req: ModelRequest): GenerateContentConfig {
  const config: GenerateContentConfig = {
    systemInstruction: buildSystemInstruction(req.instructionNonce),
    temperature: req.temperature,
    maxOutputTokens: MAX_OUTPUT_TOKENS[req.kind],
    safetySettings: SAFETY_SETTINGS,
    thinkingConfig: { thinkingBudget: req.thinkingBudget ?? THINKING_BUDGET[req.kind] },
  };
  if (req.json) {
    config.responseMimeType = 'application/json';
  }
  if (req.responseSchema !== undefined) {
    config.responseSchema = req.responseSchema as GenerateContentConfig['responseSchema'];
  }
  return config;
}

/** Pure: map an SDK response to the fields the screen and the observer need. */
export function toModelResult(
  response: Pick<GenerateContentResponse, 'text' | 'candidates' | 'promptFeedback' | 'usageMetadata'>,
): ModelResult {
  const meta = response.usageMetadata;
  const result: ModelResult = {
    text: response.text,
    finishReason: response.candidates?.[0]?.finishReason,
    blockReason: response.promptFeedback?.blockReason,
  };
  if (meta) {
    result.usage = {
      promptTokens: meta.promptTokenCount,
      outputTokens: meta.candidatesTokenCount,
      thoughtTokens: meta.thoughtsTokenCount,
    };
  }
  return result;
}

const defaultRunner: ModelRunner = async (req) => {
  const response = await getAIClient().models.generateContent({
    model: GENERATION_MODEL,
    contents: { parts: req.parts },
    config: buildGenerateConfig(req),
  });
  return toModelResult(response);
};

let activeRunner: ModelRunner = defaultRunner;

/** Test seam: replace the model call. Pass null to restore the real runner. */
export function setModelRunner(runner: ModelRunner | null): void {
  activeRunner = runner ?? defaultRunner;
}

/** Sees each raw result (kind, finishReason, usage) before screening. Never sees errors thrown by the call. */
export type ModelRunnerObserver = (req: ModelRequest, result: ModelResult) => void;

let observer: ModelRunnerObserver | null = null;

/**
 * Diagnostics seam (used by the live smoke test to record finishReason and token usage while still
 * using the real runner). Pass null to remove it. Observer errors are ignored.
 */
export function setModelRunnerObserver(next: ModelRunnerObserver | null): void {
  observer = next;
}

/** Run one generation and return screened text. Throws ContentBlockedError or MalformedOutputError. */
export async function generateText(req: ModelRequest): Promise<string> {
  const result = await activeRunner(req);
  if (observer) {
    try {
      observer(req, result);
    } catch {
      // Diagnostics must never change the outcome of a generation.
    }
  }
  return screenOutput(req.kind, result.text, result);
}
