ALTER TABLE "Notification" ADD COLUMN "dispatchedAt" TIMESTAMP(3);
CREATE TABLE "PushToken" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "deviceId" TEXT NOT NULL, "token" TEXT NOT NULL, "platform" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true, "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PushToken_token_key" ON "PushToken"("token");
CREATE UNIQUE INDEX "PushToken_userId_deviceId_key" ON "PushToken"("userId", "deviceId");
CREATE INDEX "PushToken_userId_active_idx" ON "PushToken"("userId", "active");
ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "NotificationPreference" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "pushEnabled" BOOLEAN NOT NULL DEFAULT true, "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "smsSecurity" BOOLEAN NOT NULL DEFAULT true, "mutedTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "quietStart" TEXT, "quietEnd" TEXT, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "NotificationDelivery" (
  "id" TEXT NOT NULL, "notificationId" TEXT NOT NULL, "channel" TEXT NOT NULL, "destination" TEXT, "status" TEXT NOT NULL,
  "providerId" TEXT, "error" TEXT, "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "NotificationDelivery_notificationId_channel_idx" ON "NotificationDelivery"("notificationId", "channel");
