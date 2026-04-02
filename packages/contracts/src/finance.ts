import type { ApiMeta, EntityId, IsoDateString, IsoMonthString } from "./common.js";
import type { RecurrenceDefinition, RecurrenceInput } from "./recurrence.js";

export type ExpenseSource = "manual" | "quick_capture" | "template";
export type RecurringExpenseStatus = "active" | "paused" | "archived";
export type AdminItemStatus = "pending" | "done" | "rescheduled" | "dropped";
export type FinancePaceStatus = "no_plan" | "on_pace" | "slightly_heavy" | "off_track";
export type FinanceWatchStatus = "within_limit" | "near_limit" | "over_limit";
export type FinanceGoalType = "emergency_fund" | "debt_payoff" | "travel" | "large_purchase" | "other";
export type FinanceContributionFit = "on_track" | "tight" | "needs_plan";

export interface ExpenseItem {
  id: EntityId;
  expenseCategoryId: EntityId | null;
  amountMinor: number;
  currencyCode: string;
  spentOn: IsoDateString;
  description: string | null;
  source: ExpenseSource;
  recurringExpenseTemplateId: EntityId | null;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceCategoryTotal {
  expenseCategoryId: EntityId | null;
  name: string;
  color: string | null;
  totalAmountMinor: number;
}

export interface UpcomingBillItem {
  id: EntityId;
  title: string;
  dueOn: IsoDateString;
  amountMinor: number | null;
  status: AdminItemStatus;
  recurringExpenseTemplateId: EntityId | null;
}

export interface FinanceSummaryResponse extends ApiMeta {
  month: IsoMonthString;
  currencyCode: string;
  totalSpentMinor: number;
  previousMonthTotalSpentMinor?: number;
  categoryTotals: FinanceCategoryTotal[];
  upcomingBills: UpcomingBillItem[];
}

export interface FinanceMonthPlanCategoryWatchItem {
  expenseCategoryId: EntityId;
  name: string;
  color: string | null;
  watchLimitMinor: number;
  actualSpentMinor: number;
  status: FinanceWatchStatus;
}

export interface FinanceBillTimeline {
  today: UpcomingBillItem[];
  thisWeek: UpcomingBillItem[];
  laterThisMonth: UpcomingBillItem[];
}

export interface FinanceMonthPlanItem {
  id: EntityId | null;
  month: IsoMonthString;
  plannedSpendMinor: number | null;
  fixedObligationsMinor: number | null;
  flexibleSpendTargetMinor: number | null;
  plannedIncomeMinor: number | null;
  expectedLargeExpensesMinor: number | null;
  categoryWatches: FinanceMonthPlanCategoryWatchItem[];
  billTimeline: FinanceBillTimeline;
  paceStatus: FinancePaceStatus;
  paceSummary: string;
  expectedSpendToDateMinor: number | null;
  remainingPlannedSpendMinor: number | null;
  remainingFlexibleSpendMinor: number | null;
}

export interface FinanceMonthPlanResponse extends ApiMeta {
  monthPlan: FinanceMonthPlanItem;
}

export interface UpdateFinanceMonthPlanRequest {
  plannedSpendMinor?: number | null;
  fixedObligationsMinor?: number | null;
  flexibleSpendTargetMinor?: number | null;
  plannedIncomeMinor?: number | null;
  expectedLargeExpensesMinor?: number | null;
  categoryWatches?: Array<{
    expenseCategoryId: EntityId;
    watchLimitMinor: number;
  }>;
}

export interface FinanceMonthPlanMutationResponse extends ApiMeta {
  monthPlan: FinanceMonthPlanItem;
}

export interface FinanceGoalInsightItem {
  goalId: EntityId;
  title: string;
  status: "active" | "paused" | "completed" | "archived";
  route: string;
  goalType: FinanceGoalType | null;
  targetDate: IsoDateString | null;
  targetAmountMinor: number | null;
  currentAmountMinor: number | null;
  progressPercent: number;
  remainingAmountMinor: number | null;
  monthlyContributionTargetMinor: number | null;
  contributionFit: FinanceContributionFit;
  contributionSummary: string;
  nextMilestoneTitle: string | null;
  nextMilestoneDate: IsoDateString | null;
}

export interface FinanceFocusCategory {
  expenseCategoryId: EntityId;
  name: string;
  color: string | null;
  monthSpentMinor: number;
  guidance: string;
  route: string;
}

export interface FinanceWeeklyReviewInsight {
  route: string;
  startDate: IsoDateString;
  endDate: IsoDateString;
  spendingTotalMinor: number;
  topSpendCategory: string | null;
  biggestWin: string | null;
  keepText: string | null;
  improveText: string | null;
  spendWatchCategoryName: string | null;
}

export interface FinanceMonthlyReviewInsight {
  route: string;
  startDate: IsoDateString;
  endDate: IsoDateString;
  monthVerdict: string | null;
  biggestWin: string | null;
  biggestLeak: string | null;
  nextMonthTheme: string | null;
  topSpendingCategories: Array<{
    category: string;
    amountMinor: number;
  }>;
}

export interface FinanceInsightsItem {
  month: IsoMonthString;
  moneyGoals: FinanceGoalInsightItem[];
  currentFocus: FinanceFocusCategory | null;
  weeklyReview: FinanceWeeklyReviewInsight | null;
  monthlyReview: FinanceMonthlyReviewInsight | null;
}

export interface FinanceInsightsResponse extends ApiMeta {
  insights: FinanceInsightsItem;
}

export interface UpdateFinanceGoalRequest {
  goalType?: FinanceGoalType | null;
  targetAmountMinor?: number | null;
  currentAmountMinor?: number | null;
  monthlyContributionTargetMinor?: number | null;
}

export interface FinanceGoalMutationResponse extends ApiMeta {
  goalId: EntityId;
}

export interface CreateExpenseRequest {
  expenseCategoryId?: EntityId | null;
  amountMinor: number;
  currencyCode?: string;
  spentOn: IsoDateString;
  description?: string | null;
  source?: ExpenseSource;
  recurringExpenseTemplateId?: EntityId | null;
}

export interface UpdateExpenseRequest {
  expenseCategoryId?: EntityId | null;
  amountMinor?: number;
  currencyCode?: string;
  spentOn?: IsoDateString;
  description?: string | null;
}

export interface ExpenseMutationResponse extends ApiMeta {
  expense: ExpenseItem;
}

export interface ExpensesResponse extends ApiMeta {
  from: IsoDateString;
  to: IsoDateString;
  expenses: ExpenseItem[];
}

export interface DeleteExpenseResponse extends ApiMeta {
  deleted: true;
  expenseId: EntityId;
}

export interface ExpenseCategoryItem {
  id: EntityId;
  name: string;
  color: string | null;
  sortOrder: number;
  createdAt: string;
  archivedAt: string | null;
}

export interface FinanceCategoriesResponse extends ApiMeta {
  categories: ExpenseCategoryItem[];
}

export interface CreateExpenseCategoryRequest {
  name: string;
  color?: string | null;
  sortOrder?: number;
}

export interface UpdateExpenseCategoryRequest {
  name?: string;
  color?: string | null;
  sortOrder?: number;
  archived?: boolean;
}

export interface ExpenseCategoryMutationResponse extends ApiMeta {
  category: ExpenseCategoryItem;
}

export interface RecurringExpenseItem {
  id: EntityId;
  title: string;
  expenseCategoryId: EntityId | null;
  defaultAmountMinor: number | null;
  currencyCode: string;
  recurrenceRule: string;
  recurrence: RecurrenceDefinition | null;
  nextDueOn: IsoDateString;
  remindDaysBefore: number;
  status: RecurringExpenseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringExpensesResponse extends ApiMeta {
  recurringExpenses: RecurringExpenseItem[];
}

export interface CreateRecurringExpenseRequest {
  title: string;
  expenseCategoryId?: EntityId | null;
  defaultAmountMinor?: number | null;
  currencyCode?: string;
  recurrenceRule?: string;
  recurrence?: RecurrenceInput;
  nextDueOn: IsoDateString;
  remindDaysBefore?: number;
  status?: RecurringExpenseStatus;
}

export interface UpdateRecurringExpenseRequest {
  title?: string;
  expenseCategoryId?: EntityId | null;
  defaultAmountMinor?: number | null;
  currencyCode?: string;
  recurrenceRule?: string;
  recurrence?: RecurrenceInput;
  nextDueOn?: IsoDateString;
  remindDaysBefore?: number;
  status?: RecurringExpenseStatus;
}

export interface RecurringExpenseMutationResponse extends ApiMeta {
  recurringExpense: RecurringExpenseItem;
}

export type AdminItemType = "bill" | "admin";

export interface AdminItemRecord {
  id: EntityId;
  title: string;
  itemType: AdminItemType;
  dueOn: IsoDateString;
  status: AdminItemStatus;
  relatedTaskId: EntityId | null;
  recurringExpenseTemplateId: EntityId | null;
  amountMinor: number | null;
  note: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminItemsResponse extends ApiMeta {
  adminItems: AdminItemRecord[];
}

export interface UpdateAdminItemRequest {
  title?: string;
  dueOn?: IsoDateString;
  status?: AdminItemStatus;
  relatedTaskId?: EntityId | null;
  amountMinor?: number | null;
  note?: string | null;
}

export interface AdminItemMutationResponse extends ApiMeta {
  adminItem: AdminItemRecord;
}
