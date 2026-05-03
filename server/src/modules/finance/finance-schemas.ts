import type { IsoDateString, IsoMonthString } from "@life-os/contracts";
import {
  isoMonthStringSchema,
  recurrenceInputSchema,
} from "@life-os/contracts";
import { z } from "zod";

import { createIsoDateRangeQuerySchema, isoDateStringSchema } from "../../lib/validation/date-range.js";

const isoDateSchema = isoDateStringSchema;

export const isoMonthSchema = isoMonthStringSchema as z.ZodType<IsoMonthString>;

const expenseSourceSchema = z.enum(["manual", "quick_capture", "template"]);
const recurringExpenseStatusSchema = z.enum(["active", "paused", "archived"]);
const financeAccountTypeSchema = z.enum(["bank", "cash", "wallet", "other"]);
const financeTransactionTypeSchema = z.enum(["income", "expense", "transfer", "adjustment"]);
const recurringIncomeStatusSchema = z.enum(["active", "paused", "archived"]);
const creditCardStatusSchema = z.enum(["active", "archived"]);
const loanStatusSchema = z.enum(["active", "paid_off", "archived"]);

export const createExpenseSchema = z.object({
  expenseCategoryId: z.string().uuid().nullable().optional(),
  amountMinor: z.number().int().positive(),
  currencyCode: z.string().length(3).optional(),
  spentOn: isoDateSchema,
  description: z.string().max(4000).nullable().optional(),
  source: expenseSourceSchema.optional(),
  recurringExpenseTemplateId: z.string().uuid().nullable().optional(),
});

export const createFinanceAccountSchema = z.object({
  name: z.string().min(1).max(120),
  accountType: financeAccountTypeSchema.optional(),
  currencyCode: z.string().length(3).optional(),
  openingBalanceMinor: z.number().int().optional(),
});

export const updateFinanceAccountSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  accountType: financeAccountTypeSchema.optional(),
  openingBalanceMinor: z.number().int().optional(),
  archived: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

export const createFinanceTransactionSchema = z.object({
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

export const updateFinanceTransactionSchema = z.object({
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

export const createRecurringIncomeSchema = z.object({
  accountId: z.string().uuid(),
  title: z.string().min(1).max(200),
  amountMinor: z.number().int().positive(),
  currencyCode: z.string().length(3).optional(),
  recurrenceRule: z.string().min(1).max(100).optional(),
  nextExpectedOn: isoDateSchema,
  status: recurringIncomeStatusSchema.optional(),
});

export const updateRecurringIncomeSchema = z.object({
  accountId: z.string().uuid().optional(),
  title: z.string().min(1).max(200).optional(),
  amountMinor: z.number().int().positive().optional(),
  currencyCode: z.string().length(3).optional(),
  recurrenceRule: z.string().min(1).max(100).optional(),
  nextExpectedOn: isoDateSchema.optional(),
  status: recurringIncomeStatusSchema.optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

export const receiveRecurringIncomeSchema = z.object({
  accountId: z.string().uuid().optional(),
  amountMinor: z.number().int().positive().optional(),
  currencyCode: z.string().length(3).optional(),
  receivedOn: isoDateSchema,
  description: z.string().max(240).nullable().optional(),
});

export const undoRecurringIncomeReceiptSchema = z.object({
  transactionId: z.string().uuid().optional(),
}).optional();

export const createCreditCardSchema = z.object({
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

export const updateCreditCardSchema = z.object({
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

export const createLoanSchema = z.object({
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

export const updateLoanSchema = z.object({
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

export const payDebtSchema = z.object({
  accountId: z.string().uuid().nullable().optional(),
  amountMinor: z.number().int().positive(),
  paidOn: isoDateSchema,
});

export const createFinanceBillSchema = z.object({
  title: z.string().min(1).max(200),
  dueOn: isoDateSchema,
  amountMinor: z.number().int().positive().nullable().optional(),
  note: z.string().max(4000).nullable().optional(),
  expenseCategoryId: z.string().uuid().nullable().optional(),
  recurringExpenseTemplateId: z.string().uuid().nullable().optional(),
});

export const completeFinanceBillSchema = z.object({
  paidOn: isoDateSchema,
});

export const completeFinanceBillWithExpenseSchema = z.object({
  paidOn: isoDateSchema,
  amountMinor: z.number().int().positive().nullable().optional(),
  currencyCode: z.string().length(3).optional(),
  description: z.string().max(4000).nullable().optional(),
  expenseCategoryId: z.string().uuid().nullable().optional(),
  accountId: z.string().uuid().nullable().optional(),
});

export const rescheduleFinanceBillSchema = z.object({
  dueOn: isoDateSchema,
});

export const linkFinanceBillExpenseSchema = z.object({
  expenseId: z.string().uuid(),
});

export const updateExpenseSchema = z
  .object({
    expenseCategoryId: z.string().uuid().nullable().optional(),
    amountMinor: z.number().int().positive().optional(),
    currencyCode: z.string().length(3).optional(),
    spentOn: isoDateSchema.optional(),
    description: z.string().max(4000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

export const createRecurringExpenseSchema = z.object({
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

export const createExpenseCategorySchema = z.object({
  name: z.string().min(1).max(120),
  color: z.string().max(32).nullable().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

export const updateExpenseCategorySchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    color: z.string().max(32).nullable().optional(),
    sortOrder: z.number().int().min(0).max(1000).optional(),
    archived: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

export const updateRecurringExpenseSchema = z
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

export const expenseRangeQuerySchema = createIsoDateRangeQuerySchema({ maxDays: 366 });

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

export const updateFinanceMonthPlanSchema = z.object({
  plannedSpendMinor: z.number().int().positive().nullable().optional(),
  fixedObligationsMinor: z.number().int().nonnegative().nullable().optional(),
  flexibleSpendTargetMinor: z.number().int().nonnegative().nullable().optional(),
  plannedIncomeMinor: z.number().int().nonnegative().nullable().optional(),
  expectedLargeExpensesMinor: z.number().int().nonnegative().nullable().optional(),
  categoryWatches: z.array(financeMonthPlanWatchSchema).max(8).optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

export const updateFinanceGoalSchema = z.object({
  goalType: financeGoalTypeSchema.nullable().optional(),
  targetAmountMinor: z.number().int().positive().nullable().optional(),
  currentAmountMinor: z.number().int().nonnegative().nullable().optional(),
  monthlyContributionTargetMinor: z.number().int().nonnegative().nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

export type FinanceIsoDate = IsoDateString;
