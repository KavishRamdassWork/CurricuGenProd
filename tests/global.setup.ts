import { test as setup } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
// Using standard setup procedure for wiping/seeding isolated databases.

/**
 * The wipe below deletes every user and classroom in whatever DATABASE_URL points at, so it refuses
 * to run unless that is a local database (the docker test DB from .env.test.example). Same check as
 * tests/api/generation-credits.spec.ts.
 */
const dbUrl = process.env.DATABASE_URL ?? '';
const isLocalDb = /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(dbUrl);

setup('Seed clean database for testing', async () => {
  if (!isLocalDb) {
    // Never print the URL itself: it may carry credentials for a hosted database.
    throw new Error(
      'Refusing to wipe the database: DATABASE_URL does not point at localhost/127.0.0.1. ' +
        'Point it at the local test database (see .env.test.example), or run tests that do not need ' +
        'the seed with --no-deps.',
    );
  }

  // It is extremely important that the Prisma client runs against the TEST database
  // as defined in .env.test
  const prisma = new PrismaClient();

  try {
    console.log('--- Wiping Test Database Data ---');

    // Deleting linearly avoids foreign key constraint errors
    await prisma.classroom.deleteMany({});

    // Delete all users created during previous test runs
    await prisma.user.deleteMany({});

    console.log('--- Test Database Cleared Successfully ---');

    // Setup generic user data mapping for API tests...
    // The Clerk payload will inject these users automatically during webhooks,
    // but tests might require a seeded user pre-established.
    await prisma.user.create({
      data: {
        clerkId: 'test_clerk_user_default',
        email: 'tester@edumaster.local',
        name: 'Automated Tester',
        plan: 'FREE',
        generationsLeft: 3
      }
    });

    console.log('--- Default Mock User Seeded ---');

  } catch (err) {
    console.error('Failed to wipe or seed database:', err instanceof Error ? err.name : typeof err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
});
