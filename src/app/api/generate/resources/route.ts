import { NextRequest, NextResponse } from 'next/server';
import { generateResourcesServer } from '@/lib/aiService';
import { requireGenerationAccess, consumeGeneration } from '@/lib/authGuard';
import { Classroom, WeekUnit } from '@/lib/types';
import { z } from 'zod';

const schema = z.object({
  classroom: z.custom<Classroom>(), unit: z.custom<WeekUnit>(),
  file: z.object({ name: z.string(), mimeType: z.string(), data: z.string() }).optional(),
});

export async function POST(req: NextRequest) {
  const guard = await requireGenerationAccess();
  if (!guard.ok) return guard.response;
  try {
    const { classroom, unit, file } = schema.parse(await req.json());
    const content = await generateResourcesServer(classroom, unit, file);
    await consumeGeneration(guard.dbUser.id, guard.dbUser.plan);
    return NextResponse.json({ content });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Generation failed' }, { status: 500 });
  }
}
