CREATE TABLE "MembershipPlan" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT NOT NULL, "price" INTEGER NOT NULL, "currency" TEXT NOT NULL DEFAULT 'BDT',
  "durationDays" INTEGER NOT NULL, "benefits" JSONB NOT NULL, "badge" TEXT, "displayOrder" INTEGER NOT NULL DEFAULT 0, "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "MembershipPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MembershipPlan_name_key" ON "MembershipPlan"("name");
CREATE TABLE "UserSubscription" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "planId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'ACTIVE', "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "UserSubscription_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "UserSubscription_userId_status_expiresAt_idx" ON "UserSubscription"("userId", "status", "expiresAt");
ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "ReferralCode" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "code" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "ReferralCode_userId_key" ON "ReferralCode"("userId"); CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "Referral" ("id" TEXT NOT NULL, "referralCodeId" TEXT NOT NULL, "referrerId" TEXT NOT NULL, "referredUserId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT', "qualifiedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Referral_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "Referral_referredUserId_key" ON "Referral"("referredUserId"); CREATE INDEX "Referral_referrerId_status_idx" ON "Referral"("referrerId", "status");
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "ReferralCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "ReferralReward" ("id" TEXT NOT NULL, "referralId" TEXT NOT NULL, "recipientId" TEXT NOT NULL, "amount" INTEGER NOT NULL, "reason" TEXT NOT NULL, "referenceId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "ReferralReward_referralId_recipientId_reason_key" ON "ReferralReward"("referralId", "recipientId", "reason");
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
