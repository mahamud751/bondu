-- AlterTable
ALTER TABLE "DigitalGift" ADD COLUMN "enabledInLive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "GiftTransaction" ADD COLUMN "liveId" TEXT;

-- CreateIndex
CREATE INDEX "GiftTransaction_liveId_createdAt_idx" ON "GiftTransaction"("liveId", "createdAt");
