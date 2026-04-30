import type {
  FinanceBillItem,
  FinanceDashboardResponse,
  FinanceTimelineItem,
} from "../../shared/lib/api";
import {
  daysUntil,
  formatMinorCurrency,
  formatShortDate,
} from "../../shared/lib/api";

export type MoneyEvent = {
  id: string;
  sortKey: string;
  dateLabel: string;
  type: "income" | "bill" | "card" | "loan";
  title: string;
  amountMinor: number;
  accountName: string;
  status: string;
  actionLabel: string;
  tone: "positive" | "warning" | "negative";
  groupTitle?: string;
  onAction?: () => void;
};

export function navigateMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function getBillDueText(bill: FinanceBillItem) {
  if (bill.status === "done") {
    return bill.paidAt ? `Paid ${formatShortDate(bill.paidAt.slice(0, 10))}` : "Paid";
  }

  if (bill.status === "dropped") return "Dropped";
  if (bill.status === "rescheduled") return `Moved to ${formatShortDate(bill.dueOn)}`;

  const days = daysUntil(bill.dueOn);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days <= 7) return `Due in ${days}d`;
  return `Due ${formatShortDate(bill.dueOn)}`;
}

export function getBillStatusLabel(bill: FinanceBillItem) {
  switch (bill.reconciliationStatus) {
    case "paid_with_expense": return "Logged";
    case "paid_without_expense": return "Needs expense";
    case "rescheduled": return "Open";
    case "dropped": return "Dropped";
    default: return "Due";
  }
}

export function getMonthShort(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleString("en", { month: "short", timeZone: "UTC" });
}

export function getPlannedIncomeMinor(incomePlans: Array<{ amountMinor: number; status: string }>, fallback: number | null | undefined) {
  const activePlanTotal = incomePlans
    .filter((income) => income.status === "active")
    .reduce((sum, income) => sum + income.amountMinor, 0);

  return activePlanTotal > 0 ? activePlanTotal : fallback ?? 0;
}

export function getTimelineType(item: FinanceTimelineItem): MoneyEvent["type"] {
  switch (item.sourceType) {
    case "income_plan":
    case "income_transaction":
      return "income";
    case "credit_card_due":
      return "card";
    case "loan_emi":
      return "loan";
    default:
      return "bill";
  }
}

export function getTimelineTone(item: FinanceTimelineItem): MoneyEvent["tone"] {
  if (item.status === "overdue") return "negative";
  if (item.direction === "in") return "positive";
  return "warning";
}

export function getTimelineStatusLabel(status: FinanceTimelineItem["status"]) {
  switch (status) {
    case "due_today": return "Due today";
    case "due_soon": return "Due soon";
    case "completed": return "Done";
    case "skipped": return "Skipped";
    case "paused": return "Paused";
    case "overdue": return "Overdue";
    default: return "Expected";
  }
}

export function formatSafeSpendLineAmount(
  line: FinanceDashboardResponse["safeToSpendBreakdown"]["lines"][number],
  currency: string,
) {
  const amount = formatMinorCurrency(line.amountMinor, currency);

  if (line.role === "deduction" && line.amountMinor > 0) {
    return `- ${amount}`;
  }

  return amount;
}
