import type { FastifyPluginAsync } from "fastify";
import type {
  CreateExpenseRequest,
  DeleteExpenseResponse,
  ExpenseMutationResponse,
  ExpensesResponse,
  FinanceBillItem as ContractFinanceBillItem,
  FinanceDashboardResponse,
  FinanceGoalMutationResponse,
  FinanceInsightsResponse,
  FinanceTimelineResponse,
  FinanceTransactionItem,
  IsoDateString,
  IsoMonthString,
  UpdateExpenseRequest,
  UpdateFinanceGoalRequest,
} from "@life-os/contracts";
import type {
  FinanceGoalType as PrismaFinanceGoalType,
  GoalStatus as PrismaGoalStatus,
} from "@prisma/client";
import { z } from "zod";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { AppError } from "../../lib/errors/app-error.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { getWeekStartIsoDate, parseIsoDate } from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import { getUserLocalDate } from "../../lib/time/user-time.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import {
  serializeFinanceBill,
} from "./service.js";
import {
  serializeCreditCard,
  serializeLoan,
} from "./finance-debt-mappers.js";
import { buildFinanceAccountItems } from "./finance-account-service.js";
import { registerFinanceAccountRoutes } from "./finance-account-routes.js";
import { registerFinanceBillRoutes } from "./finance-bill-routes.js";
import { registerFinanceCategoryRoutes } from "./finance-category-routes.js";
import { assertOwnedExpenseCategory } from "./finance-category-service.js";
import { getUserCurrencyCode } from "./finance-currency-service.js";
import { registerFinanceDebtRoutes } from "./finance-debt-routes.js";
import {
  findOwnedExpense,
  serializeExpense,
  toPrismaExpenseSource,
} from "./finance-expense-service.js";
import { registerFinanceMonthPlanRoutes } from "./finance-month-plan-routes.js";
import {
  buildFinanceMonthPlan,
  formatPlanCurrency,
  getIsoMonthString,
  getMonthBounds,
  getOpenBillStatusFilter,
  getUserFinanceContext,
} from "./finance-month-plan-service.js";
import { registerFinanceRecurringExpenseRoutes } from "./finance-recurring-expense-routes.js";
import { assertOwnedRecurringExpenseTemplate } from "./finance-recurring-expense-service.js";
import { registerFinanceRecurringIncomeRoutes } from "./finance-recurring-income-routes.js";
import { serializeRecurringIncome } from "./finance-recurring-income-service.js";
import { registerFinanceTransactionRoutes } from "./finance-transaction-routes.js";
import { serializeFinanceTransaction } from "./finance-transaction-service.js";
import { buildFinanceTimeline } from "./finance-timeline-service.js";
import { buildFinanceSafeToSpendBreakdown } from "./finance-safe-spend-service.js";
import { getMonthlyReviewModel, getWeeklyReviewModel } from "../reviews/service.js";
import {
  createExpenseSchema,
  expenseRangeQuerySchema,
  isoMonthSchema,
  updateExpenseSchema,
  updateFinanceGoalSchema,
} from "./finance-schemas.js";

type FinanceBillItem = ContractFinanceBillItem;

interface FinanceSummaryResponse {
  generatedAt: string;
  month: IsoMonthString;
  currencyCode: string;
  totalSpentMinor: number;
  previousMonthTotalSpentMinor: number;
  categoryTotals: Array<{
    expenseCategoryId: string | null;
    name: string;
    color: string | null;
    totalAmountMinor: number;
  }>;
  upcomingBills: FinanceBillItem[];
}

function toPrismaFinanceGoalType(
  goalType: NonNullable<UpdateFinanceGoalRequest["goalType"]>,
): PrismaFinanceGoalType {
  switch (goalType) {
    case "emergency_fund":
      return "EMERGENCY_FUND";
    case "debt_payoff":
      return "DEBT_PAYOFF";
    case "travel":
      return "TRAVEL";
    case "large_purchase":
      return "LARGE_PURCHASE";
    case "other":
      return "OTHER";
  }

  throw new Error(`Unsupported finance goal type: ${goalType satisfies never}`);
}

