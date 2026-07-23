-- CreateEnum
CREATE TYPE "LiveChatKind" AS ENUM ('USER', 'SYSTEM', 'GIFT');

-- AlterTable
ALTER TABLE "LiveSession" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'CHAT',
ADD COLUMN     "coverUrl" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "likeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalGiftPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "chatMuted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "LiveChatMessage" (
    "id" TEXT NOT NULL,
    "liveId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" "LiveChatKind" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveLike" (
    "id" TEXT NOT NULL,
    "liveId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveBan" (
    "id" TEXT NOT NULL,
    "liveId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveBan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveChatMessage_liveId_createdAt_idx" ON "LiveChatMessage"("liveId", "createdAt");

-- CreateIndex
CREATE INDEX "LiveChatMessage_userId_createdAt_idx" ON "LiveChatMessage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LiveLike_liveId_createdAt_idx" ON "LiveLike"("liveId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LiveLike_liveId_userId_key" ON "LiveLike"("liveId", "userId");

-- CreateIndex
CREATE INDEX "LiveBan_liveId_idx" ON "LiveBan"("liveId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveBan_liveId_userId_key" ON "LiveBan"("liveId", "userId");

-- CreateIndex
CREATE INDEX "LiveSession_status_category_viewerCount_idx" ON "LiveSession"("status", "category", "viewerCount");

-- AddForeignKey
ALTER TABLE "LiveChatMessage" ADD CONSTRAINT "LiveChatMessage_liveId_fkey" FOREIGN KEY ("liveId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveChatMessage" ADD CONSTRAINT "LiveChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveLike" ADD CONSTRAINT "LiveLike_liveId_fkey" FOREIGN KEY ("liveId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveLike" ADD CONSTRAINT "LiveLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveBan" ADD CONSTRAINT "LiveBan_liveId_fkey" FOREIGN KEY ("liveId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveBan" ADD CONSTRAINT "LiveBan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
