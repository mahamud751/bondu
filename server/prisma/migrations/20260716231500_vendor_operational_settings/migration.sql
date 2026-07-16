ALTER TABLE "VendorProfile"
  ADD COLUMN "breakActive" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "autoAcceptCalls" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "maximumDailyCalls" INTEGER,
  ADD COLUMN "minimumCallerBalance" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "VendorProfile"
  ADD CONSTRAINT "VendorProfile_maximumDailyCalls_check"
    CHECK ("maximumDailyCalls" IS NULL OR "maximumDailyCalls" BETWEEN 1 AND 1000),
  ADD CONSTRAINT "VendorProfile_minimumCallerBalance_check"
    CHECK ("minimumCallerBalance" BETWEEN 0 AND 100000000);
