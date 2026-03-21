CREATE TYPE "GoalMilestoneStatus" AS ENUM ('PENDING', 'COMPLETED');

ALTER TABLE "Habit" ADD COLUMN "goalId" TEXT;

CREATE TABLE "GoalMilestone" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3),
    "status" "GoalMilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GoalMilestone_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoalMilestone_goalId_sortOrder_key" ON "GoalMilestone"("goalId", "sortOrder");
CREATE INDEX "GoalMilestone_goalId_status_targetDate_idx" ON "GoalMilestone"("goalId", "status", "targetDate");
CREATE INDEX "Habit_goalId_status_idx" ON "Habit"("goalId", "status");

ALTER TABLE "Habit" ADD CONSTRAINT "Habit_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GoalMilestone" ADD CONSTRAINT "GoalMilestone_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
