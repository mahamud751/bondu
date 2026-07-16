ALTER TABLE "Withdrawal" ADD COLUMN "idempotencyKey" TEXT;
UPDATE "Withdrawal" SET "idempotencyKey" = 'legacy:' || "id" WHERE "idempotencyKey" IS NULL;
ALTER TABLE "Withdrawal" ALTER COLUMN "idempotencyKey" SET NOT NULL;
CREATE UNIQUE INDEX "Withdrawal_idempotencyKey_key" ON "Withdrawal"("idempotencyKey");
