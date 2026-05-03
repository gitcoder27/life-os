import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type {
  AdminItemMutationResponse,
  AdminItemRecord,
  AdminItemStatus,
  CreditCardItem,
  CreditCardMutationResponse,
  CreditCardStatus,
  DeleteExpenseResponse,
  ExpenseCategoryMutationResponse,
  ExpenseMutationResponse,
  ExpensesResponse,
  FinanceAccountItem,
  FinanceAccountMutationResponse,
  FinanceAccountType,
  FinanceBillCompletionMode,
  FinanceBillItem,
  FinanceBillMutationResponse,
  FinanceBillReconciliationStatus,
  FinanceBillsResponse,
  FinanceCategoriesResponse,
  FinanceContributionFit,
  FinanceDashboardResponse,
  FinanceGoalInsightItem,
  FinanceGoalMutationResponse,
  FinanceGoalType,
  FinanceInsightsItem,
  FinanceInsightsResponse,
  FinanceMonthPlanItem,
  FinanceMonthPlanMutationResponse,
  FinanceMonthPlanResponse,
  FinancePaceStatus,
  FinanceSummaryResponse,
  FinanceTimelineItem,
  FinanceTimelineResponse,
  FinanceTransactionItem,
  FinanceTransactionMutationResponse,
  FinanceTransactionType,
  FinanceWatchStatus,
  LoanItem,
  LoanMutationResponse,
  LoanStatus,
  RecurrenceInput,
  ReceiveRecurringIncomeResponse,
  RecurringExpenseMutationResponse,
  RecurringExpensesResponse,
  RecurringIncomeItem,
  RecurringIncomeMutationResponse,
  RecurringIncomeStatus,
  UndoRecurringIncomeReceiptResponse,
  UpdateFinanceGoalRequest,
  UpdateFinanceMonthPlanRequest,
} from "@life-os/contracts";
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

export type {
  AdminItemRecord,
  AdminItemStatus,
  CreditCardItem,
  CreditCardStatus,
  FinanceAccountItem,
  FinanceAccountType,
  FinanceBillCompletionMode,
  FinanceBillItem,
  FinanceBillReconciliationStatus,
  FinanceContributionFit,
  FinanceDashboardResponse,
  FinanceGoalInsightItem,
  FinanceGoalType,
  FinanceInsightsItem,
  FinanceInsightsResponse,
  FinanceMonthPlanItem,
  FinanceMonthPlanResponse,
  FinancePaceStatus,
  FinanceTimelineItem,
  FinanceTimelineResponse,
  FinanceTransactionItem,
  FinanceTransactionType,
  FinanceWatchStatus,
  LoanItem,
  LoanStatus,
  RecurringIncomeItem,
  RecurringIncomeStatus,
  UpdateFinanceGoalRequest,
  UpdateFinanceMonthPlanRequest,
};

type DeleteExpenseMutationResponse = DeleteExpenseResponse;
type CategoryMutationResponse = ExpenseCategoryMutationResponse;

const invalidateFinanceCollections = (queryClient: ReturnType<typeof useQueryClient>) => {
  void queryClient.invalidateQueries({ queryKey: queryKeys.financeCategories });
  void queryClient.invalidateQueries({ queryKey: queryKeys.financeRecurring });
  void queryClient.invalidateQueries({ queryKey: ["finance"] });
};

const invalidateFinanceDate = (
  queryClient: ReturnType<typeof useQueryClient>,
  date: string,
) => {
  invalidateCoreData(queryClient, date, {
    domains: ["finance", "home", "score", "notifications"],
  });
};

type FinanceDataQueryOptions = {
  enabled?: boolean;
  includeDashboard?: boolean;
  includeBills?: boolean;
  includeSummary?: boolean;
  includeExpenses?: boolean;
  includeRecurringExpenses?: boolean;
  includeCategories?: boolean;
  includeMonthPlan?: boolean;
  includeInsights?: boolean;
  includeTimeline?: boolean;
};

