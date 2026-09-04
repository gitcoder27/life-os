import type {
  FinanceAccount,
  FinanceAccountType as PrismaFinanceAccountType,
  FinanceTransaction,
  Prisma,
} from "@prisma/client";
import type { FinanceAccountItem } from "@life-os/contracts";

import { AppError } from "../../lib/errors/app-error.js";

type FinanceAccountType = "bank" | "cash" | "wallet" | "other";

type FinanceAccountClient = Pick<Prisma.TransactionClient, "financeAccount" | "financeTransaction">;

export function toPrismaFinanceAccountType(type: FinanceAccountType): PrismaFinanceAccountType {
  switch (type) {
    case "bank":
      return "BANK";
    case "cash":
      return "CASH";
    case "wallet":
      return "WALLET";
    case "other":
      return "OTHER";
  }

  throw new Error(`Unsupported finance account type: ${type satisfies never}`);
}

function fromPrismaFinanceAccountType(type: PrismaFinanceAccountType): FinanceAccountType {
  switch (type) {
    case "BANK":
      return "bank";
    case "CASH":
      return "cash";
    case "WALLET":
      return "wallet";
    case "OTHER":
      return "other";
  }

  throw new Error(`Unsupported finance account type: ${type satisfies never}`);
}

function getFinanceTransactionBalanceDelta(transaction: Pick<FinanceTransaction, "transactionType" | "amountMinor">) {
  switch (transaction.transactionType) {
    case "INCOME":
      return transaction.amountMinor;
    case "EXPENSE":
      return -transaction.amountMinor;
    case "ADJUSTMENT":
      return transaction.amountMinor;
    case "TRANSFER":
      return -transaction.amountMinor;
  }
}

export function serializeFinanceAccount(
  account: FinanceAccount,
  currentBalanceMinor: number,
): FinanceAccountItem {
  return {
    id: account.id,
    name: account.name,
    accountType: fromPrismaFinanceAccountType(account.accountType),
    currencyCode: account.currencyCode,
    openingBalanceMinor: account.openingBalanceMinor,
    currentBalanceMinor,
    archivedAt: account.archivedAt?.toISOString() ?? null,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

export async function buildFinanceAccountItems(
  prisma: FinanceAccountClient,
  userId: string,
) {
  const [accounts, transactions] = await Promise.all([
    prisma.financeAccount.findMany({
      where: {
        userId,
      },
      orderBy: [{ archivedAt: "asc" }, { createdAt: "asc" }],
    }),
    prisma.financeTransaction.findMany({
      where: {
        userId,
      },
      select: {
        accountId: true,
        transferAccountId: true,
        transactionType: true,
        amountMinor: true,
      },
    }),
  ]);

  const balanceMap = new Map(accounts.map((account) => [account.id, account.openingBalanceMinor]));

  for (const transaction of transactions) {
    balanceMap.set(
      transaction.accountId,
      (balanceMap.get(transaction.accountId) ?? 0) + getFinanceTransactionBalanceDelta(transaction),
    );

    if (transaction.transactionType === "TRANSFER" && transaction.transferAccountId) {
      balanceMap.set(
        transaction.transferAccountId,
        (balanceMap.get(transaction.transferAccountId) ?? 0) + transaction.amountMinor,
      );
    }
  }

  return accounts.map((account) => serializeFinanceAccount(account, balanceMap.get(account.id) ?? account.openingBalanceMinor));
}

export async function findOwnedFinanceAccount(
  prisma: FinanceAccountClient,
  userId: string,
  accountId: string,
) {
  const account = await prisma.financeAccount.findFirst({
    where: {
      id: accountId,
      userId,
    },
  });

  if (!account) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Finance account not found",
    });
  }

  return account;
}

export async function assertOwnedFinanceAccount(
  prisma: FinanceAccountClient,
  userId: string,
  accountId: string | null | undefined,
) {
  if (!accountId) {
    return;
  }

  await findOwnedFinanceAccount(prisma, userId, accountId);
}
