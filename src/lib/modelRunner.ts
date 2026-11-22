import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  type GenerateContentConfig,
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
 * Output token ceiling per kind. Thinking tokens count toward the cap, so blueprint and assessment
 * (which run with a thinking budget) are higher.
 */
export const MAX_OUTPUT_TOKENS: Record<GenKind, number> = {
  blueprint: 16384,
  'lesson-plan': 8192,
  worksheet: 8192,
  assignment: 8192,
  assessment: 16384,
  memo: 8192,
  presentation: 8192,
  game: 6144,
  resources: 6144,
  refine: 16384,
  analyze: 4096,
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
  thinkingBudget?: number;
  json?: boolean;
  responseSchema?: unknown;
};

export type ModelResult = { text?: string; finishReason?: string; blockReason?: string };

export type ModelRunner = (req: ModelRequest) => Promise<ModelResult>;

export function buildGenerateConfig(req: ModelRequest): GenerateContentConfig {
  const config: GenerateContentConfig = {
    systemInstruction: buildSystemInstruction(),
    temperature: req.temperature,
    maxOutputTokens: MAX_OUTPUT_TOKENS[req.kind],
    safetySettings: SAFETY_SETTINGS,
  };
  if (req.thinkingBudget !== undefined) {
    config.thinkingConfig = { thinkingBudget: req.thinkingBudget };
  }
  if (req.json) {
    config.responseMimeType = 'application/json';
  }
  if (req.responseSchema !== undefined) {
    config.responseSchema = req.responseSchema as GenerateContentConfig['responseSchema'];
  }
  return config;
}

const defaultRunner: ModelRunner = async (req) => {
  const response = await getAIClient().models.generateContent({
    model: GENERATION_MODEL,
    contents: { parts: req.parts },
    config: buildGenerateConfig(req),
  });
  return {
    text: response.text,
    finishReason: response.candidates?.[0]?.finishReason,
    blockReason: response.promptFeedback?.blockReason,
  };
};

let activeRunner: ModelRunner = defaultRunner;

/** Test seam: replace the model call. Pass null to restore the real runner. */
export function setModelRunner(runner: ModelRunner | null): void {
  activeRunner = runner ?? defaultRunner;
}

/** Run one generation and return screened text. Throws ContentBlockedError or MalformedOutputError. */
export async function generateText(req: ModelRequest): Promise<string> {
  const result = await activeRunner(req);
  return screenOutput(req.kind, result.text, result);
}
