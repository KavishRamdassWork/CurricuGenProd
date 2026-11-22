-- Daily generations are counted up per day and compared against the effective plan's ceiling
-- (FREE 10, BETA 200, PRO 300) instead of counting a FREE-only balance down.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "generationsUsedToday" INTEGER NOT NULL DEFAULT 0;

-- Carry over today's usage from the old countdown so nobody gets a fresh allowance mid-day.
UPDATE "User" SET "generationsUsedToday" = GREATEST(0, 10 - "generationsLeft") WHERE "lastGenerationDate" >= date_trunc('day', now());
