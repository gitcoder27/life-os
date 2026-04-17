CREATE TYPE "WeeklyCapacityMode" AS ENUM ('LIGHT', 'STANDARD', 'HEAVY');

ALTER TABLE "PlanningCycle"
ADD COLUMN "weeklyCapacityMode" "WeeklyCapacityMode",
ADD COLUMN "weeklyDeepWorkBlockTarget" INTEGER;
