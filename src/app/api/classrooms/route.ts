import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { createClassroomSchema } from '@/lib/classroomSchema';

/** Cap per account so one user cannot create unbounded rows. */
const MAX_CLASSROOMS_PER_USER = 50;

/** GET /api/classrooms — list all classrooms for the authenticated user */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const classrooms = await prisma.classroom.findMany({
    where: { userId: dbUser.id },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json({ classrooms });
}

/** POST /api/classrooms — create a new classroom */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = createClassroomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid classroom data', details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }, { status: 400 });
    }

    const existing = await prisma.classroom.count({ where: { userId: dbUser.id } });
    if (existing >= MAX_CLASSROOMS_PER_USER) {
      return NextResponse.json({ error: `Classroom limit reached (${MAX_CLASSROOMS_PER_USER}). Delete one to add another.` }, { status: 409 });
    }

    const classroom = await prisma.classroom.create({
      data: {
        ...parsed.data,
        userId: dbUser.id,
        students: [],
        assessmentColumns: [],
      },
    });

    return NextResponse.json({ classroom }, { status: 201 });
  } catch (error: unknown) {
    console.error('Classroom creation error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
