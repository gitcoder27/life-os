import type { FastifyPluginAsync } from "fastify";
import type {
  FinanceMonthPlanResponse,
  IsoMonthString,
} from "@life-os/contracts";

import { parseIsoDate } from "../../lib/time/cycle.js";
import { getUserLocalDate } from "../../lib/time/user-time.js";
import {
  OPEN_BILL_STATUSES,
  serializeFinanceBill,
} from "./service.js";

type FinanceApp = Parameters<FastifyPluginAsync>[0];

export function getMonthBounds(month: IsoMonthString) {
  const [year, monthNumber] = month.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, monthNumber - 1, 1));
  const nextMonthStart = new Date(Date.UTC(year, monthNumber, 1));

  return {
    monthStart,
    nextMonthStart,
  };
}

export function getIsoMonthString(date: Date): IsoMonthString {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}` as IsoMonthString;
}

function diffInDays(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

export function formatPlanCurrency(amountMinor: number, currencyCode: string) {
  const value = amountMinor / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currencyCode} ${value.toFixed(0)}`;
  }
}

export async function getUserFinanceContext(
  app: FinanceApp,
  userId: string,
) {
  const preferences = await app.prisma.userPreference.findUnique({
    where: {
      userId,
    },
    select: {
      currencyCode: true,
      timezone: true,
      weekStartsOn: true,
    },
  });

  return {
    currencyCode: preferences?.currencyCode ?? "USD",
    timezone: preferences?.timezone ?? "UTC",
    weekStartsOn: preferences?.weekStartsOn ?? 1,
  };
}

export function getOpenBillStatusFilter() {
  return {
    in: [...OPEN_BILL_STATUSES] as Array<(typeof OPEN_BILL_STATUSES)[number]>,
  };
}

export async function listFinanceBillsForMonth(
  app: FinanceApp,
  userId: string,
  month: IsoMonthString,
  options: { includeOverdueOpenBills?: boolean } = {},
) {
  const { monthStart, nextMonthStart } = getMonthBounds(month);

  return app.prisma.adminItem.findMany({
    where: {
      userId,
      itemType: "BILL",
      OR: [
        {
          dueOn: {
            gte: monthStart,
            lt: nextMonthStart,
          },
        },
        ...(options.includeOverdueOpenBills
          ? [
              {
                dueOn: {
                  lt: monthStart,
                },
                status: getOpenBillStatusFilter(),
              },
            ]
          : []),
      ],
    },
    include: {
      linkedExpense: {
        select: {
          id: true,
        },
      },
    },
    orderBy: [{ dueOn: "asc" }, { createdAt: "asc" }],
  });
}

