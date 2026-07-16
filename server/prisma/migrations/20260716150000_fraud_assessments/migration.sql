CREATE TABLE "FraudAssessment" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "context" TEXT NOT NULL, "referenceId" TEXT,
  "score" INTEGER NOT NULL, "reasons" TEXT[] NOT NULL, "action" TEXT NOT NULL, "metadata" JSONB,
  "reviewedBy" TEXT, "reviewedAt" TIMESTAMP(3), "resolution" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FraudAssessment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FraudAssessment_userId_createdAt_idx" ON "FraudAssessment"("userId", "createdAt");
CREATE INDEX "FraudAssessment_action_createdAt_idx" ON "FraudAssessment"("action", "createdAt");
