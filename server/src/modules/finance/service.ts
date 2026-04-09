import type { FinanceBillItem } from "@life-os/contracts";
import type {
  AdminItem,
  BillCompletionMode as PrismaBillCompletionMode,
  Expense,
  PrismaClient,
} from "@prisma/client";

import { addDays } from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import {
  formatLegacyFinanceRecurrenceRule,
  getNextRecurrenceDateAfter,
  listRecurrenceDatesInRange,
  parseLegacyFinanceRecurrenceRule,
} from "../../lib/recurrence/rules.js";
import { coerceExceptionItems } from "../../lib/recurrence/store.js";

interface MaterializeRecurringExpensesResult {
  createdAdminItems: number;
  advancedTemplates: number;
  unsupportedTemplates: number;
}

type FinanceBillRecord = AdminItem & {
  linkedExpense?: Pick<Expense, "id"> | null;
};

export const OPEN_BILL_STATUSES = ["PENDING", "RESCHEDULED"] as const;

function startOfDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function isOpenBillStatus(status: AdminItem["status"]) {
  return status === "PENDING" || status === "RESCHEDULED";
}

export function toPrismaBillCompletionMode(
  mode: NonNullable<FinanceBillItem["completionMode"]>,
): PrismaBillCompletionMode {
  switch (mode) {
    case "pay_and_log":
      return "PAY_AND_LOG";
    case "mark_paid_only":
      return "MARK_PAID_ONLY";
  }

  throw new Error(`Unsupported bill completion mode: ${mode satisfies never}`);
}

export function fromPrismaBillCompletionMode(
  mode: PrismaBillCompletionMode | null,
): FinanceBillItem["completionMode"] {
  switch (mode) {
    case "PAY_AND_LOG":
      return "pay_and_log";
    case "MARK_PAID_ONLY":
      return "mark_paid_only";
    case null:
      return null;
  }

  throw new Error(`Unsupported bill completion mode: ${mode satisfies never}`);
}

export function fromPrismaAdminItemStatus(
  status: AdminItem["status"],
): FinanceBillItem["status"] {
  switch (status) {
    case "PENDING":
      return "pending";
    case "DONE":
      return "done";
    case "RESCHEDULED":
      return "rescheduled";
    case "DROPPED":
      return "dropped";
  }

  throw new Error(`Unsupported admin item status: ${status satisfies never}`);
}

export function getBillReconciliationStatus(
  bill: Pick<FinanceBillRecord, "status" | "linkedExpense" | "completionMode">,
): FinanceBillItem["reconciliationStatus"] {
  if (bill.status === "DROPPED") {
    return "dropped";
  }

  if (bill.status === "DONE") {
    return bill.linkedExpense ? "paid_with_expense" : "paid_without_expense";
  }

  if (bill.status === "RESCHEDULED") {
    return "rescheduled";
  }

  return "due";
}

export function serializeFinanceBill(bill: FinanceBillRecord): FinanceBillItem {
  return {
    id: bill.id,
    title: bill.title,
    dueOn: toIsoDateString(bill.dueOn),
    amountMinor: bill.amountMinor,
    status: fromPrismaAdminItemStatus(bill.status),
    expenseCategoryId: bill.expenseCategoryId,
    note: bill.note,
    paidAt: bill.completedAt?.toISOString() ?? null,
    linkedExpenseId: bill.linkedExpense?.id ?? null,
    completionMode: fromPrismaBillCompletionMode(bill.completionMode),
    reconciliationStatus: getBillReconciliationStatus(bill),
    recurringExpenseTemplateId: bill.recurringExpenseTemplateId,
    createdAt: bill.createdAt.toISOString(),
    updatedAt: bill.updatedAt.toISOString(),
  };
}

function resolveTemplateRecurrence(template: {
  recurrenceRule: string;
  nextDueOn: Date;
  recurrenceRuleRecord?: {
    ruleJson: unknown;
    exceptions: Array<{ occurrenceDate: Date; action: any; targetDate: Date | null }>;
  } | null;
}) {
  if (template.recurrenceRuleRecord) {
    return {
      rule: template.recurrenceRuleRecord.ruleJson,
      exceptions: coerceExceptionItems(template.recurrenceRuleRecord.exceptions),
      legacyRuleText: template.recurrenceRule,
    };
  }

  const startsOn = toIsoDateString(template.nextDueOn);
  const rule = parseLegacyFinanceRecurrenceRule(template.recurrenceRule, startsOn);
  if (!rule) {
    return null;
  }

  return {
    rule,
    exceptions: [],
    legacyRuleText: formatLegacyFinanceRecurrenceRule(rule),
  };
}

export async function materializeRecurringExpenseItems(
  prisma: PrismaClient,
  now: Date,
): Promise<MaterializeRecurringExpensesResult> {
  const templates = await prisma.recurringExpenseTemplate.findMany({
    where: {
      status: "ACTIVE",
    },
    include: {
      recurrenceRuleRecord: {
        include: {
          exceptions: {
            orderBy: {
              occurrenceDate: "asc",
            },
          },
        },
      },
    },
    orderBy: [{ nextDueOn: "asc" }, { createdAt: "asc" }],
  });
  const lookaheadDate = addDays(startOfDay(now), 45);
  const todayIsoDate = toIsoDateString(startOfDay(now));
  const lookaheadIsoDate = toIsoDateString(lookaheadDate);

  let createdAdminItems = 0;
  let advancedTemplates = 0;
  let unsupportedTemplates = 0;

  for (const template of templates) {
    const recurrence = resolveTemplateRecurrence(template);
    if (!recurrence) {
      unsupportedTemplates += 1;
      continue;
    }

    const dueDates = listRecurrenceDatesInRange(
      recurrence.rule as any,
      todayIsoDate,
      lookaheadIsoDate,
      recurrence.exceptions,
    );

    await prisma.$transaction(async (tx) => {
      for (const dueDate of dueDates) {
        const dueOn = new Date(`${dueDate}T00:00:00.000Z`);
        const existingAdminItem = await tx.adminItem.findFirst({
          where: {
            userId: template.userId,
            recurringExpenseTemplateId: template.id,
            dueOn,
          },
        });

        if (existingAdminItem) {
          continue;
        }

        await tx.adminItem.create({
          data: {
            userId: template.userId,
            title: template.title,
            itemType: "BILL",
            dueOn,
            status: "PENDING",
            recurringExpenseTemplateId: template.id,
            expenseCategoryId: template.expenseCategoryId,
            amountMinor: template.defaultAmountMinor,
            note: "Auto-generated from recurring expense template",
          },
        });
        createdAdminItems += 1;
      }

      const nextDueDate = getNextRecurrenceDateAfter(
        recurrence.rule as any,
        lookaheadIsoDate,
        recurrence.exceptions,
      );

      if (nextDueDate && nextDueDate !== toIsoDateString(template.nextDueOn)) {
        await tx.recurringExpenseTemplate.update({
          where: {
            id: template.id,
          },
          data: {
            nextDueOn: new Date(`${nextDueDate}T00:00:00.000Z`),
            recurrenceRule: recurrence.legacyRuleText,
          },
        });
        advancedTemplates += 1;
      }
    });
  }

  return {
    createdAdminItems,
    advancedTemplates,
    unsupportedTemplates,
  };
}
