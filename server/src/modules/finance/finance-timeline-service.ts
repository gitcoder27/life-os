import type { FastifyPluginAsync } from "fastify";
import type {
  FinanceTimelineAction,
  FinanceTimelineGroup,
  FinanceTimelineGroupKey,
  FinanceTimelineItem,
  FinanceTimelineResponse,
  FinanceTimelineStatus,
  IsoDateString,
  IsoMonthString,
} from "@life-os/contracts";
import type {
  AdminItem,
  CreditCard,
  FinanceAccount,
  FinanceTransaction,
  Loan,
  RecurringIncomeTemplate,
} from "@prisma/client";

import { parseIsoDate } from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import { getUserLocalDate } from "../../lib/time/user-time.js";

type FinanceApp = Parameters<FastifyPluginAsync>[0];

type BillTimelineRecord = AdminItem & {
  linkedExpense?: { id: string } | null;
};

const groupOrder: FinanceTimelineGroupKey[] = [
  "overdue",
  "today",
  "next_7_days",
  "later_this_month",
  "completed",
];

const groupTitles: Record<FinanceTimelineGroupKey, string> = {
  overdue: "Overdue",
  today: "Today",
  next_7_days: "Next 7 days",
  later_this_month: "Later this month",
  completed: "Completed",
};

const sourceOrder: Record<FinanceTimelineItem["sourceType"], number> = {
  income_plan: 0,
  income_transaction: 1,
  bill: 2,
  credit_card_due: 3,
  loan_emi: 4,
  planned_expense: 5,
  goal_contribution: 6,
};

function getMonthBounds(month: IsoMonthString) {
  const [year, monthNumber] = month.split("-").map(Number);
  return {
    monthStart: new Date(Date.UTC(year, monthNumber - 1, 1)),
    nextMonthStart: new Date(Date.UTC(year, monthNumber, 1)),
  };
}

function getMonthDate(month: IsoMonthString, requestedDay: number | null | undefined): IsoDateString {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const day = Math.min(Math.max(requestedDay ?? 28, 1), lastDay);
  return `${year}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}` as IsoDateString;
}

function diffInDays(from: IsoDateString, to: IsoDateString) {
  return Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / (24 * 60 * 60 * 1000));
}

function getOpenStatus(date: IsoDateString, today: IsoDateString): FinanceTimelineStatus {
  const days = diffInDays(today, date);

  if (days < 0) return "overdue";
  if (days === 0) return "due_today";
  if (days <= 7) return "due_soon";
  return "expected";
}

function getGroupKey(item: Pick<FinanceTimelineItem, "date" | "status">, today: IsoDateString): FinanceTimelineGroupKey {
  if (item.status === "completed" || item.status === "skipped" || item.status === "paused") {
    return "completed";
  }

  const days = diffInDays(today, item.date);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "next_7_days";
  return "later_this_month";
}

function getAccountName(accountMap: Map<string, FinanceAccount>, accountId: string | null | undefined) {
  if (!accountId) return null;
  return accountMap.get(accountId)?.name ?? null;
}

function buildIncomePlanItem(
  income: RecurringIncomeTemplate,
  today: IsoDateString,
  accountMap: Map<string, FinanceAccount>,
): FinanceTimelineItem {
  const date = toIsoDateString(income.nextExpectedOn);
  const status = income.status === "PAUSED" ? "paused" : getOpenStatus(date, today);
  return {
    id: `income-plan-${income.id}`,
    sourceType: "income_plan",
    sourceId: income.id,
    date,
    title: income.title,
    amountMinor: income.amountMinor,
    currencyCode: income.currencyCode,
    direction: "in",
    status,
    primaryAction: status === "paused" ? null : { type: "mark_income_received", label: "Mark received" },
    accountId: income.accountId,
    metadata: {
      accountName: getAccountName(accountMap, income.accountId),
      recurrenceRule: income.recurrenceRule,
    },
  };
}

function buildIncomeTransactionItem(
  transaction: FinanceTransaction,
  accountMap: Map<string, FinanceAccount>,
): FinanceTimelineItem {
  return {
    id: `income-transaction-${transaction.id}`,
    sourceType: "income_transaction",
    sourceId: transaction.id,
    date: toIsoDateString(transaction.occurredOn),
    title: transaction.description ?? "Income",
    amountMinor: transaction.amountMinor,
    currencyCode: transaction.currencyCode,
    direction: "in",
    status: "completed",
    primaryAction: null,
    accountId: transaction.accountId,
    metadata: {
      accountName: getAccountName(accountMap, transaction.accountId),
      recurringIncomeId: transaction.recurringIncomeTemplateId,
    },
  };
}

function buildBillItem(
  bill: BillTimelineRecord,
  today: IsoDateString,
  currencyCode: string,
): FinanceTimelineItem {
  const date = toIsoDateString(bill.dueOn);
  const status: FinanceTimelineStatus =
    bill.status === "DONE"
      ? "completed"
      : bill.status === "DROPPED"
        ? "skipped"
        : getOpenStatus(date, today);
  const action: FinanceTimelineAction | null =
    bill.status === "PENDING" || bill.status === "RESCHEDULED"
      ? { type: "pay_bill", label: "Pay" }
      : null;

  return {
    id: `bill-${bill.id}`,
    sourceType: "bill",
    sourceId: bill.id,
    date,
    title: bill.title,
    amountMinor: bill.amountMinor ?? 0,
    currencyCode,
    direction: "out",
    status,
    primaryAction: action,
    accountId: null,
    metadata: {
      reconciliationStatus:
        bill.status === "DONE"
          ? bill.linkedExpense
            ? "paid_with_expense"
            : "paid_without_expense"
          : bill.status.toLowerCase(),
      recurringExpenseTemplateId: bill.recurringExpenseTemplateId,
    },
  };
}

