CREATE TYPE "TaskProgressState" AS ENUM ('NOT_STARTED', 'STARTED', 'ADVANCED');

CREATE TYPE "DailyDerailmentReason" AS ENUM (
  'UNCLEAR',
  'TOO_BIG',
  'AVOIDANCE',
  'LOW_ENERGY',
  'INTERRUPTED',
  'OVERLOADED'
);

CREATE TYPE "TaskStuckAction" AS ENUM (
  'CLARIFY',
  'SHRINK',
  'DOWNGRADE',
  'RESCHEDULE',
  'RECOVER'
);

ALTER TABLE "Task"
ADD COLUMN "nextAction" TEXT,
ADD COLUMN "fiveMinuteVersion" TEXT,
ADD COLUMN "estimatedDurationMinutes" INTEGER,
ADD COLUMN "likelyObstacle" TEXT,
ADD COLUMN "focusLengthMinutes" INTEGER,
ADD COLUMN "progressState" "TaskProgressState" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN "startedAt" TIMESTAMP(3),
ADD COLUMN "lastStuckAt" TIMESTAMP(3);

CREATE TABLE "DailyLaunch" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "planningCycleId" TEXT NOT NULL,
  "mustWinTaskId" TEXT,
  "energyRating" INTEGER,
  "likelyDerailmentReason" "DailyDerailmentReason",
  "likelyDerailmentNote" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DailyLaunch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskStuckEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "reason" "DailyDerailmentReason" NOT NULL,
  "actionTaken" "TaskStuckAction" NOT NULL,
  "note" TEXT,
  "targetDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TaskStuckEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyLaunch_planningCycleId_key" ON "DailyLaunch"("planningCycleId");
CREATE INDEX "DailyLaunch_userId_completedAt_idx" ON "DailyLaunch"("userId", "completedAt");
CREATE INDEX "DailyLaunch_mustWinTaskId_idx" ON "DailyLaunch"("mustWinTaskId");
CREATE INDEX "TaskStuckEvent_userId_createdAt_idx" ON "TaskStuckEvent"("userId", "createdAt");
CREATE INDEX "TaskStuckEvent_taskId_createdAt_idx" ON "TaskStuckEvent"("taskId", "createdAt");

ALTER TABLE "DailyLaunch"
ADD CONSTRAINT "DailyLaunch_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "DailyLaunch"
ADD CONSTRAINT "DailyLaunch_planningCycleId_fkey"
FOREIGN KEY ("planningCycleId") REFERENCES "PlanningCycle"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "DailyLaunch"
ADD CONSTRAINT "DailyLaunch_mustWinTaskId_fkey"
FOREIGN KEY ("mustWinTaskId") REFERENCES "Task"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "TaskStuckEvent"
ADD CONSTRAINT "TaskStuckEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "TaskStuckEvent"
ADD CONSTRAINT "TaskStuckEvent_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "Task"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
