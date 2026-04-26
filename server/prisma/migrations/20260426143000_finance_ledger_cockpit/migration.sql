DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FinanceAccountType') THEN
    CREATE TYPE "FinanceAccountType" AS ENUM ('BANK', 'CASH', 'WALLET', 'OTHER');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FinanceTransactionType') THEN
    CREATE TYPE "FinanceTransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RecurringIncomeStatus') THEN
    CREATE TYPE "RecurringIncomeStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "FinanceAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "accountType" "FinanceAccountType" NOT NULL DEFAULT 'BANK',
  "currencyCode" TEXT NOT NULL,
  "openingBalanceMinor" INTEGER NOT NULL DEFAULT 0,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinanceAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FinanceTransaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "transactionType" "FinanceTransactionType" NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "currencyCode" TEXT NOT NULL,
  "occurredOn" TIMESTAMP(3) NOT NULL,
  "description" TEXT,
  "expenseCategoryId" TEXT,
  "billId" TEXT,
  "transferAccountId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinanceTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RecurringIncomeTemplate" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "currencyCode" TEXT NOT NULL,
  "recurrenceRule" TEXT NOT NULL,
  "nextExpectedOn" TIMESTAMP(3) NOT NULL,
  "status" "RecurringIncomeStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecurringIncomeTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FinanceAccount_userId_archivedAt_idx" ON "FinanceAccount"("userId", "archivedAt");
CREATE INDEX IF NOT EXISTS "FinanceTransaction_userId_occurredOn_idx" ON "FinanceTransaction"("userId", "occurredOn");
CREATE INDEX IF NOT EXISTS "FinanceTransaction_accountId_occurredOn_idx" ON "FinanceTransaction"("accountId", "occurredOn");
CREATE INDEX IF NOT EXISTS "RecurringIncomeTemplate_userId_status_nextExpectedOn_idx" ON "RecurringIncomeTemplate"("userId", "status", "nextExpectedOn");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FinanceAccount_userId_fkey') THEN
    ALTER TABLE "FinanceAccount"
    ADD CONSTRAINT "FinanceAccount_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FinanceTransaction_userId_fkey') THEN
    ALTER TABLE "FinanceTransaction"
    ADD CONSTRAINT "FinanceTransaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FinanceTransaction_accountId_fkey') THEN
    ALTER TABLE "FinanceTransaction"
    ADD CONSTRAINT "FinanceTransaction_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "FinanceAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FinanceTransaction_transferAccountId_fkey') THEN
    ALTER TABLE "FinanceTransaction"
    ADD CONSTRAINT "FinanceTransaction_transferAccountId_fkey"
    FOREIGN KEY ("transferAccountId") REFERENCES "FinanceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FinanceTransaction_expenseCategoryId_fkey') THEN
    ALTER TABLE "FinanceTransaction"
    ADD CONSTRAINT "FinanceTransaction_expenseCategoryId_fkey"
    FOREIGN KEY ("expenseCategoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FinanceTransaction_billId_fkey') THEN
    ALTER TABLE "FinanceTransaction"
    ADD CONSTRAINT "FinanceTransaction_billId_fkey"
    FOREIGN KEY ("billId") REFERENCES "AdminItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RecurringIncomeTemplate_userId_fkey') THEN
    ALTER TABLE "RecurringIncomeTemplate"
    ADD CONSTRAINT "RecurringIncomeTemplate_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RecurringIncomeTemplate_accountId_fkey') THEN
    ALTER TABLE "RecurringIncomeTemplate"
    ADD CONSTRAINT "RecurringIncomeTemplate_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "FinanceAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
