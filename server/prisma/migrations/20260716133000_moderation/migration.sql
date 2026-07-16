ALTER TABLE "Report" ADD COLUMN "evidenceUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Report" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "Report" ADD COLUMN "assignedModeratorId" TEXT;
ALTER TABLE "Report" ADD COLUMN "resolution" TEXT;
ALTER TABLE "Report" ADD COLUMN "resolvedAt" TIMESTAMP(3);
CREATE TABLE "BlockedTerm" (
  "id" TEXT NOT NULL,
  "term" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'BLOCK',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BlockedTerm_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BlockedTerm_term_key" ON "BlockedTerm"("term");
CREATE TABLE "ModerationEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "category" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "matchedText" TEXT,
  "action" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModerationEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ModerationEvent_userId_createdAt_idx" ON "ModerationEvent"("userId", "createdAt");
CREATE INDEX "ModerationEvent_category_createdAt_idx" ON "ModerationEvent"("category", "createdAt");
