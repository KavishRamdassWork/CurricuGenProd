import { NextRequest, NextResponse } from 'next/server';
import { generateLessonPlanServer } from '@/lib/aiService';
import { requireGenerationAccess } from '@/lib/authGuard';
import { handleGenerationError } from '@/lib/generationErrors';
import { auditPromptInputs } from '@/lib/promptSafety';
import { z } from 'zod';
import { classroomInputSchema, unitSchema, uploadedFileSchema } from '@/lib/requestSchemas';

const schema = z.object({
  classroom: classroomInputSchema,
  units: z.array(unitSchema).max(60),
  file: uploadedFileSchema.optional(),
});

// Gemini calls (55 s timeout, one retry) need more than the platform default.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const guard = await requireGenerationAccess();
  if (!guard.ok) return guard.response;
  try {
    const body = await req.json();
    const { classroom, units, file } = schema.parse(body);
    auditPromptInputs('lesson-plan', guard.dbUser.id, [classroom.teachingNotes, classroom.accommodations, classroom.studentInterests]);
    const content = await generateLessonPlanServer(classroom, units, file);
    return NextResponse.json({ content });
  } catch (error: unknown) {
    return handleGenerationError(error, guard.dbUser, 'lesson-plan');
  }
}
