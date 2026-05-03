import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";

import { registerFinanceRoutes } from "../../../src/modules/finance/routes.js";
import { createMockPrisma } from "../../utils/mock-prisma.js";

function parseBody<T>(body: string) {
  return JSON.parse(body) as T;
}

const USER_ID = "00000000-0000-4000-8000-000000000001";
const BILL_ID = "00000000-0000-4000-8000-000000000010";
const EXPENSE_ID = "00000000-0000-4000-8000-000000000020";
const ACCOUNT_ID = "00000000-0000-4000-8000-000000000040";
const RECURRING_INCOME_ID = "00000000-0000-4000-8000-000000000070";

describe("finance bill reconciliation routes", () => {
  let app: ReturnType<typeof Fastify> | undefined;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    app = Fastify({ logger: false });
    app.decorate("prisma", prisma as any);
    app.decorateRequest("auth", null);
    app.addHook("onRequest", async (request) => {
      request.auth = {
        sessionToken: "session-token",
        sessionId: "session-id",
        userId: USER_ID,
        user: {
          id: USER_ID,
          email: "owner@example.com",
          displayName: "Owner",
        },
      };
    });

    prisma.userPreference.findUnique.mockResolvedValue({
      currencyCode: "USD",
      timezone: "UTC",
      weekStartsOn: 1,
    });

    await app.register(registerFinanceRoutes, { prefix: "/api/finance" });
    await app.ready();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }

    vi.clearAllMocks();
  });

  it("links an existing standalone expense to a paid bill", async () => {
    prisma.adminItem.findFirst.mockResolvedValueOnce({
      id: BILL_ID,
      userId: USER_ID,
      title: "Internet",
      itemType: "BILL",
      dueOn: new Date("2026-04-09T00:00:00.000Z"),
      status: "DONE",
      relatedTaskId: null,
      recurringExpenseTemplateId: null,
      expenseCategoryId: null,
      amountMinor: null,
      note: null,
      completedAt: new Date("2026-04-09T00:00:00.000Z"),
      completionMode: "MARK_PAID_ONLY",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      updatedAt: new Date("2026-04-09T00:00:00.000Z"),
      linkedExpense: null,
    });
    prisma.expense.findFirst.mockResolvedValueOnce({
      id: EXPENSE_ID,
      userId: USER_ID,
      expenseCategoryId: "00000000-0000-4000-8000-000000000030",
      billId: null,
      amountMinor: 6500,
      currencyCode: "USD",
      spentOn: new Date("2026-04-09T00:00:00.000Z"),
      description: "Internet payment",
      source: "MANUAL",
      recurringExpenseTemplateId: null,
      createdAt: new Date("2026-04-09T00:00:00.000Z"),
      updatedAt: new Date("2026-04-09T00:00:00.000Z"),
    });
    prisma.expense.update.mockResolvedValueOnce({
      id: EXPENSE_ID,
      userId: USER_ID,
      expenseCategoryId: "00000000-0000-4000-8000-000000000030",
      billId: BILL_ID,
      amountMinor: 6500,
      currencyCode: "USD",
      spentOn: new Date("2026-04-09T00:00:00.000Z"),
      description: "Internet payment",
      source: "MANUAL",
      recurringExpenseTemplateId: null,
      createdAt: new Date("2026-04-09T00:00:00.000Z"),
      updatedAt: new Date("2026-04-09T00:00:00.000Z"),
    });
    prisma.adminItem.update.mockResolvedValueOnce({
      id: BILL_ID,
      userId: USER_ID,
      title: "Internet",
      itemType: "BILL",
      dueOn: new Date("2026-04-09T00:00:00.000Z"),
      status: "DONE",
      relatedTaskId: null,
      recurringExpenseTemplateId: null,
      expenseCategoryId: "00000000-0000-4000-8000-000000000030",
      amountMinor: 6500,
      note: null,
      completedAt: new Date("2026-04-09T00:00:00.000Z"),
      completionMode: "MARK_PAID_ONLY",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      updatedAt: new Date("2026-04-09T00:00:00.000Z"),
      linkedExpense: { id: EXPENSE_ID },
    });

    const response = await app!.inject({
      method: "POST",
      url: `/api/finance/bills/${BILL_ID}/link-expense`,
      payload: {
        expenseId: EXPENSE_ID,
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = parseBody<{ bill: { linkedExpenseId: string | null; reconciliationStatus: string } }>(response.body);
    expect(payload.bill.linkedExpenseId).toBe(EXPENSE_ID);
    expect(payload.bill.reconciliationStatus).toBe("paid_with_expense");
  });

  it("allows logging a linked expense after mark-paid-only", async () => {
    const currentBill = {
      id: BILL_ID,
      userId: USER_ID,
      title: "Internet",
      itemType: "BILL",
      dueOn: new Date("2026-04-09T00:00:00.000Z"),
      status: "DONE",
      relatedTaskId: null,
      recurringExpenseTemplateId: null,
      expenseCategoryId: null,
      amountMinor: 6500,
      note: null,
      completedAt: new Date("2026-04-09T00:00:00.000Z"),
      completionMode: "MARK_PAID_ONLY",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      updatedAt: new Date("2026-04-09T00:00:00.000Z"),
      linkedExpense: null,
    };

    prisma.adminItem.findFirst
      .mockResolvedValueOnce(currentBill)
      .mockResolvedValueOnce(currentBill);
    prisma.expense.create.mockResolvedValueOnce({
      id: EXPENSE_ID,
      userId: USER_ID,
      expenseCategoryId: null,
      billId: BILL_ID,
      amountMinor: 6500,
      currencyCode: "USD",
      spentOn: new Date("2026-04-09T00:00:00.000Z"),
      description: "Internet",
      source: "MANUAL",
      recurringExpenseTemplateId: null,
      createdAt: new Date("2026-04-09T00:00:00.000Z"),
      updatedAt: new Date("2026-04-09T00:00:00.000Z"),
    });
    prisma.adminItem.update.mockResolvedValueOnce({
      ...currentBill,
      linkedExpense: { id: EXPENSE_ID },
      updatedAt: new Date("2026-04-10T00:00:00.000Z"),
    });

    const response = await app!.inject({
      method: "POST",
      url: `/api/finance/bills/${BILL_ID}/pay-and-log`,
      payload: {
        paidOn: "2026-04-09",
        amountMinor: 6500,
        description: "Internet",
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = parseBody<{ bill: { linkedExpenseId: string | null; reconciliationStatus: string } }>(response.body);
    expect(payload.bill.linkedExpenseId).toBe(EXPENSE_ID);
    expect(payload.bill.reconciliationStatus).toBe("paid_with_expense");
  });

  it("does not double-count a bill expense that also has a ledger transaction", async () => {
    const now = new Date("2026-04-09T00:00:00.000Z");
    const account = {
      id: "00000000-0000-4000-8000-000000000040",
      userId: USER_ID,
      name: "Checking",
      accountType: "BANK",
      currencyCode: "USD",
      openingBalanceMinor: 100000,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const ledgerTransaction = {
      id: "00000000-0000-4000-8000-000000000050",
      userId: USER_ID,
      accountId: account.id,
      transactionType: "EXPENSE",
      amountMinor: 6500,
      currencyCode: "USD",
      occurredOn: now,
      description: "Internet",
      expenseCategoryId: null,
      billId: BILL_ID,
      transferAccountId: null,
      createdAt: now,
      updatedAt: now,
    };
    const linkedExpense = {
      id: EXPENSE_ID,
      userId: USER_ID,
      expenseCategoryId: null,
      billId: BILL_ID,
      amountMinor: 6500,
      currencyCode: "USD",
      spentOn: now,
      description: "Internet",
      source: "MANUAL",
      recurringExpenseTemplateId: null,
      createdAt: now,
      updatedAt: now,
    };
    const standaloneExpense = {
      ...linkedExpense,
      id: "00000000-0000-4000-8000-000000000060",
      billId: null,
      amountMinor: 1200,
      description: "Coffee",
    };

    prisma.financeAccount.findMany.mockResolvedValueOnce([account]);
    prisma.financeTransaction.findMany
      .mockResolvedValueOnce([
        {
          accountId: account.id,
          transferAccountId: null,
          transactionType: "EXPENSE",
          amountMinor: 6500,
        },
      ])
      .mockResolvedValueOnce([ledgerTransaction]);
    prisma.financeMonthPlan.findUnique.mockResolvedValueOnce(null);
    prisma.recurringIncomeTemplate.findMany.mockResolvedValueOnce([]);
    prisma.creditCard.findMany.mockResolvedValueOnce([]);
    prisma.loan.findMany.mockResolvedValueOnce([]);
    prisma.expense.findMany.mockResolvedValueOnce([linkedExpense, standaloneExpense]);
    prisma.adminItem.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prisma.goal.findMany.mockResolvedValueOnce([]);

    const response = await app!.inject({
      method: "GET",
      url: "/api/finance/dashboard?month=2026-04",
    });

    expect(response.statusCode).toBe(200);
    const payload = parseBody<{
      totalSpentMinor: number;
      transactionCount: number;
      recentTransactions: Array<{ source: string; billId: string | null; amountMinor: number }>;
    }>(response.body);

    expect(payload.totalSpentMinor).toBe(7700);
    expect(payload.transactionCount).toBe(2);
    expect(payload.recentTransactions).toHaveLength(2);
    expect(payload.recentTransactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "ledger", billId: BILL_ID, amountMinor: 6500 }),
        expect.objectContaining({ source: "legacy_expense", billId: null, amountMinor: 1200 }),
      ]),
    );
  });

  it("subtracts planned expenses and goal commitments from safe-to-spend", async () => {
    const now = new Date("2026-04-09T00:00:00.000Z");
    const account = {
      id: ACCOUNT_ID,
      userId: USER_ID,
      name: "Checking",
      accountType: "BANK",
      currencyCode: "USD",
      openingBalanceMinor: 200000,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const incomeTransaction = {
      id: "00000000-0000-4000-8000-000000000050",
      userId: USER_ID,
      accountId: account.id,
      transferAccountId: null,
      transactionType: "INCOME",
      amountMinor: 50000,
      currencyCode: "USD",
      occurredOn: now,
      description: "Salary",
      expenseCategoryId: null,
      billId: null,
      recurringIncomeTemplateId: null,
      createdAt: now,
      updatedAt: now,
    };
    const bill = {
      id: BILL_ID,
      userId: USER_ID,
      title: "Rent",
      itemType: "BILL",
      dueOn: new Date("2026-04-20T00:00:00.000Z"),
      status: "PENDING",
      relatedTaskId: null,
      recurringExpenseTemplateId: null,
      expenseCategoryId: null,
      amountMinor: 40000,
      note: null,
      completedAt: null,
      completionMode: null,
      createdAt: now,
      updatedAt: now,
      linkedExpense: null,
    };

    prisma.financeAccount.findMany.mockResolvedValueOnce([account]);
    prisma.financeTransaction.findMany
      .mockResolvedValueOnce([
        {
          accountId: account.id,
          transferAccountId: null,
          transactionType: "INCOME",
          amountMinor: 50000,
        },
      ])
      .mockResolvedValueOnce([incomeTransaction]);
    prisma.financeMonthPlan.findUnique.mockResolvedValueOnce({
      id: "00000000-0000-4000-8000-0000000000c0",
      userId: USER_ID,
      monthStart: new Date("2026-04-01T00:00:00.000Z"),
      plannedSpendMinor: null,
      fixedObligationsMinor: null,
      flexibleSpendTargetMinor: null,
      plannedIncomeMinor: null,
      expectedLargeExpensesMinor: 15000,
      createdAt: now,
      updatedAt: now,
    });
    prisma.recurringIncomeTemplate.findMany.mockResolvedValueOnce([]);
    prisma.creditCard.findMany.mockResolvedValueOnce([
      {
        id: "00000000-0000-4000-8000-0000000000a0",
        userId: USER_ID,
        paymentAccountId: ACCOUNT_ID,
        name: "Axis Ace",
        issuer: "Axis",
        currencyCode: "USD",
        creditLimitMinor: 300000,
        outstandingBalanceMinor: 90000,
        statementDay: null,
        paymentDueDay: 29,
        minimumDueMinor: 9000,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      },
    ]);
    prisma.loan.findMany.mockResolvedValueOnce([
      {
        id: "00000000-0000-4000-8000-0000000000b0",
        userId: USER_ID,
        paymentAccountId: ACCOUNT_ID,
        name: "Car loan",
        lender: "HDFC",
        currencyCode: "USD",
        principalAmountMinor: 600000,
        outstandingBalanceMinor: 420000,
        emiAmountMinor: 12000,
        interestRateBps: null,
        dueDay: 30,
        startOn: null,
        endOn: null,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      },
    ]);
    prisma.expense.findMany.mockResolvedValueOnce([]);
    prisma.adminItem.findMany.mockResolvedValueOnce([bill]).mockResolvedValueOnce([]);
    prisma.goal.findMany.mockResolvedValueOnce([
      {
        id: "00000000-0000-4000-8000-0000000000d0",
        financeGoal: {
          monthlyContributionTargetMinor: 20000,
        },
      },
    ]);

    const response = await app!.inject({
      method: "GET",
      url: "/api/finance/dashboard?month=2026-04",
    });

    expect(response.statusCode).toBe(200);
    const payload = parseBody<{
      safeToSpendMinor: number;
      safeToSpendBreakdown: {
        totalDeductionsMinor: number;
        plannedExpensesMinor: number;
        goalCommitmentsMinor: number;
        lines: Array<{ key: string; amountMinor: number; role: string; sourceCount: number | null }>;
      };
    }>(response.body);

    expect(payload.safeToSpendMinor).toBe(154000);
    expect(payload.safeToSpendBreakdown.totalDeductionsMinor).toBe(96000);
    expect(payload.safeToSpendBreakdown.plannedExpensesMinor).toBe(15000);
    expect(payload.safeToSpendBreakdown.goalCommitmentsMinor).toBe(20000);
    expect(payload.safeToSpendBreakdown.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "income_received", amountMinor: 50000, role: "context" }),
        expect.objectContaining({ key: "upcoming_bills", amountMinor: 40000, role: "deduction", sourceCount: 1 }),
        expect.objectContaining({ key: "card_dues", amountMinor: 9000, role: "deduction", sourceCount: 1 }),
        expect.objectContaining({ key: "loan_emis", amountMinor: 12000, role: "deduction", sourceCount: 1 }),
        expect.objectContaining({ key: "safe_to_spend", amountMinor: 154000, role: "result" }),
      ]),
    );
  });

  it("returns an empty safe-to-spend breakdown when finance is not set up", async () => {
    prisma.financeAccount.findMany.mockResolvedValueOnce([]);
    prisma.financeTransaction.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prisma.financeMonthPlan.findUnique.mockResolvedValueOnce(null);
    prisma.recurringIncomeTemplate.findMany.mockResolvedValueOnce([]);
    prisma.creditCard.findMany.mockResolvedValueOnce([]);
    prisma.loan.findMany.mockResolvedValueOnce([]);
    prisma.expense.findMany.mockResolvedValueOnce([]);
    prisma.adminItem.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prisma.goal.findMany.mockResolvedValueOnce([]);

    const response = await app!.inject({
      method: "GET",
      url: "/api/finance/dashboard?month=2026-04",
    });

    expect(response.statusCode).toBe(200);
    const payload = parseBody<{
      safeToSpendMinor: number;
      safeToSpendBreakdown: {
        totalDeductionsMinor: number;
        lines: Array<{ key: string; amountMinor: number }>;
      };
    }>(response.body);

    expect(payload.safeToSpendMinor).toBe(0);
    expect(payload.safeToSpendBreakdown.totalDeductionsMinor).toBe(0);
    expect(payload.safeToSpendBreakdown.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "cash_available", amountMinor: 0 }),
        expect.objectContaining({ key: "safe_to_spend", amountMinor: 0 }),
      ]),
    );
  });

  it("marks recurring income received and advances the next expected date", async () => {
    const now = new Date("2026-04-28T00:00:00.000Z");
    const existingIncome = {
      id: RECURRING_INCOME_ID,
      userId: USER_ID,
      accountId: ACCOUNT_ID,
      title: "Salary",
      amountMinor: 8000000,
      currencyCode: "INR",
      recurrenceRule: "monthly",
      nextExpectedOn: now,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    };
    const updatedIncome = {
      ...existingIncome,
      nextExpectedOn: new Date("2026-05-28T00:00:00.000Z"),
      updatedAt: new Date("2026-04-28T01:00:00.000Z"),
    };
    const transaction = {
      id: "00000000-0000-4000-8000-000000000080",
      userId: USER_ID,
      accountId: ACCOUNT_ID,
      transferAccountId: null,
      transactionType: "INCOME",
      amountMinor: 8000000,
      currencyCode: "INR",
      occurredOn: now,
      description: "Salary",
      expenseCategoryId: null,
      billId: null,
      recurringIncomeTemplateId: RECURRING_INCOME_ID,
      createdAt: now,
      updatedAt: now,
    };

    prisma.recurringIncomeTemplate.findFirst.mockResolvedValueOnce(existingIncome);
    prisma.financeAccount.findFirst.mockResolvedValueOnce({
      id: ACCOUNT_ID,
      userId: USER_ID,
      name: "Kotak",
      accountType: "BANK",
      currencyCode: "INR",
      openingBalanceMinor: 0,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    prisma.financeTransaction.create.mockResolvedValueOnce(transaction);
    prisma.recurringIncomeTemplate.update.mockResolvedValueOnce(updatedIncome);

    const response = await app!.inject({
      method: "POST",
      url: `/api/finance/recurring-income/${RECURRING_INCOME_ID}/receive`,
      payload: {
        receivedOn: "2026-04-28",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.financeTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: ACCOUNT_ID,
        transactionType: "INCOME",
        amountMinor: 8000000,
        currencyCode: "INR",
        occurredOn: now,
        description: "Salary",
        recurringIncomeTemplateId: RECURRING_INCOME_ID,
      }),
    });
    expect(prisma.recurringIncomeTemplate.update).toHaveBeenCalledWith({
      where: {
        id: RECURRING_INCOME_ID,
      },
      data: expect.objectContaining({
        nextExpectedOn: new Date("2026-05-28T00:00:00.000Z"),
      }),
    });

    const payload = parseBody<{
      recurringIncome: { nextExpectedOn: string };
      transaction: { transactionType: string; amountMinor: number };
    }>(response.body);
    expect(payload.recurringIncome.nextExpectedOn).toBe("2026-05-28");
    expect(payload.transaction.transactionType).toBe("income");
    expect(payload.transaction.amountMinor).toBe(8000000);
  });

  it("undoes the latest recurring income receipt", async () => {
    const receiptDate = new Date("2026-05-28T00:00:00.000Z");
    const existingIncome = {
      id: RECURRING_INCOME_ID,
      userId: USER_ID,
      accountId: ACCOUNT_ID,
      title: "Salary",
      amountMinor: 8000000,
      currencyCode: "INR",
      recurrenceRule: "monthly",
      nextExpectedOn: new Date("2026-06-28T00:00:00.000Z"),
      status: "ACTIVE",
      createdAt: new Date("2026-04-28T00:00:00.000Z"),
      updatedAt: receiptDate,
    };
    const transaction = {
      id: "00000000-0000-4000-8000-000000000080",
      userId: USER_ID,
      accountId: ACCOUNT_ID,
      transferAccountId: null,
      transactionType: "INCOME",
      amountMinor: 8000000,
      currencyCode: "INR",
      occurredOn: receiptDate,
      description: "Salary",
      expenseCategoryId: null,
      billId: null,
      recurringIncomeTemplateId: RECURRING_INCOME_ID,
      createdAt: receiptDate,
      updatedAt: receiptDate,
    };
    const updatedIncome = {
      ...existingIncome,
      nextExpectedOn: receiptDate,
      updatedAt: new Date("2026-05-28T01:00:00.000Z"),
    };

    prisma.recurringIncomeTemplate.findFirst.mockResolvedValueOnce(existingIncome);
    prisma.financeTransaction.findFirst.mockResolvedValueOnce(transaction);
    prisma.financeTransaction.delete.mockResolvedValueOnce(transaction);
    prisma.recurringIncomeTemplate.update.mockResolvedValueOnce(updatedIncome);

    const response = await app!.inject({
      method: "POST",
      url: `/api/finance/recurring-income/${RECURRING_INCOME_ID}/undo-latest-receive`,
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.financeTransaction.delete).toHaveBeenCalledWith({
      where: {
        id: transaction.id,
      },
    });
    expect(prisma.recurringIncomeTemplate.update).toHaveBeenCalledWith({
      where: {
        id: RECURRING_INCOME_ID,
      },
      data: expect.objectContaining({
        nextExpectedOn: receiptDate,
        accountId: ACCOUNT_ID,
        amountMinor: 8000000,
        currencyCode: "INR",
      }),
    });

    const payload = parseBody<{
      recurringIncome: { nextExpectedOn: string };
      transactionId: string;
      undone: boolean;
    }>(response.body);
    expect(payload.recurringIncome.nextExpectedOn).toBe("2026-05-28");
    expect(payload.transactionId).toBe(transaction.id);
    expect(payload.undone).toBe(true);
  });

  it("does not undo a recurring income receipt with an unrelated transaction id", async () => {
    const receiptDate = new Date("2026-05-28T00:00:00.000Z");
    const existingIncome = {
      id: RECURRING_INCOME_ID,
      userId: USER_ID,
      accountId: ACCOUNT_ID,
      title: "Salary",
      amountMinor: 8000000,
      currencyCode: "INR",
      recurrenceRule: "monthly",
      nextExpectedOn: new Date("2026-06-28T00:00:00.000Z"),
      status: "ACTIVE",
      createdAt: new Date("2026-04-28T00:00:00.000Z"),
      updatedAt: receiptDate,
    };
    const unrelatedTransactionId = "00000000-0000-4000-8000-000000000099";
    const unrelatedTransaction = {
      id: unrelatedTransactionId,
      userId: USER_ID,
      accountId: ACCOUNT_ID,
      transferAccountId: null,
      transactionType: "INCOME",
      amountMinor: 12345,
      currencyCode: "INR",
      occurredOn: receiptDate,
      description: "Unrelated income",
      expenseCategoryId: null,
      billId: null,
      recurringIncomeTemplateId: "00000000-0000-4000-8000-000000000098",
      createdAt: receiptDate,
      updatedAt: receiptDate,
    };

    prisma.recurringIncomeTemplate.findFirst.mockResolvedValueOnce(existingIncome);
    prisma.financeTransaction.findFirst.mockImplementationOnce(async ({ where }: any) => {
      const serializedWhere = JSON.stringify(where);

      if (
        where.id === unrelatedTransactionId &&
        where.userId === USER_ID &&
        !serializedWhere.includes(RECURRING_INCOME_ID)
      ) {
        return unrelatedTransaction;
      }

      return null;
    });

    const response = await app!.inject({
      method: "POST",
      url: `/api/finance/recurring-income/${RECURRING_INCOME_ID}/undo-latest-receive`,
      payload: {
        transactionId: unrelatedTransactionId,
      },
    });

    expect(response.statusCode).toBe(404);
    expect(prisma.financeTransaction.delete).not.toHaveBeenCalled();
    expect(prisma.recurringIncomeTemplate.update).not.toHaveBeenCalled();
  });

  it("builds a monthly timeline with income, bills, cards, and loans grouped by status", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-28T12:00:00.000Z"));

    const createdAt = new Date("2026-04-01T00:00:00.000Z");
    const account = {
      id: ACCOUNT_ID,
      userId: USER_ID,
      name: "Kotak",
      accountType: "BANK",
      currencyCode: "INR",
      openingBalanceMinor: 11050000,
      archivedAt: null,
      createdAt,
      updatedAt: createdAt,
    };

    prisma.financeAccount.findMany.mockResolvedValueOnce([account]);
    prisma.recurringIncomeTemplate.findMany.mockResolvedValueOnce([
      {
        id: RECURRING_INCOME_ID,
        userId: USER_ID,
        accountId: ACCOUNT_ID,
        title: "Salary",
        amountMinor: 8000000,
        currencyCode: "INR",
        recurrenceRule: "monthly",
        nextExpectedOn: new Date("2026-04-30T00:00:00.000Z"),
        status: "ACTIVE",
        createdAt,
        updatedAt: createdAt,
      },
    ]);
    prisma.financeTransaction.findMany.mockResolvedValueOnce([
      {
        id: "00000000-0000-4000-8000-000000000081",
        userId: USER_ID,
        accountId: ACCOUNT_ID,
        transferAccountId: null,
        transactionType: "INCOME",
        amountMinor: 1000000,
        currencyCode: "INR",
        occurredOn: new Date("2026-04-05T00:00:00.000Z"),
        description: "Freelance",
        expenseCategoryId: null,
        billId: null,
        recurringIncomeTemplateId: null,
        createdAt,
        updatedAt: createdAt,
      },
    ]);
    prisma.adminItem.findMany.mockResolvedValueOnce([
      {
        id: "00000000-0000-4000-8000-000000000090",
        userId: USER_ID,
        title: "Rent",
        itemType: "BILL",
        dueOn: new Date("2026-04-20T00:00:00.000Z"),
        status: "PENDING",
        relatedTaskId: null,
        recurringExpenseTemplateId: null,
        expenseCategoryId: null,
        amountMinor: 2500000,
        note: null,
        completedAt: null,
        completionMode: null,
        createdAt,
        updatedAt: createdAt,
        linkedExpense: null,
      },
      {
        id: "00000000-0000-4000-8000-000000000091",
        userId: USER_ID,
        title: "Internet",
        itemType: "BILL",
        dueOn: new Date("2026-04-10T00:00:00.000Z"),
        status: "DONE",
        relatedTaskId: null,
        recurringExpenseTemplateId: null,
        expenseCategoryId: null,
        amountMinor: 150000,
        note: null,
        completedAt: new Date("2026-04-10T00:00:00.000Z"),
        completionMode: "PAY_AND_LOG",
        createdAt,
        updatedAt: createdAt,
        linkedExpense: { id: EXPENSE_ID },
      },
    ]);
    prisma.creditCard.findMany.mockResolvedValueOnce([
      {
        id: "00000000-0000-4000-8000-0000000000a0",
        userId: USER_ID,
        paymentAccountId: ACCOUNT_ID,
        name: "Axis Ace",
        issuer: "Axis",
        currencyCode: "INR",
        creditLimitMinor: 30000000,
        outstandingBalanceMinor: 900000,
        statementDay: null,
        paymentDueDay: 29,
        minimumDueMinor: 900000,
        status: "ACTIVE",
        createdAt,
        updatedAt: createdAt,
      },
    ]);
    prisma.loan.findMany.mockResolvedValueOnce([
      {
        id: "00000000-0000-4000-8000-0000000000b0",
        userId: USER_ID,
        paymentAccountId: ACCOUNT_ID,
        name: "Car loan",
        lender: "HDFC",
        currencyCode: "INR",
        principalAmountMinor: 60000000,
        outstandingBalanceMinor: 42000000,
        emiAmountMinor: 1200000,
        interestRateBps: null,
        dueDay: 30,
        startOn: null,
        endOn: null,
        status: "ACTIVE",
        createdAt,
        updatedAt: createdAt,
      },
    ]);

    const response = await app!.inject({
      method: "GET",
      url: "/api/finance/timeline?month=2026-04",
    });

    vi.useRealTimers();

    expect(response.statusCode).toBe(200);
    const payload = parseBody<{
      items: Array<{ sourceType: string; title: string; status: string; primaryAction: { type: string } | null }>;
      groups: Array<{ key: string; items: Array<{ title: string }> }>;
    }>(response.body);

    expect(payload.items.map((item) => item.sourceType)).toEqual([
      "bill",
      "credit_card_due",
      "income_plan",
      "loan_emi",
      "income_transaction",
      "bill",
    ]);
    expect(payload.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Rent", status: "overdue", primaryAction: expect.objectContaining({ type: "pay_bill" }) }),
        expect.objectContaining({ title: "Salary", status: "due_soon", primaryAction: expect.objectContaining({ type: "mark_income_received" }) }),
        expect.objectContaining({ title: "Freelance", status: "completed", primaryAction: null }),
        expect.objectContaining({ title: "Axis Ace due", status: "due_soon", primaryAction: expect.objectContaining({ type: "pay_card_due" }) }),
        expect.objectContaining({ title: "Car loan EMI", status: "due_soon", primaryAction: expect.objectContaining({ type: "pay_emi" }) }),
      ]),
    );
    expect(payload.groups.map((group) => group.key)).toEqual(["overdue", "next_7_days", "completed"]);
  });
});
