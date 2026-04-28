import type { FastifyPluginAsync } from "fastify";
import type {
  CompleteFinanceBillRequest,
  CompleteFinanceBillWithExpenseRequest,
  CreateCreditCardRequest,
  CreateFinanceAccountRequest,
  CreateFinanceBillRequest,
  CreateFinanceTransactionRequest,
  CreateLoanRequest,
  CreateExpenseCategoryRequest,
  CreateRecurringIncomeRequest,
  CreditCardItem,
  CreditCardMutationResponse,
  CreditCardsResponse,
  DeleteExpenseResponse,
  ExpenseCategoryItem,
  ExpenseCategoryMutationResponse,
  ExpensesResponse,
  FinanceAccountItem,
  FinanceAccountMutationResponse,
  FinanceAccountsResponse,
  FinanceBillItem as ContractFinanceBillItem,
  FinanceBillMutationResponse,
  FinanceBillsResponse,
  FinanceCategoriesResponse,
  FinanceDashboardResponse,
  FinanceGoalMutationResponse,
  FinanceInsightsResponse,
  FinanceMonthPlanMutationResponse,
  FinanceMonthPlanResponse,
  FinanceTimelineResponse,
  FinanceTransactionItem,
  FinanceTransactionMutationResponse,
  FinanceTransactionsResponse,
  IsoDateString,
  IsoMonthString,
  LinkFinanceBillExpenseRequest,
  LoanItem,
  LoanMutationResponse,
  LoansResponse,
  PayCreditCardRequest,
  PayLoanRequest,
  RecurrenceInput,
  ReceiveRecurringIncomeRequest,
  ReceiveRecurringIncomeResponse,
  RecurringIncomeItem,
  RecurringIncomeMutationResponse,
  RecurringIncomeResponse,
  RecurringExpenseMutationResponse,
  RescheduleFinanceBillRequest,
  UndoRecurringIncomeReceiptRequest,
  UndoRecurringIncomeReceiptResponse,
  UpdateFinanceAccountRequest,
  UpdateCreditCardRequest,
  UpdateFinanceGoalRequest,
  UpdateFinanceMonthPlanRequest,
  UpdateFinanceTransactionRequest,
  UpdateLoanRequest,
  UpdateExpenseCategoryRequest,
  UpdateRecurringIncomeRequest,
  UpdateRecurringExpenseRequest,
} from "@life-os/contracts";
import type {
  CreditCard,
  CreditCardStatus as PrismaCreditCardStatus,
  ExpenseCategory,
  Expense,
  FinanceAccount,
  FinanceAccountType as PrismaFinanceAccountType,
  FinanceGoalType as PrismaFinanceGoalType,
  FinanceTransaction,
  FinanceTransactionType as PrismaFinanceTransactionType,
  ExpenseSource as PrismaExpenseSource,
  GoalStatus as PrismaGoalStatus,
  Loan,
  LoanStatus as PrismaLoanStatus,
  RecurringIncomeStatus as PrismaRecurringIncomeStatus,
  RecurringIncomeTemplate,
  RecurringExpenseStatus as PrismaRecurringExpenseStatus,
  RecurringExpenseTemplate,
} from "@prisma/client";
import { z } from "zod";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { AppError } from "../../lib/errors/app-error.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { formatLegacyFinanceRecurrenceRule, parseLegacyFinanceRecurrenceRule } from "../../lib/recurrence/rules.js";
import { serializeRecurrenceDefinition, upsertRecurrenceRuleRecord } from "../../lib/recurrence/store.js";
import { getWeekStartIsoDate, parseIsoDate } from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import { getUserLocalDate } from "../../lib/time/user-time.js";
import { createIsoDateRangeQuerySchema, isoDateStringSchema } from "../../lib/validation/date-range.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import {
  OPEN_BILL_STATUSES,
  serializeFinanceBill,
  toPrismaBillCompletionMode,
} from "./service.js";
import { buildFinanceTimeline } from "./finance-timeline-service.js";
import { getMonthlyReviewModel, getWeeklyReviewModel } from "../reviews/service.js";

type ExpenseSource = "manual" | "quick_capture" | "template";
type RecurringExpenseStatus = "active" | "paused" | "archived";
type FinanceAccountType = "bank" | "cash" | "wallet" | "other";
type FinanceTransactionType = "income" | "expense" | "transfer" | "adjustment";
type RecurringIncomeStatus = "active" | "paused" | "archived";
type CreditCardStatus = "active" | "archived";
type LoanStatus = "active" | "paid_off" | "archived";

interface ExpenseItem {
  id: string;
  expenseCategoryId: string | null;
  amountMinor: number;
  currencyCode: string;
  spentOn: IsoDateString;
  description: string | null;
  source: ExpenseSource;
  billId: string | null;
  recurringExpenseTemplateId: string | null;
  createdAt: string;
  updatedAt: string;
}

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

interface CreateExpenseRequest {
  expenseCategoryId?: string | null;
  amountMinor: number;
  currencyCode?: string;
  spentOn: IsoDateString;
  description?: string | null;
  source?: ExpenseSource;
  recurringExpenseTemplateId?: string | null;
}

interface UpdateExpenseRequest {
  expenseCategoryId?: string | null;
  amountMinor?: number;
  currencyCode?: string;
  spentOn?: IsoDateString;
  description?: string | null;
}

interface ExpenseMutationResponse {
  generatedAt: string;
  expense: ExpenseItem;
}

interface RecurringExpenseItem {
  id: string;
  title: string;
  expenseCategoryId: string | null;
  defaultAmountMinor: number | null;
  currencyCode: string;
  recurrenceRule: string;
  recurrence: ReturnType<typeof serializeRecurrenceDefinition>;
  nextDueOn: IsoDateString;
  remindDaysBefore: number;
  status: RecurringExpenseStatus;
  createdAt: string;
  updatedAt: string;
}

interface RecurringExpensesResponse {
  generatedAt: string;
  recurringExpenses: RecurringExpenseItem[];
}

interface CreateRecurringExpenseRequest {
  title: string;
  expenseCategoryId?: string | null;
  defaultAmountMinor?: number | null;
  currencyCode?: string;
  recurrenceRule?: string;
  recurrence?: RecurrenceInput;
  nextDueOn: IsoDateString;
  remindDaysBefore?: number;
  status?: RecurringExpenseStatus;
}

const isoDateSchema = isoDateStringSchema;
const isoMonthSchema = z.string().regex(/^\d{4}-\d{2}$/) as unknown as z.ZodType<IsoMonthString>;

