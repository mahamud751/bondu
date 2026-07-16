ALTER TYPE "PaymentGateway" ADD VALUE 'STRIPE';
ALTER TYPE "PaymentGateway" ADD VALUE 'SSLCOMMERZ';
ALTER TABLE "Payment" ALTER COLUMN "receiverNumber" DROP NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "senderNumber" DROP NOT NULL;
ALTER TABLE "Payment" ADD COLUMN "orderReference" TEXT;
ALTER TABLE "Payment" ADD COLUMN "gatewayIntentId" TEXT;
CREATE UNIQUE INDEX "Payment_orderReference_key" ON "Payment"("orderReference");
CREATE UNIQUE INDEX "Payment_gatewayIntentId_key" ON "Payment"("gatewayIntentId");
CREATE TABLE "PaymentWebhook" (
  "id" TEXT NOT NULL,
  "gateway" "PaymentGateway" NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "paymentId" TEXT,
  "payload" JSONB NOT NULL,
  "processedAt" TIMESTAMP(3),
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentWebhook_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentWebhook_gateway_eventId_key" ON "PaymentWebhook"("gateway", "eventId");
CREATE INDEX "PaymentWebhook_processedAt_createdAt_idx" ON "PaymentWebhook"("processedAt", "createdAt");
ALTER TABLE "PaymentWebhook" ADD CONSTRAINT "PaymentWebhook_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