function fromPrismaFinanceGoalType(
  goalType: PrismaFinanceGoalType,
): NonNullable<UpdateFinanceGoalRequest["goalType"]> {
  switch (goalType) {
    case "EMERGENCY_FUND":
      return "emergency_fund";
    case "DEBT_PAYOFF":
      return "debt_payoff";
    case "TRAVEL":
      return "travel";
    case "LARGE_PURCHASE":
      return "large_purchase";
    case "OTHER":
      return "other";
  }

  throw new Error(`Unsupported finance goal type: ${goalType satisfies never}`);
}

function fromPrismaGoalStatus(
  status: PrismaGoalStatus,
): FinanceInsightsResponse["insights"]["moneyGoals"][number]["status"] {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "PAUSED":
      return "paused";
    case "COMPLETED":
      return "completed";
    case "ARCHIVED":
      return "archived";
  }

  throw new Error(`Unsupported goal status: ${status satisfies never}`);
}

async function buildFinanceDashboard(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  month: IsoMonthString,
): Promise<Omit<FinanceDashboardResponse, "generatedAt">> {
  const { monthStart, nextMonthStart } = getMonthBounds(month);
  const currencyCode = await getUserCurrencyCode(app.prisma, userId);

  const [accounts, transactions, monthPlan, recurringIncome, creditCards, loans, legacyExpenses, upcomingBills, overdueBills, moneyGoals] = await Promise.all([
    buildFinanceAccountItems(app.prisma, userId),
    app.prisma.financeTransaction.findMany({
      where: {
        userId,
        occurredOn: {
          gte: monthStart,
          lt: nextMonthStart,
        },
      },
      orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
      take: 30,
    }),
    app.prisma.financeMonthPlan.findUnique({
      where: {
        userId_monthStart: {
          userId,
          monthStart,
        },
      },
    }),
    app.prisma.recurringIncomeTemplate.findMany({
      where: {
        userId,
        status: {
          in: ["ACTIVE", "PAUSED"],
        },
      },
      orderBy: [{ nextExpectedOn: "asc" }, { createdAt: "asc" }],
    }),
    app.prisma.creditCard.findMany({
      where: {
        userId,
        status: "ACTIVE",
      },
      orderBy: [{ paymentDueDay: "asc" }, { createdAt: "asc" }],
    }),
    app.prisma.loan.findMany({
      where: {
        userId,
        status: "ACTIVE",
      },
      orderBy: [{ dueDay: "asc" }, { createdAt: "asc" }],
    }),
    app.prisma.expense.findMany({
      where: {
        userId,
        spentOn: {
          gte: monthStart,
          lt: nextMonthStart,
        },
      },
      orderBy: [{ spentOn: "desc" }, { createdAt: "desc" }],
      take: 30,
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
      take: 10,
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
      take: 10,
    }),
    app.prisma.goal.findMany({
      where: {
        userId,
        status: "ACTIVE",
        domain: {
          systemKey: "MONEY",
        },
        financeGoal: {
          is: {
            monthlyContributionTargetMinor: {
              gt: 0,
            },
          },
        },
      },
      include: {
        financeGoal: true,
      },
    }),
  ]);

  const incomeReceivedMinor = transactions
    .filter((transaction) => transaction.transactionType === "INCOME")
    .reduce((sum, transaction) => sum + transaction.amountMinor, 0);
  const ledgerSpentMinor = transactions
    .filter((transaction) => transaction.transactionType === "EXPENSE")
    .reduce((sum, transaction) => sum + transaction.amountMinor, 0);
  const ledgerExpenseBillIds = new Set(
    transactions
      .filter((transaction) => transaction.transactionType === "EXPENSE" && transaction.billId)
      .map((transaction) => transaction.billId),
  );
  const legacyOnlyExpenses = legacyExpenses.filter(
    (expense) => !expense.billId || !ledgerExpenseBillIds.has(expense.billId),
  );
  const legacySpentMinor = legacyOnlyExpenses.reduce((sum, expense) => sum + expense.amountMinor, 0);
  const upcomingOpenBills = [...overdueBills, ...upcomingBills];
  const upcomingDueMinor = upcomingOpenBills.reduce((sum, bill) => sum + (bill.amountMinor ?? 0), 0);
  const cardDueMinor = creditCards.reduce((sum, card) => sum + (card.minimumDueMinor ?? 0), 0);
  const loanDueMinor = loans.reduce((sum, loan) => sum + loan.emiAmountMinor, 0);
  const debtDueMinor = cardDueMinor + loanDueMinor;
  const plannedExpensesMinor = monthPlan?.expectedLargeExpensesMinor ?? 0;
  const goalCommitmentsMinor = moneyGoals.reduce(
    (sum, goal) => sum + (goal.financeGoal?.monthlyContributionTargetMinor ?? 0),
    0,
  );
  const debtOutstandingMinor =
    creditCards.reduce((sum, card) => sum + card.outstandingBalanceMinor, 0)
    + loans.reduce((sum, loan) => sum + loan.outstandingBalanceMinor, 0);
  const cashAvailableMinor = accounts
    .filter((account) => !account.archivedAt)
    .reduce((sum, account) => sum + account.currentBalanceMinor, 0);
  const totalSpentMinor = ledgerSpentMinor + legacySpentMinor;
  const safeToSpendBreakdown = buildFinanceSafeToSpendBreakdown({
    currencyCode,
    cashAvailableMinor,
    incomeReceivedMinor,
    unpaidBillsMinor: upcomingDueMinor,
    cardDuesMinor: cardDueMinor,
    loanEmisMinor: loanDueMinor,
    plannedExpensesMinor,
    goalCommitmentsMinor,
    billCount: upcomingOpenBills.length,
    cardCount: creditCards.filter((card) => (card.minimumDueMinor ?? 0) > 0).length,
    loanCount: loans.length,
    goalCount: moneyGoals.length,
  });

  return {
    month,
    currencyCode,
    cashAvailableMinor,
    incomeReceivedMinor,
    plannedIncomeMinor: monthPlan?.plannedIncomeMinor ?? null,
    totalSpentMinor,
    upcomingDueMinor,
    debtDueMinor,
    debtOutstandingMinor,
    safeToSpendMinor: safeToSpendBreakdown.safeToSpendMinor,
    safeToSpendBreakdown,
    accountCount: accounts.filter((account) => !account.archivedAt).length,
    transactionCount: transactions.length + legacyOnlyExpenses.length,
    upcomingBills: upcomingOpenBills.map(serializeFinanceBill),
    accounts,
    recentTransactions: [
      ...transactions.map(serializeFinanceTransaction),
      ...legacyOnlyExpenses.map((expense): FinanceTransactionItem => ({
        id: `legacy-expense-${expense.id}`,
        accountId: "",
        transferAccountId: null,
        transactionType: "expense",
        amountMinor: expense.amountMinor,
        currencyCode: expense.currencyCode,
        occurredOn: toIsoDateString(expense.spentOn),
        description: expense.description,
        expenseCategoryId: expense.expenseCategoryId,
        billId: expense.billId,
        recurringIncomeId: null,
        source: "legacy_expense",
        createdAt: expense.createdAt.toISOString(),
        updatedAt: expense.updatedAt.toISOString(),
      })),
    ].sort((left, right) => right.occurredOn.localeCompare(left.occurredOn) || right.createdAt.localeCompare(left.createdAt)).slice(0, 30),
    recurringIncome: recurringIncome.map(serializeRecurringIncome),
    creditCards: creditCards.map(serializeCreditCard),
    loans: loans.map(serializeLoan),
  };
}

