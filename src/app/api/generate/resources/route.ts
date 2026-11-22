import { NextRequest, NextResponse } from 'next/server';
import { generateResourcesServer } from '@/lib/aiService';
import { requireGenerationAccess, refundGeneration } from '@/lib/authGuard';
import { z } from 'zod';
import { classroomInputSchema, unitSchema, uploadedFileSchema } from '@/lib/requestSchemas';

const schema = z.object({
  classroom: classroomInputSchema, unit: unitSchema,
  file: uploadedFileSchema.optional(),
});

// Gemini calls (55 s timeout, one retry) need more than the platform default.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const guard = await requireGenerationAccess();
  if (!guard.ok) return guard.response;
  try {
    const { classroom, unit, file } = schema.parse(await req.json());
    const content = await generateResourcesServer(classroom, unit, file);
    return NextResponse.json({ content });
  } catch (error: unknown) {
    await refundGeneration(guard.dbUser.id, guard.dbUser.plan);
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid request data.' }, { status: 400 });
    console.error('Generation error:', error);
    return NextResponse.json({ error: 'Generation failed. Please try again.' }, { status: 500 });
  }
}
