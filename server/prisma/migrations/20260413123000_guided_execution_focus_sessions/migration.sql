CREATE TYPE "FocusSessionDepth" AS ENUM ('DEEP', 'SHALLOW');

CREATE TYPE "FocusSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABORTED');

CREATE TYPE "FocusSessionExitReason" AS ENUM (
  'INTERRUPTED',
  'LOW_ENERGY',
  'UNCLEAR',
  'SWITCHED_CONTEXT',
  'DONE_ENOUGH'
);

CREATE TABLE "FocusSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "depth" "FocusSessionDepth" NOT NULL,
  "plannedMinutes" INTEGER NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "status" "FocusSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "exitReason" "FocusSessionExitReason",
  "distractionNotes" TEXT,
  "completionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FocusSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FocusSession_userId_status_startedAt_idx" ON "FocusSession"("userId", "status", "startedAt");

CREATE INDEX "FocusSession_taskId_startedAt_idx" ON "FocusSession"("taskId", "startedAt");

CREATE UNIQUE INDEX "FocusSession_one_active_session_per_user_idx"
ON "FocusSession"("userId")
WHERE "status" = 'ACTIVE';

ALTER TABLE "FocusSession"
ADD CONSTRAINT "FocusSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FocusSession"
ADD CONSTRAINT "FocusSession_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
