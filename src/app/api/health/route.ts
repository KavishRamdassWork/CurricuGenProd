/**
 * GET /api/health
 *
 * Health check endpoint. Verifies:
 *   1. The GEMINI_API_KEY environment variable is set
 *   2. The key is valid and accepted by the Gemini API
 *   3. The current GENERATION_MODEL is reachable
 *
 * Safe to hit publicly — makes a minimal (1-token) Gemini call.
 * Does NOT require authentication. Does NOT consume generation credits.
 *
 * Usage:
 *   curl https://your-app.vercel.app/api/health
 *   curl http://localhost:3000/api/health
 */

import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const GENERATION_MODEL = 'gemini-3.5-flash';

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;

  // 1. Check env var is present
  if (!apiKey) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'GEMINI_API_KEY environment variable is not set.',
        fix: 'Add GEMINI_API_KEY to your .env.local (local) or Vercel environment variables (production).',
      },
      { status: 500 }
    );
  }

  // 2. Probe the API with a minimal call
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: 'Reply with the single word: ok',
      config: { maxOutputTokens: 5, temperature: 0 },
    });

    const reply = response.text?.trim().toLowerCase() ?? '';

    return NextResponse.json({
      status: 'ok',
      model: GENERATION_MODEL,
      apiKeyPrefix: `${apiKey.slice(0, 8)}…`,   // shows first 8 chars so you can confirm which key
      modelResponse: reply,
      message: 'Gemini API key is valid and model is reachable.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    // Classify the error to give actionable guidance
    let fix = 'Check the error message for details.';
    if (message.includes('API_KEY_INVALID') || message.includes('401')) {
      fix = 'The API key is invalid. Regenerate it at aistudio.google.com and update GEMINI_API_KEY.';
    } else if (message.includes('PERMISSION_DENIED') || message.includes('403')) {
      fix = 'The API key does not have access to this model. Ensure billing is enabled at console.cloud.google.com.';
    } else if (message.includes('QUOTA') || message.includes('429')) {
      fix = 'Rate limit or quota exceeded. Check your usage at aistudio.google.com or console.cloud.google.com.';
    } else if (message.includes('model') && message.includes('not found')) {
      fix = `Model "${GENERATION_MODEL}" is not available for this key. Check ai.google.dev/gemini-api/docs/models for available models.`;
    }

    return NextResponse.json(
      {
        status: 'error',
        model: GENERATION_MODEL,
        apiKeyPrefix: `${apiKey.slice(0, 8)}…`,
        error: message,
        fix,
      },
      { status: 502 }
    );
  }
}
