CREATE TYPE "RestrictionType" AS ENUM ('CALL','CHAT','GIFT','WITHDRAWAL');
CREATE TABLE "UserRestriction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "RestrictionType" NOT NULL,
  "reason" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "appliedBy" TEXT,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserRestriction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserRestriction_sourceType_sourceId_type_key" ON "UserRestriction"("sourceType","sourceId","type");
CREATE INDEX "UserRestriction_userId_type_expiresAt_revokedAt_idx" ON "UserRestriction"("userId","type","expiresAt","revokedAt");
