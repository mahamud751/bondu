CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "behaviourRating" INTEGER NOT NULL,
    "qualityRating" INTEGER NOT NULL,
    "comment" VARCHAR(1000),
    "status" TEXT NOT NULL DEFAULT 'VISIBLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Review_callId_key" ON "Review"("callId");
CREATE INDEX "Review_vendorId_status_createdAt_idx" ON "Review"("vendorId", "status", "createdAt");
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_callId_fkey" FOREIGN KEY ("callId") REFERENCES "CallSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
