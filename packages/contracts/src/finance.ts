import type { ApiMeta, EntityId, IsoDateString, IsoMonthString } from "./common.js";
import type { RecurrenceDefinition, RecurrenceInput } from "./recurrence.js";

export type ExpenseSource = "manual" | "quick_capture" | "template";
export type RecurringExpenseStatus = "active" | "paused" | "archived";
export type AdminItemStatus = "pending" | "done" | "rescheduled" | "dropped";
export type FinanceBillCompletionMode = "pay_and_log" | "mark_paid_only";
export type FinanceBillReconciliationStatus =
  | "due"
  | "paid_with_expense"
  | "paid_without_expense"
  | "rescheduled"
  | "dropped";
export type FinancePaceStatus = "no_plan" | "on_pace" | "slightly_heavy" | "off_track";
export type FinanceWatchStatus = "within_limit" | "near_limit" | "over_limit";
export type FinanceGoalType = "emergency_fund" | "debt_payoff" | "travel" | "large_purchase" | "other";
export type FinanceContributionFit = "on_track" | "tight" | "needs_plan";
export type FinanceAccountType = "bank" | "cash" | "wallet" | "other";
export type FinanceTransactionType = "income" | "expense" | "transfer" | "adjustment";
export type RecurringIncomeStatus = "active" | "paused" | "archived";
export type CreditCardStatus = "active" | "archived";
export type LoanStatus = "active" | "paid_off" | "archived";
export type FinanceTimelineSourceType =
  | "income_plan"
  | "income_transaction"
  | "bill"
  | "credit_card_due"
  | "loan_emi"
  | "planned_expense"
  | "goal_contribution";
export type FinanceTimelineDirection = "in" | "out" | "neutral";
export type FinanceTimelineStatus =
  | "expected"
  | "due_soon"
  | "due_today"
  | "overdue"
  | "completed"
  | "skipped"
  | "paused";
export type FinanceTimelineActionType =
  | "mark_income_received"
  | "pay_bill"
  | "pay_card_due"
  | "pay_emi"
  | "open"
  | "none";
export type FinanceTimelineGroupKey =
  | "overdue"
  | "today"
  | "next_7_days"
  | "later_this_month"
  | "completed";

