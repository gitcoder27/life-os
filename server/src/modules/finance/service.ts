import type { PrismaClient } from "@prisma/client";

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

function startOfDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
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
