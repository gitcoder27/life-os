import type { ApiMeta, EntityId, IsoDateString, IsoMonthString } from "./common.js";

export type ExpenseSource = "manual" | "quick_capture" | "template";
export type RecurringExpenseStatus = "active" | "paused" | "archived";
export type AdminItemStatus = "pending" | "done" | "rescheduled" | "dropped";

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
}

export interface FinanceSummaryResponse extends ApiMeta {
  month: IsoMonthString;
  currencyCode: string;
  totalSpentMinor: number;
  categoryTotals: FinanceCategoryTotal[];
  upcomingBills: UpcomingBillItem[];
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

export interface RecurringExpenseItem {
  id: EntityId;
  title: string;
  expenseCategoryId: EntityId | null;
  defaultAmountMinor: number | null;
  currencyCode: string;
  recurrenceRule: string;
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
  recurrenceRule: string;
  nextDueOn: IsoDateString;
  remindDaysBefore?: number;
  status?: RecurringExpenseStatus;
}

export interface RecurringExpenseMutationResponse extends ApiMeta {
  recurringExpense: RecurringExpenseItem;
}
