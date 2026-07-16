ALTER TABLE "CallSession"
  ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'AGORA',
  ADD COLUMN "providerSessionId" TEXT,
  ADD COLUMN "endedBy" TEXT,
  ADD COLUMN "disputeStatus" TEXT NOT NULL DEFAULT 'NONE';

CREATE INDEX "CallSession_createdAt_idx" ON "CallSession"("createdAt");
CREATE INDEX "CallSession_disputeStatus_createdAt_idx" ON "CallSession"("disputeStatus", "createdAt");