type FinanceDataQueryResult = {
  dashboard: FinanceDashboardResponse | null;
  bills: FinanceBillsResponse | null;
  summary: FinanceSummaryResponse | null;
  expenses: ExpensesResponse | null;
  recurringExpenses: RecurringExpensesResponse | null;
  categories: FinanceCategoriesResponse | null;
  monthPlan: FinanceMonthPlanResponse | null;
  insights: FinanceInsightsResponse | null;
  timeline: FinanceTimelineResponse | null;
  sectionErrors: {
    bills: ReturnType<typeof toSectionError> | null;
    expenses: ReturnType<typeof toSectionError> | null;
    recurringExpenses: ReturnType<typeof toSectionError> | null;
    categories: ReturnType<typeof toSectionError> | null;
    monthPlan: ReturnType<typeof toSectionError> | null;
    insights: ReturnType<typeof toSectionError> | null;
    dashboard: ReturnType<typeof toSectionError> | null;
    timeline: ReturnType<typeof toSectionError> | null;
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
  const includeDashboard = options.includeDashboard ?? true;
  const includeBills = options.includeBills ?? true;
  const includeSummary = options.includeSummary ?? true;
  const includeExpenses = options.includeExpenses ?? true;
  const includeRecurringExpenses = options.includeRecurringExpenses ?? true;
  const includeCategories = options.includeCategories ?? true;
  const includeMonthPlan = options.includeMonthPlan ?? true;
  const includeInsights = options.includeInsights ?? true;
  const includeTimeline = options.includeTimeline ?? true;
  const sectionKey = [
    includeBills ? "bills" : "no-bills",
    includeSummary ? "summary" : "no-summary",
    includeExpenses ? "expenses" : "no-expenses",
    includeRecurringExpenses ? "recurring" : "no-recurring",
    includeCategories ? "categories" : "no-categories",
    includeMonthPlan ? "month-plan" : "no-month-plan",
    includeInsights ? "insights" : "no-insights",
    includeDashboard ? "dashboard" : "no-dashboard",
    includeTimeline ? "timeline" : "no-timeline",
  ].join(":");

  return useQuery<FinanceDataQueryResult>({
    queryKey: [...queryKeys.finance(month), sectionKey],
    enabled: options.enabled,
    queryFn: async () => {
      const [
        dashboardResult,
        billsResult,
        summaryResult,
        expensesResult,
        recurringExpensesResult,
        categoriesResult,
        monthPlanResult,
        insightsResult,
        timelineResult,
      ] =
        await Promise.allSettled([
          includeDashboard
            ? apiRequest<FinanceDashboardResponse>("/api/finance/dashboard", {
              query: { month },
            })
            : Promise.resolve(null),
          includeBills
            ? apiRequest<FinanceBillsResponse>("/api/finance/bills", {
              query: { month },
            })
            : Promise.resolve(null),
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
          includeTimeline
            ? apiRequest<FinanceTimelineResponse>("/api/finance/timeline", {
              query: { month },
            })
            : Promise.resolve(null),
        ]);

      return {
        dashboard:
          includeDashboard && dashboardResult.status === "fulfilled"
            ? dashboardResult.value
            : null,
        bills:
          includeBills && billsResult.status === "fulfilled"
            ? billsResult.value
            : null,
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
        timeline:
          includeTimeline && timelineResult.status === "fulfilled"
            ? timelineResult.value
            : null,
        sectionErrors: {
          bills:
            includeBills && billsResult.status === "rejected"
              ? toSectionError(billsResult.reason, "Bills could not load.")
              : null,
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
          dashboard:
            includeDashboard && dashboardResult.status === "rejected"
              ? toSectionError(dashboardResult.reason, "Finance dashboard could not load.")
              : null,
          timeline:
            includeTimeline && timelineResult.status === "rejected"
              ? toSectionError(timelineResult.reason, "Timeline could not load.")
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
    onSuccess: () => invalidateFinanceDate(queryClient, todayDate),
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
    onSuccess: () => invalidateFinanceDate(queryClient, todayDate),
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
    onSuccess: () => invalidateFinanceDate(queryClient, todayDate),
  });
};

export const useCreateFinanceAccountMutation = (todayDate: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      name: string;
      accountType?: FinanceAccountType;
      currencyCode?: string;
      openingBalanceMinor?: number;
    }) =>
      apiRequest<FinanceAccountMutationResponse>("/api/finance/accounts", {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Account added.",
      errorMessage: "Account creation failed.",
    },
    onSuccess: () => invalidateFinanceDate(queryClient, todayDate),
  });
};

export const useUpdateFinanceAccountMutation = (todayDate: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      accountId,
      ...payload
    }: {
      accountId: string;
      name?: string;
      accountType?: FinanceAccountType;
      openingBalanceMinor?: number;
      archived?: boolean;
    }) =>
      apiRequest<FinanceAccountMutationResponse>(`/api/finance/accounts/${accountId}`, {
        method: "PATCH",
        body: payload,
      }),
    meta: {
      successMessage: "Account updated.",
      errorMessage: "Account update failed.",
    },
    onSuccess: () => invalidateFinanceDate(queryClient, todayDate),
  });
};

export const useCreateFinanceTransactionMutation = (todayDate: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      accountId: string;
      transferAccountId?: string | null;
      transactionType: FinanceTransactionType;
      amountMinor: number;
      currencyCode?: string;
      occurredOn: string;
      description?: string | null;
      expenseCategoryId?: string | null;
      billId?: string | null;
    }) =>
      apiRequest<FinanceTransactionMutationResponse>("/api/finance/transactions", {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Transaction added.",
      errorMessage: "Transaction failed.",
    },
    onSuccess: () => invalidateFinanceDate(queryClient, todayDate),
  });
};

