import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { ensureDbUser } from '@/lib/ensureUser';
import { lapseExpiredPro } from '@/lib/proExpiry';

const PROFILE_SELECT = {
  id: true, email: true, name: true, plan: true, generationsLeft: true, imagesLeft: true, createdAt: true,
} as const;

/** GET /api/user/me — get current user's profile and subscription status */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await lapseExpiredPro({ clerkId: user.id });

  let dbUser = await prisma.user.findUnique({
    where: { clerkId: user.id },
    select: PROFILE_SELECT,
  });

  // Auto-create user if webhook hasn't fired yet (race condition safety). Upsert keyed on clerkId,
  // so a concurrent webhook / generation request creating the same row is harmless.
  if (!dbUser) {
    const email = user.emailAddresses?.[0]?.emailAddress || '';
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || email;

    try {
      dbUser = await ensureDbUser(
        { clerkId: user.id, email, name, imageUrl: user.imageUrl },
        PROFILE_SELECT
      );
    } catch (err) {
      console.error('Failed to auto-create user', err);
      return NextResponse.json({ error: 'Failed to create user profile.' }, { status: 500 });
    }
  }

  return NextResponse.json({ user: dbUser });
}
