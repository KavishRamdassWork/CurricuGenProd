import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { updateClassroomSchema } from '@/lib/classroomSchema';
import { Prisma } from '@prisma/client';

type Params = { params: Promise<{ id: string }> };

const PATCH_RESPONSE_FIELDS = {
  id: true, name: true, subject: true, grade: true, curriculum: true,
  studentCount: true, averagePercentile: true, teachingNotes: true,
  learningStyles: true, accommodations: true, studentInterests: true,
  createdAt: true, updatedAt: true, version: true,
} as const;

async function getClassroomForUser(classroomId: string, clerkId: string) {
  const dbUser = await prisma.user.findUnique({ where: { clerkId } });
  if (!dbUser) return null;
  const classroom = await prisma.classroom.findFirst({
    where: { id: classroomId, userId: dbUser.id },
  });
  return classroom;
}

/** GET /api/classrooms/[id] — get a single classroom */
export async function GET(_req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const classroom = await getClassroomForUser(id, userId);
  if (!classroom) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ classroom });
}

/** PATCH /api/classrooms/[id] — update a classroom (blueprint, students, lessons, etc.) */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const existing = await getClassroomForUser(id, userId);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Only known, bounded fields survive validation (mass-assignment and oversize-payload guard).
  const parsed = updateClassroomSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid classroom data', details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }, { status: 400 });
  }

  const { version, ...fields } = parsed.data;

  // Prisma needs Prisma.JsonNull to store an explicit JSON null; undefined means "leave unchanged".
  const data: Record<string, unknown> = { ...fields };
  for (const field of ['blueprint', 'students', 'assessmentColumns', 'savedLessons', 'analysis'] as const) {
    if (field in data && data[field] === null) data[field] = Prisma.JsonNull;
  }

  // Optimistic locking: when the client says which version it last saw, the write is conditional on
  // that version still being current (checked and applied in one statement). Clients that send no
  // version keep the old last-write-wins behaviour. Ownership was verified by getClassroomForUser.
  let classroom;
  try {
    classroom = await prisma.classroom.update({
      where: version === undefined ? { id } : { id, version },
      data: { ...(data as Prisma.ClassroomUpdateInput), version: { increment: 1 } },
      // The client already holds the big JSON blobs it just sent; echoing them (and the internal
      // userId) back on every autosave only wastes bandwidth.
      select: PATCH_RESPONSE_FIELDS,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      const current = await prisma.classroom.findUnique({ where: { id } });
      if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json(
        { error: 'This classroom was changed somewhere else.', code: 'VERSION_CONFLICT', classroom: current },
        { status: 409 }
      );
    }
    throw error;
  }
  return NextResponse.json({ classroom });
}

/** DELETE /api/classrooms/[id] — delete a classroom */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const existing = await getClassroomForUser(id, userId);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.classroom.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
