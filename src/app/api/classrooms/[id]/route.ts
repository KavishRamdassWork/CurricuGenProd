import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

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

  const body = await req.json();

  // Only allow safe fields to be updated
  const allowedFields: string[] = [
    'name', 'subject', 'grade', 'curriculum', 'studentCount',
    'averagePercentile', 'teachingNotes', 'blueprint',
    'learningStyles', 'accommodations', 'studentInterests',
    'students', 'assessmentColumns', 'savedLessons', 'analysis',
  ];

  const data: Record<string, any> = {};
  for (const field of allowedFields) {
    if (field in body) data[field] = body[field];
  }

  const classroom = await prisma.classroom.update({
    where: { id },
    data,
  });

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