export async function buildFinanceMonthPlan(
  app: FinanceApp,
  userId: string,
  month: IsoMonthString,
): Promise<FinanceMonthPlanResponse["monthPlan"]> {
  const { monthStart, nextMonthStart } = getMonthBounds(month);
  const { currencyCode, timezone } = await getUserFinanceContext(app, userId);
  const todayIsoDate = getUserLocalDate(new Date(), timezone);
  const today = parseIsoDate(todayIsoDate);
  const currentMonth = getIsoMonthString(parseIsoDate(`${todayIsoDate}`));
  const isCurrentMonth = month === currentMonth;
  const monthProgress = (() => {
    if (!isCurrentMonth) {
      return 1;
    }

    const dayOfMonth = today.getUTCDate();
    const daysInMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate();
    return dayOfMonth / daysInMonth;
  })();

  const [monthPlan, expenses, upcomingBills, overdueBills] = await Promise.all([
    app.prisma.financeMonthPlan.findUnique({
      where: {
        userId_monthStart: {
          userId,
          monthStart,
        },
      },
      include: {
        categoryWatches: {
          include: {
            expenseCategory: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    }),
    app.prisma.expense.findMany({
      where: {
        userId,
        spentOn: {
          gte: monthStart,
          lt: nextMonthStart,
        },
      },
    }),
    app.prisma.adminItem.findMany({
      where: {
        userId,
        dueOn: {
          gte: monthStart,
          lt: nextMonthStart,
        },
        itemType: "BILL",
        status: getOpenBillStatusFilter(),
      },
      include: {
        linkedExpense: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        dueOn: "asc",
      },
    }),
    app.prisma.adminItem.findMany({
      where: {
        userId,
        dueOn: {
          lt: monthStart,
        },
        itemType: "BILL",
        status: getOpenBillStatusFilter(),
      },
      include: {
        linkedExpense: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        dueOn: "asc",
      },
    }),
  ]);

  const spentByCategory = new Map<string, number>();
  let totalSpentMinor = 0;
  for (const expense of expenses) {
    totalSpentMinor += expense.amountMinor;
    if (!expense.expenseCategoryId) {
      continue;
    }

    spentByCategory.set(
      expense.expenseCategoryId,
      (spentByCategory.get(expense.expenseCategoryId) ?? 0) + expense.amountMinor,
    );
  }

  const watchedCategories = monthPlan?.categoryWatches.map((watch) => {
    const actualSpentMinor = spentByCategory.get(watch.expenseCategoryId) ?? 0;
    const ratio = actualSpentMinor / watch.watchLimitMinor;
    const status: FinanceMonthPlanResponse["monthPlan"]["categoryWatches"][number]["status"] =
      ratio > 1
        ? "over_limit"
        : ratio >= 0.85
          ? "near_limit"
          : "within_limit";

    return {
      expenseCategoryId: watch.expenseCategoryId,
      name: watch.expenseCategory.name,
      color: watch.expenseCategory.color,
      watchLimitMinor: watch.watchLimitMinor,
      actualSpentMinor,
      status,
    };
  }) ?? [];

  const allPendingBills = [...overdueBills, ...upcomingBills].sort((left, right) =>
    left.dueOn.getTime() - right.dueOn.getTime(),
  );

  const billTimeline: FinanceMonthPlanResponse["monthPlan"]["billTimeline"] = {
    today: [],
    thisWeek: [],
    laterThisMonth: [],
  };

  for (const bill of allPendingBills) {
    const timelineBill = serializeFinanceBill(bill);
    const dayDiff = diffInDays(today, bill.dueOn);

    if (dayDiff <= 0) {
      billTimeline.today.push(timelineBill);
      continue;
    }

    if (dayDiff <= 7) {
      billTimeline.thisWeek.push(timelineBill);
      continue;
    }

    billTimeline.laterThisMonth.push(timelineBill);
  }

  const plannedSpendMinor = monthPlan?.plannedSpendMinor ?? null;
  const expectedSpendToDateMinor =
    plannedSpendMinor != null ? Math.round(plannedSpendMinor * monthProgress) : null;
  const remainingPlannedSpendMinor =
    plannedSpendMinor != null ? plannedSpendMinor - totalSpentMinor : null;
  const remainingFlexibleSpendMinor =
    monthPlan?.flexibleSpendTargetMinor != null
      ? monthPlan.flexibleSpendTargetMinor - Math.max(totalSpentMinor - (monthPlan.fixedObligationsMinor ?? 0), 0)
      : null;

  const paceStatus: FinanceMonthPlanResponse["monthPlan"]["paceStatus"] =
    plannedSpendMinor == null || expectedSpendToDateMinor == null || expectedSpendToDateMinor <= 0
      ? "no_plan"
      : totalSpentMinor <= expectedSpendToDateMinor * 1.05
        ? "on_pace"
        : totalSpentMinor <= expectedSpendToDateMinor * 1.15
          ? "slightly_heavy"
          : "off_track";

  const paceSummary =
    paceStatus === "no_plan"
      ? "Add a monthly plan to compare actual spending with a target."
      : paceStatus === "on_pace"
        ? `Spent ${formatPlanCurrency(totalSpentMinor, currencyCode)} against an expected ${formatPlanCurrency(expectedSpendToDateMinor!, currencyCode)} by now. Pace looks healthy.`
        : paceStatus === "slightly_heavy"
          ? `Spent ${formatPlanCurrency(totalSpentMinor, currencyCode)} against an expected ${formatPlanCurrency(expectedSpendToDateMinor!, currencyCode)} by now. Spending is a little heavy.`
          : `Spent ${formatPlanCurrency(totalSpentMinor, currencyCode)} against an expected ${formatPlanCurrency(expectedSpendToDateMinor!, currencyCode)} by now. The month is off track and needs adjustment.`;

  return {
    id: monthPlan?.id ?? null,
    month,
    plannedSpendMinor,
    fixedObligationsMinor: monthPlan?.fixedObligationsMinor ?? null,
    flexibleSpendTargetMinor: monthPlan?.flexibleSpendTargetMinor ?? null,
    plannedIncomeMinor: monthPlan?.plannedIncomeMinor ?? null,
    expectedLargeExpensesMinor: monthPlan?.expectedLargeExpensesMinor ?? null,
    categoryWatches: watchedCategories,
    billTimeline,
    paceStatus,
    paceSummary,
    expectedSpendToDateMinor,
    remainingPlannedSpendMinor,
    remainingFlexibleSpendMinor,
  };
}
