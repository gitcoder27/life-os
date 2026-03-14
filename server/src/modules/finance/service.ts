import type { PrismaClient } from "@prisma/client";

import { addDays } from "../../lib/time/cycle.js";

interface MaterializeRecurringExpensesResult {
  createdAdminItems: number;
  advancedTemplates: number;
  unsupportedTemplates: number;
}

type RecurrenceUnit = "day" | "week" | "month" | "year";

function startOfDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()));
}

function addYears(date: Date, years: number) {
  return new Date(Date.UTC(date.getUTCFullYear() + years, date.getUTCMonth(), date.getUTCDate()));
}

function parseRecurrenceRule(
  recurrenceRule: string,
): { count: number; unit: RecurrenceUnit } | null {
  const normalized = recurrenceRule.trim().toLowerCase();

  if (normalized === "daily") {
    return { count: 1, unit: "day" };
  }
  if (normalized === "weekly") {
    return { count: 1, unit: "week" };
  }
  if (normalized === "monthly") {
    return { count: 1, unit: "month" };
  }
  if (normalized === "yearly") {
    return { count: 1, unit: "year" };
  }

  const match = normalized.match(/^every:(\d+):(day|days|week|weeks|month|months|year|years)$/);
  if (!match) {
    return null;
  }

  const count = Number(match[1]);
  const unitToken = match[2];
  const unit =
    unitToken.startsWith("day")
      ? "day"
      : unitToken.startsWith("week")
        ? "week"
        : unitToken.startsWith("month")
          ? "month"
          : "year";

  return {
    count,
    unit,
  };
}

function getNextOccurrence(
  dueOn: Date,
  recurrence: { count: number; unit: RecurrenceUnit },
) {
  switch (recurrence.unit) {
    case "day":
      return addDays(dueOn, recurrence.count);
    case "week":
      return addDays(dueOn, recurrence.count * 7);
    case "month":
      return addMonths(dueOn, recurrence.count);
    case "year":
      return addYears(dueOn, recurrence.count);
  }
}

export async function materializeRecurringExpenseItems(
  prisma: PrismaClient,
  now: Date,
): Promise<MaterializeRecurringExpensesResult> {
  const templates = await prisma.recurringExpenseTemplate.findMany({
    where: {
      status: "ACTIVE",
    },
    orderBy: [{ nextDueOn: "asc" }, { createdAt: "asc" }],
  });
  const lookaheadDate = addDays(startOfDay(now), 45);

  let createdAdminItems = 0;
  let advancedTemplates = 0;
  let unsupportedTemplates = 0;

  for (const template of templates) {
    const recurrence = parseRecurrenceRule(template.recurrenceRule);
    if (!recurrence) {
      unsupportedTemplates += 1;
      continue;
    }

    const originalNextDueOn = startOfDay(template.nextDueOn);
    let nextDueOn = originalNextDueOn;
    let safety = 0;

    await prisma.$transaction(async (tx) => {
      while (nextDueOn <= lookaheadDate && safety < 60) {
        const existingAdminItem = await tx.adminItem.findFirst({
          where: {
            userId: template.userId,
            recurringExpenseTemplateId: template.id,
            dueOn: nextDueOn,
          },
        });

        if (!existingAdminItem) {
          await tx.adminItem.create({
            data: {
              userId: template.userId,
              title: template.title,
              itemType: "BILL",
              dueOn: nextDueOn,
              status: "PENDING",
              recurringExpenseTemplateId: template.id,
              amountMinor: template.defaultAmountMinor,
              note: "Auto-generated from recurring expense template",
            },
          });
          createdAdminItems += 1;
        }

        nextDueOn = getNextOccurrence(nextDueOn, recurrence);
        safety += 1;
      }

      if (nextDueOn.getTime() !== originalNextDueOn.getTime()) {
        await tx.recurringExpenseTemplate.update({
          where: {
            id: template.id,
          },
          data: {
            nextDueOn,
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