function getGoalProgressPercent(
  targetAmountMinor: number | null,
  currentAmountMinor: number | null,
  milestones: Array<{ status: "PENDING" | "COMPLETED" }>,
) {
  if (targetAmountMinor != null && targetAmountMinor > 0 && currentAmountMinor != null) {
    return Math.min(Math.round((currentAmountMinor / targetAmountMinor) * 100), 100);
  }

  if (milestones.length === 0) {
    return 0;
  }

  const completedCount = milestones.filter((milestone) => milestone.status === "COMPLETED").length;
  return Math.round((completedCount / milestones.length) * 100);
}

function buildContributionSummary(
  monthlyContributionTargetMinor: number | null,
  remainingAmountMinor: number | null,
  currencyCode: string,
  remainingFlexibleSpendMinor: number | null,
): {
  contributionFit: FinanceInsightsResponse["insights"]["moneyGoals"][number]["contributionFit"];
  contributionSummary: string;
} {
  if (monthlyContributionTargetMinor == null || monthlyContributionTargetMinor <= 0) {
    return {
      contributionFit: "needs_plan",
      contributionSummary: "Set a monthly contribution target to connect this goal to your money plan.",
    };
  }

  if (remainingFlexibleSpendMinor == null) {
    return {
      contributionFit: "needs_plan",
      contributionSummary: `Plan to move ${formatPlanCurrency(monthlyContributionTargetMinor, currencyCode)} into this goal each month.`,
    };
  }

  if (monthlyContributionTargetMinor <= remainingFlexibleSpendMinor) {
    return {
      contributionFit: "on_track",
      contributionSummary: remainingAmountMinor != null && remainingAmountMinor > 0
        ? `${formatPlanCurrency(monthlyContributionTargetMinor, currencyCode)} per month fits inside this month's flexible space. ${formatPlanCurrency(remainingAmountMinor, currencyCode)} still to go.`
        : `${formatPlanCurrency(monthlyContributionTargetMinor, currencyCode)} per month fits inside this month's flexible space.`,
    };
  }

  return {
    contributionFit: "tight",
    contributionSummary: `${formatPlanCurrency(monthlyContributionTargetMinor, currencyCode)} per month is higher than the flexible amount left in this month's plan.`,
  };
}

