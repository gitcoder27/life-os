ALTER TABLE "Routine"
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

WITH ranked_routines AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "userId"
      ORDER BY
        CASE "period"
          WHEN 'MORNING' THEN 0
          WHEN 'EVENING' THEN 1
          ELSE 2
        END,
        "createdAt",
        id
    ) - 1 AS sort_order
  FROM "Routine"
)
UPDATE "Routine"
SET "sortOrder" = ranked_routines.sort_order
FROM ranked_routines
WHERE "Routine".id = ranked_routines.id;

ALTER TABLE "Routine"
ALTER COLUMN "sortOrder" DROP DEFAULT;

DROP INDEX IF EXISTS "Routine_userId_period_idx";
ALTER TABLE "Routine"
DROP COLUMN "period";

DROP TYPE "RoutinePeriod";
