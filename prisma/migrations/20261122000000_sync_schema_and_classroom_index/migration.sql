-- Brings the migration history in line with schema.prisma.
--
-- The earlier migrations never captured the BETA plan, the daily-reset column or the extended
-- classroom profile (the live database was evidently synced with `prisma db push`), so a fresh
-- `prisma migrate deploy` produced a database the application could not run against.
--
-- Every statement is idempotent (IF NOT EXISTS / safe re-SET), so this is safe to apply both to a
-- fresh database and to one that already has these objects.

-- Plan enum: BETA
ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'BETA';

-- User: daily free-generation reset marker, and the current default allowance
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastGenerationDate" TIMESTAMP(3);
ALTER TABLE "User" ALTER COLUMN "generationsLeft" SET DEFAULT 10;

-- Classroom: advanced student customisation
ALTER TABLE "Classroom" ADD COLUMN IF NOT EXISTS "learningStyles" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Classroom" ADD COLUMN IF NOT EXISTS "accommodations" TEXT;
ALTER TABLE "Classroom" ADD COLUMN IF NOT EXISTS "studentInterests" TEXT;

-- Classroom: serves "list a user's classrooms, newest first"
CREATE INDEX IF NOT EXISTS "Classroom_userId_updatedAt_idx" ON "Classroom"("userId", "updatedAt");
