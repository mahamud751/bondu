CREATE TABLE "RtcWebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "channelName" TEXT,
  "payload" JSONB NOT NULL,
  "processedAt" TIMESTAMP(3),
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RtcWebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RtcWebhookEvent_provider_eventId_key" ON "RtcWebhookEvent"("provider", "eventId");
CREATE INDEX "RtcWebhookEvent_processedAt_createdAt_idx" ON "RtcWebhookEvent"("processedAt", "createdAt");
