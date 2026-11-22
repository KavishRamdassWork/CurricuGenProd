import { NextRequest, NextResponse } from 'next/server';
import { generateEducationalImageServer } from '@/lib/aiService';
import { requireImageAccess, refundImage } from '@/lib/authGuard';
import { z } from 'zod';

const schema = z.object({
  unit: z.object({
    weekNumber: z.number(),
    topicTitle: z.string().max(200),
    summary: z.string().max(500),
    learningOutcome: z.string().max(500),
  }),
  description: z.string().max(500).optional(),
});

// Gemini calls (55 s timeout, one retry) need more than the platform default.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const guard = await requireImageAccess();
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();
    const { unit, description } = schema.parse(body);
    const imageUrl = await generateEducationalImageServer(unit, description);
    // Gemini can answer with no image (e.g. filtered); don't charge the credit for that.
    if (!imageUrl) await refundImage(guard.dbUser.id, guard.dbUser.plan);
    return NextResponse.json({ imageUrl });
  } catch (error: unknown) {
    await refundImage(guard.dbUser.id, guard.dbUser.plan);
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Image generation error:', msg);

    if (msg.toLowerCase().includes('safety') || msg.toLowerCase().includes('block')) {
      return NextResponse.json(
        { error: 'Image could not be generated — try rephrasing your description.', code: 'SAFETY_BLOCK' },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { error: 'Image generation is temporarily unavailable. Try again shortly.' },
      { status: 500 }
    );
  }
}
