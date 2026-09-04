import type {
  IsoDateString,
  RecurrenceInput,
  RecurringExpenseItem,
} from "@life-os/contracts";
import type {
  Prisma,
  RecurringExpenseStatus as PrismaRecurringExpenseStatus,
  RecurringExpenseTemplate,
} from "@prisma/client";

import { AppError } from "../../lib/errors/app-error.js";
import { formatLegacyFinanceRecurrenceRule, parseLegacyFinanceRecurrenceRule } from "../../lib/recurrence/rules.js";
import { serializeRecurrenceDefinition } from "../../lib/recurrence/store.js";
import { toIsoDateString } from "../../lib/time/date.js";

type RecurringExpenseStatus = "active" | "paused" | "archived";
type RecurringExpenseClient = Pick<Prisma.TransactionClient, "recurringExpenseTemplate">;

export function toPrismaRecurringExpenseStatus(
  status: RecurringExpenseStatus,
): PrismaRecurringExpenseStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "paused":
      return "PAUSED";
    case "archived":
      return "ARCHIVED";
  }

  throw new Error(`Unsupported recurring expense status: ${status satisfies never}`);
}

function fromPrismaRecurringExpenseStatus(
  status: PrismaRecurringExpenseStatus,
): RecurringExpenseStatus {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "PAUSED":
      return "paused";
    case "ARCHIVED":
      return "archived";
  }

  throw new Error(`Unsupported recurring expense status: ${status satisfies never}`);
}

export function serializeRecurringExpense(
  recurringExpense: RecurringExpenseTemplate & {
    recurrenceRuleRecord?: Parameters<typeof serializeRecurrenceDefinition>[0];
  },
): RecurringExpenseItem {
  return {
    id: recurringExpense.id,
    title: recurringExpense.title,
    expenseCategoryId: recurringExpense.expenseCategoryId,
    defaultAmountMinor: recurringExpense.defaultAmountMinor,
    currencyCode: recurringExpense.currencyCode,
    recurrenceRule: recurringExpense.recurrenceRule,
    recurrence: serializeRecurrenceDefinition(recurringExpense.recurrenceRuleRecord),
    nextDueOn: toIsoDateString(recurringExpense.nextDueOn),
    remindDaysBefore: recurringExpense.remindDaysBefore,
    status: fromPrismaRecurringExpenseStatus(recurringExpense.status),
    createdAt: recurringExpense.createdAt.toISOString(),
    updatedAt: recurringExpense.updatedAt.toISOString(),
  };
}

export function resolveRecurringExpenseRecurrenceInput(
  payload: { recurrence?: RecurrenceInput; recurrenceRule?: string; nextDueOn: IsoDateString },
) {
  if (payload.recurrence) {
    return {
      recurrence: payload.recurrence,
      legacyRuleText: formatLegacyFinanceRecurrenceRule(payload.recurrence.rule),
    };
  }

  const parsedRule = payload.recurrenceRule
    ? parseLegacyFinanceRecurrenceRule(payload.recurrenceRule, payload.nextDueOn)
    : null;
  if (!parsedRule) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Unsupported recurring expense rule",
    });
  }

  return {
    recurrence: {
      rule: parsedRule,
      exceptions: [],
    } satisfies RecurrenceInput,
    legacyRuleText: payload.recurrenceRule ?? formatLegacyFinanceRecurrenceRule(parsedRule),
  };
}

export async function assertOwnedRecurringExpenseTemplate(
  prisma: RecurringExpenseClient,
  userId: string,
  recurringExpenseTemplateId: string | null | undefined,
) {
  if (!recurringExpenseTemplateId) {
    return;
  }

  await findOwnedRecurringExpenseTemplate(prisma, userId, recurringExpenseTemplateId);
}

export async function findOwnedRecurringExpenseTemplate(
  prisma: RecurringExpenseClient,
  userId: string,
  recurringExpenseTemplateId: string,
) {
  const recurringExpense = await prisma.recurringExpenseTemplate.findFirst({
    where: {
      id: recurringExpenseTemplateId,
      userId,
    },
  });

  if (!recurringExpense) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Recurring expense not found",
    });
  }

  return recurringExpense;
}
