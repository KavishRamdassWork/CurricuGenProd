import { NextRequest, NextResponse } from 'next/server';
import { analyzeClassPerformanceServer } from '@/lib/aiService';
import { requireGenerationAccess } from '@/lib/authGuard';
import { handleGenerationError } from '@/lib/generationErrors';
import { auditPromptInputs } from '@/lib/promptSafety';
import { Student } from '@/lib/types';
import { z } from 'zod';

const schema = z.object({
  students: z.array(z.object({
    id: z.string(), name: z.string(),
    marks: z.record(z.string(), z.number()).optional(),
    average: z.number().optional(),
  })).max(200),
});

// Gemini calls (55 s timeout, one retry) need more than the platform default.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const guard = await requireGenerationAccess();
  if (!guard.ok) return guard.response;
  try {
    const { students } = schema.parse(await req.json());
    auditPromptInputs('analyze', guard.dbUser.id, students.map((s) => s.name));
    const analysis = await analyzeClassPerformanceServer(students as Student[]);
    return NextResponse.json({ analysis });
  } catch (error: unknown) {
    return handleGenerationError(error, guard.dbUser, 'analyze');
  }
}