export const useCreateRecurringIncomeMutation = (todayDate: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      accountId: string;
      title: string;
      amountMinor: number;
      currencyCode?: string;
      recurrenceRule?: string;
      nextExpectedOn: string;
      status?: RecurringIncomeStatus;
    }) =>
      apiRequest<RecurringIncomeMutationResponse>("/api/finance/recurring-income", {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Income plan added.",
      errorMessage: "Income plan failed.",
    },
    onSuccess: () => invalidateFinanceDate(queryClient, todayDate),
  });
};

export const useUpdateRecurringIncomeMutation = (todayDate: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recurringIncomeId,
      ...payload
    }: {
      recurringIncomeId: string;
      accountId?: string;
      title?: string;
      amountMinor?: number;
      currencyCode?: string;
      recurrenceRule?: string;
      nextExpectedOn?: string;
      status?: RecurringIncomeStatus;
    }) =>
      apiRequest<RecurringIncomeMutationResponse>(`/api/finance/recurring-income/${recurringIncomeId}`, {
        method: "PATCH",
        body: payload,
      }),
    meta: {
      successMessage: "Income plan updated.",
      errorMessage: "Income plan update failed.",
    },
    onSuccess: () => invalidateFinanceDate(queryClient, todayDate),
  });
};

export const useReceiveRecurringIncomeMutation = (todayDate: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recurringIncomeId,
      ...payload
    }: {
      recurringIncomeId: string;
      accountId?: string;
      amountMinor?: number;
      currencyCode?: string;
      receivedOn: string;
      description?: string | null;
    }) =>
      apiRequest<ReceiveRecurringIncomeResponse>(`/api/finance/recurring-income/${recurringIncomeId}/receive`, {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Income received.",
      errorMessage: "Income receive failed.",
    },
    onSuccess: () => invalidateFinanceDate(queryClient, todayDate),
  });
};

export const useUndoRecurringIncomeReceiptMutation = (todayDate: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recurringIncomeId,
      transactionId,
    }: {
      recurringIncomeId: string;
      transactionId?: string;
    }) =>
      apiRequest<UndoRecurringIncomeReceiptResponse>(
        `/api/finance/recurring-income/${recurringIncomeId}/undo-latest-receive`,
        {
          method: "POST",
          body: transactionId ? { transactionId } : {},
        },
      ),
    meta: {
      successMessage: "Income receipt undone.",
      errorMessage: "Income undo failed.",
    },
    onSuccess: () => invalidateFinanceDate(queryClient, todayDate),
  });
};

export const useCreateCreditCardMutation = (todayDate: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      name: string;
      issuer?: string | null;
      paymentAccountId?: string | null;
      creditLimitMinor: number;
      outstandingBalanceMinor?: number;
      statementDay?: number | null;
      paymentDueDay?: number | null;
      minimumDueMinor?: number | null;
      currencyCode?: string;
      status?: CreditCardStatus;
    }) =>
      apiRequest<CreditCardMutationResponse>("/api/finance/credit-cards", {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Card added.",
      errorMessage: "Card creation failed.",
    },
    onSuccess: () => invalidateFinanceDate(queryClient, todayDate),
  });
};

export const useUpdateCreditCardMutation = (todayDate: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      creditCardId,
      ...payload
    }: {
      creditCardId: string;
      name?: string;
      issuer?: string | null;
      paymentAccountId?: string | null;
      creditLimitMinor?: number;
      outstandingBalanceMinor?: number;
      statementDay?: number | null;
      paymentDueDay?: number | null;
      minimumDueMinor?: number | null;
      currencyCode?: string;
      status?: CreditCardStatus;
    }) =>
      apiRequest<CreditCardMutationResponse>(`/api/finance/credit-cards/${creditCardId}`, {
        method: "PATCH",
        body: payload,
      }),
    meta: {
      successMessage: "Card updated.",
      errorMessage: "Card update failed.",
    },
    onSuccess: () => invalidateFinanceDate(queryClient, todayDate),
  });
};

export const usePayCreditCardMutation = (todayDate: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      creditCardId,
      ...payload
    }: {
      creditCardId: string;
      accountId?: string | null;
      amountMinor: number;
      paidOn: string;
    }) =>
      apiRequest<CreditCardMutationResponse>(`/api/finance/credit-cards/${creditCardId}/pay`, {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Card payment logged.",
      errorMessage: "Card payment failed.",
    },
    onSuccess: () => invalidateFinanceDate(queryClient, todayDate),
  });
};

