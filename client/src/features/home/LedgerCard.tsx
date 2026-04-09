import { Link } from "react-router-dom";
import { formatMinorCurrency } from "../../shared/lib/api";

type LedgerCardProps = {
  spentThisMonthMinor: number;
  currencyCode: string;
  budgetLabel: string;
  upcomingBills: number;
};

export function LedgerCard({
  spentThisMonthMinor,
  currencyCode,
  budgetLabel,
  upcomingBills,
}: LedgerCardProps) {
  return (
    <Link to="/finance" className="dash-card dash-card--link">
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
          {budgetLabel || "Tracking"}
        </span>
        <span className="ledger-meta__item">
          {upcomingBills} open bill{upcomingBills !== 1 ? "s" : ""} this month
        </span>
      </div>
    </Link>
  );
}
