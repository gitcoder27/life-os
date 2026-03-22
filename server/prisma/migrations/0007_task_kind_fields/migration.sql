-- CreateEnum
CREATE TYPE "TaskKind" AS ENUM ('TASK', 'NOTE', 'REMINDER');

-- AlterTable
ALTER TABLE "Task"
ADD COLUMN "kind" "TaskKind" NOT NULL DEFAULT 'TASK',
ADD COLUMN "reminderDate" TIMESTAMP(3);

-- Backfill legacy quick-capture metadata from notes JSON into first-class fields.
CREATE OR REPLACE FUNCTION "life_os_try_parse_jsonb"(input TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN input::jsonb;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$$;

WITH parsed_notes AS (
  SELECT
    id,
    "life_os_try_parse_jsonb"("notes") AS payload
  FROM "Task"
  WHERE "notes" IS NOT NULL
),
capture_notes AS (
  SELECT
    id,
    payload
  FROM parsed_notes
  WHERE payload IS NOT NULL
    AND jsonb_typeof(payload) = 'object'
    AND payload->>'marker' = 'life_os_capture'
    AND payload->>'v' = '1'
    AND payload->>'kind' IN ('note', 'reminder')
    AND jsonb_typeof(payload->'text') = 'string'
)
UPDATE "Task" AS task
SET
  "kind" = CASE
    WHEN capture_notes.payload->>'kind' = 'note' THEN 'NOTE'::"TaskKind"
    ELSE 'REMINDER'::"TaskKind"
  END,
  "notes" = NULLIF(BTRIM(capture_notes.payload->>'text'), ''),
  "reminderDate" = CASE
    WHEN capture_notes.payload->>'kind' = 'reminder'
      AND COALESCE(capture_notes.payload->>'reminderDate', '') ~ '^\d{4}-\d{2}-\d{2}$'
    THEN ((capture_notes.payload->>'reminderDate')::date)::timestamp
    ELSE NULL
  END
FROM capture_notes
WHERE task.id = capture_notes.id;

DROP FUNCTION "life_os_try_parse_jsonb"(TEXT);

-- CreateIndex
CREATE INDEX "Task_userId_status_scheduledForDate_kind_idx"
ON "Task"("userId", "status", "scheduledForDate", "kind");
