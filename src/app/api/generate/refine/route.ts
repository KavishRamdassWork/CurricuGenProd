import { NextRequest, NextResponse } from 'next/server';
import { refineContentServer } from '@/lib/aiService';
import { requireGenerationAccess, refundGeneration } from '@/lib/authGuard';
import { z } from 'zod';
import { uploadedFileSchema } from '@/lib/requestSchemas';

const schema = z.object({
  currentContent: z.string().max(50000),
  instruction: z.string().max(300),
  contextType: z.string().max(50),
  file: uploadedFileSchema.optional(),
});

// Gemini calls (55 s timeout, one retry) need more than the platform default.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const guard = await requireGenerationAccess();
  if (!guard.ok) return guard.response;
  try {
    const { currentContent, instruction, contextType, file } = schema.parse(await req.json());
    const content = await refineContentServer(currentContent, instruction, contextType, file);
    return NextResponse.json({ content });
  } catch (error: unknown) {
    await refundGeneration(guard.dbUser.id, guard.dbUser.plan);
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid request data.' }, { status: 400 });
    console.error('Generation error:', error);
    return NextResponse.json({ error: 'Generation failed. Please try again.' }, { status: 500 });
  }
}
