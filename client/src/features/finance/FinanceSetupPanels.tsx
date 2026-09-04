import type { ReactNode } from "react";

import {
  formatDueLabel,
  formatMinorCurrency,
  formatShortDate,
} from "../../shared/lib/api";
import {
  formatFullRecurrenceSummary,
  isRecurring,
  type RecurrenceDefinition,
} from "../../shared/lib/recurrence";
import { EmptyState } from "../../shared/ui/PageState";

export function SetupBlock({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <section className="setup-block">
      <div className="setup-block__head">
        <h3>{title}</h3>
        {meta ? <span>{meta}</span> : null}
      </div>
      {children}
    </section>
  );
}

function SetupEmpty({ title }: { title: string }) {
  return <div className="setup-empty">{title}</div>;
}

function formatAccountType(accountType: string) {
  switch (accountType) {
    case "bank": return "Bank";
    case "cash": return "Cash";
    case "wallet": return "Wallet";
    default: return "Other";
  }
}

export function SetupAccountList({
  accounts,
  currency,
  isUpdating,
  onArchive,
  onRestore,
}: {
  accounts: Array<{
    id: string;
    name: string;
    accountType: string;
    currentBalanceMinor: number;
    archivedAt: string | null;
  }>;
  currency: string;
  isUpdating: boolean;
  onArchive: (accountId: string) => void;
  onRestore: (accountId: string) => void;
}) {
  if (accounts.length === 0) {
    return <SetupEmpty title="No accounts yet" />;
  }

  return (
    <div className="setup-manage-list">
      {accounts.map((account) => (
        <div key={account.id} className={`setup-manage-row${account.archivedAt ? " setup-manage-row--muted" : ""}`}>
          <div>
            <strong>{account.name}</strong>
            <span>{formatAccountType(account.accountType)} · {account.archivedAt ? "Archived" : "Active"}</span>
          </div>
          <span className="setup-manage-row__amount">{formatMinorCurrency(account.currentBalanceMinor, currency)}</span>
          <button className="button button--ghost button--small" type="button" disabled={isUpdating} onClick={() => account.archivedAt ? onRestore(account.id) : onArchive(account.id)}>
            {account.archivedAt ? "Restore" : "Archive"}
          </button>
        </div>
      ))}
    </div>
  );
}

