import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type {
  RecurrenceDefinition,
  RecurrenceInput,
} from "../recurrence";
import {
  getMonthEndDate,
  getMonthStartDate,
  getMonthString,
} from "../date";
import {
  apiRequest,
  invalidateCoreData,
  queryKeys,
  toSectionError,
  unwrapRequiredResult,
} from "./core";

type FinanceSummaryResponse = {
  generatedAt: string;
  month: string;
  currencyCode: string;
  totalSpentMinor: number;
  previousMonthTotalSpentMinor: number;
  categoryTotals: Array<{
    expenseCategoryId: string | null;
    name: string;
    color: string | null;
    totalAmountMinor: number;
  }>;
  upcomingBills: Array<{
    id: string;
    title: string;
    dueOn: string;
    amountMinor: number | null;
    status: "pending" | "done" | "rescheduled" | "dropped";
    recurringExpenseTemplateId: string | null;
  }>;
};

export type FinancePaceStatus = "no_plan" | "on_pace" | "slightly_heavy" | "off_track";
export type FinanceWatchStatus = "within_limit" | "near_limit" | "over_limit";
export type FinanceGoalType = "emergency_fund" | "debt_payoff" | "travel" | "large_purchase" | "other";
export type FinanceContributionFit = "on_track" | "tight" | "needs_plan";

export type FinanceMonthPlanItem = {
  id: string | null;
  month: string;
  plannedSpendMinor: number | null;
  fixedObligationsMinor: number | null;
  flexibleSpendTargetMinor: number | null;
  plannedIncomeMinor: number | null;
  expectedLargeExpensesMinor: number | null;
  categoryWatches: Array<{
    expenseCategoryId: string;
    name: string;
    color: string | null;
    watchLimitMinor: number;
    actualSpentMinor: number;
    status: FinanceWatchStatus;
  }>;
  billTimeline: {
    today: FinanceSummaryResponse["upcomingBills"];
    thisWeek: FinanceSummaryResponse["upcomingBills"];
    laterThisMonth: FinanceSummaryResponse["upcomingBills"];
  };
  paceStatus: FinancePaceStatus;
  paceSummary: string;
  expectedSpendToDateMinor: number | null;
  remainingPlannedSpendMinor: number | null;
  remainingFlexibleSpendMinor: number | null;
};

export type FinanceMonthPlanResponse = {
  generatedAt: string;
  monthPlan: FinanceMonthPlanItem;
};

export type FinanceGoalInsightItem = {
  goalId: string;
  title: string;
  status: "active" | "paused" | "completed" | "archived";
  route: string;
  goalType: FinanceGoalType | null;
  targetDate: string | null;
  targetAmountMinor: number | null;
  currentAmountMinor: number | null;
  progressPercent: number;
  remainingAmountMinor: number | null;
  monthlyContributionTargetMinor: number | null;
  contributionFit: FinanceContributionFit;
  contributionSummary: string;
  nextMilestoneTitle: string | null;
  nextMilestoneDate: string | null;
};

export type FinanceInsightsItem = {
  month: string;
  moneyGoals: FinanceGoalInsightItem[];
  currentFocus: {
    expenseCategoryId: string;
    name: string;
    color: string | null;
    monthSpentMinor: number;
    guidance: string;
    route: string;
  } | null;
  weeklyReview: {
    route: string;
    startDate: string;
    endDate: string;
    spendingTotalMinor: number;
    topSpendCategory: string | null;
    biggestWin: string | null;
    keepText: string | null;
    improveText: string | null;
    spendWatchCategoryName: string | null;
  } | null;
  monthlyReview: {
    route: string;
    startDate: string;
    endDate: string;
    monthVerdict: string | null;
    biggestWin: string | null;
    biggestLeak: string | null;
    nextMonthTheme: string | null;
    topSpendingCategories: Array<{
      category: string;
      amountMinor: number;
    }>;
  } | null;
};

export type FinanceInsightsResponse = {
  generatedAt: string;
  insights: FinanceInsightsItem;
};

export type UpdateFinanceMonthPlanRequest = {
  plannedSpendMinor?: number | null;
  fixedObligationsMinor?: number | null;
  flexibleSpendTargetMinor?: number | null;
  plannedIncomeMinor?: number | null;
  expectedLargeExpensesMinor?: number | null;
  categoryWatches?: Array<{
    expenseCategoryId: string;
    watchLimitMinor: number;
  }>;
};

