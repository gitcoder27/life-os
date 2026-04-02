CREATE TYPE "GoalDomainSystemKey" AS ENUM (
  'HEALTH',
  'MONEY',
  'WORK_GROWTH',
  'HOME_ADMIN',
  'DISCIPLINE',
  'OTHER'
);

CREATE TYPE "GoalHorizonSystemKey" AS ENUM (
  'LIFE_VISION',
  'FIVE_YEAR',
  'ONE_YEAR',
  'QUARTER',
  'MONTH'
);

CREATE TABLE "GoalDomainConfig" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "systemKey" "GoalDomainSystemKey",
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GoalDomainConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GoalHorizonConfig" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "systemKey" "GoalHorizonSystemKey",
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "spanMonths" INTEGER,
  "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GoalHorizonConfig_pkey" PRIMARY KEY ("id")
);

INSERT INTO "GoalDomainConfig" ("id", "userId", "systemKey", "name", "sortOrder", "isArchived", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text || users."userId" || config."systemKey"::text),
  users."userId",
  config."systemKey",
  config."name",
  config."sortOrder",
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "userId" FROM "Goal") AS users
CROSS JOIN (
  VALUES
    ('HEALTH'::"GoalDomainSystemKey", 'Health', 1),
    ('MONEY'::"GoalDomainSystemKey", 'Money', 2),
    ('WORK_GROWTH'::"GoalDomainSystemKey", 'Work & Growth', 3),
    ('HOME_ADMIN'::"GoalDomainSystemKey", 'Home & Admin', 4),
    ('DISCIPLINE'::"GoalDomainSystemKey", 'Discipline', 5),
    ('OTHER'::"GoalDomainSystemKey", 'Other', 6)
) AS config("systemKey", "name", "sortOrder");

INSERT INTO "GoalHorizonConfig" ("id", "userId", "systemKey", "name", "sortOrder", "spanMonths", "isArchived", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text || users."userId" || config."systemKey"::text),
  users."userId",
  config."systemKey",
  config."name",
  config."sortOrder",
  config."spanMonths",
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "userId" FROM "Goal") AS users
CROSS JOIN (
  VALUES
    ('LIFE_VISION'::"GoalHorizonSystemKey", 'Life Vision', 1, NULL::integer),
    ('FIVE_YEAR'::"GoalHorizonSystemKey", '5-Year', 2, 60),
    ('ONE_YEAR'::"GoalHorizonSystemKey", '1-Year', 3, 12),
    ('QUARTER'::"GoalHorizonSystemKey", 'Quarter', 4, 3),
    ('MONTH'::"GoalHorizonSystemKey", 'Month', 5, 1)
) AS config("systemKey", "name", "sortOrder", "spanMonths");

ALTER TABLE "Goal"
ADD COLUMN "domainId" TEXT,
ADD COLUMN "horizonId" TEXT,
ADD COLUMN "parentGoalId" TEXT,
ADD COLUMN "why" TEXT,
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

UPDATE "Goal" AS goal
SET "domainId" = config."id"
FROM "GoalDomainConfig" AS config
WHERE config."userId" = goal."userId"
  AND config."systemKey" = CASE goal."domain"
    WHEN 'HEALTH' THEN 'HEALTH'::"GoalDomainSystemKey"
    WHEN 'MONEY' THEN 'MONEY'::"GoalDomainSystemKey"
    WHEN 'WORK_GROWTH' THEN 'WORK_GROWTH'::"GoalDomainSystemKey"
    WHEN 'HOME_ADMIN' THEN 'HOME_ADMIN'::"GoalDomainSystemKey"
    WHEN 'DISCIPLINE' THEN 'DISCIPLINE'::"GoalDomainSystemKey"
    WHEN 'OTHER' THEN 'OTHER'::"GoalDomainSystemKey"
  END;

WITH ordered_goals AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt" ASC, "id" ASC) AS "nextSortOrder"
  FROM "Goal"
)
UPDATE "Goal" AS goal
SET "sortOrder" = ordered_goals."nextSortOrder"
FROM ordered_goals
WHERE ordered_goals."id" = goal."id";

ALTER TABLE "Goal" ALTER COLUMN "domainId" SET NOT NULL;

ALTER TABLE "GoalDomainConfig"
ADD CONSTRAINT "GoalDomainConfig_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GoalHorizonConfig"
ADD CONSTRAINT "GoalHorizonConfig_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Goal"
ADD CONSTRAINT "Goal_domainId_fkey"
FOREIGN KEY ("domainId") REFERENCES "GoalDomainConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Goal"
ADD CONSTRAINT "Goal_horizonId_fkey"
FOREIGN KEY ("horizonId") REFERENCES "GoalHorizonConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Goal"
ADD CONSTRAINT "Goal_parentGoalId_fkey"
FOREIGN KEY ("parentGoalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "GoalDomainConfig_userId_systemKey_key" ON "GoalDomainConfig"("userId", "systemKey");
CREATE UNIQUE INDEX "GoalDomainConfig_userId_sortOrder_key" ON "GoalDomainConfig"("userId", "sortOrder");
CREATE INDEX "GoalDomainConfig_userId_isArchived_sortOrder_idx" ON "GoalDomainConfig"("userId", "isArchived", "sortOrder");

CREATE UNIQUE INDEX "GoalHorizonConfig_userId_systemKey_key" ON "GoalHorizonConfig"("userId", "systemKey");
CREATE UNIQUE INDEX "GoalHorizonConfig_userId_sortOrder_key" ON "GoalHorizonConfig"("userId", "sortOrder");
CREATE INDEX "GoalHorizonConfig_userId_isArchived_sortOrder_idx" ON "GoalHorizonConfig"("userId", "isArchived", "sortOrder");

CREATE INDEX "Goal_userId_status_sortOrder_idx" ON "Goal"("userId", "status", "sortOrder");
CREATE INDEX "Goal_userId_domainId_status_idx" ON "Goal"("userId", "domainId", "status");
CREATE INDEX "Goal_userId_horizonId_idx" ON "Goal"("userId", "horizonId");
CREATE INDEX "Goal_userId_parentGoalId_sortOrder_idx" ON "Goal"("userId", "parentGoalId", "sortOrder");

ALTER TABLE "Goal" DROP COLUMN "domain";
DROP TYPE "GoalDomain";
