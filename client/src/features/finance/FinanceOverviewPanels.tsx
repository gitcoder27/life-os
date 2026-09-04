import type { CSSProperties } from "react";

import {
  formatMinorCurrency,
  formatShortDate,
  type FinanceBillItem,
  type FinanceDashboardResponse,
} from "../../shared/lib/api";
import {
  formatSafeSpendLineAmount,
  getMonthShort,
} from "./finance-page-model";

export function SafeThisMonthPanel({
  currency,
  safeToSpendMinor,
  cashAvailableMinor,
  plannedIncomeMinor,
  reservedMinor,
  totalSpentMinor,
}: {
  currency: string;
  safeToSpendMinor: number;
  cashAvailableMinor: number;
  plannedIncomeMinor: number;
  reservedMinor: number;
  totalSpentMinor: number;
}) {
  const allocationTotalMinor = Math.max(
    Math.abs(safeToSpendMinor) + Math.max(reservedMinor, 0) + Math.max(totalSpentMinor, 0),
    1,
  );
  const reservedShare = Math.min((Math.max(reservedMinor, 0) / allocationTotalMinor) * 100, 100);
  const spentShare = Math.min((Math.max(totalSpentMinor, 0) / allocationTotalMinor) * 100, 100);
  const metricItems = [
    {
      icon: "¤",
      label: "Cash",
      value: cashAvailableMinor,
      meta: "Available now",
    },
    {
      icon: "↗",
      label: "Expected",
      value: plannedIncomeMinor,
      meta: "This month",
    },
    {
      icon: "▣",
      label: "Reserved",
      value: reservedMinor,
      meta: "Bills, debt, plans",
    },
    {
      icon: "≡",
      label: "Spent",
      value: totalSpentMinor,
      meta: "This month",
    },
  ];

  return (
    <section className="fc-hero" aria-label="Safe this month">
      <div className="fc-hero__safe">
        <span className="fc-label">Safe to spend</span>
        <strong>{formatMinorCurrency(safeToSpendMinor, currency)}</strong>
        <div className="fc-hero__track" aria-hidden="true">
          <span
            className="fc-hero__track-fill fc-hero__track-fill--reserved"
            style={{ inlineSize: `${reservedShare}%` } as CSSProperties}
          />
          <span
            className="fc-hero__track-fill fc-hero__track-fill--spent"
            style={{ inlineSize: `${spentShare}%` } as CSSProperties}
          />
        </div>
        <span className="fc-status-dot">On track</span>
      </div>
      <div className="fc-hero__metrics">
        {metricItems.map((metric) => (
          <div className="fc-hero__metric" key={metric.label}>
            <span className="fc-icon-box">{metric.icon}</span>
            <span className="fc-label">{metric.label}</span>
            <strong>{formatMinorCurrency(metric.value, currency)}</strong>
            <small>{metric.meta}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

export function MonthJourney({
  month,
  currency,
  incomePlan,
  nextBill,
  nextCard,
  nextLoan,
  goals,
  onMarkIncomeReceived,
  onOpenBills,
  onOpenDebt,
  onOpenGoals,
}: {
  month: string;
  currency: string;
  incomePlan: {
    title: string;
    amountMinor: number;
    nextExpectedOn: string;
  } | null;
  nextBill: FinanceBillItem | null;
  nextCard: {
    name: string;
    minimumDueMinor: number | null;
    paymentDueDay: number | null;
  } | null;
  nextLoan: {
    name: string;
    emiAmountMinor: number;
    dueDay: number | null;
  } | null;
  goals: Array<{
    goalId: string;
    title: string;
    progressPercent: number;
  }>;
  onMarkIncomeReceived?: () => void;
  onOpenBills: () => void;
  onOpenDebt: () => void;
  onOpenGoals: () => void;
}) {
  const monthName = getMonthShort(month);

  return (
    <section className="fc-journey" aria-label="Month journey">
      <div className="fc-journey__head">
        <span className="fc-label">Month journey</span>
        <div className="fc-dayline" aria-hidden="true">
          {[25, 26, 27, 28, 29, 30].map((day) => <span key={day} className={day === 29 ? "is-today" : ""}>{day}</span>)}
          <i />
          <span>{monthName === "Dec" ? "Jan" : "May"}</span>
          {[1, 2, 3, 4, 5, 6].map((day) => <span key={`next-${day}`}>{day}</span>)}
        </div>
      </div>
      <div className="fc-lanes">
        <div className="fc-lane">
          <span className="fc-lane__name">Income</span>
          {incomePlan ? (
            <div className="fc-lane-pill fc-lane-pill--income">
              <strong>{incomePlan.title}</strong>
              <span>{formatShortDate(incomePlan.nextExpectedOn)}</span>
              <span>{formatMinorCurrency(incomePlan.amountMinor, currency)}</span>
              <button type="button" onClick={onMarkIncomeReceived}>Mark received</button>
            </div>
          ) : (
            <button className="fc-lane-clear" type="button" onClick={onMarkIncomeReceived}>Add salary</button>
          )}
        </div>
        <div className="fc-lane">
          <span className="fc-lane__name">Bills</span>
          {nextBill ? (
            <button className="fc-lane-pill" type="button" onClick={onOpenBills}>
              <strong>{nextBill.title}</strong>
              <span>{formatShortDate(nextBill.dueOn)}</span>
              <span>{nextBill.amountMinor != null ? formatMinorCurrency(nextBill.amountMinor, currency) : "Amount open"}</span>
            </button>
          ) : (
            <button className="fc-lane-clear" type="button" onClick={onOpenBills}>Clear</button>
          )}
        </div>
        <div className="fc-lane">
          <span className="fc-lane__name">Debt</span>
          {nextCard || nextLoan ? (
            <button className="fc-lane-pill" type="button" onClick={onOpenDebt}>
              <strong>{nextCard?.name ?? nextLoan?.name}</strong>
              <span>{nextCard?.paymentDueDay ?? nextLoan?.dueDay ? `${monthName} ${nextCard?.paymentDueDay ?? nextLoan?.dueDay}` : "This month"}</span>
              <span>{formatMinorCurrency(nextCard?.minimumDueMinor ?? nextLoan?.emiAmountMinor ?? 0, currency)}</span>
            </button>
          ) : (
            <button className="fc-lane-clear" type="button" onClick={onOpenDebt}>No EMI / card due</button>
          )}
        </div>
        <div className="fc-lane">
          <span className="fc-lane__name">Goals</span>
          <div className="fc-goal-chips">
            {goals.slice(0, 3).map((goal) => (
              <button key={goal.goalId} className="fc-goal-chip" type="button" onClick={onOpenGoals}>
                <span>{goal.title}</span>
                <strong>{goal.progressPercent}%</strong>
              </button>
            ))}
            {goals.length === 0 ? <button className="fc-lane-clear" type="button" onClick={onOpenGoals}>Open goals</button> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export function TodayMoneyActions({
  incomePlan,
  nextBill,
  nextCard,
  nextLoan,
  currency,
  onMarkIncomeReceived,
  onOpenBill,
  onOpenDebt,
  onAddBill,
}: {
  incomePlan: {
    title: string;
    amountMinor: number;
    nextExpectedOn: string;
  } | null;
  nextBill: FinanceBillItem | null;
  nextCard: { name: string; minimumDueMinor: number | null } | null;
  nextLoan: { name: string; emiAmountMinor: number } | null;
  currency: string;
  onMarkIncomeReceived?: () => void;
  onOpenBill?: () => void;
  onOpenDebt: () => void;
  onAddBill: () => void;
}) {
  return (
    <section className="fc-rail-card">
      <span className="fc-label">Today's money actions</span>
      <div className="fc-action-list">
        {incomePlan ? (
          <button className="fc-action" type="button" onClick={onMarkIncomeReceived}>
            <span className="fc-action__icon fc-action__icon--income">↥</span>
            <span><strong>Mark {incomePlan.title.toLowerCase()} received</strong><small>Expected {formatMinorCurrency(incomePlan.amountMinor, currency)} on {formatShortDate(incomePlan.nextExpectedOn)}</small></span>
            <i>›</i>
          </button>
        ) : null}
        {nextBill ? (
          <button className="fc-action" type="button" onClick={onOpenBill}>
            <span className="fc-action__icon">▣</span>
            <span><strong>Pay {nextBill.title}</strong><small>{nextBill.amountMinor != null ? formatMinorCurrency(nextBill.amountMinor, currency) : "Amount open"} due {formatShortDate(nextBill.dueOn)}</small></span>
            <i>›</i>
          </button>
        ) : (
          <button className="fc-action" type="button" onClick={onAddBill}>
            <span className="fc-action__icon">＋</span>
            <span><strong>Add first bill</strong><small>Rent, utilities, subscriptions</small></span>
            <i>›</i>
          </button>
        )}
        {nextCard || nextLoan ? (
          <button className="fc-action" type="button" onClick={onOpenDebt}>
            <span className="fc-action__icon fc-action__icon--debt">▤</span>
            <span><strong>{nextCard ? "Review card due" : "Review EMI"}</strong><small>{formatMinorCurrency(nextCard?.minimumDueMinor ?? nextLoan?.emiAmountMinor ?? 0, currency)} upcoming</small></span>
            <i>›</i>
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function SafeSpendMath({
  currency,
  breakdown,
}: {
  currency: string;
  breakdown: FinanceDashboardResponse["safeToSpendBreakdown"] | null;
}) {
  const lines = breakdown?.lines ?? [];
  const detailLines = lines.filter((line) => line.role !== "result");
  const resultLine = lines.find((line) => line.role === "result");

  return (
    <section className="fc-rail-card">
      <span className="fc-label">Safe-to-spend math</span>
      <div className="fc-math">
        {detailLines.map((line) => (
          <span key={line.key} className={`fc-math__line fc-math__line--${line.role}`}>
            <span>
              {line.label}
              {line.sourceCount != null && line.sourceCount > 0 ? <em>{line.sourceCount}</em> : null}
            </span>
            <strong>{formatSafeSpendLineAmount(line, currency)}</strong>
          </span>
        ))}
        <span className="fc-math__total">
          {resultLine?.label ?? "Safe to spend"}
          <strong>{formatMinorCurrency(resultLine?.amountMinor ?? 0, currency)}</strong>
        </span>
      </div>
    </section>
  );
}

export function QuickLinks({
  onTransactions,
  onAccounts,
  onBills,
  onDebt,
}: {
  onTransactions: () => void;
  onAccounts: () => void;
  onBills: () => void;
  onDebt: () => void;
}) {
  return (
    <section className="fc-rail-card">
      <span className="fc-label">Quick links</span>
      <div className="fc-links">
        <button type="button" onClick={onTransactions}>Transactions <span>›</span></button>
        <button type="button" onClick={onAccounts}>Accounts <span>›</span></button>
        <button type="button" onClick={onBills}>Bills <span>›</span></button>
        <button type="button" onClick={onDebt}>Debt <span>›</span></button>
      </div>
    </section>
  );
}