type FinanceMonthPlanMutationResponse = FinanceMonthPlanResponse;
type FinanceGoalMutationResponse = {
  generatedAt: string;
  goalId: string;
};

export type UpdateFinanceGoalRequest = {
  goalType?: FinanceGoalType | null;
  targetAmountMinor?: number | null;
  currentAmountMinor?: number | null;
  monthlyContributionTargetMinor?: number | null;
};

type ExpensesResponse = {
  generatedAt: string;
  from: string;
  to: string;
  expenses: Array<{
    id: string;
    expenseCategoryId: string | null;
    amountMinor: number;
    currencyCode: string;
    spentOn: string;
    description: string | null;
    source: "manual" | "quick_capture" | "template";
    recurringExpenseTemplateId: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

type RecurringExpensesResponse = {
  generatedAt: string;
  recurringExpenses: Array<{
    id: string;
    title: string;
    expenseCategoryId: string | null;
    defaultAmountMinor: number | null;
    currencyCode: string;
    recurrenceRule: string;
    recurrence: RecurrenceDefinition | null;
    nextDueOn: string;
    remindDaysBefore: number;
    status: "active" | "paused" | "archived";
    createdAt: string;
    updatedAt: string;
  }>;
};

type FinanceCategoriesResponse = {
  generatedAt: string;
  categories: Array<{
    id: string;
    name: string;
    color: string | null;
    sortOrder: number;
    createdAt: string;
    archivedAt: string | null;
  }>;
};

type ExpenseMutationResponse = {
  generatedAt: string;
  expense: ExpensesResponse["expenses"][number];
};

type DeleteExpenseMutationResponse = {
  generatedAt: string;
  deleted: true;
  expenseId: string;
};

type CategoryMutationResponse = {
  generatedAt: string;
  category: FinanceCategoriesResponse["categories"][number];
};

type RecurringExpenseMutationResponse = {
  generatedAt: string;
  recurringExpense: RecurringExpensesResponse["recurringExpenses"][number];
};

export type AdminItemStatus = "pending" | "done" | "rescheduled" | "dropped";

export type AdminItemRecord = {
  id: string;
  title: string;
  itemType: "bill" | "admin";
  dueOn: string;
  status: AdminItemStatus;
  relatedTaskId: string | null;
  recurringExpenseTemplateId: string | null;
  amountMinor: number | null;
  note: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type AdminItemMutationResponse = {
  generatedAt: string;
  adminItem: AdminItemRecord;
};

const invalidateFinanceCollections = (queryClient: ReturnType<typeof useQueryClient>) => {
  void queryClient.invalidateQueries({ queryKey: queryKeys.financeCategories });
  void queryClient.invalidateQueries({ queryKey: queryKeys.financeRecurring });
  void queryClient.invalidateQueries({ queryKey: ["finance"] });
};

type FinanceDataQueryOptions = {
  enabled?: boolean;
  includeSummary?: boolean;
  includeExpenses?: boolean;
  includeRecurringExpenses?: boolean;
  includeCategories?: boolean;
  includeMonthPlan?: boolean;
  includeInsights?: boolean;
};

type FinanceDataQueryResult = {
  summary: FinanceSummaryResponse | null;
  expenses: ExpensesResponse | null;
  recurringExpenses: RecurringExpensesResponse | null;
  categories: FinanceCategoriesResponse | null;
  monthPlan: FinanceMonthPlanResponse | null;
  insights: FinanceInsightsResponse | null;
  sectionErrors: {
    expenses: ReturnType<typeof toSectionError> | null;
    recurringExpenses: ReturnType<typeof toSectionError> | null;
    categories: ReturnType<typeof toSectionError> | null;
    monthPlan: ReturnType<typeof toSectionError> | null;
    insights: ReturnType<typeof toSectionError> | null;
  };
};

const normalizeFinanceMonthInput = (value: string) =>
  /^\d{4}-\d{2}$/.test(value) ? value : getMonthString(value);

export const useFinanceDataQuery = (
  monthOrDate: string,
  options: FinanceDataQueryOptions = {},
) => {
  const month = normalizeFinanceMonthInput(monthOrDate);
  const monthStart = getMonthStartDate(`${month}-01`);
  const monthEnd = getMonthEndDate(`${month}-01`);
  const includeSummary = options.includeSummary ?? true;
  const includeExpenses = options.includeExpenses ?? true;
  const includeRecurringExpenses = options.includeRecurringExpenses ?? true;
  const includeCategories = options.includeCategories ?? true;
  const includeMonthPlan = options.includeMonthPlan ?? true;
  const includeInsights = options.includeInsights ?? true;
  const sectionKey = [
    includeSummary ? "summary" : "no-summary",
    includeExpenses ? "expenses" : "no-expenses",
    includeRecurringExpenses ? "recurring" : "no-recurring",
    includeCategories ? "categories" : "no-categories",
    includeMonthPlan ? "month-plan" : "no-month-plan",
    includeInsights ? "insights" : "no-insights",
  ].join(":");

  return useQuery<FinanceDataQueryResult>({
    queryKey: [...queryKeys.finance(month), sectionKey],
    enabled: options.enabled,
    queryFn: async () => {
      const [
        summaryResult,
        expensesResult,
        recurringExpensesResult,
        categoriesResult,
        monthPlanResult,
        insightsResult,
      ] =
        await Promise.allSettled([
          includeSummary
            ? apiRequest<FinanceSummaryResponse>("/api/finance/summary", {
              query: { month },
            })
            : Promise.resolve(null),
          includeExpenses
            ? apiRequest<ExpensesResponse>("/api/finance/expenses", {
              query: { from: monthStart, to: monthEnd },
            })
            : Promise.resolve(null),
          includeRecurringExpenses
            ? apiRequest<RecurringExpensesResponse>("/api/finance/recurring-expenses")
            : Promise.resolve(null),
          includeCategories
            ? apiRequest<FinanceCategoriesResponse>("/api/finance/categories")
            : Promise.resolve(null),
          includeMonthPlan
            ? apiRequest<FinanceMonthPlanResponse>("/api/finance/month-plan", {
              query: { month },
            })
            : Promise.resolve(null),
          includeInsights
            ? apiRequest<FinanceInsightsResponse>("/api/finance/insights", {
              query: { month },
            })
            : Promise.resolve(null),
        ]);

      return {
        summary:
          includeSummary
            ? unwrapRequiredResult(summaryResult, "Finance summary could not load.")
            : null,
        expenses:
          includeExpenses && expensesResult.status === "fulfilled"
            ? expensesResult.value
            : null,
        recurringExpenses:
          includeRecurringExpenses && recurringExpensesResult.status === "fulfilled"
            ? recurringExpensesResult.value
            : null,
        categories:
          includeCategories && categoriesResult.status === "fulfilled"
            ? categoriesResult.value
            : null,
        monthPlan:
          includeMonthPlan && monthPlanResult.status === "fulfilled"
            ? monthPlanResult.value
            : null,
        insights:
          includeInsights && insightsResult.status === "fulfilled"
            ? insightsResult.value
            : null,
        sectionErrors: {
          expenses:
            includeExpenses && expensesResult.status === "rejected"
              ? toSectionError(expensesResult.reason, "Expenses could not load.")
              : null,
          recurringExpenses:
            includeRecurringExpenses && recurringExpensesResult.status === "rejected"
              ? toSectionError(recurringExpensesResult.reason, "Recurring bills could not load.")
              : null,
          categories:
            includeCategories && categoriesResult.status === "rejected"
              ? toSectionError(categoriesResult.reason, "Categories could not load.")
              : null,
          monthPlan:
            includeMonthPlan && monthPlanResult.status === "rejected"
              ? toSectionError(monthPlanResult.reason, "Monthly plan could not load.")
              : null,
          insights:
            includeInsights && insightsResult.status === "rejected"
              ? toSectionError(insightsResult.reason, "Goal and review insights could not load.")
              : null,
        },
      };
    },
    retry: false,
  });
};

export const useCreateExpenseMutation = (todayDate: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      spentOn: string;
      amountMinor: number;
      currencyCode?: string;
      description?: string | null;
      expenseCategoryId?: string | null;
      source?: "manual" | "quick_capture" | "template";
      recurringExpenseTemplateId?: string | null;
    }) =>
      apiRequest<ExpenseMutationResponse>("/api/finance/expenses", {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Expense logged.",
      errorMessage: "Expense log failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, todayDate),
  });
};

export const useUpdateExpenseMutation = (todayDate: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      expenseId,
      ...payload
    }: {
      expenseId: string;
      spentOn?: string;
      amountMinor?: number;
      currencyCode?: string;
      description?: string | null;
      expenseCategoryId?: string | null;
    }) =>
      apiRequest<ExpenseMutationResponse>(`/api/finance/expenses/${expenseId}`, {
        method: "PATCH",
        body: payload,
      }),
    meta: {
      successMessage: "Expense updated.",
      errorMessage: "Expense update failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, todayDate),
  });
};