async function findOwnedMoneyGoal(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  goalId: string,
) {
  const goal = await app.prisma.goal.findFirst({
    where: {
      id: goalId,
      userId,
      domain: {
        systemKey: "MONEY",
      },
    },
    include: {
      domain: true,
      milestones: {
        orderBy: [{ targetDate: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      },
      financeGoal: true,
    },
  });

  if (!goal) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Money goal not found",
    });
  }

  return goal;
}

async function buildFinanceInsights(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  month: IsoMonthString,
): Promise<FinanceInsightsResponse["insights"]> {
  const { monthStart, nextMonthStart } = getMonthBounds(month);
  const { currencyCode, timezone, weekStartsOn } = await getUserFinanceContext(app, userId);
  const todayIsoDate = getUserLocalDate(new Date(), timezone);
  const currentMonth = getIsoMonthString(parseIsoDate(todayIsoDate));
  const selectedMonthEnd = new Date(nextMonthStart.getTime() - 24 * 60 * 60 * 1000);
  const weekAnchorIsoDate = month === currentMonth ? todayIsoDate : toIsoDateString(selectedMonthEnd);
  const weekStartIsoDate = getWeekStartIsoDate(weekAnchorIsoDate, weekStartsOn);

  const [monthPlan, moneyGoals, weeklyReview, monthlyReview] = await Promise.all([
    buildFinanceMonthPlan(app, userId, month),
    app.prisma.goal.findMany({
      where: {
        userId,
        domain: {
          systemKey: "MONEY",
        },
        status: {
          not: "ARCHIVED",
        },
      },
      include: {
        domain: true,
        horizon: true,
        milestones: {
          orderBy: [{ targetDate: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
        },
        financeGoal: true,
      },
      orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    getWeeklyReviewModel(app.prisma, userId, parseIsoDate(weekStartIsoDate)),
    getMonthlyReviewModel(app.prisma, userId, monthStart),
  ]);

  const spendWatchCategoryId = weeklyReview.existingReview?.spendingWatchCategoryId ?? null;
  const [spendWatchCategory, spendWatchTotals] = spendWatchCategoryId
    ? await Promise.all([
      app.prisma.expenseCategory.findFirst({
        where: {
          id: spendWatchCategoryId,
          userId,
        },
      }),
      app.prisma.expense.aggregate({
        where: {
          userId,
          expenseCategoryId: spendWatchCategoryId,
          spentOn: {
            gte: monthStart,
            lt: nextMonthStart,
          },
        },
        _sum: {
          amountMinor: true,
        },
      }),
    ])
    : [null, null];

  const moneyGoalItems = moneyGoals.map((goal) => {
    const targetAmountMinor = goal.financeGoal?.targetAmountMinor ?? null;
    const currentAmountMinor = goal.financeGoal?.currentAmountMinor ?? null;
    const remainingAmountMinor =
      targetAmountMinor != null && currentAmountMinor != null
        ? Math.max(targetAmountMinor - currentAmountMinor, 0)
        : null;
    const progressPercent = getGoalProgressPercent(targetAmountMinor, currentAmountMinor, goal.milestones);
    const nextMilestone = goal.milestones.find((milestone) => milestone.status === "PENDING") ?? null;
    const contribution = buildContributionSummary(
      goal.financeGoal?.monthlyContributionTargetMinor ?? null,
      remainingAmountMinor,
      currencyCode,
      monthPlan.remainingFlexibleSpendMinor,
    );

    return {
      goalId: goal.id,
      title: goal.title,
      status: fromPrismaGoalStatus(goal.status),
      route: "/goals",
      goalType: goal.financeGoal ? fromPrismaFinanceGoalType(goal.financeGoal.goalType) : null,
      targetDate: goal.targetDate ? toIsoDateString(goal.targetDate) : null,
      targetAmountMinor,
      currentAmountMinor,
      progressPercent,
      remainingAmountMinor,
      monthlyContributionTargetMinor: goal.financeGoal?.monthlyContributionTargetMinor ?? null,
      contributionFit: contribution.contributionFit,
      contributionSummary: contribution.contributionSummary,
      nextMilestoneTitle: nextMilestone?.title ?? null,
      nextMilestoneDate: nextMilestone?.targetDate ? toIsoDateString(nextMilestone.targetDate) : null,
    };
  });

  return {
    month,
    moneyGoals: moneyGoalItems,
    currentFocus:
      spendWatchCategory && weeklyReview.existingReview?.improveText
        ? {
            expenseCategoryId: spendWatchCategory.id,
            name: spendWatchCategory.name,
            color: spendWatchCategory.color,
            monthSpentMinor: spendWatchTotals?._sum.amountMinor ?? 0,
            guidance: weeklyReview.existingReview.improveText,
            route: `/reviews/weekly?date=${weeklyReview.startDate}`,
          }
        : null,
    weeklyReview: {
      route: `/reviews/weekly?date=${weeklyReview.startDate}`,
      startDate: weeklyReview.startDate as IsoDateString,
      endDate: weeklyReview.endDate as IsoDateString,
      spendingTotalMinor: weeklyReview.summary.spendingTotal,
      topSpendCategory: weeklyReview.summary.topSpendCategory,
      biggestWin: weeklyReview.existingReview?.biggestWin ?? null,
      keepText: weeklyReview.existingReview?.keepText ?? null,
      improveText: weeklyReview.existingReview?.improveText ?? null,
      spendWatchCategoryName: spendWatchCategory?.name ?? null,
    },
    monthlyReview: {
      route: `/reviews/monthly?date=${monthlyReview.startDate}`,
      startDate: monthlyReview.startDate as IsoDateString,
      endDate: monthlyReview.endDate as IsoDateString,
      monthVerdict: monthlyReview.existingReview?.monthVerdict ?? null,
      biggestWin: monthlyReview.existingReview?.biggestWin ?? null,
      biggestLeak: monthlyReview.existingReview?.biggestLeak ?? null,
      nextMonthTheme: monthlyReview.existingReview?.nextMonthTheme ?? null,
      topSpendingCategories: monthlyReview.summary.spendingByCategory
        .slice()
        .sort((left, right) => right.amountMinor - left.amountMinor)
        .slice(0, 3),
    },
  };
}

export const registerFinanceRoutes: FastifyPluginAsync = async (app) => {
  await app.register(registerFinanceAccountRoutes);
  await app.register(registerFinanceBillRoutes);
  await app.register(registerFinanceCategoryRoutes);
  await app.register(registerFinanceDebtRoutes);
  await app.register(registerFinanceMonthPlanRoutes);
  await app.register(registerFinanceRecurringExpenseRoutes);
  await app.register(registerFinanceRecurringIncomeRoutes);
  await app.register(registerFinanceTransactionRoutes);

  app.get("/dashboard", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(
      z.object({
        month: isoMonthSchema,
      }),
      request.query,
    );

    const response: FinanceDashboardResponse = withGeneratedAt(
      await buildFinanceDashboard(app, user.id, query.month),
    );

    return reply.send(response);
  });

  app.get("/timeline", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(
      z.object({
        month: isoMonthSchema,
      }),
      request.query,
    );

    const response: FinanceTimelineResponse = withGeneratedAt(
      await buildFinanceTimeline(app, user.id, query.month),
    );

    return reply.send(response);
  });

  app.get("/insights", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(
      z.object({
        month: isoMonthSchema,
      }),
      request.query,
    );

    const response: FinanceInsightsResponse = withGeneratedAt({
      insights: await buildFinanceInsights(app, user.id, query.month),
    });

    return reply.send(response);
  });

  app.put("/goals/:goalId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { goalId } = request.params as { goalId: string };
    const payload = parseOrThrow(updateFinanceGoalSchema, request.body as UpdateFinanceGoalRequest);

    const goal = await findOwnedMoneyGoal(app, user.id, goalId);

    await app.prisma.financeGoal.upsert({
      where: {
        goalId: goal.id,
      },
      update: {
        goalType: payload.goalType ? toPrismaFinanceGoalType(payload.goalType) : undefined,
        targetAmountMinor: payload.targetAmountMinor,
        currentAmountMinor: payload.currentAmountMinor,
        monthlyContributionTargetMinor: payload.monthlyContributionTargetMinor,
      },
      create: {
        goalId: goal.id,
        goalType: payload.goalType ? toPrismaFinanceGoalType(payload.goalType) : "OTHER",
        targetAmountMinor: payload.targetAmountMinor ?? null,
        currentAmountMinor: payload.currentAmountMinor ?? null,
        monthlyContributionTargetMinor: payload.monthlyContributionTargetMinor ?? null,
      },
    });

    const response: FinanceGoalMutationResponse = withGeneratedAt({
      goalId: goal.id,
    });

    return reply.send(response);
  });

  app.get("/expenses", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(expenseRangeQuerySchema, request.query);
    const fromDate = parseIsoDate(query.from);
    const toDateExclusive = new Date(parseIsoDate(query.to).getTime() + 24 * 60 * 60 * 1000);
    const expenses = await app.prisma.expense.findMany({
      where: {
        userId: user.id,
        spentOn: {
          gte: fromDate,
          lt: toDateExclusive,
        },
      },
      orderBy: [{ spentOn: "asc" }, { createdAt: "asc" }],
    });

    const response: ExpensesResponse = withGeneratedAt({
      from: query.from,
      to: query.to,
      expenses: expenses.map(serializeExpense),
    });

    return reply.send(response);
  });

  app.get("/summary", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(
      z.object({
        month: isoMonthSchema,
      }),
      request.query,
    );
    const { monthStart, nextMonthStart } = getMonthBounds(query.month);
    const currencyCode = await getUserCurrencyCode(app.prisma, user.id);

    // Compute previous month bounds for comparison
    const prevMonthStart = new Date(monthStart);
    prevMonthStart.setUTCMonth(prevMonthStart.getUTCMonth() - 1);
    const prevMonthEnd = new Date(monthStart);

    const [expenses, categories, upcomingBills, overdueBills, prevMonthExpenses] = await Promise.all([
      app.prisma.expense.findMany({
        where: {
          userId: user.id,
          spentOn: {
            gte: monthStart,
            lt: nextMonthStart,
          },
        },
      }),
      app.prisma.expenseCategory.findMany({
        where: {
          userId: user.id,
          archivedAt: null,
        },
      }),
      app.prisma.adminItem.findMany({
        where: {
          userId: user.id,
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
        take: 10,
      }),
      // Overdue bills from prior months that are still pending
      app.prisma.adminItem.findMany({
        where: {
          userId: user.id,
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
        take: 10,
      }),
      // Previous month spending for comparison
      app.prisma.expense.aggregate({
        where: {
          userId: user.id,
          spentOn: {
            gte: prevMonthStart,
            lt: prevMonthEnd,
          },
        },
        _sum: {
          amountMinor: true,
        },
      }),
    ]);

    const categoryLookup = new Map(categories.map((category) => [category.id, category]));
    const categoryTotalsMap = new Map<
      string,
      { expenseCategoryId: string | null; name: string; color: string | null; totalAmountMinor: number }
    >();
    let totalSpentMinor = 0;

    for (const expense of expenses) {
      totalSpentMinor += expense.amountMinor;
      const category = expense.expenseCategoryId ? categoryLookup.get(expense.expenseCategoryId) : null;
      const key = expense.expenseCategoryId ?? "uncategorized";
      const existing = categoryTotalsMap.get(key);

      if (existing) {
        existing.totalAmountMinor += expense.amountMinor;
        continue;
      }

      categoryTotalsMap.set(key, {
        expenseCategoryId: expense.expenseCategoryId,
        name: category?.name ?? "Uncategorized",
        color: category?.color ?? null,
        totalAmountMinor: expense.amountMinor,
      });
    }

    const allPendingBills = [...overdueBills, ...upcomingBills];

    const response: FinanceSummaryResponse = withGeneratedAt({
      month: query.month,
      currencyCode,
      totalSpentMinor,
      previousMonthTotalSpentMinor: prevMonthExpenses._sum.amountMinor ?? 0,
      categoryTotals: Array.from(categoryTotalsMap.values()).sort(
        (left, right) => right.totalAmountMinor - left.totalAmountMinor,
      ),
      upcomingBills: allPendingBills.map(serializeFinanceBill),
    });

    return reply.send(response);
  });

  app.post("/expenses", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createExpenseSchema, request.body as CreateExpenseRequest);

    await Promise.all([
      assertOwnedExpenseCategory(app.prisma, user.id, payload.expenseCategoryId),
      assertOwnedRecurringExpenseTemplate(app.prisma, user.id, payload.recurringExpenseTemplateId),
    ]);

    const expense = await app.prisma.expense.create({
      data: {
        userId: user.id,
        expenseCategoryId: payload.expenseCategoryId ?? null,
        amountMinor: payload.amountMinor,
        currencyCode: payload.currencyCode ?? (await getUserCurrencyCode(app.prisma, user.id)),
        spentOn: parseIsoDate(payload.spentOn),
        description: payload.description ?? null,
        source: toPrismaExpenseSource(payload.source ?? "manual"),
        recurringExpenseTemplateId: payload.recurringExpenseTemplateId ?? null,
      },
    });

    const response: ExpenseMutationResponse = withGeneratedAt({
      expense: serializeExpense(expense),
    });

    return reply.status(201).send(response);
  });

  app.patch("/expenses/:expenseId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(updateExpenseSchema, request.body as UpdateExpenseRequest);
    const { expenseId } = request.params as { expenseId: string };

    await findOwnedExpense(app.prisma, user.id, expenseId);
    await assertOwnedExpenseCategory(app.prisma, user.id, payload.expenseCategoryId);

    const expense = await app.prisma.expense.update({
      where: {
        id: expenseId,
      },
      data: {
        expenseCategoryId: payload.expenseCategoryId,
        amountMinor: payload.amountMinor,
        currencyCode: payload.currencyCode,
        spentOn: payload.spentOn ? parseIsoDate(payload.spentOn) : undefined,
        description: payload.description,
      },
    });

    const response: ExpenseMutationResponse = withGeneratedAt({
      expense: serializeExpense(expense),
    });

    return reply.send(response);
  });

  app.delete("/expenses/:expenseId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { expenseId } = request.params as { expenseId: string };

    await findOwnedExpense(app.prisma, user.id, expenseId);
    await app.prisma.expense.delete({
      where: {
        id: expenseId,
      },
    });

    const response: DeleteExpenseResponse = withGeneratedAt({
      deleted: true,
      expenseId,
    });

    return reply.send(response);
  });

};
