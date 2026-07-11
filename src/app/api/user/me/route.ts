import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { Plan } from '@prisma/client';

/** GET /api/user/me — get current user's profile and subscription status */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let dbUser = await prisma.user.findUnique({
    where: { clerkId: user.id },
    select: { id: true, email: true, name: true, plan: true, generationsLeft: true, imagesLeft: true, createdAt: true },
  });

  // Auto-create user if webhook hasn't fired yet (race condition safety)
  if (!dbUser) {
    const email = user.emailAddresses?.[0]?.emailAddress || '';
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || email;

    const betaEmails = (process.env.BETA_TESTER_EMAILS || "")
      .toLowerCase()
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    const isBeta = email && betaEmails.includes(email.toLowerCase());
    const plan: Plan = isBeta ? 'BETA' : 'FREE';

    try {
      dbUser = await prisma.user.create({
        data: {
          clerkId: user.id,
          email,
          name,
          plan,
          generationsLeft: 10,
          imagesLeft: 1,
          lastGenerationDate: new Date()
        },
        select: { id: true, email: true, name: true, plan: true, generationsLeft: true, imagesLeft: true, createdAt: true },
      });
    } catch (err) {
      console.error('Failed to auto-create user', err);
      return NextResponse.json({ error: 'Failed to create user profile. Email may already be in use by another test account?' }, { status: 500 });
    }
  }

  return NextResponse.json({ user: dbUser });
}
