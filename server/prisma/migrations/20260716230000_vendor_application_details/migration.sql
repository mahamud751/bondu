ALTER TABLE "VendorProfile" ADD COLUMN "address" TEXT,
ADD COLUMN "contactEmail" TEXT,
ADD COLUMN "profileDescription" TEXT,
ADD COLUMN "supportedLanguages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "preferredWorkingHours" TEXT,
ADD COLUMN "payoutMethod" TEXT,
ADD COLUMN "payoutAccountEncrypted" TEXT,
ADD COLUMN "payoutAccountLast4" TEXT;
