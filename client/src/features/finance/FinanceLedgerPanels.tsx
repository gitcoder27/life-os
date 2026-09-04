import type { Dispatch, SetStateAction } from "react";

import {
  daysUntil,
  formatMinorCurrency,
  formatShortDate,
  type FinanceBillItem,
  type FinanceTransactionType,
} from "../../shared/lib/api";
import { EmptyState } from "../../shared/ui/PageState";
import {
  getBillDueText,
  getBillStatusLabel,
} from "./finance-page-model";

export type BillPaymentFormState = {
  paidOn: string;
  amount: string;
  categoryId: string;
  accountId: string;
  description: string;
};

export function TransactionList({
  transactions,
  currency,
  accountMap,
  categoryMap,
}: {
  transactions: Array<{
    id: string;
    accountId: string;
    transactionType: FinanceTransactionType;
    amountMinor: number;
    currencyCode: string;
    occurredOn: string;
    description: string | null;
    expenseCategoryId: string | null;
    source: "ledger" | "legacy_expense";
  }>;
  currency: string;
  accountMap: Map<string, { name: string }>;
  categoryMap: Map<string, { name: string }>;
}) {
  if (transactions.length === 0) {
    return <EmptyState title="No money entries" description="Add income, expense, transfer, or adjustment." />;
  }

  return (
    <div className="fc-list">
      {transactions.map((transaction) => {
        const isPositive = transaction.transactionType === "income" || (transaction.transactionType === "adjustment" && transaction.amountMinor > 0);
        const category = transaction.expenseCategoryId ? categoryMap.get(transaction.expenseCategoryId)?.name : null;
        const account = transaction.accountId ? accountMap.get(transaction.accountId)?.name : "Legacy";

        return (
          <div key={transaction.id} className="fc-row">
            <div className={`fc-row__dot fc-row__dot--${transaction.transactionType}`} />
            <div className="fc-row__main">
              <strong>{transaction.description || (transaction.transactionType === "income" ? "Income" : transaction.transactionType === "expense" ? "Expense" : transaction.transactionType === "transfer" ? "Transfer" : "Adjustment")}</strong>
              <span>{formatShortDate(transaction.occurredOn)} · {account}{category ? ` · ${category}` : ""}</span>
            </div>
            <span className={`fc-row__amount${isPositive ? " fc-row__amount--positive" : ""}`}>
              {isPositive ? "+" : "-"}{formatMinorCurrency(Math.abs(transaction.amountMinor), transaction.currencyCode || currency)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function BillRow({
  bill,
  currency,
  payingBillId,
  reschedulingBillId,
  rescheduleDate,
  setRescheduleDate,
  onPay,
  onMarkPaid,
  onDrop,
  onStartReschedule,
  onReschedule,
  onCancelReschedule,
  paymentForm,
  setPaymentForm,
  categories,
  accounts,
  onPayAndLog,
  isPaying,
}: {
  bill: FinanceBillItem;
  currency: string;
  payingBillId: string | null;
  reschedulingBillId: string | null;
  rescheduleDate: string;
  setRescheduleDate: (value: string) => void;
  onPay: (bill: FinanceBillItem) => void;
  onMarkPaid: (bill: FinanceBillItem) => void;
  onDrop: (bill: FinanceBillItem) => void;
  onStartReschedule: (bill: FinanceBillItem) => void;
  onReschedule: (billId: string) => Promise<void>;
  onCancelReschedule: () => void;
  paymentForm: BillPaymentFormState;
  setPaymentForm: Dispatch<SetStateAction<BillPaymentFormState>>;
  categories: Array<{ id: string; name: string }>;
  accounts: Array<{ id: string; name: string }>;
  onPayAndLog: (bill: FinanceBillItem) => Promise<void>;
  isPaying: boolean;
}) {
  const isOpen = bill.status === "pending" || bill.status === "rescheduled";

  return (
    <div className="fc-bill">
      <div className="fc-row">
        <div className={`fc-row__dot${daysUntil(bill.dueOn) <= 0 && isOpen ? " fc-row__dot--expense" : ""}`} />
        <div className="fc-row__main">
          <strong>{bill.title}</strong>
          <span>{getBillDueText(bill)} · {getBillStatusLabel(bill)}</span>
        </div>
        {bill.amountMinor != null ? <span className="fc-row__amount">{formatMinorCurrency(bill.amountMinor, currency)}</span> : null}
        <div className="fc-row__actions">
          {isOpen ? (
            <>
              <button className="button button--primary button--small" type="button" onClick={() => onPay(bill)}>Pay</button>
              <button className="button button--ghost button--small" type="button" onClick={() => onMarkPaid(bill)}>Paid</button>
              <button className="button button--ghost button--small" type="button" onClick={() => onStartReschedule(bill)}>Move</button>
              <button className="button button--ghost button--small" type="button" onClick={() => onDrop(bill)}>Drop</button>
            </>
          ) : null}
          {!isOpen && bill.reconciliationStatus === "paid_without_expense" ? (
            <button className="button button--primary button--small" type="button" onClick={() => onPay(bill)}>Log expense</button>
          ) : null}
        </div>
      </div>

      {payingBillId === bill.id ? (
        <div className="fc-editor fc-editor--nested">
          <div className="fc-form-grid">
            <label className="field">
              <span>Paid on</span>
              <input type="date" value={paymentForm.paidOn} onChange={(event) => setPaymentForm((form) => ({ ...form, paidOn: event.target.value }))} />
            </label>
            <label className="field">
              <span>Amount</span>
              <input type="text" inputMode="decimal" value={paymentForm.amount} onChange={(event) => setPaymentForm((form) => ({ ...form, amount: event.target.value }))} />
            </label>
            <label className="field">
              <span>Category</span>
              <select value={paymentForm.categoryId} onChange={(event) => setPaymentForm((form) => ({ ...form, categoryId: event.target.value }))}>
                <option value="">None</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Account</span>
              <select value={paymentForm.accountId} onChange={(event) => setPaymentForm((form) => ({ ...form, accountId: event.target.value }))}>
                <option value="">Legacy only</option>
                {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </label>
            <label className="field fc-field--wide">
              <span>Description</span>
              <input type="text" value={paymentForm.description} onChange={(event) => setPaymentForm((form) => ({ ...form, description: event.target.value }))} />
            </label>
          </div>
          <button className="button button--primary button--small" type="button" disabled={isPaying} onClick={() => void onPayAndLog(bill)}>
            {isPaying ? "Saving..." : "Pay and log"}
          </button>
        </div>
      ) : null}

      {reschedulingBillId === bill.id ? (
        <div className="fc-inline-action">
          <input type="date" value={rescheduleDate} onChange={(event) => setRescheduleDate(event.target.value)} />
          <button className="button button--primary button--small" type="button" onClick={() => void onReschedule(bill.id)}>Save</button>
          <button className="button button--ghost button--small" type="button" onClick={onCancelReschedule}>Cancel</button>
        </div>
      ) : null}
    </div>
  );
}
