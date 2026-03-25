import { NextRequest, NextResponse } from 'next/server';
import { generateMemoServer } from '@/lib/aiService';
import { requireGenerationAccess, consumeGeneration } from '@/lib/authGuard';
import { z } from 'zod';

const schema = z.object({ contentToGrade: z.string().max(30000), classroom: z.any() });

export async function POST(req: NextRequest) {
  const guard = await requireGenerationAccess();
  if (!guard.ok) return guard.response;
  try {
    const body = await req.json();
    const { contentToGrade, classroom } = schema.parse(body);
    const content = await generateMemoServer(contentToGrade, classroom);
    await consumeGeneration(guard.dbUser.id, guard.dbUser.plan);
    return NextResponse.json({ content });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Generation failed' }, { status: 500 });
  }
}
