CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "DayPlannerBlock" current_block
    JOIN "DayPlannerBlock" overlapping_block
      ON current_block."planningCycleId" = overlapping_block."planningCycleId"
      AND current_block."id" < overlapping_block."id"
      AND current_block."startsAt" < overlapping_block."endsAt"
      AND overlapping_block."startsAt" < current_block."endsAt"
  ) THEN
    RAISE EXCEPTION 'Cannot add planner block overlap exclusion constraint while overlapping DayPlannerBlock rows exist in the same planning cycle.';
  END IF;
END $$;

ALTER TABLE "DayPlannerBlock"
ADD CONSTRAINT "DayPlannerBlock_no_overlap_per_cycle"
EXCLUDE USING gist (
  "planningCycleId" WITH =,
  tsrange("startsAt", "endsAt", '[)') WITH &&
)
WHERE ("startsAt" < "endsAt");
