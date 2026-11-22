import { NextRequest, NextResponse } from 'next/server';
import { generateBlueprintServer } from '@/lib/aiService';
import { requireGenerationAccess, refundGeneration } from '@/lib/authGuard';
import { Classroom, Student } from '@/lib/types';
import { z } from 'zod';

const classroomSchema = z.object({
  id: z.string(),
  name: z.string().max(100),
  subject: z.string().max(100),
  grade: z.string().max(50),
  curriculum: z.string().max(100),
  studentCount: z.number().int().min(1).max(500),
  averagePercentile: z.number().min(0).max(100),
  teachingNotes: z.string().max(1000).default(''),
  learningStyles: z.array(z.string()).optional(),
  accommodations: z.string().nullable().optional(),
  studentInterests: z.string().nullable().optional(),
  students: z.array(z.custom<Student>()).default([]),
  assessmentColumns: z.array(z.string()).default([]),
});

// Gemini calls (55 s timeout, one retry) need more than the platform default.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const guard = await requireGenerationAccess();
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();
    const classroom = classroomSchema.parse(body.classroom);
    const blueprint = await generateBlueprintServer(classroom as Classroom);
    return NextResponse.json({ blueprint });
  } catch (error: unknown) {
    await refundGeneration(guard.dbUser.id, guard.dbUser.plan);
    console.error('Blueprint generation error:', error);
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid request data.' }, { status: 400 });
    console.error('Generation error:', error);
    return NextResponse.json({ error: 'Generation failed. Please try again.' }, { status: 500 });
  }
}
