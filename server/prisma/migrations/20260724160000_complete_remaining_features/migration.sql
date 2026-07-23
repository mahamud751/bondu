ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "localePreference" TEXT NOT NULL DEFAULT 'en';

CREATE TABLE IF NOT EXISTS "SuperFan" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'SUPER',
    "entryFx" TEXT NOT NULL DEFAULT 'GOLD_WAVE',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SuperFan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SuperFan_hostId_userId_key" ON "SuperFan"("hostId", "userId");
CREATE INDEX IF NOT EXISTS "SuperFan_hostId_idx" ON "SuperFan"("hostId");
CREATE INDEX IF NOT EXISTS "SuperFan_userId_idx" ON "SuperFan"("userId");
ALTER TABLE "SuperFan" DROP CONSTRAINT IF EXISTS "SuperFan_hostId_fkey";
ALTER TABLE "SuperFan" ADD CONSTRAINT "SuperFan_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SuperFan" DROP CONSTRAINT IF EXISTS "SuperFan_userId_fkey";
ALTER TABLE "SuperFan" ADD CONSTRAINT "SuperFan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "PlatformEvent" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "giftBonusPct" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformEvent_code_key" ON "PlatformEvent"("code");
CREATE INDEX IF NOT EXISTS "PlatformEvent_active_startsAt_endsAt_idx" ON "PlatformEvent"("active", "startsAt", "endsAt");

CREATE TABLE IF NOT EXISTS "BeautyPreset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "smooth" INTEGER NOT NULL DEFAULT 40,
    "whiten" INTEGER NOT NULL DEFAULT 20,
    "slim" INTEGER NOT NULL DEFAULT 10,
    "bigEye" INTEGER NOT NULL DEFAULT 0,
    "filterId" TEXT NOT NULL DEFAULT 'natural',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BeautyPreset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BeautyPreset_userId_key" ON "BeautyPreset"("userId");
ALTER TABLE "BeautyPreset" DROP CONSTRAINT IF EXISTS "BeautyPreset_userId_fkey";
ALTER TABLE "BeautyPreset" ADD CONSTRAINT "BeautyPreset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "LiveCoachTip" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "message" TEXT NOT NULL,
    "minViewers" INTEGER NOT NULL DEFAULT 0,
    "maxViewers" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "LiveCoachTip_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LiveCoachTip_code_key" ON "LiveCoachTip"("code");
