CREATE UNIQUE INDEX "CallSession_active_payment_source_key"
ON "CallSession"("paymentSourceType", "paymentSourceId")
WHERE "paymentSourceId" IS NOT NULL
  AND "status" IN ('REQUESTED', 'ACCEPTED', 'CONNECTING', 'ACTIVE');
