ALTER TYPE "TaskOriginType" ADD VALUE IF NOT EXISTS 'MEAL_PLAN';

CREATE TYPE "MealPlanGrocerySourceType" AS ENUM ('PLANNED', 'MANUAL');

CREATE TABLE "MealPlanWeek" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPlanWeek_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MealPlanEntry" (
    "id" TEXT NOT NULL,
    "mealPlanWeekId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "mealSlot" "MealSlot" NOT NULL,
    "mealTemplateId" TEXT NOT NULL,
    "servings" DECIMAL(7,2),
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPlanEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MealPrepSession" (
    "id" TEXT NOT NULL,
    "mealPlanWeekId" TEXT NOT NULL,
    "scheduledForDate" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "taskId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPrepSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MealPlanGroceryItem" (
    "id" TEXT NOT NULL,
    "mealPlanWeekId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(9,2),
    "unit" TEXT,
    "section" TEXT,
    "note" TEXT,
    "sourceType" "MealPlanGrocerySourceType" NOT NULL,
    "isChecked" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPlanGroceryItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MealLog"
ADD COLUMN "mealPlanEntryId" TEXT;

CREATE UNIQUE INDEX "MealPlanWeek_userId_startDate_key" ON "MealPlanWeek"("userId", "startDate");
CREATE INDEX "MealPlanWeek_userId_startDate_idx" ON "MealPlanWeek"("userId", "startDate");
CREATE INDEX "MealPlanEntry_mealPlanWeekId_date_mealSlot_sortOrder_idx" ON "MealPlanEntry"("mealPlanWeekId", "date", "mealSlot", "sortOrder");
CREATE INDEX "MealPlanEntry_mealTemplateId_idx" ON "MealPlanEntry"("mealTemplateId");
CREATE UNIQUE INDEX "MealPrepSession_taskId_key" ON "MealPrepSession"("taskId");
CREATE INDEX "MealPrepSession_mealPlanWeekId_scheduledForDate_sortOrder_idx" ON "MealPrepSession"("mealPlanWeekId", "scheduledForDate", "sortOrder");
CREATE INDEX "MealPlanGroceryItem_mealPlanWeekId_sourceType_sortOrder_idx" ON "MealPlanGroceryItem"("mealPlanWeekId", "sourceType", "sortOrder");
CREATE INDEX "MealLog_mealPlanEntryId_idx" ON "MealLog"("mealPlanEntryId");

ALTER TABLE "MealPlanWeek"
ADD CONSTRAINT "MealPlanWeek_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MealPlanEntry"
ADD CONSTRAINT "MealPlanEntry_mealPlanWeekId_fkey"
FOREIGN KEY ("mealPlanWeekId") REFERENCES "MealPlanWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MealPlanEntry"
ADD CONSTRAINT "MealPlanEntry_mealTemplateId_fkey"
FOREIGN KEY ("mealTemplateId") REFERENCES "MealTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MealPrepSession"
ADD CONSTRAINT "MealPrepSession_mealPlanWeekId_fkey"
FOREIGN KEY ("mealPlanWeekId") REFERENCES "MealPlanWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MealPrepSession"
ADD CONSTRAINT "MealPrepSession_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MealPlanGroceryItem"
ADD CONSTRAINT "MealPlanGroceryItem_mealPlanWeekId_fkey"
FOREIGN KEY ("mealPlanWeekId") REFERENCES "MealPlanWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MealLog"
ADD CONSTRAINT "MealLog_mealPlanEntryId_fkey"
FOREIGN KEY ("mealPlanEntryId") REFERENCES "MealPlanEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
