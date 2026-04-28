import { describe, expect, it } from "vitest";

import type { FinanceTimelineItem } from "@life-os/contracts";

import { buildFinanceAttentionItems } from "../../src/modules/home/finance-attention.js";

const timelineItem = (
  overrides: Partial<FinanceTimelineItem>,
): FinanceTimelineItem => ({
  id: "item-1",
  sourceType: "income_plan",
  sourceId: "income-1",
  date: "2026-04-28",
  title: "Salary",
  amountMinor: 8000000,
  currencyCode: "INR",
  direction: "in",
  status: "due_today",
  primaryAction: { type: "mark_income_received", label: "Mark received" },
  accountId: "account-1",
  metadata: {},
  ...overrides,
});

describe("home finance attention", () => {
  it("surfaces actionable income, bill, card, and loan events", () => {
    const items = buildFinanceAttentionItems([
      timelineItem({
        sourceType: "income_transaction",
        sourceId: "transaction-1",
        status: "completed",
        primaryAction: null,
      }),
      timelineItem({
        sourceType: "loan_emi",
        sourceId: "loan-1",
        title: "Car loan EMI",
        amountMinor: 1200000,
        direction: "out",
        status: "overdue",
        primaryAction: { type: "pay_emi", label: "Pay EMI" },
      }),
      timelineItem({}),
      timelineItem({
        sourceType: "bill",
        sourceId: "bill-1",
        title: "Rent",
        amountMinor: 2500000,
        direction: "out",
        status: "overdue",
        primaryAction: { type: "pay_bill", label: "Pay" },
      }),
      timelineItem({
        sourceType: "credit_card_due",
        sourceId: "card-1",
        title: "HDFC card due",
        amountMinor: 800000,
        direction: "out",
        status: "due_today",
        primaryAction: { type: "pay_card_due", label: "Pay due" },
      }),
    ], "INR");

    expect(items.map((item) => item.title)).toEqual([
      "Rent is overdue",
      "Car loan EMI is overdue",
      "Mark Salary received",
      "Pay HDFC card due",
    ]);
    expect(items[0]).toEqual(
      expect.objectContaining({
        kind: "finance",
        tone: "urgent",
        detail: "₹25,000 missed on 2026-04-28",
        action: {
          type: "open_route",
          route: "/finance?month=2026-04&bill=bill-1&intent=pay&section=due_now",
        },
      }),
    );
    expect(items[1]).toEqual({
      id: "finance:loan_emi:loan-1",
      title: "Car loan EMI is overdue",
      kind: "finance",
      tone: "urgent",
      detail: "₹12,000 missed on 2026-04-28",
      dismissible: true,
      action: {
        type: "open_route",
        route: "/finance?month=2026-04",
      },
    });
  });

  it("ignores non-actionable future and completed events", () => {
    const items = buildFinanceAttentionItems([
      timelineItem({ status: "expected" }),
      timelineItem({ status: "completed", primaryAction: null }),
      timelineItem({ sourceType: "planned_expense", status: "due_today" }),
    ], "INR");

    expect(items).toHaveLength(0);
  });
});
