import { NextRequest, NextResponse } from 'next/server';
import { generateWorksheetServer } from '@/lib/aiService';
import { requireGenerationAccess } from '@/lib/authGuard';
import { handleGenerationError } from '@/lib/generationErrors';
import { auditPromptInputs } from '@/lib/promptSafety';
import { z } from 'zod';
import { classroomInputSchema, unitSchema, uploadedFileSchema, worksheetTypeSchema } from '@/lib/requestSchemas';

const schema = z.object({
  classroom: classroomInputSchema, unit: unitSchema,
  type: worksheetTypeSchema,
  file: uploadedFileSchema.optional(),
  userInstruction: z.string().max(300).optional(),
});

// Gemini calls (55 s timeout, one retry) need more than the platform default.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const guard = await requireGenerationAccess();
  if (!guard.ok) return guard.response;
  try {
    const body = await req.json();
    const { classroom, unit, type, file, userInstruction } = schema.parse(body);
    auditPromptInputs('worksheet', guard.dbUser.id, [userInstruction, classroom.teachingNotes, classroom.accommodations, classroom.studentInterests]);
    const content = await generateWorksheetServer(classroom, unit, type, file, userInstruction);
    return NextResponse.json({ content });
  } catch (error: unknown) {
    return handleGenerationError(error, guard.dbUser, 'worksheet');
  }
}
