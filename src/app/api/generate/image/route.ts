import { NextRequest, NextResponse } from 'next/server';
import { generateEducationalImageServer } from '@/lib/aiService';
import { requireGenerationAccess, consumeGeneration } from '@/lib/authGuard';
import { z } from 'zod';

const schema = z.object({
  unit: z.object({
    weekNumber: z.number(), topicTitle: z.string().max(200),
    summary: z.string().max(500), learningOutcome: z.string().max(500),
  }),
});

export async function POST(req: NextRequest) {
  const guard = await requireGenerationAccess();
  if (!guard.ok) return guard.response;
  try {
    const { unit } = schema.parse(await req.json());
    const imageUrl = await generateEducationalImageServer(unit);
    await consumeGeneration(guard.dbUser.id, guard.dbUser.plan);
    return NextResponse.json({ imageUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Generation failed' }, { status: 500 });
  }
}
