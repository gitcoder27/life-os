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
  }>;
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

const invalidateFinanceCollections = (queryClient: ReturnType<typeof useQueryClient>) => {
  void queryClient.invalidateQueries({ queryKey: queryKeys.financeCategories });
  void queryClient.invalidateQueries({ queryKey: queryKeys.financeRecurring });
  void queryClient.invalidateQueries({ queryKey: ["finance"] });
};

export const useFinanceDataQuery = (date: string) => {
  const month = getMonthString(date);
  const monthStart = getMonthStartDate(date);
  const monthEnd = getMonthEndDate(date);

  return useQuery({
    queryKey: queryKeys.finance(month),
    queryFn: async () => {
      const [summaryResult, expensesResult, recurringExpensesResult, categoriesResult] =
        await Promise.allSettled([
          apiRequest<FinanceSummaryResponse>("/api/finance/summary", {
            query: { month },
          }),
          apiRequest<ExpensesResponse>("/api/finance/expenses", {
            query: { from: monthStart, to: monthEnd },
          }),
          apiRequest<RecurringExpensesResponse>("/api/finance/recurring-expenses"),
          apiRequest<FinanceCategoriesResponse>("/api/finance/categories"),
        ]);

      return {
        summary: unwrapRequiredResult(summaryResult, "Finance summary could not load."),
        expenses: expensesResult.status === "fulfilled" ? expensesResult.value : null,
        recurringExpenses:
          recurringExpensesResult.status === "fulfilled"
            ? recurringExpensesResult.value
            : null,
        categories: categoriesResult.status === "fulfilled" ? categoriesResult.value : null,
        sectionErrors: {
          expenses:
            expensesResult.status === "rejected"
              ? toSectionError(expensesResult.reason, "Expenses could not load.")
              : null,
          recurringExpenses:
            recurringExpensesResult.status === "rejected"
              ? toSectionError(recurringExpensesResult.reason, "Recurring bills could not load.")
              : null,
          categories:
            categoriesResult.status === "rejected"
              ? toSectionError(categoriesResult.reason, "Categories could not load.")
              : null,
        },
      };
    },
    retry: false,
  });
};

export const useCreateExpenseMutation = (date: string) => {
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
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
};

export const useUpdateExpenseMutation = (date: string) => {
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
    onSuccess: () => invalidateCoreData(queryClient, date),
  });
};

export const useDeleteExpenseMutation = (date: string) => {
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
    onSuccess: () => invalidateCoreData(queryClient, date),
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
      archivedAt?: string | null;
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
