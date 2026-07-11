import { NextRequest, NextResponse } from 'next/server';
import { generateLessonPlanServer } from '@/lib/aiService';
import { requireGenerationAccess, consumeGeneration } from '@/lib/authGuard';
import { Classroom, WeekUnit } from '@/lib/types';
import { z } from 'zod';

const schema = z.object({
  classroom: z.custom<Classroom>(),
  units: z.array(z.custom<WeekUnit>()),
  file: z.object({ name: z.string(), mimeType: z.string(), data: z.string() }).optional(),
});

export async function POST(req: NextRequest) {
  const guard = await requireGenerationAccess();
  if (!guard.ok) return guard.response;
  try {
    const body = await req.json();
    const { classroom, units, file } = schema.parse(body);
    const content = await generateLessonPlanServer(classroom, units, file);
    await consumeGeneration(guard.dbUser.id, guard.dbUser.plan);
    return NextResponse.json({ content });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Generation failed' }, { status: 500 });
  }
}
