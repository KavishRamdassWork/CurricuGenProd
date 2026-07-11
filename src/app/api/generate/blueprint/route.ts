import { NextRequest, NextResponse } from 'next/server';
import { generateBlueprintServer } from '@/lib/aiService';
import { requireGenerationAccess, consumeGeneration } from '@/lib/authGuard';
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

export async function POST(req: NextRequest) {
  const guard = await requireGenerationAccess();
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();
    const classroom = classroomSchema.parse(body.classroom);
    const blueprint = await generateBlueprintServer(classroom as Classroom);
    await consumeGeneration(guard.dbUser.id, guard.dbUser.plan);
    return NextResponse.json({ blueprint });
  } catch (error: unknown) {
    console.error('Blueprint generation error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Generation failed' }, { status: 500 });
  }
}
