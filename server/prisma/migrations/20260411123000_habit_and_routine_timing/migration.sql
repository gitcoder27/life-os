CREATE TYPE "HabitTimingMode" AS ENUM ('ANYTIME', 'ANCHOR', 'EXACT_TIME', 'TIME_WINDOW');

CREATE TYPE "RoutineTimingMode" AS ENUM ('ANYTIME', 'PERIOD', 'CUSTOM_WINDOW');

CREATE TYPE "RoutinePeriod" AS ENUM ('MORNING', 'EVENING');

ALTER TABLE "Habit"
ADD COLUMN "timingMode" "HabitTimingMode" NOT NULL DEFAULT 'ANYTIME',
ADD COLUMN "targetTimeMinutes" INTEGER,
ADD COLUMN "windowStartMinutes" INTEGER,
ADD COLUMN "windowEndMinutes" INTEGER;

ALTER TABLE "Routine"
ADD COLUMN "timingMode" "RoutineTimingMode" NOT NULL DEFAULT 'ANYTIME',
ADD COLUMN "period" "RoutinePeriod",
ADD COLUMN "windowStartMinutes" INTEGER,
ADD COLUMN "windowEndMinutes" INTEGER;

UPDATE "Habit"
SET "timingMode" = CASE
  WHEN "anchorText" IS NOT NULL AND btrim("anchorText") <> '' THEN 'ANCHOR'::"HabitTimingMode"
  ELSE 'ANYTIME'::"HabitTimingMode"
END;
