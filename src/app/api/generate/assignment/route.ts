import { NextRequest, NextResponse } from 'next/server';
import { generateAssignmentServer } from '@/lib/aiService';
import { requireGenerationAccess, consumeGeneration } from '@/lib/authGuard';
import { z } from 'zod';

const schema = z.object({
  classroom: z.any(), unit: z.any(),
  file: z.object({ name: z.string(), mimeType: z.string(), data: z.string() }).optional(),
  userInstruction: z.string().max(300).optional(),
});

export async function POST(req: NextRequest) {
  const guard = await requireGenerationAccess();
  if (!guard.ok) return guard.response;
  try {
    const body = await req.json();
    const { classroom, unit, file, userInstruction } = schema.parse(body);
    const content = await generateAssignmentServer(classroom, unit, file, userInstruction);
    await consumeGeneration(guard.dbUser.id, guard.dbUser.plan);
    return NextResponse.json({ content });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Generation failed' }, { status: 500 });
  }
}
