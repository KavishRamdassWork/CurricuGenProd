import { NextRequest, NextResponse } from 'next/server';
import { analyzeClassPerformanceServer } from '@/lib/aiService';
import { requireGenerationAccess, consumeGeneration } from '@/lib/authGuard';
import { Student } from '@/lib/types';
import { z } from 'zod';

const schema = z.object({
  students: z.array(z.object({
    id: z.string(), name: z.string(),
    marks: z.record(z.string(), z.number()).optional(),
    average: z.number().optional(),
  })).max(200),
});

export async function POST(req: NextRequest) {
  const guard = await requireGenerationAccess();
  if (!guard.ok) return guard.response;
  try {
    const { students } = schema.parse(await req.json());
    const analysis = await analyzeClassPerformanceServer(students as Student[]);
    await consumeGeneration(guard.dbUser.id, guard.dbUser.plan);
    return NextResponse.json({ analysis });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Analysis failed' }, { status: 500 });
  }
}
