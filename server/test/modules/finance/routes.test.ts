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
});
