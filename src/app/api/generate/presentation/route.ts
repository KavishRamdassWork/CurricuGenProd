import { NextRequest, NextResponse } from 'next/server';
import { generatePresentationServer } from '@/lib/aiService';
import { requireGenerationAccess } from '@/lib/authGuard';
import { handleGenerationError } from '@/lib/generationErrors';
import { auditPromptInputs } from '@/lib/promptSafety';
import { z } from 'zod';
import { classroomInputSchema, unitSchema } from '@/lib/requestSchemas';

const schema = z.object({ classroom: classroomInputSchema, units: z.array(unitSchema).max(60) });

// Gemini calls (55 s timeout, one retry) need more than the platform default.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const guard = await requireGenerationAccess();
  if (!guard.ok) return guard.response;
  try {
    const { classroom, units } = schema.parse(await req.json());
    auditPromptInputs('presentation', guard.dbUser.id, [classroom.teachingNotes, classroom.accommodations, classroom.studentInterests]);
    const content = await generatePresentationServer(classroom, units);
    return NextResponse.json({ content });
  } catch (error: unknown) {
    return handleGenerationError(error, guard.dbUser, 'presentation');
  }
}
