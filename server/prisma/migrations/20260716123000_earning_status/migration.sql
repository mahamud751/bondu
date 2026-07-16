CREATE TYPE "EarningStatus" AS ENUM ('PENDING', 'AVAILABLE', 'HELD', 'REFUNDED');
ALTER TABLE "Earning" ADD COLUMN "status" "EarningStatus" NOT NULL DEFAULT 'PENDING';
CREATE INDEX "Earning_status_availableAt_idx" ON "Earning"("status", "availableAt");
