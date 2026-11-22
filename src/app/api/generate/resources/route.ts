import { NextRequest, NextResponse } from 'next/server';
import { generateResourcesServer } from '@/lib/aiService';
import { requireGenerationAccess } from '@/lib/authGuard';
import { handleGenerationError } from '@/lib/generationErrors';
import { auditPromptInputs } from '@/lib/promptSafety';
import { z } from 'zod';
import { classroomInputSchema, unitSchema, uploadedFileSchema } from '@/lib/requestSchemas';

const schema = z.object({
  classroom: classroomInputSchema, unit: unitSchema,
  file: uploadedFileSchema.optional(),
});

// Gemini calls (55 s timeout, one retry) need more than the platform default.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const guard = await requireGenerationAccess();
  if (!guard.ok) return guard.response;
  try {
    const { classroom, unit, file } = schema.parse(await req.json());
    auditPromptInputs('resources', guard.dbUser.id, [classroom.teachingNotes, classroom.accommodations, classroom.studentInterests]);
    const content = await generateResourcesServer(classroom, unit, file);
    return NextResponse.json({ content });
  } catch (error: unknown) {
    return handleGenerationError(error, guard.dbUser, 'resources');
  }
}
