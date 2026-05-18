import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  FinanceBillItem,
  FinanceDashboardResponse,
  FinanceTimelineItem,
} from "../../shared/lib/api";
import { setPreferredTimezone } from "../../shared/lib/date";
import {
  formatSafeSpendLineAmount,
  getBillDueText,
  getBillStatusLabel,
  getMonthShort,
  getPlannedIncomeMinor,
  getTimelineStatusLabel,
  getTimelineTone,
  getTimelineType,
  navigateMonth,
} from "./finance-page-model";

const makeBill = (overrides: Partial<FinanceBillItem>): FinanceBillItem => ({
  id: "bill-1",
  title: "Rent",
  amountMinor: 100000,
  currency: "USD",
  dueOn: "2026-05-03",
  status: "pending",
  paidAt: null,
  categoryId: null,
  categoryName: null,
  accountId: null,
  accountName: null,
  recurrenceTemplateId: null,
  reconciliationStatus: "due",
  linkedExpenseId: null,
  ...overrides,
} as FinanceBillItem);

afterEach(() => {
  vi.useRealTimers();
  setPreferredTimezone("");
});

describe("finance page model", () => {
  it("navigates months across year boundaries", () => {
    expect(navigateMonth("2026-01", -1)).toBe("2025-12");
    expect(navigateMonth("2026-12", 1)).toBe("2027-01");
    expect(getMonthShort("2026-05")).toBe("May");
  });

  it("formats bill due text from status and relative due dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-03T12:00:00.000Z"));
    setPreferredTimezone("UTC");

    expect(getBillDueText(makeBill({ dueOn: "2026-05-03" }))).toBe("Due today");
    expect(getBillDueText(makeBill({ dueOn: "2026-05-05" }))).toBe("Due in 2d");
    expect(getBillDueText(makeBill({ dueOn: "2026-05-01" }))).toBe("2d overdue");
    expect(getBillDueText(makeBill({ status: "done", paidAt: "2026-05-02T09:00:00.000Z" }))).toBe("Paid May 2");
    expect(getBillDueText(makeBill({ status: "rescheduled", dueOn: "2026-05-10" }))).toBe("Moved to May 10");
  });

  it("maps bill reconciliation and timeline state to display labels", () => {
    expect(getBillStatusLabel(makeBill({ reconciliationStatus: "paid_with_expense" }))).toBe("Logged");
    expect(getBillStatusLabel(makeBill({ reconciliationStatus: "paid_without_expense" }))).toBe("Needs expense");
    expect(getTimelineType({ sourceType: "income_transaction" } as FinanceTimelineItem)).toBe("income");
    expect(getTimelineType({ sourceType: "credit_card_due" } as FinanceTimelineItem)).toBe("card");
    expect(getTimelineType({ sourceType: "loan_emi" } as FinanceTimelineItem)).toBe("loan");
    expect(getTimelineType({ sourceType: "bill" } as FinanceTimelineItem)).toBe("bill");
    expect(getTimelineTone({ status: "overdue", direction: "out" } as FinanceTimelineItem)).toBe("negative");
    expect(getTimelineTone({ status: "expected", direction: "in" } as FinanceTimelineItem)).toBe("positive");
    expect(getTimelineStatusLabel("due_soon")).toBe("Due soon");
  });

  it("summarizes planned income and safe spend lines", () => {
    expect(getPlannedIncomeMinor([
      { amountMinor: 20000, status: "active" },
      { amountMinor: 30000, status: "paused" },
    ], 50000)).toBe(20000);
    expect(getPlannedIncomeMinor([], 50000)).toBe(50000);
    expect(formatSafeSpendLineAmount({
      label: "Bills",
      role: "deduction",
      amountMinor: 4200,
    } as FinanceDashboardResponse["safeToSpendBreakdown"]["lines"][number], "USD")).toBe("- $42.00");
  });
});
