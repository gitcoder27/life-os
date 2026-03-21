CREATE TYPE "RecurrenceOwnerType" AS ENUM ('TASK', 'HABIT', 'RECURRING_EXPENSE');
CREATE TYPE "RecurrenceCarryPolicy" AS ENUM ('COMPLETE_AND_CLONE', 'MOVE_DUE_DATE', 'CANCEL');
CREATE TYPE "RecurrenceExceptionAction" AS ENUM ('SKIP', 'DO_ONCE', 'RESCHEDULE');

CREATE TABLE "RecurrenceRule" (
    "id" TEXT NOT NULL,
    "ownerType" "RecurrenceOwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ruleJson" JSONB NOT NULL,
    "carryPolicy" "RecurrenceCarryPolicy",
    "legacyRuleText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RecurrenceRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecurrenceException" (
    "id" TEXT NOT NULL,
    "recurrenceRuleId" TEXT NOT NULL,
    "occurrenceDate" TIMESTAMP(3) NOT NULL,
    "action" "RecurrenceExceptionAction" NOT NULL,
    "targetDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RecurrenceException_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Task" ADD COLUMN "recurrenceRuleId" TEXT;
ALTER TABLE "Habit" ADD COLUMN "recurrenceRuleId" TEXT;
ALTER TABLE "RecurringExpenseTemplate" ADD COLUMN "recurrenceRuleId" TEXT;

CREATE UNIQUE INDEX "RecurrenceRule_ownerType_ownerId_key" ON "RecurrenceRule"("ownerType", "ownerId");
CREATE UNIQUE INDEX "RecurrenceException_recurrenceRuleId_occurrenceDate_key" ON "RecurrenceException"("recurrenceRuleId", "occurrenceDate");
CREATE INDEX "Task_userId_recurrenceRuleId_scheduledForDate_idx" ON "Task"("userId", "recurrenceRuleId", "scheduledForDate");

ALTER TABLE "Task" ADD CONSTRAINT "Task_recurrenceRuleId_fkey" FOREIGN KEY ("recurrenceRuleId") REFERENCES "RecurrenceRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_recurrenceRuleId_fkey" FOREIGN KEY ("recurrenceRuleId") REFERENCES "RecurrenceRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecurringExpenseTemplate" ADD CONSTRAINT "RecurringExpenseTemplate_recurrenceRuleId_fkey" FOREIGN KEY ("recurrenceRuleId") REFERENCES "RecurrenceRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecurrenceException" ADD CONSTRAINT "RecurrenceException_recurrenceRuleId_fkey" FOREIGN KEY ("recurrenceRuleId") REFERENCES "RecurrenceRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
