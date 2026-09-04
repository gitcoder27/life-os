import type {
  FinanceTransaction,
  FinanceTransactionType as PrismaFinanceTransactionType,
} from "@prisma/client";
import type {
  CreateFinanceTransactionRequest,
  FinanceTransactionItem,
} from "@life-os/contracts";

import { AppError } from "../../lib/errors/app-error.js";
import { toIsoDateString } from "../../lib/time/date.js";

type FinanceTransactionType = "income" | "expense" | "transfer" | "adjustment";

export function toPrismaFinanceTransactionType(type: FinanceTransactionType): PrismaFinanceTransactionType {
  switch (type) {
    case "income":
      return "INCOME";
    case "expense":
      return "EXPENSE";
    case "transfer":
      return "TRANSFER";
    case "adjustment":
      return "ADJUSTMENT";
  }

  throw new Error(`Unsupported finance transaction type: ${type satisfies never}`);
}

export function fromPrismaFinanceTransactionType(type: PrismaFinanceTransactionType): FinanceTransactionType {
  switch (type) {
    case "INCOME":
      return "income";
    case "EXPENSE":
      return "expense";
    case "TRANSFER":
      return "transfer";
    case "ADJUSTMENT":
      return "adjustment";
  }

  throw new Error(`Unsupported finance transaction type: ${type satisfies never}`);
}

export function serializeFinanceTransaction(
  transaction: FinanceTransaction,
): FinanceTransactionItem {
  return {
    id: transaction.id,
    accountId: transaction.accountId,
    transferAccountId: transaction.transferAccountId,
    transactionType: fromPrismaFinanceTransactionType(transaction.transactionType),
    amountMinor: transaction.amountMinor,
    currencyCode: transaction.currencyCode,
    occurredOn: toIsoDateString(transaction.occurredOn),
    description: transaction.description,
    expenseCategoryId: transaction.expenseCategoryId,
    billId: transaction.billId,
    recurringIncomeId: transaction.recurringIncomeTemplateId,
    source: "ledger",
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString(),
  };
}

export function validateFinanceTransactionPayload(
  payload: Pick<CreateFinanceTransactionRequest, "transactionType" | "amountMinor" | "transferAccountId">,
) {
  if (payload.transactionType === "adjustment") {
    if (payload.amountMinor === 0) {
      throw new AppError({
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Adjustment amount cannot be zero",
      });
    }
    return;
  }

  if (payload.amountMinor <= 0) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Amount must be greater than zero",
    });
  }

  if (payload.transactionType === "transfer" && !payload.transferAccountId) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Transfer account is required",
    });
  }
}
