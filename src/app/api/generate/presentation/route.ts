import { NextRequest, NextResponse } from 'next/server';
import { generatePresentationServer } from '@/lib/aiService';
import { requireGenerationAccess, consumeGeneration } from '@/lib/authGuard';
import { z } from 'zod';

const schema = z.object({ classroom: z.any(), units: z.array(z.any()) });

export async function POST(req: NextRequest) {
  const guard = await requireGenerationAccess();
  if (!guard.ok) return guard.response;
  try {
    const { classroom, units } = schema.parse(await req.json());
    const content = await generatePresentationServer(classroom, units);
    await consumeGeneration(guard.dbUser.id, guard.dbUser.plan);
    return NextResponse.json({ content });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Generation failed' }, { status: 500 });
  }
}
