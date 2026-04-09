import { describe, expect, it, vi } from "vitest";

import {
  getBillReconciliationStatus,
  materializeRecurringExpenseItems,
  serializeFinanceBill,
} from "../../../src/modules/finance/service.js";

describe("finance service", () => {
  it("creates recurring admin items for supported templates", async () => {
    const txFindFirst = vi.fn().mockResolvedValue(null);
    const txCreate = vi.fn().mockResolvedValue({});
    const txUpdate = vi.fn().mockResolvedValue({});
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "template-1",
        userId: "user-1",
        title: "Rent",
        nextDueOn: new Date("2026-01-01T00:00:00.000Z"),
        status: "ACTIVE",
        recurrenceRule: "monthly",
      },
    ]);
    const prisma = {
      recurringExpenseTemplate: {
        findMany,
      },
      adminItem: {
        findFirst: txFindFirst,
        create: txCreate,
      },
      $transaction: vi.fn(async (callback: any) => callback({ adminItem: { findFirst: txFindFirst, create: txCreate }, recurringExpenseTemplate: { update: txUpdate } })),
    } as any;

    const result = await materializeRecurringExpenseItems(prisma, new Date("2026-01-15T00:00:00.000Z"));

    expect(result.createdAdminItems).toBe(1);
    expect(result.advancedTemplates).toBe(1);
    expect(result.unsupportedTemplates).toBe(0);
    expect(txCreate).toHaveBeenCalledTimes(1);
    expect(txUpdate).toHaveBeenCalled();
  });

  it("counts unsupported templates without generating rows", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "template-2",
        userId: "user-1",
        title: "Odd",
        nextDueOn: new Date("2026-01-01T00:00:00.000Z"),
        status: "ACTIVE",
        recurrenceRule: "every:1:millennium",
      },
    ]);
    const prisma = {
      recurringExpenseTemplate: { findMany },
      adminItem: { findFirst: vi.fn(), create: vi.fn() },
      $transaction: vi.fn(async (callback: any) => callback({ adminItem: { findFirst: vi.fn(), create: vi.fn() }, recurringExpenseTemplate: { update: vi.fn() } })),
    } as any;

    const result = await materializeRecurringExpenseItems(prisma, new Date("2026-01-15T00:00:00.000Z"));

    expect(result.createdAdminItems).toBe(0);
    expect(result.unsupportedTemplates).toBe(1);
    expect(result.advancedTemplates).toBe(0);
  });

  it("serializes paid bills with linked expenses as reconciled", () => {
    const bill = serializeFinanceBill({
      id: "bill-1",
      userId: "user-1",
      title: "Internet",
      itemType: "BILL",
      dueOn: new Date("2026-04-10T00:00:00.000Z"),
      status: "DONE",
      relatedTaskId: null,
      recurringExpenseTemplateId: null,
      expenseCategoryId: "cat-1",
      amountMinor: 6500,
      note: null,
      completedAt: new Date("2026-04-10T00:00:00.000Z"),
      completionMode: "PAY_AND_LOG",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      updatedAt: new Date("2026-04-10T00:00:00.000Z"),
      linkedExpense: { id: "expense-1" },
    } as any);

    expect(bill.linkedExpenseId).toBe("expense-1");
    expect(bill.completionMode).toBe("pay_and_log");
    expect(bill.reconciliationStatus).toBe("paid_with_expense");
  });

  it("treats mark-paid-only bills as unreconciled until an expense is linked", () => {
    const status = getBillReconciliationStatus({
      status: "DONE",
      linkedExpense: null,
      completionMode: "MARK_PAID_ONLY",
    } as any);

    expect(status).toBe("paid_without_expense");
  });
});
