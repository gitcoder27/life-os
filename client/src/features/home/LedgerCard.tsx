import { Link } from "react-router-dom";
import { formatMajorCurrency } from "../../shared/lib/api";

type LedgerCardProps = {
  spentThisMonth: number;
  budgetLabel: string;
  upcomingBills: number;
};

export function LedgerCard({
  spentThisMonth,
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
          {formatMajorCurrency(spentThisMonth)}
        </span>
      </div>
      <div className="ledger-meta">
        <span className="ledger-meta__item">
          {budgetLabel || "Tracking"}
        </span>
        <span className="ledger-meta__item">
          {upcomingBills} upcoming bill{upcomingBills !== 1 ? "s" : ""}
        </span>
      </div>
    </Link>
  );
}
