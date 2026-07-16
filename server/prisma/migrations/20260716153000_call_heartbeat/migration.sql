ALTER TABLE "CallSession" ADD COLUMN "lastHeartbeatAt" TIMESTAMP(3);
ALTER TABLE "CallSession" ADD COLUMN "lastHeartbeatSeconds" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CallSession" ADD COLUMN "disconnectReason" TEXT;
CREATE INDEX "CallSession_status_lastHeartbeatAt_idx" ON "CallSession"("status", "lastHeartbeatAt");
