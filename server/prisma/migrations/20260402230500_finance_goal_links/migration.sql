DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'FinanceGoalType'
  ) THEN
    CREATE TYPE "FinanceGoalType" AS ENUM (
      'EMERGENCY_FUND',
      'DEBT_PAYOFF',
      'TRAVEL',
      'LARGE_PURCHASE',
      'OTHER'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "FinanceGoal" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "goalType" "FinanceGoalType" NOT NULL DEFAULT 'OTHER',
    "targetAmountMinor" INTEGER,
    "currentAmountMinor" INTEGER,
    "monthlyContributionTargetMinor" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceGoal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FinanceGoal_goalId_key"
ON "FinanceGoal"("goalId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'FinanceGoal_goalId_fkey'
  ) THEN
    ALTER TABLE "FinanceGoal"
    ADD CONSTRAINT "FinanceGoal_goalId_fkey"
    FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
