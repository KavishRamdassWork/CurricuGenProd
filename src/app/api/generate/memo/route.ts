import { NextRequest, NextResponse } from 'next/server';
import { generateMemoServer } from '@/lib/aiService';
import { requireGenerationAccess, refundGeneration } from '@/lib/authGuard';
import { Classroom } from '@/lib/types';
import { z } from 'zod';

const schema = z.object({ contentToGrade: z.string().max(30000), classroom: z.custom<Classroom>() });

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
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Generation failed' }, { status: 500 });
  }
}
