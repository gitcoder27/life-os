-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "GoalDomain" AS ENUM ('HEALTH', 'MONEY', 'WORK_GROWTH', 'HOME_ADMIN', 'DISCIPLINE', 'OTHER');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PlanningCycleType" AS ENUM ('DAY', 'WEEK', 'MONTH');

-- CreateEnum
CREATE TYPE "PlanningCycleStatus" AS ENUM ('OPEN', 'REVIEW_READY', 'CLOSED');

-- CreateEnum
CREATE TYPE "PriorityStatus" AS ENUM ('PENDING', 'COMPLETED', 'DROPPED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'COMPLETED', 'DROPPED');

-- CreateEnum
CREATE TYPE "TaskOriginType" AS ENUM ('MANUAL', 'QUICK_CAPTURE', 'CARRY_FORWARD', 'REVIEW_SEED', 'RECURRING');

-- CreateEnum
CREATE TYPE "HabitStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CheckinStatus" AS ENUM ('COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "HabitCheckinSource" AS ENUM ('TAP', 'QUICK_CAPTURE', 'REVIEW');

-- CreateEnum
CREATE TYPE "RoutinePeriod" AS ENUM ('MORNING', 'EVENING');

-- CreateEnum
CREATE TYPE "RoutineStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WaterLogSource" AS ENUM ('TAP', 'QUICK_CAPTURE', 'MANUAL');

-- CreateEnum
CREATE TYPE "MealSlot" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');

-- CreateEnum
CREATE TYPE "MealLoggingQuality" AS ENUM ('PARTIAL', 'MEANINGFUL', 'FULL');

-- CreateEnum
CREATE TYPE "WorkoutPlanType" AS ENUM ('WORKOUT', 'RECOVERY', 'NONE');

-- CreateEnum
CREATE TYPE "WorkoutActualStatus" AS ENUM ('COMPLETED', 'RECOVERY_RESPECTED', 'FALLBACK', 'MISSED', 'NONE');

-- CreateEnum
CREATE TYPE "ExpenseSource" AS ENUM ('MANUAL', 'QUICK_CAPTURE', 'TEMPLATE');

-- CreateEnum
CREATE TYPE "RecurringExpenseStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AdminItemType" AS ENUM ('BILL', 'ADMIN');

-- CreateEnum
CREATE TYPE "AdminItemStatus" AS ENUM ('PENDING', 'DONE', 'RESCHEDULED', 'DROPPED');

-- CreateEnum
CREATE TYPE "ReviewType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "onboardedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionTokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventPayloadJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "userId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "weekStartsOn" INTEGER NOT NULL DEFAULT 1,
    "dailyReviewStartTime" TEXT,
    "dailyReviewEndTime" TEXT,
    "dailyWaterTargetMl" INTEGER NOT NULL DEFAULT 2500,
    "defaultScoreEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "domain" "GoalDomain" NOT NULL,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "targetDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningCycle" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cycleType" "PlanningCycleType" NOT NULL,
    "cycleStartDate" TIMESTAMP(3) NOT NULL,
    "cycleEndDate" TIMESTAMP(3) NOT NULL,
    "status" "PlanningCycleStatus" NOT NULL DEFAULT 'OPEN',
    "theme" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CyclePriority" (
    "id" TEXT NOT NULL,
    "planningCycleId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "status" "PriorityStatus" NOT NULL DEFAULT 'PENDING',
    "goalId" TEXT,
    "sourceReviewType" "ReviewType",
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CyclePriority_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledForDate" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "goalId" TEXT,
    "originType" "TaskOriginType" NOT NULL DEFAULT 'MANUAL',
    "carriedFromTaskId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Habit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "scheduleRuleJson" JSONB NOT NULL,
    "targetPerDay" INTEGER NOT NULL DEFAULT 1,
    "status" "HabitStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Habit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HabitCheckin" (
    "id" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "occurredOn" TIMESTAMP(3) NOT NULL,
    "status" "CheckinStatus" NOT NULL DEFAULT 'COMPLETED',
    "source" "HabitCheckinSource" NOT NULL DEFAULT 'TAP',
    "completedAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "HabitCheckin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Routine" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "period" "RoutinePeriod" NOT NULL,
    "status" "RoutineStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Routine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineItem" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineItemCheckin" (
    "id" TEXT NOT NULL,
    "routineItemId" TEXT NOT NULL,
    "occurredOn" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RoutineItemCheckin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "amountMl" INTEGER NOT NULL,
    "source" "WaterLogSource" NOT NULL DEFAULT 'TAP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaterLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mealSlot" "MealSlot",
    "templatePayloadJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "MealTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "mealSlot" "MealSlot",
    "mealTemplateId" TEXT,
    "description" TEXT NOT NULL,
    "loggingQuality" "MealLoggingQuality" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "planType" "WorkoutPlanType" NOT NULL DEFAULT 'NONE',
    "plannedLabel" TEXT,
    "actualStatus" "WorkoutActualStatus" NOT NULL DEFAULT 'NONE',
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeightLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "measuredOn" TIMESTAMP(3) NOT NULL,
    "weightValue" DECIMAL(7,2) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeightLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringExpenseTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "expenseCategoryId" TEXT,
    "defaultAmountMinor" INTEGER,
    "currencyCode" TEXT NOT NULL,
    "recurrenceRule" TEXT NOT NULL,
    "nextDueOn" TIMESTAMP(3) NOT NULL,
    "remindDaysBefore" INTEGER NOT NULL DEFAULT 0,
    "status" "RecurringExpenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringExpenseTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expenseCategoryId" TEXT,
    "amountMinor" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "spentOn" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "source" "ExpenseSource" NOT NULL DEFAULT 'MANUAL',
    "recurringExpenseTemplateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "itemType" "AdminItemType" NOT NULL,
    "dueOn" TIMESTAMP(3) NOT NULL,
    "status" "AdminItemStatus" NOT NULL DEFAULT 'PENDING',
    "relatedTaskId" TEXT,
    "recurringExpenseTemplateId" TEXT,
    "amountMinor" INTEGER,
    "note" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planningCycleId" TEXT NOT NULL,
    "biggestWin" TEXT NOT NULL,
    "frictionTag" TEXT NOT NULL,
    "frictionNote" TEXT,
    "energyRating" INTEGER NOT NULL,
    "optionalNote" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planningCycleId" TEXT NOT NULL,
    "biggestWin" TEXT NOT NULL,
    "biggestMiss" TEXT NOT NULL,
    "mainLesson" TEXT NOT NULL,
    "keepText" TEXT NOT NULL,
    "improveText" TEXT NOT NULL,
    "focusHabitId" TEXT,
    "healthTargetText" TEXT,
    "spendingWatchCategoryId" TEXT,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planningCycleId" TEXT NOT NULL,
    "monthVerdict" TEXT NOT NULL,
    "biggestWin" TEXT NOT NULL,
    "biggestLeak" TEXT NOT NULL,
    "ratingsJson" JSONB NOT NULL,
    "nextMonthTheme" TEXT NOT NULL,
    "threeOutcomesJson" JSONB NOT NULL,
    "habitChangesJson" JSONB NOT NULL,
    "simplifyText" TEXT NOT NULL,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planningCycleId" TEXT NOT NULL,
    "scoreValue" INTEGER NOT NULL,
    "scoreBand" TEXT NOT NULL,
    "earnedPoints" DECIMAL(7,2) NOT NULL,
    "applicablePoints" DECIMAL(7,2) NOT NULL,
    "breakdownJson" JSONB NOT NULL,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notificationType" TEXT NOT NULL,
    "severity" "NotificationSeverity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "ruleKey" TEXT NOT NULL,
    "visibleFrom" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionTokenHash_key" ON "Session"("sessionTokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningCycle_userId_cycleType_cycleStartDate_key" ON "PlanningCycle"("userId", "cycleType", "cycleStartDate");

-- CreateIndex
CREATE UNIQUE INDEX "CyclePriority_planningCycleId_slot_key" ON "CyclePriority"("planningCycleId", "slot");

-- CreateIndex
CREATE INDEX "Task_userId_scheduledForDate_status_idx" ON "Task"("userId", "scheduledForDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HabitCheckin_habitId_occurredOn_key" ON "HabitCheckin"("habitId", "occurredOn");

-- CreateIndex
CREATE UNIQUE INDEX "RoutineItemCheckin_routineItemId_occurredOn_key" ON "RoutineItemCheckin"("routineItemId", "occurredOn");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutDay_userId_date_key" ON "WorkoutDay"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_userId_name_key" ON "ExpenseCategory"("userId", "name");

-- CreateIndex
CREATE INDEX "Expense_userId_spentOn_idx" ON "Expense"("userId", "spentOn");

-- CreateIndex
CREATE INDEX "AdminItem_userId_dueOn_status_idx" ON "AdminItem"("userId", "dueOn", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReview_planningCycleId_key" ON "DailyReview"("planningCycleId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReview_planningCycleId_key" ON "WeeklyReview"("planningCycleId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyReview_planningCycleId_key" ON "MonthlyReview"("planningCycleId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyScore_planningCycleId_key" ON "DailyScore"("planningCycleId");

-- CreateIndex
CREATE INDEX "DailyScore_userId_finalizedAt_idx" ON "DailyScore"("userId", "finalizedAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_dismissedAt_visibleFrom_idx" ON "Notification"("userId", "readAt", "dismissedAt", "visibleFrom");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningCycle" ADD CONSTRAINT "PlanningCycle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CyclePriority" ADD CONSTRAINT "CyclePriority_planningCycleId_fkey" FOREIGN KEY ("planningCycleId") REFERENCES "PlanningCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CyclePriority" ADD CONSTRAINT "CyclePriority_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_carriedFromTaskId_fkey" FOREIGN KEY ("carriedFromTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitCheckin" ADD CONSTRAINT "HabitCheckin_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineItem" ADD CONSTRAINT "RoutineItem_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineItemCheckin" ADD CONSTRAINT "RoutineItemCheckin_routineItemId_fkey" FOREIGN KEY ("routineItemId") REFERENCES "RoutineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterLog" ADD CONSTRAINT "WaterLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealTemplate" ADD CONSTRAINT "MealTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealLog" ADD CONSTRAINT "MealLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealLog" ADD CONSTRAINT "MealLog_mealTemplateId_fkey" FOREIGN KEY ("mealTemplateId") REFERENCES "MealTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutDay" ADD CONSTRAINT "WorkoutDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeightLog" ADD CONSTRAINT "WeightLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpenseTemplate" ADD CONSTRAINT "RecurringExpenseTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpenseTemplate" ADD CONSTRAINT "RecurringExpenseTemplate_expenseCategoryId_fkey" FOREIGN KEY ("expenseCategoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_expenseCategoryId_fkey" FOREIGN KEY ("expenseCategoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recurringExpenseTemplateId_fkey" FOREIGN KEY ("recurringExpenseTemplateId") REFERENCES "RecurringExpenseTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminItem" ADD CONSTRAINT "AdminItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminItem" ADD CONSTRAINT "AdminItem_relatedTaskId_fkey" FOREIGN KEY ("relatedTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminItem" ADD CONSTRAINT "AdminItem_recurringExpenseTemplateId_fkey" FOREIGN KEY ("recurringExpenseTemplateId") REFERENCES "RecurringExpenseTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReview" ADD CONSTRAINT "DailyReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReview" ADD CONSTRAINT "DailyReview_planningCycleId_fkey" FOREIGN KEY ("planningCycleId") REFERENCES "PlanningCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReview" ADD CONSTRAINT "WeeklyReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReview" ADD CONSTRAINT "WeeklyReview_planningCycleId_fkey" FOREIGN KEY ("planningCycleId") REFERENCES "PlanningCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReview" ADD CONSTRAINT "WeeklyReview_focusHabitId_fkey" FOREIGN KEY ("focusHabitId") REFERENCES "Habit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReview" ADD CONSTRAINT "WeeklyReview_spendingWatchCategoryId_fkey" FOREIGN KEY ("spendingWatchCategoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyReview" ADD CONSTRAINT "MonthlyReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyReview" ADD CONSTRAINT "MonthlyReview_planningCycleId_fkey" FOREIGN KEY ("planningCycleId") REFERENCES "PlanningCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyScore" ADD CONSTRAINT "DailyScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyScore" ADD CONSTRAINT "DailyScore_planningCycleId_fkey" FOREIGN KEY ("planningCycleId") REFERENCES "PlanningCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

