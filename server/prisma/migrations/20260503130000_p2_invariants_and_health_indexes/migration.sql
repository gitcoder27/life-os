CREATE INDEX IF NOT EXISTS "WaterLog_userId_occurredAt_idx"
ON "WaterLog"("userId", "occurredAt");

CREATE INDEX IF NOT EXISTS "MealLog_userId_occurredAt_idx"
ON "MealLog"("userId", "occurredAt");

CREATE INDEX IF NOT EXISTS "WeightLog_userId_measuredOn_createdAt_idx"
ON "WeightLog"("userId", "measuredOn", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "FocusSession_one_active_session_per_user_idx"
ON "FocusSession"("userId")
WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX IF NOT EXISTS "Notification_active_deliveryKey_unique_idx"
ON "Notification"("userId", "deliveryKey")
WHERE "dismissedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Notification_active_unread_rule_entity_unique_idx"
ON "Notification"("userId", "ruleKey", "entityType", "entityId")
WHERE "dismissedAt" IS NULL AND "readAt" IS NULL;
