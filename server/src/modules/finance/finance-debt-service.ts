import { Prisma } from "@prisma/client";
import type { CreditCard, Loan, PrismaClient } from "@prisma/client";

import { AppError } from "../../lib/errors/app-error.js";
import { parseIsoDate } from "../../lib/time/cycle.js";

type PayDebtInput = {
  userId: string;
  accountId?: string | null;
  amountMinor: number;
  paidOn: string;
};

async function assertOwnedPaymentAccount(
  tx: Prisma.TransactionClient,
  userId: string,
  accountId: string,
) {
  const account = await tx.financeAccount.findFirst({
    where: {
      id: accountId,
      userId,
    },
    select: {
      id: true,
    },
  });

  if (!account) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Finance account not found",
    });
  }
}

function requirePaymentAccount(accountId: string | null | undefined) {
  if (!accountId) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Payment account is required",
    });
  }

  return accountId;
}

export async function payCreditCardDebt(
  prisma: PrismaClient,
  creditCardId: string,
  input: PayDebtInput,
): Promise<CreditCard> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.creditCard.findFirst({
      where: {
        id: creditCardId,
        userId: input.userId,
      },
    });

    if (!current) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Credit card not found",
      });
    }

    const transactionAccountId = requirePaymentAccount(input.accountId ?? current.paymentAccountId);
    await assertOwnedPaymentAccount(tx, input.userId, transactionAccountId);

    await tx.financeTransaction.create({
      data: {
        userId: input.userId,
        accountId: transactionAccountId,
        transactionType: "EXPENSE",
        amountMinor: input.amountMinor,
        currencyCode: current.currencyCode,
        occurredOn: parseIsoDate(input.paidOn),
        description: `${current.name} payment`,
      },
    });

    await tx.$executeRaw(Prisma.sql`
      UPDATE "CreditCard"
      SET
        "outstandingBalanceMinor" = GREATEST("outstandingBalanceMinor" - ${input.amountMinor}, 0),
        "minimumDueMinor" = CASE
          WHEN "minimumDueMinor" IS NULL THEN NULL
          ELSE GREATEST("minimumDueMinor" - ${input.amountMinor}, 0)
        END,
        "updatedAt" = NOW()
      WHERE "id" = ${current.id} AND "userId" = ${input.userId}
    `);

    return tx.creditCard.findFirstOrThrow({
      where: {
        id: current.id,
        userId: input.userId,
      },
    });
  });
}

export async function payLoanDebt(
  prisma: PrismaClient,
  loanId: string,
  input: PayDebtInput,
): Promise<Loan> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.loan.findFirst({
      where: {
        id: loanId,
        userId: input.userId,
      },
    });

    if (!current) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Loan not found",
      });
    }

    const transactionAccountId = requirePaymentAccount(input.accountId ?? current.paymentAccountId);
    await assertOwnedPaymentAccount(tx, input.userId, transactionAccountId);

    await tx.financeTransaction.create({
      data: {
        userId: input.userId,
        accountId: transactionAccountId,
        transactionType: "EXPENSE",
        amountMinor: input.amountMinor,
        currencyCode: current.currencyCode,
        occurredOn: parseIsoDate(input.paidOn),
        description: `${current.name} EMI`,
      },
    });

    await tx.$executeRaw(Prisma.sql`
      UPDATE "Loan"
      SET
        "outstandingBalanceMinor" = GREATEST("outstandingBalanceMinor" - ${input.amountMinor}, 0),
        "status" = CASE
          WHEN GREATEST("outstandingBalanceMinor" - ${input.amountMinor}, 0) = 0
            THEN 'PAID_OFF'::"LoanStatus"
          ELSE "status"
        END,
        "updatedAt" = NOW()
      WHERE "id" = ${current.id} AND "userId" = ${input.userId}
    `);

    return tx.loan.findFirstOrThrow({
      where: {
        id: current.id,
        userId: input.userId,
      },
    });
  });
}