function buildCreditCardItem(
  card: CreditCard,
  month: IsoMonthString,
  today: IsoDateString,
  accountMap: Map<string, FinanceAccount>,
): FinanceTimelineItem | null {
  const amountMinor = card.minimumDueMinor ?? 0;
  if (amountMinor <= 0) return null;

  const date = getMonthDate(month, card.paymentDueDay);
  return {
    id: `credit-card-due-${card.id}`,
    sourceType: "credit_card_due",
    sourceId: card.id,
    date,
    title: `${card.name} due`,
    amountMinor,
    currencyCode: card.currencyCode,
    direction: "out",
    status: getOpenStatus(date, today),
    primaryAction: { type: "pay_card_due", label: "Pay due" },
    accountId: card.paymentAccountId,
    metadata: {
      accountName: getAccountName(accountMap, card.paymentAccountId),
      outstandingBalanceMinor: card.outstandingBalanceMinor,
      issuer: card.issuer,
    },
  };
}

function buildLoanItem(
  loan: Loan,
  month: IsoMonthString,
  today: IsoDateString,
  accountMap: Map<string, FinanceAccount>,
): FinanceTimelineItem {
  const date = getMonthDate(month, loan.dueDay);
  return {
    id: `loan-emi-${loan.id}`,
    sourceType: "loan_emi",
    sourceId: loan.id,
    date,
    title: `${loan.name} EMI`,
    amountMinor: loan.emiAmountMinor,
    currencyCode: loan.currencyCode,
    direction: "out",
    status: getOpenStatus(date, today),
    primaryAction: { type: "pay_emi", label: "Pay EMI" },
    accountId: loan.paymentAccountId,
    metadata: {
      accountName: getAccountName(accountMap, loan.paymentAccountId),
      outstandingBalanceMinor: loan.outstandingBalanceMinor,
      lender: loan.lender,
    },
  };
}

function sortTimelineItems(left: FinanceTimelineItem, right: FinanceTimelineItem) {
  return (
    left.date.localeCompare(right.date)
    || sourceOrder[left.sourceType] - sourceOrder[right.sourceType]
    || left.title.localeCompare(right.title)
  );
}

function groupTimelineItems(items: FinanceTimelineItem[], today: IsoDateString): FinanceTimelineGroup[] {
  return groupOrder
    .map((key) => ({
      key,
      title: groupTitles[key],
      items: items.filter((item) => getGroupKey(item, today) === key),
    }))
    .filter((group) => group.items.length > 0);
}

export async function buildFinanceTimeline(
  app: FinanceApp,
  userId: string,
  month: IsoMonthString,
): Promise<Omit<FinanceTimelineResponse, "generatedAt">> {
  const { monthStart, nextMonthStart } = getMonthBounds(month);
  const preferences = await app.prisma.userPreference.findUnique({
    where: { userId },
    select: { currencyCode: true, timezone: true },
  });
  const currencyCode = preferences?.currencyCode ?? "USD";
  const today = getUserLocalDate(new Date(), preferences?.timezone ?? "UTC");

  const [accounts, recurringIncome, incomeTransactions, bills, creditCards, loans] = await Promise.all([
    app.prisma.financeAccount.findMany({
      where: { userId },
      orderBy: [{ archivedAt: "asc" }, { createdAt: "asc" }],
    }),
    app.prisma.recurringIncomeTemplate.findMany({
      where: {
        userId,
        status: { in: ["ACTIVE", "PAUSED"] },
        nextExpectedOn: { gte: monthStart, lt: nextMonthStart },
      },
      orderBy: [{ nextExpectedOn: "asc" }, { createdAt: "asc" }],
    }),
    app.prisma.financeTransaction.findMany({
      where: {
        userId,
        transactionType: "INCOME",
        occurredOn: { gte: monthStart, lt: nextMonthStart },
      },
      orderBy: [{ occurredOn: "asc" }, { createdAt: "asc" }],
    }),
    app.prisma.adminItem.findMany({
      where: {
        userId,
        itemType: "BILL",
        dueOn: { gte: monthStart, lt: nextMonthStart },
        status: { in: ["PENDING", "RESCHEDULED", "DONE", "DROPPED"] },
      },
      include: {
        linkedExpense: {
          select: { id: true },
        },
      },
      orderBy: [{ dueOn: "asc" }, { createdAt: "asc" }],
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
        OR: [
          { startOn: null },
          { startOn: { lt: nextMonthStart } },
        ],
        AND: [
          {
            OR: [
              { endOn: null },
              { endOn: { gte: monthStart } },
            ],
          },
        ],
      },
      orderBy: [{ dueDay: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const items = [
    ...recurringIncome.map((income) => buildIncomePlanItem(income, today, accountMap)),
    ...incomeTransactions.map((transaction) => buildIncomeTransactionItem(transaction, accountMap)),
    ...bills.map((bill) => buildBillItem(bill, today, currencyCode)),
    ...creditCards.flatMap((card) => {
      const item = buildCreditCardItem(card, month, today, accountMap);
      return item ? [item] : [];
    }),
    ...loans.map((loan) => buildLoanItem(loan, month, today, accountMap)),
  ].sort((left, right) => {
    const leftGroup = getGroupKey(left, today);
    const rightGroup = getGroupKey(right, today);
    const groupDelta = groupOrder.indexOf(leftGroup) - groupOrder.indexOf(rightGroup);
    if (groupDelta !== 0) return groupDelta;
    return sortTimelineItems(left, right);
  });

  return {
    month,
    currencyCode,
    items,
    groups: groupTimelineItems(items, today),
  };
}
