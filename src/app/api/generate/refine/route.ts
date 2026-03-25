import { NextRequest, NextResponse } from 'next/server';
import { refineContentServer } from '@/lib/aiService';
import { requireGenerationAccess, consumeGeneration } from '@/lib/authGuard';
import { z } from 'zod';

const schema = z.object({
  currentContent: z.string().max(50000),
  instruction: z.string().max(300),
  contextType: z.string().max(50),
  file: z.object({ name: z.string(), mimeType: z.string(), data: z.string() }).optional(),
});

export async function POST(req: NextRequest) {
  const guard = await requireGenerationAccess();
  if (!guard.ok) return guard.response;
  try {
    const { currentContent, instruction, contextType, file } = schema.parse(await req.json());
    const content = await refineContentServer(currentContent, instruction, contextType, file);
    await consumeGeneration(guard.dbUser.id, guard.dbUser.plan);
    return NextResponse.json({ content });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Generation failed' }, { status: 500 });
  }
}