export const useCreateLoanMutation = (todayDate: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      name: string;
      lender?: string | null;
      paymentAccountId?: string | null;
      principalAmountMinor?: number | null;
      outstandingBalanceMinor: number;
      emiAmountMinor: number;
      interestRateBps?: number | null;
      dueDay?: number | null;
      startOn?: string | null;
      endOn?: string | null;
      currencyCode?: string;
      status?: LoanStatus;
    }) =>
      apiRequest<LoanMutationResponse>("/api/finance/loans", {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Loan added.",
      errorMessage: "Loan creation failed.",
    },
    onSuccess: () => invalidateFinanceDate(queryClient, todayDate),
  });
};

export const useUpdateLoanMutation = (todayDate: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      loanId,
      ...payload
    }: {
      loanId: string;
      name?: string;
      lender?: string | null;
      paymentAccountId?: string | null;
      principalAmountMinor?: number | null;
      outstandingBalanceMinor?: number;
      emiAmountMinor?: number;
      interestRateBps?: number | null;
      dueDay?: number | null;
      startOn?: string | null;
      endOn?: string | null;
      currencyCode?: string;
      status?: LoanStatus;
    }) =>
      apiRequest<LoanMutationResponse>(`/api/finance/loans/${loanId}`, {
        method: "PATCH",
        body: payload,
      }),
    meta: {
      successMessage: "Loan updated.",
      errorMessage: "Loan update failed.",
    },
    onSuccess: () => invalidateFinanceDate(queryClient, todayDate),
  });
};

export const usePayLoanMutation = (todayDate: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      loanId,
      ...payload
    }: {
      loanId: string;
      accountId?: string | null;
      amountMinor: number;
      paidOn: string;
    }) =>
      apiRequest<LoanMutationResponse>(`/api/finance/loans/${loanId}/pay`, {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "EMI logged.",
      errorMessage: "EMI payment failed.",
    },
    onSuccess: () => invalidateFinanceDate(queryClient, todayDate),
  });
};

export const useCreateBillMutation = (todayDate: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      title?: string;
      dueOn?: string;
      amountMinor?: number | null;
      expenseCategoryId?: string | null;
      note?: string | null;
    }) =>
      apiRequest<FinanceBillMutationResponse>("/api/finance/bills", {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Bill added.",
      errorMessage: "Bill creation failed.",
    },
    onSuccess: () => invalidateFinanceDate(queryClient, todayDate),
  });
};

export const usePayAndLogBillMutation = (todayDate: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      billId,
      ...payload
    }: {
      billId: string;
      paidOn: string;
      amountMinor?: number | null;
      currencyCode?: string;
      description?: string | null;
      expenseCategoryId?: string | null;
      accountId?: string | null;
    }) =>
      apiRequest<FinanceBillMutationResponse>(`/api/finance/bills/${billId}/pay-and-log`, {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Bill paid and expense logged.",
      errorMessage: "Bill payment failed.",
    },
    onSuccess: () => invalidateFinanceDate(queryClient, todayDate),
  });
};

export const useMarkBillPaidMutation = (todayDate: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      billId,
      paidOn,
    }: {
      billId: string;
      paidOn: string;
    }) =>
      apiRequest<FinanceBillMutationResponse>(`/api/finance/bills/${billId}/mark-paid`, {
        method: "POST",
        body: { paidOn },
      }),
    meta: {
      successMessage: "Bill marked paid.",
      errorMessage: "Bill update failed.",
    },
    onSuccess: () => invalidateFinanceDate(queryClient, todayDate),
  });
};

export const useLinkBillExpenseMutation = (todayDate: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      billId,
      expenseId,
    }: {
      billId: string;
      expenseId: string;
    }) =>
      apiRequest<FinanceBillMutationResponse>(`/api/finance/bills/${billId}/link-expense`, {
        method: "POST",
        body: { expenseId },
      }),
    meta: {
      successMessage: "Expense linked to bill.",
      errorMessage: "Expense link failed.",
    },
    onSuccess: () => invalidateFinanceDate(queryClient, todayDate),
  });
};

export const useRescheduleBillMutation = (todayDate: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      billId,
      dueOn,
    }: {
      billId: string;
      dueOn: string;
    }) =>
      apiRequest<FinanceBillMutationResponse>(`/api/finance/bills/${billId}/reschedule`, {
        method: "POST",
        body: { dueOn },
      }),
    meta: {
      successMessage: "Bill rescheduled.",
      errorMessage: "Bill reschedule failed.",
    },
    onSuccess: () => invalidateFinanceDate(queryClient, todayDate),
  });
};

export const useDismissBillMutation = (todayDate: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (billId: string) =>
      apiRequest<FinanceBillMutationResponse>(`/api/finance/bills/${billId}/dismiss`, {
        method: "POST",
      }),
    meta: {
      successMessage: "Bill dismissed.",
      errorMessage: "Bill dismissal failed.",
    },
    onSuccess: () => invalidateFinanceDate(queryClient, todayDate),
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.goalsAll });
    },
  });
};
