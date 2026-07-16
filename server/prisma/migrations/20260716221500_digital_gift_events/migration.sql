ALTER TABLE "DigitalGift" ADD COLUMN "animationUrl" TEXT,
ADD COLUMN "category" TEXT NOT NULL DEFAULT 'STANDARD',
ADD COLUMN "enabledInCalls" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "enabledInChats" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "GiftTransaction" (
  "id" TEXT NOT NULL,
  "giftId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "receiverId" TEXT NOT NULL,
  "callId" TEXT,
  "conversationId" TEXT,
  "grossAmount" INTEGER NOT NULL,
  "vendorAmount" INTEGER NOT NULL,
  "platformAmount" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GiftTransaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GiftTransaction_giftId_fkey" FOREIGN KEY ("giftId") REFERENCES "DigitalGift"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GiftTransaction_amounts_valid" CHECK ("grossAmount" > 0 AND "vendorAmount" >= 0 AND "platformAmount" >= 0 AND "vendorAmount" + "platformAmount" = "grossAmount")
);
CREATE UNIQUE INDEX "GiftTransaction_idempotencyKey_key" ON "GiftTransaction"("idempotencyKey");
CREATE INDEX "GiftTransaction_receiverId_createdAt_idx" ON "GiftTransaction"("receiverId","createdAt");
CREATE INDEX "GiftTransaction_senderId_createdAt_idx" ON "GiftTransaction"("senderId","createdAt");
CREATE INDEX "GiftTransaction_callId_createdAt_idx" ON "GiftTransaction"("callId","createdAt");
CREATE INDEX "GiftTransaction_conversationId_createdAt_idx" ON "GiftTransaction"("conversationId","createdAt");