export function SetupCardList({
  cards,
  currency,
  accountMap,
  isUpdating,
  onArchive,
}: {
  cards: Array<{
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
  currency: string;
  accountMap: Map<string, { name: string }>;
  isUpdating: boolean;
  onArchive: (cardId: string) => void;
}) {
  if (cards.length === 0) {
    return <SetupEmpty title="No cards tracked" />;
  }

  return (
    <div className="setup-manage-list">
      {cards.map((card) => (
        <div key={card.id} className="setup-manage-row">
          <div>
            <strong>{card.name}</strong>
            <span>
              {card.issuer ?? "Credit card"} · {card.utilizationPercent}% used
              {card.paymentDueDay ? ` · due ${card.paymentDueDay}` : ""}
              {card.paymentAccountId ? ` · ${accountMap.get(card.paymentAccountId)?.name ?? "Account"}` : ""}
            </span>
          </div>
          <span className="setup-manage-row__amount">{formatMinorCurrency(card.minimumDueMinor ?? card.outstandingBalanceMinor, currency)}</span>
          <button className="button button--ghost button--small" type="button" disabled={isUpdating} onClick={() => onArchive(card.id)}>Archive</button>
        </div>
      ))}
    </div>
  );
}

export function SetupLoanList({
  loans,
  currency,
  accountMap,
  isUpdating,
  onArchive,
}: {
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
  accountMap: Map<string, { name: string }>;
  isUpdating: boolean;
  onArchive: (loanId: string) => void;
}) {
  if (loans.length === 0) {
    return <SetupEmpty title="No loans tracked" />;
  }

  return (
    <div className="setup-manage-list">
      {loans.map((loan) => (
        <div key={loan.id} className="setup-manage-row">
          <div>
            <strong>{loan.name}</strong>
            <span>
              {loan.lender ?? "Loan"} · {loan.progressPercent}% paid
              {loan.dueDay ? ` · due ${loan.dueDay}` : ""}
              {loan.paymentAccountId ? ` · ${accountMap.get(loan.paymentAccountId)?.name ?? "Account"}` : ""}
            </span>
          </div>
          <span className="setup-manage-row__amount">{formatMinorCurrency(loan.emiAmountMinor, currency)}</span>
          <button className="button button--ghost button--small" type="button" disabled={isUpdating} onClick={() => onArchive(loan.id)}>Archive</button>
        </div>
      ))}
    </div>
  );
}

export function SetupCategoryList({
  categories,
  isUpdating,
  onArchive,
}: {
  categories: Array<{ id: string; name: string; color: string | null }>;
  isUpdating: boolean;
  onArchive: (categoryId: string) => void;
}) {
  if (categories.length === 0) {
    return <SetupEmpty title="No categories yet" />;
  }

  return (
    <div className="setup-manage-list setup-manage-list--chips">
      {categories.map((category) => (
        <div key={category.id} className="setup-category-chip">
          <span style={{ background: category.color ?? "rgba(226, 184, 95, 0.7)" }} />
          <strong>{category.name}</strong>
          <button className="button button--ghost button--small" type="button" disabled={isUpdating} onClick={() => onArchive(category.id)}>Archive</button>
        </div>
      ))}
    </div>
  );
}

export function SetupRecurringBillList({
  recurringBills,
  currency,
  categoryMap,
  isUpdating,
  onToggle,
  onArchive,
}: {
  recurringBills: Array<{
    id: string;
    title: string;
    expenseCategoryId: string | null;
    defaultAmountMinor: number | null;
    recurrence: RecurrenceDefinition | null;
    nextDueOn: string;
    status: "active" | "paused" | "archived";
  }>;
  currency: string;
  categoryMap: Map<string, { name: string }>;
  isUpdating: boolean;
  onToggle: (item: { id: string; status: "active" | "paused" | "archived" }) => void;
  onArchive: (recurringExpenseId: string) => void;
}) {
  if (recurringBills.length === 0) {
    return <SetupEmpty title="No recurring bills" />;
  }

  return (
    <div className="setup-manage-list">
      {recurringBills.map((item) => {
        const category = item.expenseCategoryId ? categoryMap.get(item.expenseCategoryId)?.name : null;
        return (
          <div key={item.id} className={`setup-manage-row${item.status !== "active" ? " setup-manage-row--muted" : ""}`}>
            <div>
              <strong>{item.title}</strong>
              <span>
                {isRecurring(item.recurrence) ? `${formatFullRecurrenceSummary(item.recurrence!.rule)} · ` : ""}
                {formatDueLabel(item.nextDueOn)}
                {category ? ` · ${category}` : ""}
                {item.status !== "active" ? ` · ${item.status}` : ""}
              </span>
            </div>
            <span className="setup-manage-row__amount">{formatMinorCurrency(item.defaultAmountMinor ?? 0, currency)}</span>
            <div className="setup-manage-row__actions">
              <button className="button button--ghost button--small" type="button" disabled={isUpdating} onClick={() => onToggle(item)}>
                {item.status === "active" ? "Pause" : "Resume"}
              </button>
              <button className="button button--ghost button--small" type="button" disabled={isUpdating} onClick={() => onArchive(item.id)}>Archive</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function IncomePlanList({
  incomePlans,
  currency,
  accountMap,
  onMarkReceived,
  onUndoReceipt,
  onPause,
  onArchive,
  isUpdating,
  isReceiving,
  isUndoing,
}: {
  incomePlans: Array<{
    id: string;
    accountId: string;
    title: string;
    amountMinor: number;
    currencyCode: string;
    nextExpectedOn: string;
    status: "active" | "paused" | "archived";
  }>;
  currency: string;
  accountMap: Map<string, { name: string }>;
  onMarkReceived: (income: { id: string; accountId: string; amountMinor: number; currencyCode?: string; title: string }) => void;
  onUndoReceipt: (incomeId: string) => void;
  onPause: (incomeId: string) => void;
  onArchive: (incomeId: string) => void;
  isUpdating: boolean;
  isReceiving: boolean;
  isUndoing: boolean;
}) {
  if (incomePlans.length === 0) {
    return <EmptyState title="No income plans" description="Add salary or other expected income." />;
  }

  return (
    <div className="setup-manage-list">
      {incomePlans.map((income) => (
        <div key={income.id} className={`setup-income-row${income.status !== "active" ? " setup-income-row--muted" : ""}`}>
          <div>
            <strong>{income.title}</strong>
            <span>{accountMap.get(income.accountId)?.name ?? "Account"} · Next {formatShortDate(income.nextExpectedOn)} · {income.status}</span>
          </div>
          <span className="setup-income-row__amount">{formatMinorCurrency(income.amountMinor, currency)}</span>
          <div className="setup-income-row__actions">
            <button className="button button--primary button--small" type="button" disabled={isReceiving || income.status !== "active"} onClick={() => onMarkReceived(income)}>Mark received</button>
            <button className="button button--ghost button--small" type="button" disabled={isUndoing} onClick={() => onUndoReceipt(income.id)}>Undo</button>
            <button className="button button--ghost button--small" type="button" disabled={isUpdating || income.status !== "active"} onClick={() => onPause(income.id)}>Pause</button>
            <button className="button button--ghost button--small" type="button" disabled={isUpdating || income.status === "archived"} onClick={() => onArchive(income.id)}>Archive</button>
          </div>
        </div>
      ))}
    </div>
  );
}