export interface ExpenseItem {
  id: EntityId;
  expenseCategoryId: EntityId | null;
  amountMinor: number;
  currencyCode: string;
  spentOn: IsoDateString;
  description: string | null;
  source: ExpenseSource;
  billId: EntityId | null;
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

export interface FinanceBillItem {
  id: EntityId;
  title: string;
  dueOn: IsoDateString;
  amountMinor: number | null;
  status: AdminItemStatus;
  expenseCategoryId: EntityId | null;
  note: string | null;
  paidAt: string | null;
  linkedExpenseId: EntityId | null;
  completionMode: FinanceBillCompletionMode | null;
  reconciliationStatus: FinanceBillReconciliationStatus;
  recurringExpenseTemplateId: EntityId | null;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceSummaryResponse extends ApiMeta {
  month: IsoMonthString;
  currencyCode: string;
  totalSpentMinor: number;
  previousMonthTotalSpentMinor?: number;
  categoryTotals: FinanceCategoryTotal[];
  upcomingBills: FinanceBillItem[];
}

export interface FinanceAccountItem {
  id: EntityId;
  name: string;
  accountType: FinanceAccountType;
  currencyCode: string;
  openingBalanceMinor: number;
  currentBalanceMinor: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceTransactionItem {
  id: EntityId;
  accountId: EntityId;
  transferAccountId: EntityId | null;
  transactionType: FinanceTransactionType;
  amountMinor: number;
  currencyCode: string;
  occurredOn: IsoDateString;
  description: string | null;
  expenseCategoryId: EntityId | null;
  billId: EntityId | null;
  recurringIncomeId: EntityId | null;
  source: "ledger" | "legacy_expense";
  createdAt: string;
  updatedAt: string;
}

export interface RecurringIncomeItem {
  id: EntityId;
  accountId: EntityId;
  title: string;
  amountMinor: number;
  currencyCode: string;
  recurrenceRule: string;
  nextExpectedOn: IsoDateString;
  status: RecurringIncomeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreditCardItem {
  id: EntityId;
  paymentAccountId: EntityId | null;
  name: string;
  issuer: string | null;
  currencyCode: string;
  creditLimitMinor: number;
  outstandingBalanceMinor: number;
  statementDay: number | null;
  paymentDueDay: number | null;
  minimumDueMinor: number | null;
  utilizationPercent: number;
  status: CreditCardStatus;
  createdAt: string;
  updatedAt: string;
}

export interface LoanItem {
  id: EntityId;
  paymentAccountId: EntityId | null;
  name: string;
  lender: string | null;
  currencyCode: string;
  principalAmountMinor: number | null;
  outstandingBalanceMinor: number;
  emiAmountMinor: number;
  interestRateBps: number | null;
  dueDay: number | null;
  startOn: IsoDateString | null;
  endOn: IsoDateString | null;
  progressPercent: number;
  status: LoanStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceDashboardResponse extends ApiMeta {
  month: IsoMonthString;
  currencyCode: string;
  cashAvailableMinor: number;
  incomeReceivedMinor: number;
  plannedIncomeMinor: number | null;
  totalSpentMinor: number;
  upcomingDueMinor: number;
  debtDueMinor: number;
  debtOutstandingMinor: number;
  safeToSpendMinor: number;
  accountCount: number;
  transactionCount: number;
  upcomingBills: FinanceBillItem[];
  accounts: FinanceAccountItem[];
  recentTransactions: FinanceTransactionItem[];
  recurringIncome: RecurringIncomeItem[];
  creditCards: CreditCardItem[];
  loans: LoanItem[];
}

export interface FinanceTimelineAction {
  type: FinanceTimelineActionType;
  label: string;
}

export interface FinanceTimelineItem {
  id: EntityId | string;
  sourceType: FinanceTimelineSourceType;
  sourceId: EntityId;
  date: IsoDateString;
  title: string;
  amountMinor: number;
  currencyCode: string;
  direction: FinanceTimelineDirection;
  status: FinanceTimelineStatus;
  primaryAction: FinanceTimelineAction | null;
  accountId: EntityId | null;
  metadata: Record<string, string | number | boolean | null>;
}

export interface FinanceTimelineGroup {
  key: FinanceTimelineGroupKey;
  title: string;
  items: FinanceTimelineItem[];
}

export interface FinanceTimelineResponse extends ApiMeta {
  month: IsoMonthString;
  currencyCode: string;
  items: FinanceTimelineItem[];
  groups: FinanceTimelineGroup[];
}

export interface CreateFinanceAccountRequest {
  name: string;
  accountType?: FinanceAccountType;
  currencyCode?: string;
  openingBalanceMinor?: number;
}

export interface UpdateFinanceAccountRequest {
  name?: string;
  accountType?: FinanceAccountType;
  openingBalanceMinor?: number;
  archived?: boolean;
}

export interface FinanceAccountsResponse extends ApiMeta {
  accounts: FinanceAccountItem[];
}

export interface FinanceAccountMutationResponse extends ApiMeta {
  account: FinanceAccountItem;
}

export interface CreateFinanceTransactionRequest {
  accountId: EntityId;
  transferAccountId?: EntityId | null;
  transactionType: FinanceTransactionType;
  amountMinor: number;
  currencyCode?: string;
  occurredOn: IsoDateString;
  description?: string | null;
  expenseCategoryId?: EntityId | null;
  billId?: EntityId | null;
}

export interface UpdateFinanceTransactionRequest {
  accountId?: EntityId;
  transferAccountId?: EntityId | null;
  transactionType?: FinanceTransactionType;
  amountMinor?: number;
  currencyCode?: string;
  occurredOn?: IsoDateString;
  description?: string | null;
  expenseCategoryId?: EntityId | null;
  billId?: EntityId | null;
}

export interface FinanceTransactionsResponse extends ApiMeta {
  from: IsoDateString;
  to: IsoDateString;
  transactions: FinanceTransactionItem[];
}

export interface FinanceTransactionMutationResponse extends ApiMeta {
  transaction: FinanceTransactionItem;
}

export interface CreateRecurringIncomeRequest {
  accountId: EntityId;
  title: string;
  amountMinor: number;
  currencyCode?: string;
  recurrenceRule?: string;
  nextExpectedOn: IsoDateString;
  status?: RecurringIncomeStatus;
}

export interface UpdateRecurringIncomeRequest {
  accountId?: EntityId;
  title?: string;
  amountMinor?: number;
  currencyCode?: string;
  recurrenceRule?: string;
  nextExpectedOn?: IsoDateString;
  status?: RecurringIncomeStatus;
}

export interface RecurringIncomeResponse extends ApiMeta {
  recurringIncome: RecurringIncomeItem[];
}

export interface RecurringIncomeMutationResponse extends ApiMeta {
  recurringIncome: RecurringIncomeItem;
}

export interface ReceiveRecurringIncomeRequest {
  accountId?: EntityId;
  amountMinor?: number;
  currencyCode?: string;
  receivedOn: IsoDateString;
  description?: string | null;
}

export interface ReceiveRecurringIncomeResponse extends ApiMeta {
  recurringIncome: RecurringIncomeItem;
  transaction: FinanceTransactionItem;
}

export interface UndoRecurringIncomeReceiptRequest {
  transactionId?: EntityId;
}

export interface UndoRecurringIncomeReceiptResponse extends ApiMeta {
  recurringIncome: RecurringIncomeItem;
  transactionId: EntityId;
  undone: true;
}

export interface CreateCreditCardRequest {
  name: string;
  issuer?: string | null;
  paymentAccountId?: EntityId | null;
  creditLimitMinor: number;
  outstandingBalanceMinor?: number;
  statementDay?: number | null;
  paymentDueDay?: number | null;
  minimumDueMinor?: number | null;
  currencyCode?: string;
  status?: CreditCardStatus;
}

export interface UpdateCreditCardRequest {
  name?: string;
  issuer?: string | null;
  paymentAccountId?: EntityId | null;
  creditLimitMinor?: number;
  outstandingBalanceMinor?: number;
  statementDay?: number | null;
  paymentDueDay?: number | null;
  minimumDueMinor?: number | null;
  currencyCode?: string;
  status?: CreditCardStatus;
}

export interface CreditCardsResponse extends ApiMeta {
  creditCards: CreditCardItem[];
}

export interface CreditCardMutationResponse extends ApiMeta {
  creditCard: CreditCardItem;
}

export interface PayCreditCardRequest {
  accountId?: EntityId | null;
  amountMinor: number;
  paidOn: IsoDateString;
}

export interface CreateLoanRequest {
  name: string;
  lender?: string | null;
  paymentAccountId?: EntityId | null;
  principalAmountMinor?: number | null;
  outstandingBalanceMinor: number;
  emiAmountMinor: number;
  interestRateBps?: number | null;
  dueDay?: number | null;
  startOn?: IsoDateString | null;
  endOn?: IsoDateString | null;
  currencyCode?: string;
  status?: LoanStatus;
}

export interface UpdateLoanRequest {
  name?: string;
  lender?: string | null;
  paymentAccountId?: EntityId | null;
  principalAmountMinor?: number | null;
  outstandingBalanceMinor?: number;
  emiAmountMinor?: number;
  interestRateBps?: number | null;
  dueDay?: number | null;
  startOn?: IsoDateString | null;
  endOn?: IsoDateString | null;
  currencyCode?: string;
  status?: LoanStatus;
}

export interface LoansResponse extends ApiMeta {
  loans: LoanItem[];
}

export interface LoanMutationResponse extends ApiMeta {
  loan: LoanItem;
}

export interface PayLoanRequest {
  accountId?: EntityId | null;
  amountMinor: number;
  paidOn: IsoDateString;
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
  today: FinanceBillItem[];
  thisWeek: FinanceBillItem[];
  laterThisMonth: FinanceBillItem[];
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

export interface FinanceBillsResponse extends ApiMeta {
  month: IsoMonthString;
  bills: FinanceBillItem[];
}

export interface CreateFinanceBillRequest {
  title: string;
  dueOn: IsoDateString;
  amountMinor?: number | null;
  note?: string | null;
  expenseCategoryId?: EntityId | null;
  recurringExpenseTemplateId?: EntityId | null;
}

export interface CompleteFinanceBillWithExpenseRequest {
  paidOn: IsoDateString;
  amountMinor?: number | null;
  currencyCode?: string;
  description?: string | null;
  expenseCategoryId?: EntityId | null;
  accountId?: EntityId | null;
}

export interface CompleteFinanceBillRequest {
  paidOn: IsoDateString;
}

export interface RescheduleFinanceBillRequest {
  dueOn: IsoDateString;
}

export interface LinkFinanceBillExpenseRequest {
  expenseId: EntityId;
}

export interface FinanceBillMutationResponse extends ApiMeta {
  bill: FinanceBillItem;
  expense?: ExpenseItem | null;
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
