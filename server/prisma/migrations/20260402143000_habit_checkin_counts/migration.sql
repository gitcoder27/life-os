ALTER TABLE "HabitCheckin"
ADD COLUMN "completionCount" INTEGER NOT NULL DEFAULT 1;

UPDATE "HabitCheckin"
SET "completionCount" = 0
WHERE "status" = 'SKIPPED';
