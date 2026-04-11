CREATE TYPE "GoalEngagementState" AS ENUM ('PRIMARY', 'SECONDARY', 'PARKED', 'MAINTENANCE');

CREATE TYPE "DayMode" AS ENUM ('NORMAL', 'RESCUE', 'RECOVERY');

CREATE TYPE "HabitType" AS ENUM ('MAINTENANCE', 'GROWTH', 'IDENTITY');

CREATE TYPE "HabitCheckinLevel" AS ENUM ('MINIMUM', 'STANDARD', 'STRETCH');

CREATE TYPE "RescueReason" AS ENUM ('OVERLOAD', 'LOW_ENERGY', 'INTERRUPTION', 'MISSED_DAY');

ALTER TABLE "Goal"
ADD COLUMN "engagementState" "GoalEngagementState",
ADD COLUMN "weeklyProofText" TEXT,
ADD COLUMN "knownObstacle" TEXT,
ADD COLUMN "parkingRule" TEXT;

ALTER TABLE "DailyLaunch"
ADD COLUMN "dayMode" "DayMode" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN "rescueReason" "RescueReason",
ADD COLUMN "rescueSuggestedAt" TIMESTAMP(3),
ADD COLUMN "rescueActivatedAt" TIMESTAMP(3),
ADD COLUMN "rescueExitedAt" TIMESTAMP(3);

ALTER TABLE "Habit"
ADD COLUMN "habitType" "HabitType" NOT NULL DEFAULT 'MAINTENANCE',
ADD COLUMN "anchorText" TEXT,
ADD COLUMN "minimumVersion" TEXT,
ADD COLUMN "standardVersion" TEXT,
ADD COLUMN "stretchVersion" TEXT,
ADD COLUMN "obstaclePlan" TEXT,
ADD COLUMN "repairRule" TEXT,
ADD COLUMN "identityMeaning" TEXT;

ALTER TABLE "HabitCheckin"
ADD COLUMN "achievedLevel" "HabitCheckinLevel";
