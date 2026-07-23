-- CreateEnum
CREATE TYPE "LiveMode" AS ENUM ('VIDEO', 'AUDIO');
CREATE TYPE "LiveSeatRole" AS ENUM ('HOST', 'GUEST');
CREATE TYPE "LiveMicRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "LivePkStatus" AS ENUM ('PENDING', 'ACTIVE', 'ENDED', 'CANCELLED');

-- AlterTable LiveSession
ALTER TABLE "LiveSession" ADD COLUMN "mode" "LiveMode" NOT NULL DEFAULT 'VIDEO',
ADD COLUMN "maxGuests" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN "seatsOpen" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "queueEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "activePkId" TEXT;

CREATE INDEX "LiveSession_status_mode_idx" ON "LiveSession"("status", "mode");

-- LiveSeat
CREATE TABLE "LiveSeat" (
    "id" TEXT NOT NULL,
    "liveId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seatIndex" INTEGER NOT NULL,
    "role" "LiveSeatRole" NOT NULL DEFAULT 'GUEST',
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "cameraOff" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    CONSTRAINT "LiveSeat_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LiveSeat_liveId_seatIndex_key" ON "LiveSeat"("liveId", "seatIndex");
CREATE INDEX "LiveSeat_liveId_leftAt_idx" ON "LiveSeat"("liveId", "leftAt");
CREATE INDEX "LiveSeat_userId_leftAt_idx" ON "LiveSeat"("userId", "leftAt");
ALTER TABLE "LiveSeat" ADD CONSTRAINT "LiveSeat_liveId_fkey" FOREIGN KEY ("liveId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiveSeat" ADD CONSTRAINT "LiveSeat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- LiveMicRequest
CREATE TABLE "LiveMicRequest" (
    "id" TEXT NOT NULL,
    "liveId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "LiveMicRequestStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    CONSTRAINT "LiveMicRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LiveMicRequest_liveId_status_createdAt_idx" ON "LiveMicRequest"("liveId", "status", "createdAt");
CREATE INDEX "LiveMicRequest_userId_status_idx" ON "LiveMicRequest"("userId", "status");
ALTER TABLE "LiveMicRequest" ADD CONSTRAINT "LiveMicRequest_liveId_fkey" FOREIGN KEY ("liveId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiveMicRequest" ADD CONSTRAINT "LiveMicRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- LivePk
CREATE TABLE "LivePk" (
    "id" TEXT NOT NULL,
    "challengerLiveId" TEXT NOT NULL,
    "opponentLiveId" TEXT NOT NULL,
    "status" "LivePkStatus" NOT NULL DEFAULT 'PENDING',
    "durationSeconds" INTEGER NOT NULL DEFAULT 180,
    "challengerScore" INTEGER NOT NULL DEFAULT 0,
    "opponentScore" INTEGER NOT NULL DEFAULT 0,
    "winnerLiveId" TEXT,
    "startedAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LivePk_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LivePk_status_endsAt_idx" ON "LivePk"("status", "endsAt");
CREATE INDEX "LivePk_challengerLiveId_status_idx" ON "LivePk"("challengerLiveId", "status");
CREATE INDEX "LivePk_opponentLiveId_status_idx" ON "LivePk"("opponentLiveId", "status");
ALTER TABLE "LivePk" ADD CONSTRAINT "LivePk_challengerLiveId_fkey" FOREIGN KEY ("challengerLiveId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivePk" ADD CONSTRAINT "LivePk_opponentLiveId_fkey" FOREIGN KEY ("opponentLiveId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FanClub
CREATE TABLE "FanClub" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "badge" TEXT NOT NULL DEFAULT '✦',
    "joinCost" INTEGER NOT NULL DEFAULT 10,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FanClub_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FanClub_ownerId_key" ON "FanClub"("ownerId");
ALTER TABLE "FanClub" ADD CONSTRAINT "FanClub_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "FanClubMember" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "intimacyPoints" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FanClubMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FanClubMember_clubId_userId_key" ON "FanClubMember"("clubId", "userId");
CREATE INDEX "FanClubMember_userId_idx" ON "FanClubMember"("userId");
CREATE INDEX "FanClubMember_clubId_intimacyPoints_idx" ON "FanClubMember"("clubId", "intimacyPoints");
ALTER TABLE "FanClubMember" ADD CONSTRAINT "FanClubMember_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "FanClub"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FanClubMember" ADD CONSTRAINT "FanClubMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Levels
CREATE TABLE "UserLevel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wealthXp" INTEGER NOT NULL DEFAULT 0,
    "charmXp" INTEGER NOT NULL DEFAULT 0,
    "hostXp" INTEGER NOT NULL DEFAULT 0,
    "wealthLevel" INTEGER NOT NULL DEFAULT 1,
    "charmLevel" INTEGER NOT NULL DEFAULT 1,
    "hostLevel" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserLevel_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserLevel_userId_key" ON "UserLevel"("userId");
ALTER TABLE "UserLevel" ADD CONSTRAINT "UserLevel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tasks
CREATE TABLE "TaskDefinition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rewardPoints" INTEGER NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'DAILY',
    "targetCount" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "TaskDefinition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TaskDefinition_code_key" ON "TaskDefinition"("code");

CREATE TABLE "TaskClaim" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "periodKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TaskClaim_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TaskClaim_taskId_userId_periodKey_key" ON "TaskClaim"("taskId", "userId", "periodKey");
CREATE INDEX "TaskClaim_userId_periodKey_idx" ON "TaskClaim"("userId", "periodKey");
ALTER TABLE "TaskClaim" ADD CONSTRAINT "TaskClaim_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "TaskDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskClaim" ADD CONSTRAINT "TaskClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
