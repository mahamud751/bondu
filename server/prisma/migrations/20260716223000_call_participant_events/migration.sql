CREATE TABLE "CallParticipantEvent" (
  "id" TEXT NOT NULL,
  "callId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "eventTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CallParticipantEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CallParticipantEvent_callId_fkey" FOREIGN KEY ("callId") REFERENCES "CallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CallParticipantEvent_callId_eventTime_idx" ON "CallParticipantEvent"("callId","eventTime");
CREATE INDEX "CallParticipantEvent_userId_eventTime_idx" ON "CallParticipantEvent"("userId","eventTime");
