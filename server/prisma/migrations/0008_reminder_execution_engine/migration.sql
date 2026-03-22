-- AlterTable
ALTER TABLE "Task"
RENAME COLUMN "reminderDate" TO "reminderAt";

ALTER TABLE "Task"
ADD COLUMN "reminderTriggeredAt" TIMESTAMP(3);

-- Replace the old reminder filter index with an execution-oriented index.
DROP INDEX IF EXISTS "Task_userId_status_scheduledForDate_kind_idx";

CREATE INDEX "Task_userId_kind_status_reminderAt_reminderTriggeredAt_idx"
ON "Task"("userId", "kind", "status", "reminderAt", "reminderTriggeredAt");
