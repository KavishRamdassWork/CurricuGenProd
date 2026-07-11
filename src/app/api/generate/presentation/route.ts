import { NextRequest, NextResponse } from 'next/server';
import { generatePresentationServer } from '@/lib/aiService';
import { requireGenerationAccess, consumeGeneration } from '@/lib/authGuard';
import { Classroom, WeekUnit } from '@/lib/types';
import { z } from 'zod';

const schema = z.object({ classroom: z.custom<Classroom>(), units: z.array(z.custom<WeekUnit>()) });

export async function POST(req: NextRequest) {
  const guard = await requireGenerationAccess();
  if (!guard.ok) return guard.response;
  try {
    const { classroom, units } = schema.parse(await req.json());
    const content = await generatePresentationServer(classroom, units);
    await consumeGeneration(guard.dbUser.id, guard.dbUser.plan);
    return NextResponse.json({ content });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Generation failed' }, { status: 500 });
  }
}
