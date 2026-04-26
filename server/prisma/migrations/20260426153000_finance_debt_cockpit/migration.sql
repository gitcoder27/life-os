DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CreditCardStatus') THEN
    CREATE TYPE "CreditCardStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LoanStatus') THEN
    CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'PAID_OFF', 'ARCHIVED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "CreditCard" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "paymentAccountId" TEXT,
  "name" TEXT NOT NULL,
  "issuer" TEXT,
  "currencyCode" TEXT NOT NULL,
  "creditLimitMinor" INTEGER NOT NULL,
  "outstandingBalanceMinor" INTEGER NOT NULL DEFAULT 0,
  "statementDay" INTEGER,
  "paymentDueDay" INTEGER,
  "minimumDueMinor" INTEGER,
  "status" "CreditCardStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreditCard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Loan" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "paymentAccountId" TEXT,
  "name" TEXT NOT NULL,
  "lender" TEXT,
  "currencyCode" TEXT NOT NULL,
  "principalAmountMinor" INTEGER,
  "outstandingBalanceMinor" INTEGER NOT NULL DEFAULT 0,
  "emiAmountMinor" INTEGER NOT NULL,
  "interestRateBps" INTEGER,
  "dueDay" INTEGER,
  "startOn" TIMESTAMP(3),
  "endOn" TIMESTAMP(3),
  "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CreditCard_userId_status_idx" ON "CreditCard"("userId", "status");
CREATE INDEX IF NOT EXISTS "Loan_userId_status_idx" ON "Loan"("userId", "status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CreditCard_userId_fkey') THEN
    ALTER TABLE "CreditCard"
    ADD CONSTRAINT "CreditCard_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CreditCard_paymentAccountId_fkey') THEN
    ALTER TABLE "CreditCard"
    ADD CONSTRAINT "CreditCard_paymentAccountId_fkey"
    FOREIGN KEY ("paymentAccountId") REFERENCES "FinanceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Loan_userId_fkey') THEN
    ALTER TABLE "Loan"
    ADD CONSTRAINT "Loan_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Loan_paymentAccountId_fkey') THEN
    ALTER TABLE "Loan"
    ADD CONSTRAINT "Loan_paymentAccountId_fkey"
    FOREIGN KEY ("paymentAccountId") REFERENCES "FinanceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
