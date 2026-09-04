import type {
  RecurringIncomeStatus as PrismaRecurringIncomeStatus,
  RecurringIncomeTemplate,
} from "@prisma/client";
import type { RecurringIncomeItem } from "@life-os/contracts";

import { toIsoDateString } from "../../lib/time/date.js";

type RecurringIncomeStatus = "active" | "paused" | "archived";

function addMonthsClamped(date: Date, months: number) {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return next;
}

function addRecurringIncomePeriod(date: Date, recurrenceRule: string) {
  const normalizedRule = recurrenceRule.trim().toLowerCase();
  const next = new Date(date);

  if (normalizedRule.includes("week")) {
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }

  if (normalizedRule.includes("year")) {
    return addMonthsClamped(date, 12);
  }

  return addMonthsClamped(date, 1);
}

export function getNextRecurringIncomeDate(
  income: Pick<RecurringIncomeTemplate, "nextExpectedOn" | "recurrenceRule">,
  receivedOn: Date,
) {
  let nextExpectedOn = addRecurringIncomePeriod(income.nextExpectedOn, income.recurrenceRule);

  while (nextExpectedOn <= receivedOn) {
    nextExpectedOn = addRecurringIncomePeriod(nextExpectedOn, income.recurrenceRule);
  }

  return nextExpectedOn;
}

export function toPrismaRecurringIncomeStatus(status: RecurringIncomeStatus): PrismaRecurringIncomeStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "paused":
      return "PAUSED";
    case "archived":
      return "ARCHIVED";
  }

  throw new Error(`Unsupported recurring income status: ${status satisfies never}`);
}

function fromPrismaRecurringIncomeStatus(status: PrismaRecurringIncomeStatus): RecurringIncomeStatus {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "PAUSED":
      return "paused";
    case "ARCHIVED":
      return "archived";
  }

  throw new Error(`Unsupported recurring income status: ${status satisfies never}`);
}

export function serializeRecurringIncome(income: RecurringIncomeTemplate): RecurringIncomeItem {
  return {
    id: income.id,
    accountId: income.accountId,
    title: income.title,
    amountMinor: income.amountMinor,
    currencyCode: income.currencyCode,
    recurrenceRule: income.recurrenceRule,
    nextExpectedOn: toIsoDateString(income.nextExpectedOn),
    status: fromPrismaRecurringIncomeStatus(income.status),
    createdAt: income.createdAt.toISOString(),
    updatedAt: income.updatedAt.toISOString(),
  };
}
