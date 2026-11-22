import { NextRequest, NextResponse } from 'next/server';
import { generateAssessmentServer } from '@/lib/aiService';
import { requireGenerationAccess } from '@/lib/authGuard';
import { handleGenerationError } from '@/lib/generationErrors';
import { auditPromptInputs } from '@/lib/promptSafety';
import { z } from 'zod';
import { classroomInputSchema, unitSchema, uploadedFileSchema } from '@/lib/requestSchemas';

const schema = z.object({
  classroom: classroomInputSchema, unit: unitSchema,
  file: uploadedFileSchema.optional(),
  userInstruction: z.string().max(300).optional(),
  scopeUnits: z.array(unitSchema).max(60).optional(),
});

// Gemini calls (55 s timeout, one retry) need more than the platform default.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const guard = await requireGenerationAccess();
  if (!guard.ok) return guard.response;
  try {
    const body = await req.json();
    const { classroom, unit, file, userInstruction, scopeUnits } = schema.parse(body);
    auditPromptInputs('assessment', guard.dbUser.id, [userInstruction, classroom.teachingNotes, classroom.accommodations, classroom.studentInterests]);
    const content = await generateAssessmentServer(classroom, unit, file, userInstruction, scopeUnits);
    return NextResponse.json({ content });
  } catch (error: unknown) {
    return handleGenerationError(error, guard.dbUser, 'assessment');
  }
}
