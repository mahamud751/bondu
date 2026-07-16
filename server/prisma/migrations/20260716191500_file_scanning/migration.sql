ALTER TABLE "FileAsset"
  ADD COLUMN "scanProvider" TEXT,
  ADD COLUMN "scanResult" TEXT,
  ADD COLUMN "scanAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "scannedAt" TIMESTAMP(3);
UPDATE "FileAsset" SET "scanProvider"='legacy',"scanResult"='CLEAN',"scannedAt"=CURRENT_TIMESTAMP WHERE "status"='READY';
