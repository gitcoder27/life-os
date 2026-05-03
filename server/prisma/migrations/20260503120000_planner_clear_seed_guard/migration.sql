-- Track when a day planner timeline was intentionally cleared so auto-seeding
-- does not recreate the removed block structure on the next day-plan fetch.
ALTER TABLE "PlanningCycle" ADD COLUMN "plannerBlocksClearedAt" TIMESTAMP(3);
