import { formatMinorCurrency } from "../../shared/lib/api";
import { EmptyState } from "../../shared/ui/PageState";

export function DebtSummary({
  creditCards,
  loans,
  currency,
  outstandingMinor,
  dueMinor,
}: {
  creditCards: Array<{
    id: string;
    outstandingBalanceMinor: number;
    creditLimitMinor: number;
    utilizationPercent: number;
  }>;
  loans: Array<{
    id: string;
    outstandingBalanceMinor: number;
    emiAmountMinor: number;
  }>;
  currency: string;
  outstandingMinor: number;
  dueMinor: number;
}) {
  if (creditCards.length === 0 && loans.length === 0) {
    return <EmptyState title="No debt tracked" description="Add cards or loans from setup." />;
  }

  const totalLimitMinor = creditCards.reduce((sum, card) => sum + card.creditLimitMinor, 0);
  const totalCardOutstandingMinor = creditCards.reduce((sum, card) => sum + card.outstandingBalanceMinor, 0);
  const utilization = totalLimitMinor > 0 ? Math.round((totalCardOutstandingMinor / totalLimitMinor) * 100) : 0;

  return (
    <div className="fc-debt-summary">
      <div>
        <span className="fc-label">Outstanding</span>
        <strong>{formatMinorCurrency(outstandingMinor, currency)}</strong>
      </div>
      <div>
        <span className="fc-label">This month</span>
        <strong>{formatMinorCurrency(dueMinor, currency)}</strong>
      </div>
      <div>
        <span className="fc-label">Card use</span>
        <strong>{utilization}%</strong>
      </div>
    </div>
  );
}

export function DebtList({
  creditCards,
  loans,
  currency,
  onArchiveCard,
  onArchiveLoan,
  onPayCard,
  onPayLoan,
  isPaying,
}: {
  creditCards: Array<{
    id: string;
    name: string;
    issuer: string | null;
    paymentAccountId: string | null;
    outstandingBalanceMinor: number;
    creditLimitMinor: number;
    minimumDueMinor: number | null;
    paymentDueDay: number | null;
    utilizationPercent: number;
  }>;
  loans: Array<{
    id: string;
    name: string;
    lender: string | null;
    paymentAccountId: string | null;
    outstandingBalanceMinor: number;
    emiAmountMinor: number;
    dueDay: number | null;
    progressPercent: number;
  }>;
  currency: string;
  onArchiveCard: (cardId: string) => void;
  onArchiveLoan: (loanId: string) => void;
  onPayCard: (card: {
    id: string;
    paymentAccountId: string | null;
    outstandingBalanceMinor: number;
    minimumDueMinor: number | null;
  }) => void;
  onPayLoan: (loan: {
    id: string;
    paymentAccountId: string | null;
    emiAmountMinor: number;
  }) => void;
  isPaying: boolean;
}) {
  if (creditCards.length === 0 && loans.length === 0) {
    return null;
  }

  return (
    <div className="fc-list">
      {creditCards.map((card) => (
        <div key={card.id} className="fc-row">
          <div className="fc-row__dot fc-row__dot--transfer" />
          <div className="fc-row__main">
            <strong>{card.name}</strong>
            <span>
              {card.issuer ?? "Credit card"} · {card.utilizationPercent}% used
              {card.paymentDueDay ? ` · due ${card.paymentDueDay}` : ""}
            </span>
          </div>
          <span className="fc-row__amount">{formatMinorCurrency(card.outstandingBalanceMinor, currency)}</span>
          <div className="fc-row__actions">
            <span className="fc-muted">{formatMinorCurrency(card.minimumDueMinor ?? 0, currency)} due</span>
            <button
              className="button button--primary button--small"
              type="button"
              disabled={!card.paymentAccountId || (card.minimumDueMinor ?? card.outstandingBalanceMinor) <= 0 || isPaying}
              onClick={() => onPayCard(card)}
            >
              Pay due
            </button>
            <button className="button button--ghost button--small" type="button" onClick={() => onArchiveCard(card.id)}>Archive</button>
          </div>
        </div>
      ))}
      {loans.map((loan) => (
        <div key={loan.id} className="fc-row">
          <div className="fc-row__dot fc-row__dot--expense" />
          <div className="fc-row__main">
            <strong>{loan.name}</strong>
            <span>
              {loan.lender ?? "Loan"} · {loan.progressPercent}% paid
              {loan.dueDay ? ` · due ${loan.dueDay}` : ""}
            </span>
          </div>
          <span className="fc-row__amount">{formatMinorCurrency(loan.outstandingBalanceMinor, currency)}</span>
          <div className="fc-row__actions">
            <span className="fc-muted">{formatMinorCurrency(loan.emiAmountMinor, currency)} EMI</span>
            <button
              className="button button--primary button--small"
              type="button"
              disabled={!loan.paymentAccountId || loan.emiAmountMinor <= 0 || isPaying}
              onClick={() => onPayLoan(loan)}
            >
              Pay EMI
            </button>
            <button className="button button--ghost button--small" type="button" onClick={() => onArchiveLoan(loan.id)}>Archive</button>
          </div>
        </div>
      ))}
    </div>
  );
}
