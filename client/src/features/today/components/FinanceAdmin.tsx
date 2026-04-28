import {
  useFinanceDataQuery,
  getTodayDate,
  useReceiveRecurringIncomeMutation,
  type FinanceTimelineItem,
} from "../../../shared/lib/api";
import { Link } from "react-router-dom";
import { buildFinanceBillRoute, buildFinanceRoute } from "../../finance/finance-navigation";
import { useQuickMarkBillPaid } from "../../finance/useQuickMarkBillPaid";

export function FinanceAdmin() {
  const today = getTodayDate();
  const currentMonth = today.slice(0, 7);
  const financeQuery = useFinanceDataQuery(today, {
    includeRecurringExpenses: false,
    includeCategories: false,
    includeMonthPlan: false,
    includeInsights: false,
  });
  const { isPending, markPaid, pendingBillId } = useQuickMarkBillPaid(today);
  const receiveIncomeMutation = useReceiveRecurringIncomeMutation(today);

  if (financeQuery.isLoading && !financeQuery.data) {
    return (
      <div className="today-finance-admin">
        <h3 className="today-context-title">Finance &amp; Admin</h3>
        <p className="today-finance-admin__empty">Loading…</p>
      </div>
    );
  }

  const data = financeQuery.data;
  if (!data) return null;

  const { summary, expenses } = data;
  const todayExpenses = expenses?.expenses?.filter((e) => e.spentOn === today) ?? [];
  const hasLoggedToday = todayExpenses.length > 0;
  const todayTotal = todayExpenses.reduce((sum, e) => sum + e.amountMinor, 0);

  const pendingBills = summary?.upcomingBills?.filter((b) => b.status === "pending" || b.status === "rescheduled") ?? [];
  const overdueBills = pendingBills.filter((b) => b.dueOn <= today);
  const upcomingBills = pendingBills.filter((b) => b.dueOn > today).slice(0, 3);
  const actionableTimelineItems = (data.timeline?.items ?? [])
    .filter(isActionableTodayFinanceItem)
    .slice(0, 4);
  const incomePlans = data.dashboard?.recurringIncome ?? [];

  const currencyCode = summary?.currencyCode ?? "USD";
  const handleReceiveIncome = async (item: FinanceTimelineItem) => {
    const income = incomePlans.find((plan) => plan.id === item.sourceId);
    const accountId = income?.accountId ?? item.accountId;
    if (!accountId) return;

    await receiveIncomeMutation.mutateAsync({
      recurringIncomeId: item.sourceId,
      accountId,
      amountMinor: item.amountMinor,
      currencyCode: item.currencyCode,
      receivedOn: item.date,
      description: item.title,
    });
  };

  return (
    <div className="today-finance-admin">
      <h3 className="today-context-title">Finance &amp; Admin</h3>

      <div className="today-fa__rows">
        {/* Expense logging status */}
        <div className="today-fa__row">
          <span className={`today-fa__indicator${hasLoggedToday ? " today-fa__indicator--done" : ""}`}>
            {hasLoggedToday ? "✓" : "○"}
          </span>
          <span className="today-fa__label">
            {hasLoggedToday
              ? `${formatMinor(todayTotal, currencyCode)} logged today`
              : "No expenses logged today"}
          </span>
          <div className="today-fa__actions">
            <Link to={buildFinanceRoute({ month: currentMonth })} className="today-fa__chip">
              {hasLoggedToday ? "Open" : "Log"}
            </Link>
          </div>
        </div>

        {actionableTimelineItems.map((item) => {
          const isIncome = item.sourceType === "income_plan";
          const isOverdue = item.status === "overdue";

          return (
            <div
              key={item.id}
              className={`today-fa__row today-fa__row--finance${isOverdue ? " today-fa__row--alert" : ""}`}
            >
              <span
                className={`today-fa__indicator${
                  isOverdue ? " today-fa__indicator--alert" : " today-fa__indicator--done"
                }`}
              >
                {getFinanceEventMarker(item)}
              </span>
              <span className="today-fa__label">
                {getFinanceEventTitle(item)}
                {` · ${formatMinor(item.amountMinor, item.currencyCode)}`}
              </span>
              <span className="today-fa__due">{isOverdue ? "Overdue" : "Today"}</span>
              <div className="today-fa__actions">
                {isIncome ? (
                  <button
                    className="today-fa__chip-button today-fa__chip--primary"
                    type="button"
                    disabled={receiveIncomeMutation.isPending}
                    onClick={() => void handleReceiveIncome(item)}
                  >
                    {receiveIncomeMutation.isPending ? "Saving..." : "Mark"}
                  </button>
                ) : (
                  <Link
                    to={buildFinanceRoute({ month: item.date.slice(0, 7) })}
                    className="today-fa__chip today-fa__chip--primary"
                  >
                    Open
                  </Link>
                )}
              </div>
            </div>
          );
        })}

        {/* Overdue bills */}
        {overdueBills.map((bill) => (
          <div key={bill.id} className="today-fa__row today-fa__row--alert">
            <span className="today-fa__indicator today-fa__indicator--alert">!</span>
            <span className="today-fa__label">
              {bill.title}
              {bill.amountMinor != null ? ` · ${formatMinor(bill.amountMinor, currencyCode)}` : ""}
            </span>
            <span className="today-fa__due">Overdue</span>
            <div className="today-fa__actions">
              <Link
                to={buildFinanceBillRoute(bill, {
                  intent: "pay",
                  section: "due_now",
                })}
                className="today-fa__chip today-fa__chip--primary"
              >
                Pay
              </Link>
              <button
                className="today-fa__chip-button"
                type="button"
                disabled={isPending}
                onClick={() => void markPaid(bill.id)}
              >
                {pendingBillId === bill.id ? "Saving..." : "Mark paid"}
              </button>
            </div>
          </div>
        ))}

        {/* Upcoming bills */}
        {upcomingBills.map((bill) => (
          <div key={bill.id} className="today-fa__row">
            <span className="today-fa__indicator">◎</span>
            <span className="today-fa__label">
              {bill.title}
              {bill.amountMinor != null ? ` · ${formatMinor(bill.amountMinor, currencyCode)}` : ""}
            </span>
            <span className="today-fa__due">{formatRelativeDate(bill.dueOn, today)}</span>
            <div className="today-fa__actions">
              <Link
                to={buildFinanceBillRoute(bill, {
                  intent: bill.dueOn <= today ? "pay" : "view",
                  section: bill.dueOn <= today ? "due_now" : "pending_bills",
                })}
                className="today-fa__chip"
              >
                {bill.dueOn <= today ? "Pay" : "Open"}
              </Link>
            </div>
          </div>
        ))}

        {/* Monthly total context */}
        {summary ? (
          <div className="today-fa__row today-fa__row--summary">
            <span className="today-fa__indicator">📊</span>
            <span className="today-fa__label">
              Month total: {formatMinor(summary.totalSpentMinor, currencyCode)}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function isActionableTodayFinanceItem(item: FinanceTimelineItem): boolean {
  if (item.status !== "overdue" && item.status !== "due_today") {
    return false;
  }

  if (!item.primaryAction) {
    return false;
  }

  return (
    item.sourceType === "income_plan"
    || item.sourceType === "credit_card_due"
    || item.sourceType === "loan_emi"
  );
}

function getFinanceEventMarker(item: FinanceTimelineItem): string {
  if (item.sourceType === "income_plan") return "I";
  if (item.sourceType === "credit_card_due") return "C";
  return "L";
}

function getFinanceEventTitle(item: FinanceTimelineItem): string {
  if (item.sourceType === "income_plan") {
    return item.status === "overdue" ? `${item.title} missed` : item.title;
  }

  return item.title;
}

function formatMinor(amountMinor: number, currencyCode: string): string {
  const value = amountMinor / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currencyCode} ${value.toFixed(2)}`;
  }
}

function formatRelativeDate(dateStr: string, today: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const todayDate = new Date(today + "T00:00:00");
  const diffDays = Math.round((date.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return `In ${diffDays}d`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
