-- CreateTable
CREATE TABLE "DayPlannerBlock" (
    "id" TEXT NOT NULL,
    "planningCycleId" TEXT NOT NULL,
    "title" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayPlannerBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayPlannerBlockTask" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayPlannerBlockTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DayPlannerBlock_planningCycleId_sortOrder_key" ON "DayPlannerBlock"("planningCycleId", "sortOrder");

-- CreateIndex
CREATE INDEX "DayPlannerBlock_planningCycleId_startsAt_endsAt_idx" ON "DayPlannerBlock"("planningCycleId", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "DayPlannerBlockTask_taskId_key" ON "DayPlannerBlockTask"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "DayPlannerBlockTask_blockId_sortOrder_key" ON "DayPlannerBlockTask"("blockId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "DayPlannerBlockTask_blockId_taskId_key" ON "DayPlannerBlockTask"("blockId", "taskId");

-- CreateIndex
CREATE INDEX "DayPlannerBlockTask_taskId_blockId_idx" ON "DayPlannerBlockTask"("taskId", "blockId");

-- AddForeignKey
ALTER TABLE "DayPlannerBlock" ADD CONSTRAINT "DayPlannerBlock_planningCycleId_fkey" FOREIGN KEY ("planningCycleId") REFERENCES "PlanningCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayPlannerBlockTask" ADD CONSTRAINT "DayPlannerBlockTask_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "DayPlannerBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayPlannerBlockTask" ADD CONSTRAINT "DayPlannerBlockTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
