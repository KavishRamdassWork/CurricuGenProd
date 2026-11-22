-- Counts today's capped refunds (malformed or truncated model output). Once it reaches the daily cap
-- such failures keep their credit, so a user cannot get unlimited free model calls by breaking output
-- on purpose. Reset together with "generationsUsedToday" on the first reservation of a new day.
-- Idempotent: safe to re-run.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "generationRefundsToday" INTEGER NOT NULL DEFAULT 0;
