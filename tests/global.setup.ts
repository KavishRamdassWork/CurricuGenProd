import { test as setup } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
// Using standard setup procedure for wiping/seeding isolated databases.

setup('Seed clean database for testing', async () => {
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
    console.error('Failed to wipe or seed database:', err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
});
