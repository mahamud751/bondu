ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_REFUNDED';
CREATE TABLE "PaymentRefund" (
  "id" TEXT NOT NULL, "paymentId" TEXT NOT NULL, "amount" INTEGER NOT NULL, "reason" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING',
  "gatewayRefundId" TEXT, "idempotencyKey" TEXT NOT NULL, "requestedBy" TEXT NOT NULL, "processedAt" TIMESTAMP(3), "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentRefund_gatewayRefundId_key" ON "PaymentRefund"("gatewayRefundId"); CREATE UNIQUE INDEX "PaymentRefund_idempotencyKey_key" ON "PaymentRefund"("idempotencyKey"); CREATE INDEX "PaymentRefund_paymentId_status_idx" ON "PaymentRefund"("paymentId", "status");
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "PaymentReconciliation" (
  "id" TEXT NOT NULL, "paymentId" TEXT NOT NULL, "gatewayStatus" TEXT NOT NULL, "localStatus" TEXT NOT NULL, "amountMatches" BOOLEAN NOT NULL,
  "statusMatches" BOOLEAN NOT NULL, "discrepancy" TEXT, "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PaymentReconciliation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PaymentReconciliation_checkedAt_discrepancy_idx" ON "PaymentReconciliation"("checkedAt", "discrepancy");
ALTER TABLE "PaymentReconciliation" ADD CONSTRAINT "PaymentReconciliation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
