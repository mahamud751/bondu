CREATE TABLE "VendorSchedule" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endMinute" INTEGER NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Dhaka',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VendorSchedule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VendorSchedule_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "VendorSchedule_day_check" CHECK ("dayOfWeek" BETWEEN 0 AND 6),
  CONSTRAINT "VendorSchedule_minutes_check" CHECK ("startMinute" BETWEEN 0 AND 1439 AND "endMinute" BETWEEN 0 AND 1439 AND "startMinute" <> "endMinute")
);
CREATE UNIQUE INDEX "VendorSchedule_vendorId_dayOfWeek_key" ON "VendorSchedule"("vendorId","dayOfWeek");
CREATE INDEX "VendorSchedule_vendorId_enabled_idx" ON "VendorSchedule"("vendorId","enabled");
