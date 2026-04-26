ALTER TABLE "Task"
ADD COLUMN "todaySortOrder" INTEGER NOT NULL DEFAULT 0;

WITH ranked_tasks AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "scheduledForDate", status
      ORDER BY "createdAt", id
    ) - 1 AS sort_order
  FROM "Task"
)
UPDATE "Task"
SET "todaySortOrder" = ranked_tasks.sort_order
FROM ranked_tasks
WHERE "Task".id = ranked_tasks.id;

CREATE INDEX "Task_userId_scheduledForDate_todaySortOrder_createdAt_idx"
ON "Task"("userId", "scheduledForDate", "todaySortOrder", "createdAt");
