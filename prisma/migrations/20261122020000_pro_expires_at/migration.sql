-- When a Pro subscription is cancelled, access continues until the end of the period already paid for.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "proExpiresAt" TIMESTAMP(3);