export const useDeleteExpenseMutation = (todayDate: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (expenseId: string) =>
      apiRequest<DeleteExpenseMutationResponse>(`/api/finance/expenses/${expenseId}`, {
        method: "DELETE",
      }),
    meta: {
      successMessage: "Expense deleted.",
      errorMessage: "Expense deletion failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, todayDate),
  });
};

export const useUpdateAdminItemMutation = (todayDate: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      adminItemId,
      ...payload
    }: {
      adminItemId: string;
      title?: string;
      dueOn?: string;
      status?: AdminItemStatus;
      amountMinor?: number | null;
      note?: string | null;
    }) =>
      apiRequest<AdminItemMutationResponse>(`/api/admin/admin-items/${adminItemId}`, {
        method: "PATCH",
        body: payload,
      }),
    meta: {
      successMessage: "Bill updated.",
      errorMessage: "Bill update failed.",
    },
    onSuccess: () => invalidateCoreData(queryClient, todayDate),
  });
};

export const useCreateCategoryMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { name: string; color?: string | null }) =>
      apiRequest<CategoryMutationResponse>("/api/finance/categories", {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Category created.",
      errorMessage: "Category creation failed.",
    },
    onSuccess: () => invalidateFinanceCollections(queryClient),
  });
};

export const useUpdateCategoryMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      categoryId,
      ...payload
    }: {
      categoryId: string;
      name?: string;
      color?: string | null;
      archived?: boolean;
    }) =>
      apiRequest<CategoryMutationResponse>(`/api/finance/categories/${categoryId}`, {
        method: "PATCH",
        body: payload,
      }),
    meta: {
      successMessage: "Category updated.",
      errorMessage: "Category update failed.",
    },
    onSuccess: () => invalidateFinanceCollections(queryClient),
  });
};

export const useCreateRecurringExpenseMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      title: string;
      expenseCategoryId?: string | null;
      defaultAmountMinor?: number | null;
      currencyCode?: string;
      recurrenceRule?: string;
      recurrence?: RecurrenceInput;
      nextDueOn: string;
      remindDaysBefore?: number;
    }) =>
      apiRequest<RecurringExpenseMutationResponse>("/api/finance/recurring-expenses", {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Recurring expense created.",
      errorMessage: "Recurring expense creation failed.",
    },
    onSuccess: () => invalidateFinanceCollections(queryClient),
  });
};

export const useUpdateRecurringExpenseMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recurringExpenseId,
      ...payload
    }: {
      recurringExpenseId: string;
      title?: string;
      expenseCategoryId?: string | null;
      defaultAmountMinor?: number | null;
      recurrenceRule?: string;
      recurrence?: RecurrenceInput;
      nextDueOn?: string;
      remindDaysBefore?: number;
      status?: "active" | "paused" | "archived";
    }) =>
      apiRequest<RecurringExpenseMutationResponse>(
        `/api/finance/recurring-expenses/${recurringExpenseId}`,
        { method: "PATCH", body: payload },
      ),
    meta: {
      successMessage: "Recurring expense updated.",
      errorMessage: "Recurring expense update failed.",
    },
    onSuccess: () => invalidateFinanceCollections(queryClient),
  });
};

export const useUpdateFinanceMonthPlanMutation = (month: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateFinanceMonthPlanRequest) =>
      apiRequest<FinanceMonthPlanMutationResponse>("/api/finance/month-plan", {
        method: "PUT",
        query: { month },
        body: payload,
      }),
    meta: {
      successMessage: "Monthly plan updated.",
      errorMessage: "Monthly plan update failed.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance(month) });
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
  });
};

export const useUpdateFinanceGoalMutation = (month: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      goalId,
      ...payload
    }: UpdateFinanceGoalRequest & { goalId: string }) =>
      apiRequest<FinanceGoalMutationResponse>(`/api/finance/goals/${goalId}`, {
        method: "PUT",
        body: payload,
      }),
    meta: {
      successMessage: "Money goal updated.",
      errorMessage: "Money goal update failed.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance(month) });
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.goalsAll });
    },
  });
};