const expenseSourceSchema = z.enum(["manual", "quick_capture", "template"]);
const recurringExpenseStatusSchema = z.enum(["active", "paused", "archived"]);
const financeAccountTypeSchema = z.enum(["bank", "cash", "wallet", "other"]);
const financeTransactionTypeSchema = z.enum(["income", "expense", "transfer", "adjustment"]);
const recurringIncomeStatusSchema = z.enum(["active", "paused", "archived"]);
const creditCardStatusSchema = z.enum(["active", "archived"]);
const loanStatusSchema = z.enum(["active", "paid_off", "archived"]);
const recurrenceExceptionActionSchema = z.enum(["skip", "do_once", "reschedule"]);
const recurrenceRuleSchema = z.object({
  frequency: z.enum(["daily", "weekly", "monthly_nth_weekday", "interval"]),
  startsOn: isoDateSchema,
  interval: z.number().int().positive().max(365).optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  nthWeekday: z
    .object({
      ordinal: z.union([z.literal(-1), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
      dayOfWeek: z.number().int().min(0).max(6),
    })
    .optional(),
  end: z
    .object({
      type: z.enum(["never", "on_date", "after_occurrences"]),
      until: isoDateSchema.nullable().optional(),
      occurrenceCount: z.number().int().positive().optional(),
    })
    .optional(),
});
const recurrenceInputSchema = z.object({
  rule: recurrenceRuleSchema,
  exceptions: z
    .array(
      z.object({
        occurrenceDate: isoDateSchema,
        action: recurrenceExceptionActionSchema,
        targetDate: isoDateSchema.nullable().optional(),
      }),
    )
    .max(180)
    .optional(),
});

const createExpenseSchema = z.object({
  expenseCategoryId: z.string().uuid().nullable().optional(),
  amountMinor: z.number().int().positive(),
  currencyCode: z.string().length(3).optional(),
  spentOn: isoDateSchema,
  description: z.string().max(4000).nullable().optional(),
  source: expenseSourceSchema.optional(),
  recurringExpenseTemplateId: z.string().uuid().nullable().optional(),
});

const createFinanceAccountSchema = z.object({
  name: z.string().min(1).max(120),
  accountType: financeAccountTypeSchema.optional(),
  currencyCode: z.string().length(3).optional(),
  openingBalanceMinor: z.number().int().optional(),
});

const updateFinanceAccountSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  accountType: financeAccountTypeSchema.optional(),
  openingBalanceMinor: z.number().int().optional(),
  archived: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

const createFinanceTransactionSchema = z.object({
  accountId: z.string().uuid(),
  transferAccountId: z.string().uuid().nullable().optional(),
  transactionType: financeTransactionTypeSchema,
  amountMinor: z.number().int(),
  currencyCode: z.string().length(3).optional(),
  occurredOn: isoDateSchema,
  description: z.string().max(4000).nullable().optional(),
  expenseCategoryId: z.string().uuid().nullable().optional(),
  billId: z.string().uuid().nullable().optional(),
});

const updateFinanceTransactionSchema = z.object({
  accountId: z.string().uuid().optional(),
  transferAccountId: z.string().uuid().nullable().optional(),
  transactionType: financeTransactionTypeSchema.optional(),
  amountMinor: z.number().int().optional(),
  currencyCode: z.string().length(3).optional(),
  occurredOn: isoDateSchema.optional(),
  description: z.string().max(4000).nullable().optional(),
  expenseCategoryId: z.string().uuid().nullable().optional(),
  billId: z.string().uuid().nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

const createRecurringIncomeSchema = z.object({
  accountId: z.string().uuid(),
  title: z.string().min(1).max(200),
  amountMinor: z.number().int().positive(),
  currencyCode: z.string().length(3).optional(),
  recurrenceRule: z.string().min(1).max(100).optional(),
  nextExpectedOn: isoDateSchema,
  status: recurringIncomeStatusSchema.optional(),
});

const updateRecurringIncomeSchema = z.object({
  accountId: z.string().uuid().optional(),
  title: z.string().min(1).max(200).optional(),
  amountMinor: z.number().int().positive().optional(),
  currencyCode: z.string().length(3).optional(),
  recurrenceRule: z.string().min(1).max(100).optional(),
  nextExpectedOn: isoDateSchema.optional(),
  status: recurringIncomeStatusSchema.optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

const receiveRecurringIncomeSchema = z.object({
  accountId: z.string().uuid().optional(),
  amountMinor: z.number().int().positive().optional(),
  currencyCode: z.string().length(3).optional(),
  receivedOn: isoDateSchema,
  description: z.string().max(240).nullable().optional(),
});

const undoRecurringIncomeReceiptSchema = z.object({
  transactionId: z.string().uuid().optional(),
}).optional();

const createCreditCardSchema = z.object({
  name: z.string().min(1).max(120),
  issuer: z.string().max(120).nullable().optional(),
  paymentAccountId: z.string().uuid().nullable().optional(),
  creditLimitMinor: z.number().int().positive(),
  outstandingBalanceMinor: z.number().int().nonnegative().optional(),
  statementDay: z.number().int().min(1).max(31).nullable().optional(),
  paymentDueDay: z.number().int().min(1).max(31).nullable().optional(),
  minimumDueMinor: z.number().int().nonnegative().nullable().optional(),
  currencyCode: z.string().length(3).optional(),
  status: creditCardStatusSchema.optional(),
});

const updateCreditCardSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  issuer: z.string().max(120).nullable().optional(),
  paymentAccountId: z.string().uuid().nullable().optional(),
  creditLimitMinor: z.number().int().positive().optional(),
  outstandingBalanceMinor: z.number().int().nonnegative().optional(),
  statementDay: z.number().int().min(1).max(31).nullable().optional(),
  paymentDueDay: z.number().int().min(1).max(31).nullable().optional(),
  minimumDueMinor: z.number().int().nonnegative().nullable().optional(),
  currencyCode: z.string().length(3).optional(),
  status: creditCardStatusSchema.optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

const createLoanSchema = z.object({
  name: z.string().min(1).max(120),
  lender: z.string().max(120).nullable().optional(),
  paymentAccountId: z.string().uuid().nullable().optional(),
  principalAmountMinor: z.number().int().positive().nullable().optional(),
  outstandingBalanceMinor: z.number().int().nonnegative(),
  emiAmountMinor: z.number().int().positive(),
  interestRateBps: z.number().int().nonnegative().nullable().optional(),
  dueDay: z.number().int().min(1).max(31).nullable().optional(),
  startOn: isoDateSchema.nullable().optional(),
  endOn: isoDateSchema.nullable().optional(),
  currencyCode: z.string().length(3).optional(),
  status: loanStatusSchema.optional(),
});

const updateLoanSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  lender: z.string().max(120).nullable().optional(),
  paymentAccountId: z.string().uuid().nullable().optional(),
  principalAmountMinor: z.number().int().positive().nullable().optional(),
  outstandingBalanceMinor: z.number().int().nonnegative().optional(),
  emiAmountMinor: z.number().int().positive().optional(),
  interestRateBps: z.number().int().nonnegative().nullable().optional(),
  dueDay: z.number().int().min(1).max(31).nullable().optional(),
  startOn: isoDateSchema.nullable().optional(),
  endOn: isoDateSchema.nullable().optional(),
  currencyCode: z.string().length(3).optional(),
  status: loanStatusSchema.optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

const payDebtSchema = z.object({
  accountId: z.string().uuid().nullable().optional(),
  amountMinor: z.number().int().positive(),
  paidOn: isoDateSchema,
});

const createFinanceBillSchema = z.object({
  title: z.string().min(1).max(200),
  dueOn: isoDateSchema,
  amountMinor: z.number().int().positive().nullable().optional(),
  note: z.string().max(4000).nullable().optional(),
  expenseCategoryId: z.string().uuid().nullable().optional(),
  recurringExpenseTemplateId: z.string().uuid().nullable().optional(),
});

const completeFinanceBillSchema = z.object({
  paidOn: isoDateSchema,
});

const completeFinanceBillWithExpenseSchema = z.object({
  paidOn: isoDateSchema,
  amountMinor: z.number().int().positive().nullable().optional(),
  currencyCode: z.string().length(3).optional(),
  description: z.string().max(4000).nullable().optional(),
  expenseCategoryId: z.string().uuid().nullable().optional(),
  accountId: z.string().uuid().nullable().optional(),
});

const rescheduleFinanceBillSchema = z.object({
  dueOn: isoDateSchema,
});

const linkFinanceBillExpenseSchema = z.object({
  expenseId: z.string().uuid(),
});

const updateExpenseSchema = z
  .object({
    expenseCategoryId: z.string().uuid().nullable().optional(),
    amountMinor: z.number().int().positive().optional(),
    currencyCode: z.string().length(3).optional(),
    spentOn: isoDateSchema.optional(),
    description: z.string().max(4000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

const createRecurringExpenseSchema = z.object({
  title: z.string().min(1).max(200),
  expenseCategoryId: z.string().uuid().nullable().optional(),
  defaultAmountMinor: z.number().int().positive().nullable().optional(),
  currencyCode: z.string().length(3).optional(),
  recurrenceRule: z.string().min(1).max(100).optional(),
  recurrence: recurrenceInputSchema.optional(),
  nextDueOn: isoDateSchema,
  remindDaysBefore: z.number().int().min(0).max(365).optional(),
  status: recurringExpenseStatusSchema.optional(),
}).refine((value) => Boolean(value.recurrence || value.recurrenceRule), "Provide recurrence details");

const createExpenseCategorySchema = z.object({
  name: z.string().min(1).max(120),
  color: z.string().max(32).nullable().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

const updateExpenseCategorySchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    color: z.string().max(32).nullable().optional(),
    sortOrder: z.number().int().min(0).max(1000).optional(),
    archived: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

const updateRecurringExpenseSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    expenseCategoryId: z.string().uuid().nullable().optional(),
    defaultAmountMinor: z.number().int().positive().nullable().optional(),
    currencyCode: z.string().length(3).optional(),
    recurrenceRule: z.string().min(1).max(100).optional(),
    recurrence: recurrenceInputSchema.optional(),
    nextDueOn: isoDateSchema.optional(),
    remindDaysBefore: z.number().int().min(0).max(365).optional(),
    status: recurringExpenseStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

const expenseRangeQuerySchema = createIsoDateRangeQuerySchema({ maxDays: 366 });

const financeMonthPlanWatchSchema = z.object({
  expenseCategoryId: z.string().uuid(),
  watchLimitMinor: z.number().int().positive(),
});

const financeGoalTypeSchema = z.enum([
  "emergency_fund",
  "debt_payoff",
  "travel",
  "large_purchase",
  "other",
]);

const updateFinanceMonthPlanSchema = z.object({
  plannedSpendMinor: z.number().int().positive().nullable().optional(),
  fixedObligationsMinor: z.number().int().nonnegative().nullable().optional(),
  flexibleSpendTargetMinor: z.number().int().nonnegative().nullable().optional(),
  plannedIncomeMinor: z.number().int().nonnegative().nullable().optional(),
  expectedLargeExpensesMinor: z.number().int().nonnegative().nullable().optional(),
  categoryWatches: z.array(financeMonthPlanWatchSchema).max(8).optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

const updateFinanceGoalSchema = z.object({
  goalType: financeGoalTypeSchema.nullable().optional(),
  targetAmountMinor: z.number().int().positive().nullable().optional(),
  currentAmountMinor: z.number().int().nonnegative().nullable().optional(),
  monthlyContributionTargetMinor: z.number().int().nonnegative().nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

function getMonthBounds(month: IsoMonthString) {
  const [year, monthNumber] = month.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, monthNumber - 1, 1));
  const nextMonthStart = new Date(Date.UTC(year, monthNumber, 1));

  return {
    monthStart,
    nextMonthStart,
  };
}

function getIsoMonthString(date: Date): IsoMonthString {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}` as IsoMonthString;
}

function addMonthsClamped(date: Date, months: number) {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return next;
}

function addRecurringIncomePeriod(date: Date, recurrenceRule: string) {
  const normalizedRule = recurrenceRule.trim().toLowerCase();
  const next = new Date(date);

  if (normalizedRule.includes("week")) {
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }

  if (normalizedRule.includes("year")) {
    return addMonthsClamped(date, 12);
  }

  return addMonthsClamped(date, 1);
}

function getNextRecurringIncomeDate(
  income: Pick<RecurringIncomeTemplate, "nextExpectedOn" | "recurrenceRule">,
  receivedOn: Date,
) {
  let nextExpectedOn = addRecurringIncomePeriod(income.nextExpectedOn, income.recurrenceRule);

  while (nextExpectedOn <= receivedOn) {
    nextExpectedOn = addRecurringIncomePeriod(nextExpectedOn, income.recurrenceRule);
  }

  return nextExpectedOn;
}

function diffInDays(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function formatPlanCurrency(amountMinor: number, currencyCode: string) {
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

function toPrismaExpenseSource(source: ExpenseSource): PrismaExpenseSource {
  switch (source) {
    case "manual":
      return "MANUAL";
    case "quick_capture":
      return "QUICK_CAPTURE";
    case "template":
      return "TEMPLATE";
  }

  throw new Error(`Unsupported expense source: ${source satisfies never}`);
}

function fromPrismaExpenseSource(source: PrismaExpenseSource): ExpenseSource {
  switch (source) {
    case "MANUAL":
      return "manual";
    case "QUICK_CAPTURE":
      return "quick_capture";
    case "TEMPLATE":
      return "template";
  }

  throw new Error(`Unsupported expense source: ${source satisfies never}`);
}

function toPrismaRecurringExpenseStatus(
  status: RecurringExpenseStatus,
): PrismaRecurringExpenseStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "paused":
      return "PAUSED";
    case "archived":
      return "ARCHIVED";
  }

  throw new Error(`Unsupported recurring expense status: ${status satisfies never}`);
}

function fromPrismaRecurringExpenseStatus(
  status: PrismaRecurringExpenseStatus,
): RecurringExpenseStatus {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "PAUSED":
      return "paused";
    case "ARCHIVED":
      return "archived";
  }

  throw new Error(`Unsupported recurring expense status: ${status satisfies never}`);
}

function toPrismaFinanceAccountType(type: FinanceAccountType): PrismaFinanceAccountType {
  switch (type) {
    case "bank":
      return "BANK";
    case "cash":
      return "CASH";
    case "wallet":
      return "WALLET";
    case "other":
      return "OTHER";
  }

  throw new Error(`Unsupported finance account type: ${type satisfies never}`);
}

function fromPrismaFinanceAccountType(type: PrismaFinanceAccountType): FinanceAccountType {
  switch (type) {
    case "BANK":
      return "bank";
    case "CASH":
      return "cash";
    case "WALLET":
      return "wallet";
    case "OTHER":
      return "other";
  }

  throw new Error(`Unsupported finance account type: ${type satisfies never}`);
}

function toPrismaFinanceTransactionType(type: FinanceTransactionType): PrismaFinanceTransactionType {
  switch (type) {
    case "income":
      return "INCOME";
    case "expense":
      return "EXPENSE";
    case "transfer":
      return "TRANSFER";
    case "adjustment":
      return "ADJUSTMENT";
  }

  throw new Error(`Unsupported finance transaction type: ${type satisfies never}`);
}

function fromPrismaFinanceTransactionType(type: PrismaFinanceTransactionType): FinanceTransactionType {
  switch (type) {
    case "INCOME":
      return "income";
    case "EXPENSE":
      return "expense";
    case "TRANSFER":
      return "transfer";
    case "ADJUSTMENT":
      return "adjustment";
  }

  throw new Error(`Unsupported finance transaction type: ${type satisfies never}`);
}

function toPrismaRecurringIncomeStatus(status: RecurringIncomeStatus): PrismaRecurringIncomeStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "paused":
      return "PAUSED";
    case "archived":
      return "ARCHIVED";
  }

  throw new Error(`Unsupported recurring income status: ${status satisfies never}`);
}

function fromPrismaRecurringIncomeStatus(status: PrismaRecurringIncomeStatus): RecurringIncomeStatus {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "PAUSED":
      return "paused";
    case "ARCHIVED":
      return "archived";
  }

  throw new Error(`Unsupported recurring income status: ${status satisfies never}`);
}

function toPrismaCreditCardStatus(status: CreditCardStatus): PrismaCreditCardStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "archived":
      return "ARCHIVED";
  }

  throw new Error(`Unsupported credit card status: ${status satisfies never}`);
}

function fromPrismaCreditCardStatus(status: PrismaCreditCardStatus): CreditCardStatus {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "ARCHIVED":
      return "archived";
  }

  throw new Error(`Unsupported credit card status: ${status satisfies never}`);
}

function toPrismaLoanStatus(status: LoanStatus): PrismaLoanStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "paid_off":
      return "PAID_OFF";
    case "archived":
      return "ARCHIVED";
  }

  throw new Error(`Unsupported loan status: ${status satisfies never}`);
}

function fromPrismaLoanStatus(status: PrismaLoanStatus): LoanStatus {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "PAID_OFF":
      return "paid_off";
    case "ARCHIVED":
      return "archived";
  }

  throw new Error(`Unsupported loan status: ${status satisfies never}`);
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

function serializeExpense(expense: Expense): ExpenseItem {
  return {
    id: expense.id,
    expenseCategoryId: expense.expenseCategoryId,
    amountMinor: expense.amountMinor,
    currencyCode: expense.currencyCode,
    spentOn: toIsoDateString(expense.spentOn),
    description: expense.description,
    source: fromPrismaExpenseSource(expense.source),
    billId: expense.billId,
    recurringExpenseTemplateId: expense.recurringExpenseTemplateId,
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
  };
}

function serializeExpenseCategory(category: ExpenseCategory): ExpenseCategoryItem {
  return {
    id: category.id,
    name: category.name,
    color: category.color,
    sortOrder: category.sortOrder,
    createdAt: category.createdAt.toISOString(),
    archivedAt: category.archivedAt?.toISOString() ?? null,
  };
}

function getFinanceTransactionBalanceDelta(transaction: Pick<FinanceTransaction, "transactionType" | "amountMinor">) {
  switch (transaction.transactionType) {
    case "INCOME":
      return transaction.amountMinor;
    case "EXPENSE":
      return -transaction.amountMinor;
    case "ADJUSTMENT":
      return transaction.amountMinor;
    case "TRANSFER":
      return -transaction.amountMinor;
  }
}

function serializeFinanceAccount(
  account: FinanceAccount,
  currentBalanceMinor: number,
): FinanceAccountItem {
  return {
    id: account.id,
    name: account.name,
    accountType: fromPrismaFinanceAccountType(account.accountType),
    currencyCode: account.currencyCode,
    openingBalanceMinor: account.openingBalanceMinor,
    currentBalanceMinor,
    archivedAt: account.archivedAt?.toISOString() ?? null,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

function serializeFinanceTransaction(
  transaction: FinanceTransaction,
): FinanceTransactionItem {
  return {
    id: transaction.id,
    accountId: transaction.accountId,
    transferAccountId: transaction.transferAccountId,
    transactionType: fromPrismaFinanceTransactionType(transaction.transactionType),
    amountMinor: transaction.amountMinor,
    currencyCode: transaction.currencyCode,
    occurredOn: toIsoDateString(transaction.occurredOn),
    description: transaction.description,
    expenseCategoryId: transaction.expenseCategoryId,
    billId: transaction.billId,
    recurringIncomeId: transaction.recurringIncomeTemplateId,
    source: "ledger",
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString(),
  };
}

function serializeRecurringIncome(income: RecurringIncomeTemplate): RecurringIncomeItem {
  return {
    id: income.id,
    accountId: income.accountId,
    title: income.title,
    amountMinor: income.amountMinor,
    currencyCode: income.currencyCode,
    recurrenceRule: income.recurrenceRule,
    nextExpectedOn: toIsoDateString(income.nextExpectedOn),
    status: fromPrismaRecurringIncomeStatus(income.status),
    createdAt: income.createdAt.toISOString(),
    updatedAt: income.updatedAt.toISOString(),
  };
}

function serializeCreditCard(card: CreditCard): CreditCardItem {
  return {
    id: card.id,
    paymentAccountId: card.paymentAccountId,
    name: card.name,
    issuer: card.issuer,
    currencyCode: card.currencyCode,
    creditLimitMinor: card.creditLimitMinor,
    outstandingBalanceMinor: card.outstandingBalanceMinor,
    statementDay: card.statementDay,
    paymentDueDay: card.paymentDueDay,
    minimumDueMinor: card.minimumDueMinor,
    utilizationPercent: card.creditLimitMinor > 0
      ? Math.min(Math.round((card.outstandingBalanceMinor / card.creditLimitMinor) * 100), 999)
      : 0,
    status: fromPrismaCreditCardStatus(card.status),
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  };
}

function serializeLoan(loan: Loan): LoanItem {
  const paidMinor =
    loan.principalAmountMinor != null
      ? Math.max(loan.principalAmountMinor - loan.outstandingBalanceMinor, 0)
      : 0;

  return {
    id: loan.id,
    paymentAccountId: loan.paymentAccountId,
    name: loan.name,
    lender: loan.lender,
    currencyCode: loan.currencyCode,
    principalAmountMinor: loan.principalAmountMinor,
    outstandingBalanceMinor: loan.outstandingBalanceMinor,
    emiAmountMinor: loan.emiAmountMinor,
    interestRateBps: loan.interestRateBps,
    dueDay: loan.dueDay,
    startOn: loan.startOn ? toIsoDateString(loan.startOn) : null,
    endOn: loan.endOn ? toIsoDateString(loan.endOn) : null,
    progressPercent:
      loan.principalAmountMinor != null && loan.principalAmountMinor > 0
        ? Math.min(Math.round((paidMinor / loan.principalAmountMinor) * 100), 100)
        : 0,
    status: fromPrismaLoanStatus(loan.status),
    createdAt: loan.createdAt.toISOString(),
    updatedAt: loan.updatedAt.toISOString(),
  };
}

function serializeRecurringExpense(
  recurringExpense: RecurringExpenseTemplate & {
    recurrenceRuleRecord?: Parameters<typeof serializeRecurrenceDefinition>[0];
  },
): RecurringExpenseItem {
  return {
    id: recurringExpense.id,
    title: recurringExpense.title,
    expenseCategoryId: recurringExpense.expenseCategoryId,
    defaultAmountMinor: recurringExpense.defaultAmountMinor,
    currencyCode: recurringExpense.currencyCode,
    recurrenceRule: recurringExpense.recurrenceRule,
    recurrence: serializeRecurrenceDefinition(recurringExpense.recurrenceRuleRecord),
    nextDueOn: toIsoDateString(recurringExpense.nextDueOn),
    remindDaysBefore: recurringExpense.remindDaysBefore,
    status: fromPrismaRecurringExpenseStatus(recurringExpense.status),
    createdAt: recurringExpense.createdAt.toISOString(),
    updatedAt: recurringExpense.updatedAt.toISOString(),
  };
}

function resolveRecurringExpenseRecurrenceInput(
  payload: { recurrence?: RecurrenceInput; recurrenceRule?: string; nextDueOn: IsoDateString },
) {
  if (payload.recurrence) {
    return {
      recurrence: payload.recurrence,
      legacyRuleText: formatLegacyFinanceRecurrenceRule(payload.recurrence.rule),
    };
  }

  const parsedRule = payload.recurrenceRule
    ? parseLegacyFinanceRecurrenceRule(payload.recurrenceRule, payload.nextDueOn)
    : null;
  if (!parsedRule) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Unsupported recurring expense rule",
    });
  }

  return {
    recurrence: {
      rule: parsedRule,
      exceptions: [],
    } satisfies RecurrenceInput,
    legacyRuleText: payload.recurrenceRule ?? formatLegacyFinanceRecurrenceRule(parsedRule),
  };
}

async function getUserCurrencyCode(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
) {
  const preferences = await app.prisma.userPreference.findUnique({
    where: {
      userId,
    },
  });

  return preferences?.currencyCode ?? "USD";
}

async function getUserFinanceContext(
  app: Parameters<FastifyPluginAsync>[0],
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

async function buildFinanceAccountItems(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
) {
  const [accounts, transactions] = await Promise.all([
    app.prisma.financeAccount.findMany({
      where: {
        userId,
      },
      orderBy: [{ archivedAt: "asc" }, { createdAt: "asc" }],
    }),
    app.prisma.financeTransaction.findMany({
      where: {
        userId,
      },
      select: {
        accountId: true,
        transferAccountId: true,
        transactionType: true,
        amountMinor: true,
      },
    }),
  ]);

  const balanceMap = new Map(accounts.map((account) => [account.id, account.openingBalanceMinor]));

  for (const transaction of transactions) {
    balanceMap.set(
      transaction.accountId,
      (balanceMap.get(transaction.accountId) ?? 0) + getFinanceTransactionBalanceDelta(transaction),
    );

    if (transaction.transactionType === "TRANSFER" && transaction.transferAccountId) {
      balanceMap.set(
        transaction.transferAccountId,
        (balanceMap.get(transaction.transferAccountId) ?? 0) + transaction.amountMinor,
      );
    }
  }

  return accounts.map((account) => serializeFinanceAccount(account, balanceMap.get(account.id) ?? account.openingBalanceMinor));
}

async function findOwnedFinanceAccount(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  accountId: string,
) {
  const account = await app.prisma.financeAccount.findFirst({
    where: {
      id: accountId,
      userId,
    },
  });

  if (!account) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Finance account not found",
    });
  }

  return account;
}

async function assertOwnedFinanceAccount(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  accountId: string | null | undefined,
) {
  if (!accountId) {
    return;
  }

  await findOwnedFinanceAccount(app, userId, accountId);
}

function validateFinanceTransactionPayload(
  payload: Pick<CreateFinanceTransactionRequest, "transactionType" | "amountMinor" | "transferAccountId">,
) {
  if (payload.transactionType === "adjustment") {
    if (payload.amountMinor === 0) {
      throw new AppError({
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Adjustment amount cannot be zero",
      });
    }
    return;
  }

  if (payload.amountMinor <= 0) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Amount must be greater than zero",
    });
  }

  if (payload.transactionType === "transfer" && !payload.transferAccountId) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Transfer account is required",
    });
  }
}

async function buildFinanceDashboard(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  month: IsoMonthString,
): Promise<Omit<FinanceDashboardResponse, "generatedAt">> {
  const { monthStart, nextMonthStart } = getMonthBounds(month);
  const currencyCode = await getUserCurrencyCode(app, userId);

  const [accounts, transactions, monthPlan, recurringIncome, creditCards, loans, legacyExpenses, upcomingBills, overdueBills] = await Promise.all([
    buildFinanceAccountItems(app, userId),
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
  const debtOutstandingMinor =
    creditCards.reduce((sum, card) => sum + card.outstandingBalanceMinor, 0)
    + loans.reduce((sum, loan) => sum + loan.outstandingBalanceMinor, 0);
  const cashAvailableMinor = accounts
    .filter((account) => !account.archivedAt)
    .reduce((sum, account) => sum + account.currentBalanceMinor, 0);
  const totalSpentMinor = ledgerSpentMinor + legacySpentMinor;

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
    safeToSpendMinor: cashAvailableMinor - upcomingDueMinor - debtDueMinor,
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

async function assertOwnedExpenseCategory(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  expenseCategoryId: string | null | undefined,
) {
  if (!expenseCategoryId) {
    return;
  }

  const category = await app.prisma.expenseCategory.findFirst({
    where: {
      id: expenseCategoryId,
      userId,
      archivedAt: null,
    },
  });

  if (!category) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Expense category not found",
    });
  }
}

async function findOwnedExpenseCategory(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  expenseCategoryId: string,
) {
  const category = await app.prisma.expenseCategory.findFirst({
    where: {
      id: expenseCategoryId,
      userId,
    },
  });

  if (!category) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Expense category not found",
    });
  }

  return category;
}

async function assertOwnedRecurringExpenseTemplate(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  recurringExpenseTemplateId: string | null | undefined,
) {
  if (!recurringExpenseTemplateId) {
    return;
  }

  const recurringExpense = await app.prisma.recurringExpenseTemplate.findFirst({
    where: {
      id: recurringExpenseTemplateId,
      userId,
    },
  });

  if (!recurringExpense) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Recurring expense not found",
    });
  }
}

async function findOwnedRecurringExpenseTemplate(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  recurringExpenseTemplateId: string,
) {
  const recurringExpense = await app.prisma.recurringExpenseTemplate.findFirst({
    where: {
      id: recurringExpenseTemplateId,
      userId,
    },
  });

  if (!recurringExpense) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Recurring expense not found",
    });
  }

  return recurringExpense;
}

async function findOwnedFinanceBill(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  billId: string,
) {
  const bill = await app.prisma.adminItem.findFirst({
    where: {
      id: billId,
      userId,
      itemType: "BILL",
    },
    include: {
      linkedExpense: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!bill) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Bill not found",
    });
  }

  return bill;
}

function getOpenBillStatusFilter() {
  return {
    in: [...OPEN_BILL_STATUSES] as Array<(typeof OPEN_BILL_STATUSES)[number]>,
  };
}

async function listFinanceBillsForMonth(
  app: Parameters<FastifyPluginAsync>[0],
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

function resolveBillPaidAt(paidOn: IsoDateString) {
  return parseIsoDate(paidOn);
}

function resolveBillExpenseAmount(
  billAmountMinor: number | null,
  requestedAmountMinor: number | null | undefined,
) {
  return requestedAmountMinor ?? billAmountMinor ?? null;
}

async function findOwnedExpense(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  expenseId: string,
) {
  const expense = await app.prisma.expense.findFirst({
    where: {
      id: expenseId,
      userId,
    },
  });

  if (!expense) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Expense not found",
    });
  }

  return expense;
}

async function buildFinanceMonthPlan(
  app: Parameters<FastifyPluginAsync>[0],
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

  app.get("/accounts", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const response: FinanceAccountsResponse = withGeneratedAt({
      accounts: await buildFinanceAccountItems(app, user.id),
    });

    return reply.send(response);
  });

  app.post("/accounts", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createFinanceAccountSchema, request.body as CreateFinanceAccountRequest);
    const currencyCode = payload.currencyCode ?? (await getUserCurrencyCode(app, user.id));

    const account = await app.prisma.financeAccount.create({
      data: {
        userId: user.id,
        name: payload.name.trim(),
        accountType: toPrismaFinanceAccountType(payload.accountType ?? "bank"),
        currencyCode,
        openingBalanceMinor: payload.openingBalanceMinor ?? 0,
      },
    });

    const response: FinanceAccountMutationResponse = withGeneratedAt({
      account: serializeFinanceAccount(account, account.openingBalanceMinor),
    });

    return reply.status(201).send(response);
  });

  app.patch("/accounts/:accountId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { accountId } = request.params as { accountId: string };
    const payload = parseOrThrow(updateFinanceAccountSchema, request.body as UpdateFinanceAccountRequest);

    await findOwnedFinanceAccount(app, user.id, accountId);

    const account = await app.prisma.financeAccount.update({
      where: {
        id: accountId,
      },
      data: {
        name: payload.name?.trim(),
        accountType: payload.accountType ? toPrismaFinanceAccountType(payload.accountType) : undefined,
        openingBalanceMinor: payload.openingBalanceMinor,
        archivedAt:
          payload.archived === undefined
            ? undefined
            : payload.archived
              ? new Date()
              : null,
      },
    });

    const accounts = await buildFinanceAccountItems(app, user.id);
    const response: FinanceAccountMutationResponse = withGeneratedAt({
      account: accounts.find((item) => item.id === account.id) ?? serializeFinanceAccount(account, account.openingBalanceMinor),
    });

    return reply.send(response);
  });

  app.get("/transactions", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(expenseRangeQuerySchema, request.query);
    const fromDate = parseIsoDate(query.from);
    const toDateExclusive = new Date(parseIsoDate(query.to).getTime() + 24 * 60 * 60 * 1000);
    const transactions = await app.prisma.financeTransaction.findMany({
      where: {
        userId: user.id,
        occurredOn: {
          gte: fromDate,
          lt: toDateExclusive,
        },
      },
      orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
    });

    const response: FinanceTransactionsResponse = withGeneratedAt({
      from: query.from,
      to: query.to,
      transactions: transactions.map(serializeFinanceTransaction),
    });

    return reply.send(response);
  });

  app.post("/transactions", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createFinanceTransactionSchema, request.body as CreateFinanceTransactionRequest);

    validateFinanceTransactionPayload(payload);
    await Promise.all([
      assertOwnedFinanceAccount(app, user.id, payload.accountId),
      assertOwnedFinanceAccount(app, user.id, payload.transferAccountId),
      assertOwnedExpenseCategory(app, user.id, payload.expenseCategoryId),
      payload.billId ? findOwnedFinanceBill(app, user.id, payload.billId) : Promise.resolve(null),
    ]);

    if (payload.transferAccountId && payload.transferAccountId === payload.accountId) {
      throw new AppError({
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Transfer accounts must be different",
      });
    }

    const transaction = await app.prisma.financeTransaction.create({
      data: {
        userId: user.id,
        accountId: payload.accountId,
        transferAccountId: payload.transactionType === "transfer" ? payload.transferAccountId ?? null : null,
        transactionType: toPrismaFinanceTransactionType(payload.transactionType),
        amountMinor: payload.amountMinor,
        currencyCode: payload.currencyCode ?? (await getUserCurrencyCode(app, user.id)),
        occurredOn: parseIsoDate(payload.occurredOn),
        description: payload.description ?? null,
        expenseCategoryId: payload.expenseCategoryId ?? null,
        billId: payload.billId ?? null,
      },
    });

    const response: FinanceTransactionMutationResponse = withGeneratedAt({
      transaction: serializeFinanceTransaction(transaction),
    });

    return reply.status(201).send(response);
  });

  app.patch("/transactions/:transactionId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { transactionId } = request.params as { transactionId: string };
    const payload = parseOrThrow(updateFinanceTransactionSchema, request.body as UpdateFinanceTransactionRequest);
    const existing = await app.prisma.financeTransaction.findFirst({
      where: {
        id: transactionId,
        userId: user.id,
      },
    });

    if (!existing) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Finance transaction not found",
      });
    }

    const nextPayload = {
      accountId: payload.accountId ?? existing.accountId,
      transferAccountId: payload.transferAccountId === undefined ? existing.transferAccountId : payload.transferAccountId,
      transactionType: payload.transactionType ?? fromPrismaFinanceTransactionType(existing.transactionType),
      amountMinor: payload.amountMinor ?? existing.amountMinor,
    };

    validateFinanceTransactionPayload(nextPayload);
    await Promise.all([
      assertOwnedFinanceAccount(app, user.id, nextPayload.accountId),
      assertOwnedFinanceAccount(app, user.id, nextPayload.transferAccountId),
      assertOwnedExpenseCategory(app, user.id, payload.expenseCategoryId),
      payload.billId ? findOwnedFinanceBill(app, user.id, payload.billId) : Promise.resolve(null),
    ]);

    if (nextPayload.transferAccountId && nextPayload.transferAccountId === nextPayload.accountId) {
      throw new AppError({
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Transfer accounts must be different",
      });
    }

    const transaction = await app.prisma.financeTransaction.update({
      where: {
        id: existing.id,
      },
      data: {
        accountId: payload.accountId,
        transferAccountId: nextPayload.transactionType === "transfer" ? nextPayload.transferAccountId : null,
        transactionType: payload.transactionType ? toPrismaFinanceTransactionType(payload.transactionType) : undefined,
        amountMinor: payload.amountMinor,
        currencyCode: payload.currencyCode,
        occurredOn: payload.occurredOn ? parseIsoDate(payload.occurredOn) : undefined,
        description: payload.description,
        expenseCategoryId: payload.expenseCategoryId,
        billId: payload.billId,
      },
    });

    const response: FinanceTransactionMutationResponse = withGeneratedAt({
      transaction: serializeFinanceTransaction(transaction),
    });

    return reply.send(response);
  });

  app.get("/recurring-income", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const recurringIncome = await app.prisma.recurringIncomeTemplate.findMany({
      where: {
        userId: user.id,
      },
      orderBy: [{ status: "asc" }, { nextExpectedOn: "asc" }],
    });

    const response: RecurringIncomeResponse = withGeneratedAt({
      recurringIncome: recurringIncome.map(serializeRecurringIncome),
    });

    return reply.send(response);
  });

  app.post("/recurring-income", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createRecurringIncomeSchema, request.body as CreateRecurringIncomeRequest);

    await assertOwnedFinanceAccount(app, user.id, payload.accountId);

    const recurringIncome = await app.prisma.recurringIncomeTemplate.create({
      data: {
        userId: user.id,
        accountId: payload.accountId,
        title: payload.title.trim(),
        amountMinor: payload.amountMinor,
        currencyCode: payload.currencyCode ?? (await getUserCurrencyCode(app, user.id)),
        recurrenceRule: payload.recurrenceRule ?? "monthly",
        nextExpectedOn: parseIsoDate(payload.nextExpectedOn),
        status: toPrismaRecurringIncomeStatus(payload.status ?? "active"),
      },
    });

    const response: RecurringIncomeMutationResponse = withGeneratedAt({
      recurringIncome: serializeRecurringIncome(recurringIncome),
    });

    return reply.status(201).send(response);
  });

  app.patch("/recurring-income/:recurringIncomeId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { recurringIncomeId } = request.params as { recurringIncomeId: string };
    const payload = parseOrThrow(updateRecurringIncomeSchema, request.body as UpdateRecurringIncomeRequest);

    const existing = await app.prisma.recurringIncomeTemplate.findFirst({
      where: {
        id: recurringIncomeId,
        userId: user.id,
      },
    });

    if (!existing) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Recurring income not found",
      });
    }

    await assertOwnedFinanceAccount(app, user.id, payload.accountId);

    const recurringIncome = await app.prisma.recurringIncomeTemplate.update({
      where: {
        id: existing.id,
      },
      data: {
        accountId: payload.accountId,
        title: payload.title?.trim(),
        amountMinor: payload.amountMinor,
        currencyCode: payload.currencyCode,
        recurrenceRule: payload.recurrenceRule,
        nextExpectedOn: payload.nextExpectedOn ? parseIsoDate(payload.nextExpectedOn) : undefined,
        status: payload.status ? toPrismaRecurringIncomeStatus(payload.status) : undefined,
      },
    });

    const response: RecurringIncomeMutationResponse = withGeneratedAt({
      recurringIncome: serializeRecurringIncome(recurringIncome),
    });

    return reply.send(response);
  });

  app.post("/recurring-income/:recurringIncomeId/receive", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { recurringIncomeId } = request.params as { recurringIncomeId: string };
    const payload = parseOrThrow(receiveRecurringIncomeSchema, request.body as ReceiveRecurringIncomeRequest);

    const existing = await app.prisma.recurringIncomeTemplate.findFirst({
      where: {
        id: recurringIncomeId,
        userId: user.id,
      },
    });

    if (!existing) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Recurring income not found",
      });
    }

    if (existing.status !== "ACTIVE") {
      throw new AppError({
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Income plan must be active to receive",
      });
    }

    const accountId = payload.accountId ?? existing.accountId;
    await assertOwnedFinanceAccount(app, user.id, accountId);

    const receivedOn = parseIsoDate(payload.receivedOn);
    const amountMinor = payload.amountMinor ?? existing.amountMinor;
    const currencyCode = payload.currencyCode ?? existing.currencyCode;
    const description = payload.description ?? existing.title;

    const result = await app.prisma.$transaction(async (tx) => {
      const transaction = await tx.financeTransaction.create({
        data: {
          userId: user.id,
          accountId,
          transactionType: "INCOME",
          amountMinor,
          currencyCode,
          occurredOn: receivedOn,
          description,
          recurringIncomeTemplateId: existing.id,
        },
      });
      const recurringIncome = await tx.recurringIncomeTemplate.update({
        where: {
          id: existing.id,
        },
        data: {
          accountId,
          amountMinor,
          currencyCode,
          nextExpectedOn: getNextRecurringIncomeDate(existing, receivedOn),
        },
      });

      return { recurringIncome, transaction };
    });

    const response: ReceiveRecurringIncomeResponse = withGeneratedAt({
      recurringIncome: serializeRecurringIncome(result.recurringIncome),
      transaction: serializeFinanceTransaction(result.transaction),
    });

    return reply.send(response);
  });

  app.post("/recurring-income/:recurringIncomeId/undo-latest-receive", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { recurringIncomeId } = request.params as { recurringIncomeId: string };
    const payload =
      parseOrThrow(undoRecurringIncomeReceiptSchema, request.body as UndoRecurringIncomeReceiptRequest | undefined) ?? {};

    const existing = await app.prisma.recurringIncomeTemplate.findFirst({
      where: {
        id: recurringIncomeId,
        userId: user.id,
      },
    });

    if (!existing) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Recurring income not found",
      });
    }

    const transaction = payload.transactionId
      ? await app.prisma.financeTransaction.findFirst({
        where: {
          id: payload.transactionId,
          userId: user.id,
          transactionType: "INCOME",
        },
      })
      : await app.prisma.financeTransaction.findFirst({
        where: {
          userId: user.id,
          transactionType: "INCOME",
          OR: [
            {
              recurringIncomeTemplateId: existing.id,
            },
            {
              recurringIncomeTemplateId: null,
              accountId: existing.accountId,
              amountMinor: existing.amountMinor,
              currencyCode: existing.currencyCode,
              description: existing.title,
            },
          ],
        },
        orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
      });

    if (!transaction) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "No received income transaction found",
      });
    }

    const recurringIncome = await app.prisma.$transaction(async (tx) => {
      await tx.financeTransaction.delete({
        where: {
          id: transaction.id,
        },
      });

      return tx.recurringIncomeTemplate.update({
        where: {
          id: existing.id,
        },
        data: {
          nextExpectedOn: transaction.occurredOn,
          accountId: transaction.accountId,
          amountMinor: transaction.amountMinor,
          currencyCode: transaction.currencyCode,
        },
      });
    });

    const response: UndoRecurringIncomeReceiptResponse = withGeneratedAt({
      recurringIncome: serializeRecurringIncome(recurringIncome),
      transactionId: transaction.id,
      undone: true,
    });

    return reply.send(response);
  });

  app.get("/credit-cards", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const creditCards = await app.prisma.creditCard.findMany({
      where: {
        userId: user.id,
      },
      orderBy: [{ status: "asc" }, { paymentDueDay: "asc" }, { createdAt: "asc" }],
    });

    const response: CreditCardsResponse = withGeneratedAt({
      creditCards: creditCards.map(serializeCreditCard),
    });

    return reply.send(response);
  });

  app.post("/credit-cards", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createCreditCardSchema, request.body as CreateCreditCardRequest);

    await assertOwnedFinanceAccount(app, user.id, payload.paymentAccountId);

    const creditCard = await app.prisma.creditCard.create({
      data: {
        userId: user.id,
        paymentAccountId: payload.paymentAccountId ?? null,
        name: payload.name.trim(),
        issuer: payload.issuer ?? null,
        currencyCode: payload.currencyCode ?? (await getUserCurrencyCode(app, user.id)),
        creditLimitMinor: payload.creditLimitMinor,
        outstandingBalanceMinor: payload.outstandingBalanceMinor ?? 0,
        statementDay: payload.statementDay ?? null,
        paymentDueDay: payload.paymentDueDay ?? null,
        minimumDueMinor: payload.minimumDueMinor ?? null,
        status: toPrismaCreditCardStatus(payload.status ?? "active"),
      },
    });

    const response: CreditCardMutationResponse = withGeneratedAt({
      creditCard: serializeCreditCard(creditCard),
    });

    return reply.status(201).send(response);
  });

  app.patch("/credit-cards/:creditCardId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { creditCardId } = request.params as { creditCardId: string };
    const payload = parseOrThrow(updateCreditCardSchema, request.body as UpdateCreditCardRequest);
    const existing = await app.prisma.creditCard.findFirst({
      where: {
        id: creditCardId,
        userId: user.id,
      },
    });

    if (!existing) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Credit card not found",
      });
    }

    await assertOwnedFinanceAccount(app, user.id, payload.paymentAccountId);

    const creditCard = await app.prisma.creditCard.update({
      where: {
        id: existing.id,
      },
      data: {
        paymentAccountId: payload.paymentAccountId,
        name: payload.name?.trim(),
        issuer: payload.issuer,
        currencyCode: payload.currencyCode,
        creditLimitMinor: payload.creditLimitMinor,
        outstandingBalanceMinor: payload.outstandingBalanceMinor,
        statementDay: payload.statementDay,
        paymentDueDay: payload.paymentDueDay,
        minimumDueMinor: payload.minimumDueMinor,
        status: payload.status ? toPrismaCreditCardStatus(payload.status) : undefined,
      },
    });

    const response: CreditCardMutationResponse = withGeneratedAt({
      creditCard: serializeCreditCard(creditCard),
    });

    return reply.send(response);
  });

  app.post("/credit-cards/:creditCardId/pay", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { creditCardId } = request.params as { creditCardId: string };
    const payload = parseOrThrow(payDebtSchema, request.body as PayCreditCardRequest);
    const existing = await app.prisma.creditCard.findFirst({
      where: {
        id: creditCardId,
        userId: user.id,
      },
    });

    if (!existing) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Credit card not found",
      });
    }

    const accountId = payload.accountId ?? existing.paymentAccountId;
    await assertOwnedFinanceAccount(app, user.id, accountId);
    if (!accountId) {
      throw new AppError({
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Payment account is required",
      });
    }

    const creditCard = await app.prisma.$transaction(async (tx) => {
      await tx.financeTransaction.create({
        data: {
          userId: user.id,
          accountId,
          transactionType: "EXPENSE",
          amountMinor: payload.amountMinor,
          currencyCode: existing.currencyCode,
          occurredOn: parseIsoDate(payload.paidOn),
          description: `${existing.name} payment`,
        },
      });

      return tx.creditCard.update({
        where: {
          id: existing.id,
        },
        data: {
          outstandingBalanceMinor: Math.max(existing.outstandingBalanceMinor - payload.amountMinor, 0),
          minimumDueMinor:
            existing.minimumDueMinor == null
              ? null
              : Math.max(existing.minimumDueMinor - payload.amountMinor, 0),
        },
      });
    });

    const response: CreditCardMutationResponse = withGeneratedAt({
      creditCard: serializeCreditCard(creditCard),
    });

    return reply.send(response);
  });

  app.get("/loans", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const loans = await app.prisma.loan.findMany({
      where: {
        userId: user.id,
      },
      orderBy: [{ status: "asc" }, { dueDay: "asc" }, { createdAt: "asc" }],
    });

    const response: LoansResponse = withGeneratedAt({
      loans: loans.map(serializeLoan),
    });

    return reply.send(response);
  });

  app.post("/loans", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createLoanSchema, request.body as CreateLoanRequest);

    await assertOwnedFinanceAccount(app, user.id, payload.paymentAccountId);

    const loan = await app.prisma.loan.create({
      data: {
        userId: user.id,
        paymentAccountId: payload.paymentAccountId ?? null,
        name: payload.name.trim(),
        lender: payload.lender ?? null,
        currencyCode: payload.currencyCode ?? (await getUserCurrencyCode(app, user.id)),
        principalAmountMinor: payload.principalAmountMinor ?? null,
        outstandingBalanceMinor: payload.outstandingBalanceMinor,
        emiAmountMinor: payload.emiAmountMinor,
        interestRateBps: payload.interestRateBps ?? null,
        dueDay: payload.dueDay ?? null,
        startOn: payload.startOn ? parseIsoDate(payload.startOn) : null,
        endOn: payload.endOn ? parseIsoDate(payload.endOn) : null,
        status: toPrismaLoanStatus(payload.status ?? "active"),
      },
    });

    const response: LoanMutationResponse = withGeneratedAt({
      loan: serializeLoan(loan),
    });

    return reply.status(201).send(response);
  });

  app.patch("/loans/:loanId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { loanId } = request.params as { loanId: string };
    const payload = parseOrThrow(updateLoanSchema, request.body as UpdateLoanRequest);
    const existing = await app.prisma.loan.findFirst({
      where: {
        id: loanId,
        userId: user.id,
      },
    });

    if (!existing) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Loan not found",
      });
    }

    await assertOwnedFinanceAccount(app, user.id, payload.paymentAccountId);

    const loan = await app.prisma.loan.update({
      where: {
        id: existing.id,
      },
      data: {
        paymentAccountId: payload.paymentAccountId,
        name: payload.name?.trim(),
        lender: payload.lender,
        currencyCode: payload.currencyCode,
        principalAmountMinor: payload.principalAmountMinor,
        outstandingBalanceMinor: payload.outstandingBalanceMinor,
        emiAmountMinor: payload.emiAmountMinor,
        interestRateBps: payload.interestRateBps,
        dueDay: payload.dueDay,
        startOn: payload.startOn ? parseIsoDate(payload.startOn) : payload.startOn === null ? null : undefined,
        endOn: payload.endOn ? parseIsoDate(payload.endOn) : payload.endOn === null ? null : undefined,
        status: payload.status ? toPrismaLoanStatus(payload.status) : undefined,
      },
    });

    const response: LoanMutationResponse = withGeneratedAt({
      loan: serializeLoan(loan),
    });

    return reply.send(response);
  });

  app.post("/loans/:loanId/pay", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { loanId } = request.params as { loanId: string };
    const payload = parseOrThrow(payDebtSchema, request.body as PayLoanRequest);
    const existing = await app.prisma.loan.findFirst({
      where: {
        id: loanId,
        userId: user.id,
      },
    });

    if (!existing) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Loan not found",
      });
    }

    const accountId = payload.accountId ?? existing.paymentAccountId;
    await assertOwnedFinanceAccount(app, user.id, accountId);
    if (!accountId) {
      throw new AppError({
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Payment account is required",
      });
    }

    const loan = await app.prisma.$transaction(async (tx) => {
      await tx.financeTransaction.create({
        data: {
          userId: user.id,
          accountId,
          transactionType: "EXPENSE",
          amountMinor: payload.amountMinor,
          currencyCode: existing.currencyCode,
          occurredOn: parseIsoDate(payload.paidOn),
          description: `${existing.name} EMI`,
        },
      });

      const nextOutstandingMinor = Math.max(existing.outstandingBalanceMinor - payload.amountMinor, 0);
      return tx.loan.update({
        where: {
          id: existing.id,
        },
        data: {
          outstandingBalanceMinor: nextOutstandingMinor,
          status: nextOutstandingMinor === 0 ? "PAID_OFF" : existing.status,
        },
      });
    });

    const response: LoanMutationResponse = withGeneratedAt({
      loan: serializeLoan(loan),
    });

    return reply.send(response);
  });

  app.get("/month-plan", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(
      z.object({
        month: isoMonthSchema,
      }),
      request.query,
    );

    const response: FinanceMonthPlanResponse = withGeneratedAt({
      monthPlan: await buildFinanceMonthPlan(app, user.id, query.month),
    });

    return reply.send(response);
  });

  app.put("/month-plan", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(
      z.object({
        month: isoMonthSchema,
      }),
      request.query,
    );
    const payload = parseOrThrow(updateFinanceMonthPlanSchema, request.body as UpdateFinanceMonthPlanRequest);
    const { monthStart } = getMonthBounds(query.month);

    for (const watch of payload.categoryWatches ?? []) {
      await assertOwnedExpenseCategory(app, user.id, watch.expenseCategoryId);
    }

    await app.prisma.$transaction(async (tx) => {
      const monthPlan = await tx.financeMonthPlan.upsert({
        where: {
          userId_monthStart: {
            userId: user.id,
            monthStart,
          },
        },
        update: {
          plannedSpendMinor: payload.plannedSpendMinor,
          fixedObligationsMinor: payload.fixedObligationsMinor,
          flexibleSpendTargetMinor: payload.flexibleSpendTargetMinor,
          plannedIncomeMinor: payload.plannedIncomeMinor,
          expectedLargeExpensesMinor: payload.expectedLargeExpensesMinor,
        },
        create: {
          userId: user.id,
          monthStart,
          plannedSpendMinor: payload.plannedSpendMinor ?? null,
          fixedObligationsMinor: payload.fixedObligationsMinor ?? null,
          flexibleSpendTargetMinor: payload.flexibleSpendTargetMinor ?? null,
          plannedIncomeMinor: payload.plannedIncomeMinor ?? null,
          expectedLargeExpensesMinor: payload.expectedLargeExpensesMinor ?? null,
        },
      });

      if (payload.categoryWatches) {
        await tx.financeMonthPlanCategoryWatch.deleteMany({
          where: {
            financeMonthPlanId: monthPlan.id,
          },
        });

        if (payload.categoryWatches.length > 0) {
          await tx.financeMonthPlanCategoryWatch.createMany({
            data: payload.categoryWatches.map((watch) => ({
              financeMonthPlanId: monthPlan.id,
              expenseCategoryId: watch.expenseCategoryId,
              watchLimitMinor: watch.watchLimitMinor,
            })),
          });
        }
      }
    });

    const response: FinanceMonthPlanMutationResponse = withGeneratedAt({
      monthPlan: await buildFinanceMonthPlan(app, user.id, query.month),
    });

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

  app.get("/categories", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const categories = await app.prisma.expenseCategory.findMany({
      where: {
        userId: user.id,
        archivedAt: null,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    const response: FinanceCategoriesResponse = withGeneratedAt({
      categories: categories.map(serializeExpenseCategory),
    });

    return reply.send(response);
  });

  app.post("/categories", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(
      createExpenseCategorySchema,
      request.body as CreateExpenseCategoryRequest,
    );
    const category = await app.prisma.expenseCategory.create({
      data: {
        userId: user.id,
        name: payload.name,
        color: payload.color ?? null,
        sortOrder: payload.sortOrder ?? 0,
      },
    });

    const response: ExpenseCategoryMutationResponse = withGeneratedAt({
      category: serializeExpenseCategory(category),
    });

    return reply.status(201).send(response);
  });

  app.patch("/categories/:categoryId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { categoryId } = request.params as { categoryId: string };
    const payload = parseOrThrow(
      updateExpenseCategorySchema,
      request.body as UpdateExpenseCategoryRequest,
    );

    await findOwnedExpenseCategory(app, user.id, categoryId);

    const category = await app.prisma.expenseCategory.update({
      where: {
        id: categoryId,
      },
      data: {
        name: payload.name,
        color: payload.color,
        sortOrder: payload.sortOrder,
        archivedAt:
          payload.archived === undefined
            ? undefined
            : payload.archived
              ? new Date()
              : null,
      },
    });

    const response: ExpenseCategoryMutationResponse = withGeneratedAt({
      category: serializeExpenseCategory(category),
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
    const currencyCode = await getUserCurrencyCode(app, user.id);

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

  app.get("/bills", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(
      z.object({
        month: isoMonthSchema,
      }),
      request.query,
    );
    const { timezone } = await getUserFinanceContext(app, user.id);
    const currentMonth = getIsoMonthString(parseIsoDate(getUserLocalDate(new Date(), timezone)));
    const bills = await listFinanceBillsForMonth(app, user.id, query.month, {
      includeOverdueOpenBills: query.month === currentMonth,
    });

    const response: FinanceBillsResponse = withGeneratedAt({
      month: query.month,
      bills: bills.map(serializeFinanceBill),
    });

    return reply.send(response);
  });

  app.post("/bills", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(
      createFinanceBillSchema,
      request.body as CreateFinanceBillRequest,
    );

    const recurringExpenseTemplate = payload.recurringExpenseTemplateId
      ? await findOwnedRecurringExpenseTemplate(app, user.id, payload.recurringExpenseTemplateId)
      : null;
    const expenseCategoryId = payload.expenseCategoryId ?? recurringExpenseTemplate?.expenseCategoryId ?? null;

    await assertOwnedExpenseCategory(app, user.id, expenseCategoryId);

    const bill = await app.prisma.adminItem.create({
      data: {
        userId: user.id,
        title: payload.title.trim(),
        itemType: "BILL",
        dueOn: parseIsoDate(payload.dueOn),
        status: "PENDING",
        recurringExpenseTemplateId: payload.recurringExpenseTemplateId ?? null,
        expenseCategoryId,
        amountMinor: payload.amountMinor ?? recurringExpenseTemplate?.defaultAmountMinor ?? null,
        note: payload.note ?? null,
      },
      include: {
        linkedExpense: {
          select: {
            id: true,
          },
        },
      },
    });

    const response: FinanceBillMutationResponse = withGeneratedAt({
      bill: serializeFinanceBill(bill),
      expense: null,
    });

    return reply.status(201).send(response);
  });

  app.post("/bills/:billId/pay-and-log", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { billId } = request.params as { billId: string };
    const payload = parseOrThrow(
      completeFinanceBillWithExpenseSchema,
      request.body as CompleteFinanceBillWithExpenseRequest,
    );

    const existingBill = await findOwnedFinanceBill(app, user.id, billId);
    const expenseCategoryId = payload.expenseCategoryId ?? existingBill.expenseCategoryId ?? null;

    await Promise.all([
      assertOwnedExpenseCategory(app, user.id, expenseCategoryId),
      assertOwnedFinanceAccount(app, user.id, payload.accountId),
    ]);

    const amountMinor = resolveBillExpenseAmount(existingBill.amountMinor, payload.amountMinor);
    if (!amountMinor) {
      throw new AppError({
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Amount is required to log payment for this bill",
      });
    }

    const currencyCode = payload.currencyCode ?? (await getUserCurrencyCode(app, user.id));
    const paidAt = resolveBillPaidAt(payload.paidOn);

    const result = await app.prisma.$transaction(async (tx) => {
      const bill = await tx.adminItem.findFirst({
        where: {
          id: billId,
          userId: user.id,
          itemType: "BILL",
        },
        include: {
          linkedExpense: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!bill) {
        throw new AppError({
          statusCode: 404,
          code: "NOT_FOUND",
          message: "Bill not found",
        });
      }

      if (bill.status === "DROPPED") {
        throw new AppError({
          statusCode: 409,
          code: "CONFLICT",
          message: "Dropped bills cannot be paid",
        });
      }

      if (bill.status === "DONE") {
        if (bill.linkedExpense && bill.completionMode === "PAY_AND_LOG") {
          const expense = await tx.expense.findUnique({
            where: {
              billId: bill.id,
            },
          });

          return {
            bill,
            expense,
          };
        }

        if (!bill.linkedExpense && bill.completionMode === "MARK_PAID_ONLY") {
          const expense = await tx.expense.create({
            data: {
              userId: user.id,
              expenseCategoryId,
              billId: bill.id,
              amountMinor,
              currencyCode,
              spentOn: paidAt,
              description: payload.description ?? bill.title,
              source: bill.recurringExpenseTemplateId ? "TEMPLATE" : "MANUAL",
              recurringExpenseTemplateId: bill.recurringExpenseTemplateId ?? null,
            },
          });
          if (payload.accountId) {
            await tx.financeTransaction.create({
              data: {
                userId: user.id,
                accountId: payload.accountId,
                transactionType: "EXPENSE",
                amountMinor,
                currencyCode,
                occurredOn: paidAt,
                description: payload.description ?? bill.title,
                expenseCategoryId,
                billId: bill.id,
              },
            });
          }

          const updatedBill = await tx.adminItem.update({
            where: {
              id: bill.id,
            },
            data: {
              completedAt: paidAt,
              amountMinor: bill.amountMinor ?? amountMinor,
              expenseCategoryId,
            },
            include: {
              linkedExpense: {
                select: {
                  id: true,
                },
              },
            },
          });

          return {
            bill: updatedBill,
            expense,
          };
        }

        throw new AppError({
          statusCode: 409,
          code: "CONFLICT",
          message: "Bill has already been completed",
        });
      }

      const expense = await tx.expense.create({
        data: {
          userId: user.id,
          expenseCategoryId,
          billId: bill.id,
          amountMinor,
          currencyCode,
          spentOn: paidAt,
          description: payload.description ?? bill.title,
          source: bill.recurringExpenseTemplateId ? "TEMPLATE" : "MANUAL",
          recurringExpenseTemplateId: bill.recurringExpenseTemplateId ?? null,
        },
      });
      if (payload.accountId) {
        await tx.financeTransaction.create({
          data: {
            userId: user.id,
            accountId: payload.accountId,
            transactionType: "EXPENSE",
            amountMinor,
            currencyCode,
            occurredOn: paidAt,
            description: payload.description ?? bill.title,
            expenseCategoryId,
            billId: bill.id,
          },
        });
      }

      const updatedBill = await tx.adminItem.update({
        where: {
          id: bill.id,
        },
        data: {
          status: "DONE",
          completedAt: paidAt,
          completionMode: toPrismaBillCompletionMode("pay_and_log"),
          amountMinor: bill.amountMinor ?? amountMinor,
          expenseCategoryId,
        },
        include: {
          linkedExpense: {
            select: {
              id: true,
            },
          },
        },
      });

      return {
        bill: updatedBill,
        expense,
      };
    });

    const response: FinanceBillMutationResponse = withGeneratedAt({
      bill: serializeFinanceBill(result.bill),
      expense: result.expense ? serializeExpense(result.expense) : null,
    });

    return reply.send(response);
  });

  app.post("/bills/:billId/link-expense", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { billId } = request.params as { billId: string };
    const payload = parseOrThrow(
      linkFinanceBillExpenseSchema,
      request.body as LinkFinanceBillExpenseRequest,
    );

    const result = await app.prisma.$transaction(async (tx) => {
      const [bill, expense] = await Promise.all([
        tx.adminItem.findFirst({
          where: {
            id: billId,
            userId: user.id,
            itemType: "BILL",
          },
          include: {
            linkedExpense: {
              select: {
                id: true,
              },
            },
          },
        }),
        tx.expense.findFirst({
          where: {
            id: payload.expenseId,
            userId: user.id,
          },
        }),
      ]);

      if (!bill) {
        throw new AppError({
          statusCode: 404,
          code: "NOT_FOUND",
          message: "Bill not found",
        });
      }

      if (!expense) {
        throw new AppError({
          statusCode: 404,
          code: "NOT_FOUND",
          message: "Expense not found",
        });
      }

      if (bill.status !== "DONE") {
        throw new AppError({
          statusCode: 409,
          code: "CONFLICT",
          message: "Only paid bills can link an expense",
        });
      }

      if (bill.linkedExpense?.id === expense.id) {
        return {
          bill,
          expense,
        };
      }

      if (bill.linkedExpense) {
        throw new AppError({
          statusCode: 409,
          code: "CONFLICT",
          message: "Bill already has a linked expense",
        });
      }

      if (expense.billId && expense.billId !== bill.id) {
        throw new AppError({
          statusCode: 409,
          code: "CONFLICT",
          message: "Expense is already linked to another bill",
        });
      }

      const updatedExpense = await tx.expense.update({
        where: {
          id: expense.id,
        },
        data: {
          billId: bill.id,
          recurringExpenseTemplateId: expense.recurringExpenseTemplateId ?? bill.recurringExpenseTemplateId ?? null,
        },
      });

      const updatedBill = await tx.adminItem.update({
        where: {
          id: bill.id,
        },
        data: {
          expenseCategoryId: bill.expenseCategoryId ?? updatedExpense.expenseCategoryId,
          amountMinor: bill.amountMinor ?? updatedExpense.amountMinor,
        },
        include: {
          linkedExpense: {
            select: {
              id: true,
            },
          },
        },
      });

      return {
        bill: updatedBill,
        expense: updatedExpense,
      };
    });

    const response: FinanceBillMutationResponse = withGeneratedAt({
      bill: serializeFinanceBill(result.bill),
      expense: serializeExpense(result.expense),
    });

    return reply.send(response);
  });

  app.post("/bills/:billId/mark-paid", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { billId } = request.params as { billId: string };
    const payload = parseOrThrow(
      completeFinanceBillSchema,
      request.body as CompleteFinanceBillRequest,
    );

    await findOwnedFinanceBill(app, user.id, billId);

    const bill = await app.prisma.$transaction(async (tx) => {
      const currentBill = await tx.adminItem.findFirst({
        where: {
          id: billId,
          userId: user.id,
          itemType: "BILL",
        },
        include: {
          linkedExpense: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!currentBill) {
        throw new AppError({
          statusCode: 404,
          code: "NOT_FOUND",
          message: "Bill not found",
        });
      }

      if (currentBill.status === "DROPPED") {
        throw new AppError({
          statusCode: 409,
          code: "CONFLICT",
          message: "Dropped bills cannot be marked paid",
        });
      }

      if (currentBill.status === "DONE") {
        if (!currentBill.linkedExpense && currentBill.completionMode === "MARK_PAID_ONLY") {
          return currentBill;
        }

        throw new AppError({
          statusCode: 409,
          code: "CONFLICT",
          message: "Bill has already been completed",
        });
      }

      return tx.adminItem.update({
        where: {
          id: currentBill.id,
        },
        data: {
          status: "DONE",
          completedAt: resolveBillPaidAt(payload.paidOn),
          completionMode: toPrismaBillCompletionMode("mark_paid_only"),
        },
        include: {
          linkedExpense: {
            select: {
              id: true,
            },
          },
        },
      });
    });

    const response: FinanceBillMutationResponse = withGeneratedAt({
      bill: serializeFinanceBill(bill),
      expense: null,
    });

    return reply.send(response);
  });

  app.post("/bills/:billId/reschedule", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { billId } = request.params as { billId: string };
    const payload = parseOrThrow(
      rescheduleFinanceBillSchema,
      request.body as RescheduleFinanceBillRequest,
    );

    const currentBill = await findOwnedFinanceBill(app, user.id, billId);

    if (currentBill.status === "DONE" || currentBill.status === "DROPPED") {
      throw new AppError({
        statusCode: 409,
        code: "CONFLICT",
        message: "Completed or dismissed bills cannot be rescheduled",
      });
    }

    const nextDueOn = parseIsoDate(payload.dueOn);
    const bill = await app.prisma.adminItem.update({
      where: {
        id: currentBill.id,
      },
      data: {
        dueOn: nextDueOn,
        status: "RESCHEDULED",
        completedAt: null,
        completionMode: null,
      },
      include: {
        linkedExpense: {
          select: {
            id: true,
          },
        },
      },
    });

    const response: FinanceBillMutationResponse = withGeneratedAt({
      bill: serializeFinanceBill(bill),
      expense: null,
    });

    return reply.send(response);
  });

  app.post("/bills/:billId/dismiss", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { billId } = request.params as { billId: string };
    const currentBill = await findOwnedFinanceBill(app, user.id, billId);

    if (currentBill.status === "DONE") {
      throw new AppError({
        statusCode: 409,
        code: "CONFLICT",
        message: "Paid bills cannot be dismissed",
      });
    }

    if (currentBill.status === "DROPPED") {
      const response: FinanceBillMutationResponse = withGeneratedAt({
        bill: serializeFinanceBill(currentBill),
        expense: null,
      });

      return reply.send(response);
    }

    const bill = await app.prisma.adminItem.update({
      where: {
        id: currentBill.id,
      },
      data: {
        status: "DROPPED",
        completedAt: null,
        completionMode: null,
      },
      include: {
        linkedExpense: {
          select: {
            id: true,
          },
        },
      },
    });

    const response: FinanceBillMutationResponse = withGeneratedAt({
      bill: serializeFinanceBill(bill),
      expense: null,
    });

    return reply.send(response);
  });

  app.post("/expenses", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createExpenseSchema, request.body as CreateExpenseRequest);

    await Promise.all([
      assertOwnedExpenseCategory(app, user.id, payload.expenseCategoryId),
      assertOwnedRecurringExpenseTemplate(app, user.id, payload.recurringExpenseTemplateId),
    ]);

    const expense = await app.prisma.expense.create({
      data: {
        userId: user.id,
        expenseCategoryId: payload.expenseCategoryId ?? null,
        amountMinor: payload.amountMinor,
        currencyCode: payload.currencyCode ?? (await getUserCurrencyCode(app, user.id)),
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

    await findOwnedExpense(app, user.id, expenseId);
    await assertOwnedExpenseCategory(app, user.id, payload.expenseCategoryId);

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

    await findOwnedExpense(app, user.id, expenseId);
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

  app.get("/recurring-expenses", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const recurringExpenses = await app.prisma.recurringExpenseTemplate.findMany({
      where: {
        userId: user.id,
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
      orderBy: [
        { status: "asc" },
        { nextDueOn: "asc" },
        { createdAt: "asc" },
      ],
    });

    const response: RecurringExpensesResponse = withGeneratedAt({
      recurringExpenses: recurringExpenses.map(serializeRecurringExpense),
    });

    return reply.send(response);
  });

  app.post("/recurring-expenses", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(
      createRecurringExpenseSchema,
      request.body as CreateRecurringExpenseRequest,
    );
    const recurrence = resolveRecurringExpenseRecurrenceInput(payload);

    await assertOwnedExpenseCategory(app, user.id, payload.expenseCategoryId);

    const recurringExpense = await app.prisma.$transaction(async (tx) => {
      const createdRecurringExpense = await tx.recurringExpenseTemplate.create({
        data: {
          userId: user.id,
          title: payload.title,
          expenseCategoryId: payload.expenseCategoryId ?? null,
          defaultAmountMinor: payload.defaultAmountMinor ?? null,
          currencyCode: payload.currencyCode ?? (await getUserCurrencyCode(app, user.id)),
          recurrenceRule: recurrence.legacyRuleText,
          nextDueOn: parseIsoDate(payload.nextDueOn),
          remindDaysBefore: payload.remindDaysBefore ?? 0,
          status: toPrismaRecurringExpenseStatus(payload.status ?? "active"),
        },
      });

      const recurrenceRecord = await upsertRecurrenceRuleRecord(tx, {
        ownerType: "RECURRING_EXPENSE",
        ownerId: createdRecurringExpense.id,
        recurrence: recurrence.recurrence,
        legacyRuleText: recurrence.legacyRuleText,
      });

      await tx.recurringExpenseTemplate.update({
        where: {
          id: createdRecurringExpense.id,
        },
        data: {
          recurrenceRuleId: recurrenceRecord.id,
        },
      });

      return tx.recurringExpenseTemplate.findUniqueOrThrow({
        where: {
          id: createdRecurringExpense.id,
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
      });
    });

    const response: RecurringExpenseMutationResponse = withGeneratedAt({
      recurringExpense: serializeRecurringExpense(recurringExpense),
    });

    return reply.status(201).send(response);
  });

  app.patch("/recurring-expenses/:recurringExpenseId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { recurringExpenseId } = request.params as { recurringExpenseId: string };
    const payload = parseOrThrow(
      updateRecurringExpenseSchema,
      request.body as UpdateRecurringExpenseRequest,
    );

    const existingRecurringExpense = await findOwnedRecurringExpenseTemplate(app, user.id, recurringExpenseId);
    await assertOwnedExpenseCategory(app, user.id, payload.expenseCategoryId);

    const recurringExpense = await app.prisma.$transaction(async (tx) => {
      const recurrence =
        payload.recurrence || payload.recurrenceRule || payload.nextDueOn
          ? resolveRecurringExpenseRecurrenceInput({
              recurrence: payload.recurrence,
              recurrenceRule: payload.recurrenceRule,
              nextDueOn: payload.nextDueOn ?? toIsoDateString(existingRecurringExpense.nextDueOn),
            })
          : null;

      await tx.recurringExpenseTemplate.update({
        where: {
          id: recurringExpenseId,
        },
        data: {
          title: payload.title,
          expenseCategoryId: payload.expenseCategoryId,
          defaultAmountMinor: payload.defaultAmountMinor,
          currencyCode: payload.currencyCode,
          recurrenceRule: recurrence?.legacyRuleText ?? payload.recurrenceRule,
          nextDueOn: payload.nextDueOn ? parseIsoDate(payload.nextDueOn) : undefined,
          remindDaysBefore: payload.remindDaysBefore,
          status: payload.status ? toPrismaRecurringExpenseStatus(payload.status) : undefined,
        },
      });

      if (recurrence) {
        const recurrenceRecord = await upsertRecurrenceRuleRecord(tx, {
          ownerType: "RECURRING_EXPENSE",
          ownerId: recurringExpenseId,
          recurrence: recurrence.recurrence,
          legacyRuleText: recurrence.legacyRuleText,
        });

        await tx.recurringExpenseTemplate.update({
          where: {
            id: recurringExpenseId,
          },
          data: {
            recurrenceRuleId: recurrenceRecord.id,
          },
        });
      }

      return tx.recurringExpenseTemplate.findUniqueOrThrow({
        where: {
          id: recurringExpenseId,
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
      });
    });

    const response: RecurringExpenseMutationResponse = withGeneratedAt({
      recurringExpense: serializeRecurringExpense(recurringExpense),
    });

    return reply.send(response);
  });
};
