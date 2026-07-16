CREATE TYPE "StaffPermissionKey" AS ENUM (
  'VIEW_DASHBOARD', 'MANAGE_USERS', 'REVIEW_VENDORS', 'MANAGE_FINANCE',
  'MODERATE_CONTENT', 'REVIEW_RISK', 'MANAGE_CATALOG', 'MANAGE_SETTINGS', 'VIEW_AUDIT_LOGS',
  'EXPORT_DATA', 'MANAGE_STAFF'
);

CREATE TABLE "StaffPermission" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "permission" "StaffPermissionKey" NOT NULL,
  "allowed" BOOLEAN NOT NULL,
  "grantedBy" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffPermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffPermission_userId_permission_key" ON "StaffPermission"("userId", "permission");
CREATE INDEX "StaffPermission_userId_allowed_idx" ON "StaffPermission"("userId", "allowed");
