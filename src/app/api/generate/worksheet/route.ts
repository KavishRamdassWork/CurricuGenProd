import { NextRequest, NextResponse } from 'next/server';
import { generateWorksheetServer } from '@/lib/aiService';
import { requireGenerationAccess, consumeGeneration } from '@/lib/authGuard';
import { Classroom, WeekUnit } from '@/lib/types';
import { z } from 'zod';

const schema = z.object({
  classroom: z.custom<Classroom>(), unit: z.custom<WeekUnit>(),
  type: z.string().max(50).default('Standard'),
  file: z.object({ name: z.string(), mimeType: z.string(), data: z.string() }).optional(),
  userInstruction: z.string().max(300).optional(),
});

export async function POST(req: NextRequest) {
  const guard = await requireGenerationAccess();
  if (!guard.ok) return guard.response;
  try {
    const body = await req.json();
    const { classroom, unit, type, file, userInstruction } = schema.parse(body);
    const content = await generateWorksheetServer(classroom, unit, type, file, userInstruction);
    await consumeGeneration(guard.dbUser.id, guard.dbUser.plan);
    return NextResponse.json({ content });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Generation failed' }, { status: 500 });
  }
}
