import { useId, type Dispatch, type SetStateAction } from "react";

import type { FinanceTransactionType } from "../../shared/lib/api";

type FinanceAccountOption = {
  id: string;
  name: string;
};

type FinanceCategoryOption = {
  id: string;
  name: string;
};

export type TransactionForm = {
  transactionType: FinanceTransactionType;
  accountId: string;
  transferAccountId: string;
  amount: string;
  occurredOn: string;
  description: string;
  expenseCategoryId: string;
};

export type BillForm = {
  title: string;
  dueOn: string;
  amount: string;
  categoryId: string;
};

export type LegacyExpenseForm = {
  amount: string;
  description: string;
  categoryId: string;
  spentOn: string;
};

export function FinanceTransactionEditor({
  accounts,
  categories,
  form,
  setForm,
  isSaving,
  onSave,
  onCancel,
}: {
  accounts: FinanceAccountOption[];
  categories: FinanceCategoryOption[];
  form: TransactionForm;
  setForm: Dispatch<SetStateAction<TransactionForm>>;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="fc-editor">
      <div className="fc-form-grid">
        <label className="field">
          <span>Type</span>
          <select value={form.transactionType} onChange={(event) => setForm((currentForm) => ({ ...currentForm, transactionType: event.target.value as FinanceTransactionType }))}>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="transfer">Transfer</option>
            <option value="adjustment">Adjustment</option>
          </select>
        </label>
        <label className="field">
          <span>Account</span>
          <select value={form.accountId} onChange={(event) => setForm((currentForm) => ({ ...currentForm, accountId: event.target.value }))}>
            <option value="">Select</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </label>
        {form.transactionType === "transfer" ? (
          <label className="field">
            <span>To</span>
            <select value={form.transferAccountId} onChange={(event) => setForm((currentForm) => ({ ...currentForm, transferAccountId: event.target.value }))}>
              <option value="">Select</option>
              {accounts
                .filter((account) => account.id !== form.accountId)
                .map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          </label>
        ) : null}
        <label className="field">
          <span>Amount</span>
          <input type="text" inputMode="decimal" value={form.amount} onChange={(event) => setForm((currentForm) => ({ ...currentForm, amount: event.target.value }))} />
        </label>
        <label className="field">
          <span>Date</span>
          <input type="date" value={form.occurredOn} onChange={(event) => setForm((currentForm) => ({ ...currentForm, occurredOn: event.target.value }))} />
        </label>
        <label className="field">
          <span>Category</span>
          <select value={form.expenseCategoryId} onChange={(event) => setForm((currentForm) => ({ ...currentForm, expenseCategoryId: event.target.value }))} disabled={form.transactionType !== "expense"}>
            <option value="">None</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label className="field fc-field--wide">
          <span>Description</span>
          <input type="text" value={form.description} onChange={(event) => setForm((currentForm) => ({ ...currentForm, description: event.target.value }))} />
        </label>
      </div>
      <div className="button-row">
        <button className="button button--primary button--small" type="button" disabled={isSaving} onClick={onSave}>
          {isSaving ? "Saving..." : "Save entry"}
        </button>
        <button className="button button--ghost button--small" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </section>
  );
}

export function FinanceBillEditor({
  categories,
  form,
  setForm,
  isSaving,
  onSave,
  onCancel,
  onManageCategories,
}: {
  categories: FinanceCategoryOption[];
  form: BillForm;
  setForm: Dispatch<SetStateAction<BillForm>>;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onManageCategories: () => void;
}) {
  const categoryLabelId = useId();

  return (
    <section className="fc-editor">
      <div className="fc-form-grid">
        <label className="field fc-field--wide">
          <span>Bill</span>
          <input type="text" value={form.title} onChange={(event) => setForm((currentForm) => ({ ...currentForm, title: event.target.value }))} />
        </label>
        <label className="field">
          <span>Due</span>
          <input type="date" value={form.dueOn} onChange={(event) => setForm((currentForm) => ({ ...currentForm, dueOn: event.target.value }))} />
        </label>
        <label className="field">
          <span>Amount</span>
          <input type="text" inputMode="decimal" value={form.amount} onChange={(event) => setForm((currentForm) => ({ ...currentForm, amount: event.target.value }))} />
        </label>
        <div className="field">
          <div className="field__split-label">
            <span id={categoryLabelId}>Category</span>
            <button type="button" onClick={onManageCategories}>Manage</button>
          </div>
          <select aria-labelledby={categoryLabelId} value={form.categoryId} onChange={(event) => setForm((currentForm) => ({ ...currentForm, categoryId: event.target.value }))}>
            <option value="">None</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </div>
      </div>
      <div className="button-row">
        <button className="button button--primary button--small" type="button" disabled={isSaving} onClick={onSave}>
          {isSaving ? "Saving..." : "Save bill"}
        </button>
        <button className="button button--ghost button--small" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </section>
  );
}

export function FinanceLegacyExpenseEditor({
  categories,
  form,
  setForm,
  isSaving,
  onSave,
}: {
  categories: FinanceCategoryOption[];
  form: LegacyExpenseForm;
  setForm: Dispatch<SetStateAction<LegacyExpenseForm>>;
  isSaving: boolean;
  onSave: () => void;
}) {
  return (
    <section className="fc-editor fc-editor--nested">
      <div className="fc-form-grid">
        <label className="field">
          <span>Amount</span>
          <input type="text" inputMode="decimal" value={form.amount} onChange={(event) => setForm((currentForm) => ({ ...currentForm, amount: event.target.value }))} />
        </label>
        <label className="field">
          <span>Date</span>
          <input type="date" value={form.spentOn} onChange={(event) => setForm((currentForm) => ({ ...currentForm, spentOn: event.target.value }))} />
        </label>
        <label className="field">
          <span>Category</span>
          <select value={form.categoryId} onChange={(event) => setForm((currentForm) => ({ ...currentForm, categoryId: event.target.value }))}>
            <option value="">None</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label className="field fc-field--wide">
          <span>Description</span>
          <input type="text" value={form.description} onChange={(event) => setForm((currentForm) => ({ ...currentForm, description: event.target.value }))} />
        </label>
      </div>
      <button className="button button--primary button--small" type="button" disabled={isSaving} onClick={onSave}>Save expense</button>
    </section>
  );
}
