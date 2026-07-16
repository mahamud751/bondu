ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'DISPUTED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CHARGEBACK';
CREATE TABLE "PaymentDispute" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "gatewayDisputeId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "reason" TEXT,
  "status" TEXT NOT NULL,
  "evidenceDueAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentDispute_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentDispute_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PaymentDispute_gatewayDisputeId_key" ON "PaymentDispute"("gatewayDisputeId");
CREATE INDEX "PaymentDispute_status_createdAt_idx" ON "PaymentDispute"("status","createdAt");
CREATE INDEX "PaymentDispute_paymentId_createdAt_idx" ON "PaymentDispute"("paymentId","createdAt");
