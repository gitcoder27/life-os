ALTER TABLE "UserPreference"
ADD COLUMN "notificationPreferences" JSONB;

ALTER TABLE "Notification"
ADD COLUMN "deliveryKey" TEXT;

UPDATE "Notification"
SET "deliveryKey" = "ruleKey"
  || '|'
  || COALESCE("entityType", '_')
  || '|'
  || COALESCE("entityId", '_')
WHERE "deliveryKey" IS NULL;

ALTER TABLE "Notification"
ALTER COLUMN "deliveryKey" SET NOT NULL;

CREATE INDEX "Notification_userId_ruleKey_entityType_entityId_idx"
ON "Notification"("userId", "ruleKey", "entityType", "entityId");

CREATE INDEX "Notification_userId_deliveryKey_dismissedAt_idx"
ON "Notification"("userId", "deliveryKey", "dismissedAt");
