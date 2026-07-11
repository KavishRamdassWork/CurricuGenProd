import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

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

    const body = await req.json();
    const { name, subject, grade, curriculum, studentCount, averagePercentile, teachingNotes, learningStyles, accommodations, studentInterests } = body;

    const classroom = await prisma.classroom.create({
      data: {
        userId: dbUser.id,
        name,
        subject,
        grade,
        curriculum,
        studentCount: Number(studentCount) || 30,
        averagePercentile: Number(averagePercentile) || 65,
        teachingNotes: teachingNotes || '',
        learningStyles: Array.isArray(learningStyles) ? learningStyles : [],
        accommodations: accommodations || null,
        studentInterests: studentInterests || null,
        students: [],
        assessmentColumns: [],
      },
    });

    return NextResponse.json({ classroom }, { status: 201 });
  } catch (error: unknown) {
    console.error('Classroom creation error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}
