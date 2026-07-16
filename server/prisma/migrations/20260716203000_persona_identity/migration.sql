ALTER TABLE "VendorProfile" ADD COLUMN "identityProvider" TEXT,
ADD COLUMN "identityInquiryId" TEXT,
ADD COLUMN "identityStatus" TEXT,
ADD COLUMN "identityUpdatedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "VendorProfile_identityInquiryId_key" ON "VendorProfile"("identityInquiryId");

CREATE TABLE "IdentityWebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "inquiryId" TEXT,
  "payload" JSONB NOT NULL,
  "processedAt" TIMESTAMP(3),
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdentityWebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IdentityWebhookEvent_provider_eventId_key" ON "IdentityWebhookEvent"("provider","eventId");
CREATE INDEX "IdentityWebhookEvent_processedAt_createdAt_idx" ON "IdentityWebhookEvent"("processedAt","createdAt");
