-- Optimistic locking counter for Classroom writes.
ALTER TABLE "Classroom" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0;

-- Accepted PayFast notifications (audit trail + redelivery detection).
CREATE TABLE IF NOT EXISTS "Payment" (
    "id" TEXT NOT NULL,
    "pfPaymentId" TEXT NOT NULL,
    "mPaymentId" TEXT,
    "clerkId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amountGross" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_pfPaymentId_key" ON "Payment"("pfPaymentId");
CREATE INDEX IF NOT EXISTS "Payment_clerkId_createdAt_idx" ON "Payment"("clerkId", "createdAt");
