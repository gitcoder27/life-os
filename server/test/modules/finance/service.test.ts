import { describe, expect, it, vi } from "vitest";

import { materializeRecurringExpenseItems } from "../../../src/modules/finance/service.js";

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

    expect(result.createdAdminItems).toBe(3);
    expect(result.advancedTemplates).toBe(1);
    expect(result.unsupportedTemplates).toBe(0);
    expect(txCreate).toHaveBeenCalledTimes(3);
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
});
