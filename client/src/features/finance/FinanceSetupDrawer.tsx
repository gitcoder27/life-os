import { useId, type Dispatch, type RefObject, type SetStateAction } from "react";

import { formatMinorCurrency } from "../../shared/lib/api";
import {
  IncomePlanList,
  SetupAccountList,
  SetupBlock,
  SetupCardList,
  SetupCategoryList,
  SetupLoanList,
  SetupRecurringBillList,
} from "./FinanceSetupPanels";

export type SetupTab = "accounts" | "income" | "cards" | "loans" | "categories" | "recurring";

export type AccountForm = {
  name: string;
  accountType: "bank" | "cash" | "wallet" | "other";
  openingBalance: string;
};

export type IncomeForm = {
  title: string;
  accountId: string;
  amount: string;
  nextExpectedOn: string;
};

export type CategoryForm = {
  name: string;
  color: string;
};

export type RecurringBillForm = {
  title: string;
  amount: string;
  categoryId: string;
  nextDueOn: string;
};

export type CreditCardForm = {
  name: string;
  issuer: string;
  paymentAccountId: string;
  creditLimit: string;
  outstandingBalance: string;
  minimumDue: string;
  paymentDueDay: string;
};

export type LoanForm = {
  name: string;
  lender: string;
  paymentAccountId: string;
  principalAmount: string;
  outstandingBalance: string;
  emiAmount: string;
  dueDay: string;
};

type SetupNavItem = {
  key: SetupTab;
  label: string;
  count: number;
};

type FinanceAccountOption = {
  id: string;
  name: string;
};

type FinanceCategoryOption = {
  id: string;
  name: string;
  color: string | null;
};

type FinanceAccountListItem = FinanceAccountOption & {
  accountType: string;
  currentBalanceMinor: number;
  archivedAt: string | null;
};

type RecurringIncomeItem = {
  id: string;
  accountId: string;
  title: string;
  amountMinor: number;
  currencyCode: string;
  nextExpectedOn: string;
  status: "active" | "paused" | "archived";
};

type CreditCardItem = {
  id: string;
  name: string;
  issuer: string | null;
  paymentAccountId: string | null;
  outstandingBalanceMinor: number;
  creditLimitMinor: number;
  minimumDueMinor: number | null;
  paymentDueDay: number | null;
  utilizationPercent: number;
};

type LoanItem = {
  id: string;
  name: string;
  lender: string | null;
  paymentAccountId: string | null;
  outstandingBalanceMinor: number;
  emiAmountMinor: number;
  dueDay: number | null;
  progressPercent: number;
};

type RecurringBillItem = {
  id: string;
  title: string;
  expenseCategoryId: string | null;
  defaultAmountMinor: number | null;
  recurrence: Parameters<typeof SetupRecurringBillList>[0]["recurringBills"][number]["recurrence"];
  nextDueOn: string;
  status: "active" | "paused" | "archived";
};

