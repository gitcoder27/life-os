-- Enforce idempotency for recurring task materialization and generated notifications.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT "userId", "recurrenceRuleId", "scheduledForDate"
      FROM "Task"
      WHERE "recurrenceRuleId" IS NOT NULL
        AND "scheduledForDate" IS NOT NULL
      GROUP BY "userId", "recurrenceRuleId", "scheduledForDate"
      HAVING COUNT(*) > 1
    ) duplicate_recurring_tasks
  ) THEN
    RAISE EXCEPTION 'Cannot add recurring task occurrence uniqueness while duplicate Task rows exist for the same user, recurrence rule, and scheduled date.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT "userId", "deliveryKey"
      FROM "Notification"
      GROUP BY "userId", "deliveryKey"
      HAVING COUNT(*) > 1
    ) duplicate_notifications
  ) THEN
    RAISE EXCEPTION 'Cannot add notification delivery-key uniqueness while duplicate Notification rows exist for the same user and delivery key.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT "userId"
      FROM "FocusSession"
      WHERE "status" = 'ACTIVE'
      GROUP BY "userId"
      HAVING COUNT(*) > 1
    ) duplicate_active_focus_sessions
  ) THEN
    RAISE EXCEPTION 'Cannot add active focus session uniqueness while a user has multiple ACTIVE FocusSession rows.';
  END IF;
END $$;

CREATE UNIQUE INDEX "Task_userId_recurrenceRuleId_scheduledForDate_key"
ON "Task"("userId", "recurrenceRuleId", "scheduledForDate");

CREATE UNIQUE INDEX "Notification_userId_deliveryKey_key"
ON "Notification"("userId", "deliveryKey");

-- Enforce one active focus session per user at the database layer.
CREATE UNIQUE INDEX "FocusSession_one_active_per_user_key"
ON "FocusSession"("userId")
WHERE "status" = 'ACTIVE';
