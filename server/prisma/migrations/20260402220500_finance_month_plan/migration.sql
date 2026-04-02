CREATE TABLE IF NOT EXISTS "FinanceMonthPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "monthStart" TIMESTAMP(3) NOT NULL,
    "plannedSpendMinor" INTEGER,
    "fixedObligationsMinor" INTEGER,
    "flexibleSpendTargetMinor" INTEGER,
    "plannedIncomeMinor" INTEGER,
    "expectedLargeExpensesMinor" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceMonthPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FinanceMonthPlanCategoryWatch" (
    "id" TEXT NOT NULL,
    "financeMonthPlanId" TEXT NOT NULL,
    "expenseCategoryId" TEXT NOT NULL,
    "watchLimitMinor" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceMonthPlanCategoryWatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FinanceMonthPlan_userId_monthStart_key"
ON "FinanceMonthPlan"("userId", "monthStart");

CREATE UNIQUE INDEX IF NOT EXISTS "FinanceMonthPlanCategoryWatch_financeMonthPlanId_expenseCategoryId_key"
ON "FinanceMonthPlanCategoryWatch"("financeMonthPlanId", "expenseCategoryId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'FinanceMonthPlan_userId_fkey'
  ) THEN
    ALTER TABLE "FinanceMonthPlan"
    ADD CONSTRAINT "FinanceMonthPlan_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'FinanceMonthPlanCategoryWatch_financeMonthPlanId_fkey'
  ) THEN
    ALTER TABLE "FinanceMonthPlanCategoryWatch"
    ADD CONSTRAINT "FinanceMonthPlanCategoryWatch_financeMonthPlanId_fkey"
    FOREIGN KEY ("financeMonthPlanId") REFERENCES "FinanceMonthPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'FinanceMonthPlanCategoryWatch_expenseCategoryId_fkey'
  ) THEN
    ALTER TABLE "FinanceMonthPlanCategoryWatch"
    ADD CONSTRAINT "FinanceMonthPlanCategoryWatch_expenseCategoryId_fkey"
    FOREIGN KEY ("expenseCategoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
