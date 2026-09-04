import type {
  CreditCardItem,
  LoanItem,
} from "@life-os/contracts";
import type {
  CreditCard,
  CreditCardStatus as PrismaCreditCardStatus,
  Loan,
  LoanStatus as PrismaLoanStatus,
} from "@prisma/client";

import { toIsoDateString } from "../../lib/time/date.js";

type CreditCardStatus = "active" | "archived";
type LoanStatus = "active" | "paid_off" | "archived";

export function toPrismaCreditCardStatus(status: CreditCardStatus): PrismaCreditCardStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "archived":
      return "ARCHIVED";
  }

  throw new Error(`Unsupported credit card status: ${status satisfies never}`);
}

function fromPrismaCreditCardStatus(status: PrismaCreditCardStatus): CreditCardStatus {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "ARCHIVED":
      return "archived";
  }

  throw new Error(`Unsupported credit card status: ${status satisfies never}`);
}

export function toPrismaLoanStatus(status: LoanStatus): PrismaLoanStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "paid_off":
      return "PAID_OFF";
    case "archived":
      return "ARCHIVED";
  }

  throw new Error(`Unsupported loan status: ${status satisfies never}`);
}

function fromPrismaLoanStatus(status: PrismaLoanStatus): LoanStatus {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "PAID_OFF":
      return "paid_off";
    case "ARCHIVED":
      return "archived";
  }

  throw new Error(`Unsupported loan status: ${status satisfies never}`);
}

export function serializeCreditCard(card: CreditCard): CreditCardItem {
  return {
    id: card.id,
    paymentAccountId: card.paymentAccountId,
    name: card.name,
    issuer: card.issuer,
    currencyCode: card.currencyCode,
    creditLimitMinor: card.creditLimitMinor,
    outstandingBalanceMinor: card.outstandingBalanceMinor,
    statementDay: card.statementDay,
    paymentDueDay: card.paymentDueDay,
    minimumDueMinor: card.minimumDueMinor,
    utilizationPercent: card.creditLimitMinor > 0
      ? Math.min(Math.round((card.outstandingBalanceMinor / card.creditLimitMinor) * 100), 999)
      : 0,
    status: fromPrismaCreditCardStatus(card.status),
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  };
}

export function serializeLoan(loan: Loan): LoanItem {
  const paidMinor =
    loan.principalAmountMinor != null
      ? Math.max(loan.principalAmountMinor - loan.outstandingBalanceMinor, 0)
      : 0;

  return {
    id: loan.id,
    paymentAccountId: loan.paymentAccountId,
    name: loan.name,
    lender: loan.lender,
    currencyCode: loan.currencyCode,
    principalAmountMinor: loan.principalAmountMinor,
    outstandingBalanceMinor: loan.outstandingBalanceMinor,
    emiAmountMinor: loan.emiAmountMinor,
    interestRateBps: loan.interestRateBps,
    dueDay: loan.dueDay,
    startOn: loan.startOn ? toIsoDateString(loan.startOn) : null,
    endOn: loan.endOn ? toIsoDateString(loan.endOn) : null,
    progressPercent:
      loan.principalAmountMinor != null && loan.principalAmountMinor > 0
        ? Math.min(Math.round((paidMinor / loan.principalAmountMinor) * 100), 100)
        : 0,
    status: fromPrismaLoanStatus(loan.status),
    createdAt: loan.createdAt.toISOString(),
    updatedAt: loan.updatedAt.toISOString(),
  };
}
