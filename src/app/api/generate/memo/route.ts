import { NextRequest, NextResponse } from 'next/server';
import { generateMemoServer } from '@/lib/aiService';
import { requireGenerationAccess } from '@/lib/authGuard';
import { handleGenerationError } from '@/lib/generationErrors';
import { AUDITED_CONTENT_CHARS, auditPromptInputs } from '@/lib/promptSafety';
import { z } from 'zod';
import { classroomInputSchema } from '@/lib/requestSchemas';

const schema = z.object({ contentToGrade: z.string().max(30000), classroom: classroomInputSchema });

// Gemini calls (55 s timeout, one retry) need more than the platform default.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const guard = await requireGenerationAccess();
  if (!guard.ok) return guard.response;
  try {
    const body = await req.json();
    const { contentToGrade, classroom } = schema.parse(body);
    auditPromptInputs('memo', guard.dbUser.id, [
      classroom.teachingNotes,
      classroom.accommodations,
      classroom.studentInterests,
      contentToGrade.slice(0, AUDITED_CONTENT_CHARS),
    ]);
    const content = await generateMemoServer(contentToGrade, classroom);
    return NextResponse.json({ content });
  } catch (error: unknown) {
    return handleGenerationError(error, guard.dbUser, 'memo');
  }
}
