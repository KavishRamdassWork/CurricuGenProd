import { NextRequest, NextResponse } from 'next/server';
import { generateMemoServer } from '@/lib/aiService';
import { requireGenerationAccess, refundGeneration } from '@/lib/authGuard';
import { z } from 'zod';
import { classroomInputSchema } from '@/lib/requestSchemas';

const schema = z.object({ contentToGrade: z.string().max(30000), classroom: classroomInputSchema });

// Gemini calls (55 s timeout, one retry) need more than the platform default.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const guard = await requireGenerationAccess();
  if (!guard.ok) return guard.response;
  try {
    const body = await req.json();
    const { contentToGrade, classroom } = schema.parse(body);
    const content = await generateMemoServer(contentToGrade, classroom);
    return NextResponse.json({ content });
  } catch (error: unknown) {
    await refundGeneration(guard.dbUser.id, guard.dbUser.plan);
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid request data.' }, { status: 400 });
    console.error('Generation error:', error);
    return NextResponse.json({ error: 'Generation failed. Please try again.' }, { status: 500 });
  }
}