export function FinanceSetupDrawer({
  activeAccounts,
  activeCategories,
  activeCreditCards,
  activeLoans,
  accountForm,
  accountMap,
  accounts,
  categoryForm,
  categoryMap,
  closeButtonRef,
  creditCardForm,
  currency,
  drawerRef,
  incomeForm,
  incomePlans,
  isCreatingAccount,
  isCreatingCategory,
  isCreatingCreditCard,
  isCreatingIncome,
  isCreatingLoan,
  isCreatingRecurringBill,
  isReceivingIncome,
  isUndoingIncome,
  isUpdatingAccount,
  isUpdatingCategory,
  isUpdatingCreditCard,
  isUpdatingIncome,
  isUpdatingLoan,
  isUpdatingRecurringBill,
  loanForm,
  onArchiveAccount,
  onArchiveCard,
  onArchiveCategory,
  onArchiveIncome,
  onArchiveLoan,
  onArchiveRecurringBill,
  onClose,
  onCreateAccount,
  onCreateCategory,
  onCreateCreditCard,
  onCreateIncome,
  onCreateLoan,
  onCreateRecurringBill,
  onMarkIncomeReceived,
  onPauseIncome,
  onRestoreAccount,
  onToggleRecurringBill,
  onUndoIncomeReceipt,
  plannedIncomeMinor,
  recurringBillForm,
  setupNavItems,
  setupTab,
  setAccountForm,
  setCategoryForm,
  setCreditCardForm,
  setIncomeForm,
  setLoanForm,
  setRecurringBillForm,
  setSetupTab,
  totalCashMinor,
  visibleRecurringBills,
}: {
  activeAccounts: FinanceAccountOption[];
  activeCategories: FinanceCategoryOption[];
  activeCreditCards: CreditCardItem[];
  activeLoans: LoanItem[];
  accountForm: AccountForm;
  accountMap: Map<string, { name: string }>;
  accounts: FinanceAccountListItem[];
  categoryForm: CategoryForm;
  categoryMap: Map<string, { name: string }>;
  closeButtonRef: RefObject<HTMLButtonElement>;
  creditCardForm: CreditCardForm;
  currency: string;
  drawerRef: RefObject<HTMLElement>;
  incomeForm: IncomeForm;
  incomePlans: RecurringIncomeItem[];
  isCreatingAccount: boolean;
  isCreatingCategory: boolean;
  isCreatingCreditCard: boolean;
  isCreatingIncome: boolean;
  isCreatingLoan: boolean;
  isCreatingRecurringBill: boolean;
  isReceivingIncome: boolean;
  isUndoingIncome: boolean;
  isUpdatingAccount: boolean;
  isUpdatingCategory: boolean;
  isUpdatingCreditCard: boolean;
  isUpdatingIncome: boolean;
  isUpdatingLoan: boolean;
  isUpdatingRecurringBill: boolean;
  loanForm: LoanForm;
  onArchiveAccount: (accountId: string) => void;
  onArchiveCard: (cardId: string) => void;
  onArchiveCategory: (categoryId: string) => void;
  onArchiveIncome: (incomeId: string) => void;
  onArchiveLoan: (loanId: string) => void;
  onArchiveRecurringBill: (recurringExpenseId: string) => void;
  onClose: () => void;
  onCreateAccount: () => void;
  onCreateCategory: () => void;
  onCreateCreditCard: () => void;
  onCreateIncome: () => void;
  onCreateLoan: () => void;
  onCreateRecurringBill: () => void;
  onMarkIncomeReceived: (income: { id: string; accountId: string; amountMinor: number; currencyCode?: string; title: string }) => void;
  onPauseIncome: (incomeId: string) => void;
  onRestoreAccount: (accountId: string) => void;
  onToggleRecurringBill: (item: { id: string; status: "active" | "paused" | "archived" }) => void;
  onUndoIncomeReceipt: (incomeId: string) => void;
  plannedIncomeMinor: number;
  recurringBillForm: RecurringBillForm;
  setupNavItems: SetupNavItem[];
  setupTab: SetupTab;
  setAccountForm: Dispatch<SetStateAction<AccountForm>>;
  setCategoryForm: Dispatch<SetStateAction<CategoryForm>>;
  setCreditCardForm: Dispatch<SetStateAction<CreditCardForm>>;
  setIncomeForm: Dispatch<SetStateAction<IncomeForm>>;
  setLoanForm: Dispatch<SetStateAction<LoanForm>>;
  setRecurringBillForm: Dispatch<SetStateAction<RecurringBillForm>>;
  setSetupTab: Dispatch<SetStateAction<SetupTab>>;
  totalCashMinor: number;
  visibleRecurringBills: RecurringBillItem[];
}) {
  const recurringCategoryLabelId = useId();

  return (
    <div className="setup-drawer__backdrop" onClick={onClose}>
      <aside
        ref={drawerRef}
        className="setup-drawer setup-drawer--money"
        role="dialog"
        aria-modal="true"
        aria-labelledby="finance-setup-drawer-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="setup-drawer__header">
          <h2 className="setup-drawer__title" id="finance-setup-drawer-title">Money setup</h2>
          <button ref={closeButtonRef} className="button button--ghost button--small" type="button" onClick={onClose}>Close</button>
        </div>
        <div className="setup-drawer__tabs">
          {setupNavItems.map((item) => (
            <button key={item.key} className={`feed__tab${setupTab === item.key ? " feed__tab--active" : ""}`} type="button" onClick={() => setSetupTab(item.key)}>
              {item.label}
              <span>{item.count}</span>
            </button>
          ))}
        </div>
        <div className="setup-drawer__content">
          {setupTab === "accounts" ? (
            <div className="stack-form">
              <SetupBlock title="Add account" meta={`${activeAccounts.length} active`}>
                <div className="setup-drawer__form-grid">
                  <label className="field">
                    <span>Name</span>
                    <input type="text" value={accountForm.name} onChange={(event) => setAccountForm((form) => ({ ...form, name: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Type</span>
                    <select value={accountForm.accountType} onChange={(event) => setAccountForm((form) => ({ ...form, accountType: event.target.value as AccountForm["accountType"] }))}>
                      <option value="bank">Bank</option>
                      <option value="cash">Cash</option>
                      <option value="wallet">Wallet</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Opening balance</span>
                    <input type="text" inputMode="decimal" value={accountForm.openingBalance} onChange={(event) => setAccountForm((form) => ({ ...form, openingBalance: event.target.value }))} />
                  </label>
                </div>
                <button className="button button--primary button--small" type="button" disabled={isCreatingAccount} onClick={onCreateAccount}>Add account</button>
              </SetupBlock>
              <SetupBlock title="Accounts" meta={formatMinorCurrency(totalCashMinor, currency)}>
                <SetupAccountList
                  accounts={accounts}
                  currency={currency}
                  isUpdating={isUpdatingAccount}
                  onArchive={onArchiveAccount}
                  onRestore={onRestoreAccount}
                />
              </SetupBlock>
            </div>
          ) : null}

          {setupTab === "income" ? (
            <div className="stack-form">
              <SetupBlock title="Add income" meta={formatMinorCurrency(plannedIncomeMinor, currency)}>
                <div className="setup-drawer__form-grid">
                  <label className="field">
                    <span>Income</span>
                    <input type="text" value={incomeForm.title} onChange={(event) => setIncomeForm((form) => ({ ...form, title: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Account</span>
                    <select value={incomeForm.accountId} onChange={(event) => setIncomeForm((form) => ({ ...form, accountId: event.target.value }))}>
                      <option value="">Select</option>
                      {activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span>Amount</span>
                    <input type="text" inputMode="decimal" value={incomeForm.amount} onChange={(event) => setIncomeForm((form) => ({ ...form, amount: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Next date</span>
                    <input type="date" value={incomeForm.nextExpectedOn} onChange={(event) => setIncomeForm((form) => ({ ...form, nextExpectedOn: event.target.value }))} />
                  </label>
                </div>
                <button className="button button--primary button--small" type="button" disabled={isCreatingIncome} onClick={onCreateIncome}>Add income</button>
              </SetupBlock>
              <SetupBlock title="Income plans" meta={`${incomePlans.filter((income) => income.status !== "archived").length} saved`}>
                <IncomePlanList
                  incomePlans={incomePlans}
                  currency={currency}
                  accountMap={accountMap}
                  onMarkReceived={onMarkIncomeReceived}
                  onUndoReceipt={onUndoIncomeReceipt}
                  onPause={onPauseIncome}
                  onArchive={onArchiveIncome}
                  isUpdating={isUpdatingIncome}
                  isReceiving={isReceivingIncome}
                  isUndoing={isUndoingIncome}
                />
              </SetupBlock>
            </div>
          ) : null}

          {setupTab === "cards" ? (
            <div className="stack-form">
              <SetupBlock title="Add card" meta={`${activeCreditCards.length} active`}>
                <div className="setup-drawer__form-grid">
                  <label className="field">
                    <span>Card</span>
                    <input type="text" value={creditCardForm.name} onChange={(event) => setCreditCardForm((form) => ({ ...form, name: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Issuer</span>
                    <input type="text" value={creditCardForm.issuer} onChange={(event) => setCreditCardForm((form) => ({ ...form, issuer: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Pay from</span>
                    <select value={creditCardForm.paymentAccountId} onChange={(event) => setCreditCardForm((form) => ({ ...form, paymentAccountId: event.target.value }))}>
                      <option value="">None</option>
                      {activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span>Limit</span>
                    <input type="text" inputMode="decimal" value={creditCardForm.creditLimit} onChange={(event) => setCreditCardForm((form) => ({ ...form, creditLimit: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Outstanding</span>
                    <input type="text" inputMode="decimal" value={creditCardForm.outstandingBalance} onChange={(event) => setCreditCardForm((form) => ({ ...form, outstandingBalance: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Minimum due</span>
                    <input type="text" inputMode="decimal" value={creditCardForm.minimumDue} onChange={(event) => setCreditCardForm((form) => ({ ...form, minimumDue: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Due day</span>
                    <input type="number" min={1} max={31} value={creditCardForm.paymentDueDay} onChange={(event) => setCreditCardForm((form) => ({ ...form, paymentDueDay: event.target.value }))} />
                  </label>
                </div>
                <button className="button button--primary button--small" type="button" disabled={isCreatingCreditCard} onClick={onCreateCreditCard}>Add card</button>
              </SetupBlock>
              <SetupBlock title="Cards" meta={formatMinorCurrency(activeCreditCards.reduce((sum, card) => sum + card.outstandingBalanceMinor, 0), currency)}>
                <SetupCardList
                  cards={activeCreditCards}
                  currency={currency}
                  accountMap={accountMap}
                  isUpdating={isUpdatingCreditCard}
                  onArchive={onArchiveCard}
                />
              </SetupBlock>
            </div>
          ) : null}

          {setupTab === "loans" ? (
            <div className="stack-form">
              <SetupBlock title="Add loan" meta={`${activeLoans.length} active`}>
                <div className="setup-drawer__form-grid">
                  <label className="field">
                    <span>Loan</span>
                    <input type="text" value={loanForm.name} onChange={(event) => setLoanForm((form) => ({ ...form, name: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Lender</span>
                    <input type="text" value={loanForm.lender} onChange={(event) => setLoanForm((form) => ({ ...form, lender: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Pay from</span>
                    <select value={loanForm.paymentAccountId} onChange={(event) => setLoanForm((form) => ({ ...form, paymentAccountId: event.target.value }))}>
                      <option value="">None</option>
                      {activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span>Principal</span>
                    <input type="text" inputMode="decimal" value={loanForm.principalAmount} onChange={(event) => setLoanForm((form) => ({ ...form, principalAmount: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Outstanding</span>
                    <input type="text" inputMode="decimal" value={loanForm.outstandingBalance} onChange={(event) => setLoanForm((form) => ({ ...form, outstandingBalance: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>EMI</span>
                    <input type="text" inputMode="decimal" value={loanForm.emiAmount} onChange={(event) => setLoanForm((form) => ({ ...form, emiAmount: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Due day</span>
                    <input type="number" min={1} max={31} value={loanForm.dueDay} onChange={(event) => setLoanForm((form) => ({ ...form, dueDay: event.target.value }))} />
                  </label>
                </div>
                <button className="button button--primary button--small" type="button" disabled={isCreatingLoan} onClick={onCreateLoan}>Add loan</button>
              </SetupBlock>
              <SetupBlock title="Loans" meta={formatMinorCurrency(activeLoans.reduce((sum, loan) => sum + loan.outstandingBalanceMinor, 0), currency)}>
                <SetupLoanList
                  loans={activeLoans}
                  currency={currency}
                  accountMap={accountMap}
                  isUpdating={isUpdatingLoan}
                  onArchive={onArchiveLoan}
                />
              </SetupBlock>
            </div>
          ) : null}

          {setupTab === "categories" ? (
            <div className="stack-form">
              <SetupBlock title="Add category" meta={`${activeCategories.length} active`}>
                <div className="setup-drawer__form-grid setup-drawer__form-grid--compact">
                  <label className="field">
                    <span>Name</span>
                    <input type="text" value={categoryForm.name} onChange={(event) => setCategoryForm((form) => ({ ...form, name: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Color</span>
                    <input type="text" value={categoryForm.color} onChange={(event) => setCategoryForm((form) => ({ ...form, color: event.target.value }))} />
                  </label>
                </div>
                <button className="button button--primary button--small" type="button" disabled={isCreatingCategory} onClick={onCreateCategory}>Add category</button>
              </SetupBlock>
              <SetupBlock title="Categories" meta="For bills and expenses">
                <SetupCategoryList
                  categories={activeCategories}
                  isUpdating={isUpdatingCategory}
                  onArchive={onArchiveCategory}
                />
              </SetupBlock>
            </div>
          ) : null}

          {setupTab === "recurring" ? (
            <div className="stack-form">
              <SetupBlock title="Add recurring bill" meta={`${visibleRecurringBills.length} saved`}>
                <div className="setup-drawer__form-grid">
                  <label className="field">
                    <span>Bill</span>
                    <input type="text" value={recurringBillForm.title} onChange={(event) => setRecurringBillForm((form) => ({ ...form, title: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Amount</span>
                    <input type="text" inputMode="decimal" value={recurringBillForm.amount} onChange={(event) => setRecurringBillForm((form) => ({ ...form, amount: event.target.value }))} />
                  </label>
                  <div className="field">
                    <div className="field__split-label">
                      <span id={recurringCategoryLabelId}>Category</span>
                      <button type="button" onClick={() => setSetupTab("categories")}>Manage</button>
                    </div>
                    <select aria-labelledby={recurringCategoryLabelId} value={recurringBillForm.categoryId} onChange={(event) => setRecurringBillForm((form) => ({ ...form, categoryId: event.target.value }))}>
                      <option value="">None</option>
                      {activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                  </div>
                  <label className="field">
                    <span>Next due</span>
                    <input type="date" value={recurringBillForm.nextDueOn} onChange={(event) => setRecurringBillForm((form) => ({ ...form, nextDueOn: event.target.value }))} />
                  </label>
                </div>
                <button className="button button--primary button--small" type="button" disabled={isCreatingRecurringBill} onClick={onCreateRecurringBill}>Add recurring bill</button>
              </SetupBlock>
              <SetupBlock title="Recurring bills" meta={formatMinorCurrency(visibleRecurringBills.reduce((sum, item) => sum + (item.defaultAmountMinor ?? 0), 0), currency)}>
                <SetupRecurringBillList
                  recurringBills={visibleRecurringBills}
                  currency={currency}
                  categoryMap={categoryMap}
                  isUpdating={isUpdatingRecurringBill}
                  onToggle={onToggleRecurringBill}
                  onArchive={onArchiveRecurringBill}
                />
              </SetupBlock>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
