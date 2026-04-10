import { Link } from "react-router-dom";
import {
  formatMinorCurrency,
  formatRelativeDate,
  type HomeAction,
} from "../../shared/lib/api";
import { resolveHomeActionTarget } from "../../shared/lib/homeNavigation";

type LedgerCardProps = {
  spentThisMonthMinor: number;
  currencyCode: string;
  budgetLabel: string;
  upcomingBills: number;
  focusBill: {
    id: string;
    title: string;
    dueOn: string;
    amountMinor: number | null;
    status: "pending" | "rescheduled";
  } | null;
  action: HomeAction;
};

export function LedgerCard({
  spentThisMonthMinor,
  currencyCode,
  budgetLabel,
  upcomingBills,
  focusBill,
  action,
}: LedgerCardProps) {
  const target = resolveHomeActionTarget(action);

  return (
    <Link to={target.to} state={target.state} className="dash-card dash-card--link">
      <h3 className="dash-card__title">
        Ledger
        <span className="dash-card__arrow">&rarr;</span>
      </h3>
      <div className="ledger-amount">
        <span className="ledger-amount__label">Month spend</span>
        <span className="ledger-amount__value">
          {formatMinorCurrency(spentThisMonthMinor, currencyCode)}
        </span>
      </div>
      <div className="ledger-meta">
        <span className="ledger-meta__item">
          {focusBill
            ? `${focusBill.title} · ${formatRelativeDate(focusBill.dueOn)}`
            : budgetLabel || "Tracking"}
        </span>
        <span className="ledger-meta__item">
          {upcomingBills} open bill{upcomingBills !== 1 ? "s" : ""} this month
        </span>
      </div>
    </Link>
  );
}
