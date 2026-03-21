import { useState } from "react";

import {
  formatDueLabel,
  formatMinorCurrency,
  formatMonthLabel,
  formatRelativeDate,
  getTodayDate,
  parseAmountToMinor,
  useCreateCategoryMutation,
  useCreateExpenseMutation,
  useCreateRecurringExpenseMutation,
  useDeleteExpenseMutation,
  useFinanceDataQuery,
  useUpdateCategoryMutation,
  useUpdateExpenseMutation,
  useUpdateRecurringExpenseMutation,
} from "../../shared/lib/api";
import {
  type RecurrenceRuleInput,
  formatFullRecurrenceSummary,
  isRecurring,
} from "../../shared/lib/recurrence";
import { PageHeader } from "../../shared/ui/PageHeader";
import {
  EmptyState,
  InlineErrorState,
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";
import { RecurrenceEditor, buildRecurrenceInput } from "../../shared/ui/RecurrenceEditor";
import { SectionCard } from "../../shared/ui/SectionCard";

type CategoryForm = { name: string; color: string };
type RecurringForm = {
  title: string;
  expenseCategoryId: string;
  defaultAmount: string;
  recurrenceRule: string;
  recurrenceInput: RecurrenceRuleInput | null;
  nextDueOn: string;
  remindDaysBefore: string;
};

type ExpenseForm = {
  amount: string;
  description: string;
  categoryId: string;
  spentOn: string;
};

const emptyCategory: CategoryForm = { name: "", color: "" };
const emptyRecurring: RecurringForm = {
  title: "",
  expenseCategoryId: "",
  defaultAmount: "",
  recurrenceRule: "monthly",
  recurrenceInput: null,
  nextDueOn: "",
  remindDaysBefore: "3",
};

export function FinancePage() {
  const today = getTodayDate();
  const financeQuery = useFinanceDataQuery(today);
  const createExpenseMutation = useCreateExpenseMutation(today);
  const updateExpenseMutation = useUpdateExpenseMutation(today);
  const deleteExpenseMutation = useDeleteExpenseMutation(today);
  const createCategoryMutation = useCreateCategoryMutation();
  const updateCategoryMutation = useUpdateCategoryMutation();
  const createRecurringMutation = useCreateRecurringExpenseMutation();
  const updateRecurringMutation = useUpdateRecurringExpenseMutation();

  // Expense form
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const emptyExpense: ExpenseForm = { amount: "", description: "", categoryId: "", spentOn: today };
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>(emptyExpense);

  // Expense editing
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editExpenseForm, setEditExpenseForm] = useState<ExpenseForm>(emptyExpense);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);

  // Category management
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catForm, setCatForm] = useState<CategoryForm>(emptyCategory);

  // Recurring management
  const [showRecForm, setShowRecForm] = useState(false);
  const [editingRecId, setEditingRecId] = useState<string | null>(null);
  const [recForm, setRecForm] = useState<RecurringForm>(emptyRecurring);

  if (financeQuery.isLoading && !financeQuery.data) {
    return (
      <PageLoadingState
        title="Loading finance"
        description="Pulling together spend totals, recent expenses, and recurring bills."
      />
    );
  }

  if (financeQuery.isError || !financeQuery.data) {
    return (
      <PageErrorState
        title="Finance could not load"
        message={financeQuery.error instanceof Error ? financeQuery.error.message : undefined}
        onRetry={() => void financeQuery.refetch()}
      />
    );
  }

  const summary = financeQuery.data.summary;
  const expenses = financeQuery.data.expenses?.expenses ?? [];
  const recurringExpenses = financeQuery.data.recurringExpenses?.recurringExpenses ?? [];
  const categories = financeQuery.data.categories?.categories ?? [];
  const activeCategories = categories.filter((c) => !c.archivedAt);
  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
  const topCategory = summary?.categoryTotals[0];

  // Expense creation
  async function handleAddExpense() {
    const amountMinor = parseAmountToMinor(expenseForm.amount);
    if (!amountMinor) return;

    await createExpenseMutation.mutateAsync({
      spentOn: expenseForm.spentOn || today,
      amountMinor,
      currencyCode: summary?.currencyCode ?? "USD",
      description: expenseForm.description || "Quick expense",
      expenseCategoryId: expenseForm.categoryId || null,
      source: "manual",
    });
    setExpenseForm(emptyExpense);
    setShowExpenseForm(false);
  }

  // Expense editing
  function openEditExpense(expense: typeof expenses[number]) {
    setEditingExpenseId(expense.id);
    setEditExpenseForm({
      amount: String(expense.amountMinor / 100),
      description: expense.description ?? "",
      categoryId: expense.expenseCategoryId ?? "",
      spentOn: expense.spentOn,
    });
    setDeletingExpenseId(null);
  }

  async function handleUpdateExpense(expenseId: string) {
    const amountMinor = parseAmountToMinor(editExpenseForm.amount);
    if (!amountMinor) return;

    await updateExpenseMutation.mutateAsync({
      expenseId,
      amountMinor,
      description: editExpenseForm.description || null,
      expenseCategoryId: editExpenseForm.categoryId || null,
      spentOn: editExpenseForm.spentOn,
    });
    setEditingExpenseId(null);
  }

  // Category CRUD
  function openCreateCategory() {
    setEditingCatId(null);
    setCatForm(emptyCategory);
    setShowCatForm(true);
  }

  function openEditCategory(cat: typeof categories[number]) {
    setEditingCatId(cat.id);
    setCatForm({ name: cat.name, color: cat.color ?? "" });
    setShowCatForm(true);
  }

  async function handleCategorySave() {
    if (!catForm.name.trim()) return;
    if (editingCatId) {
      await updateCategoryMutation.mutateAsync({
        categoryId: editingCatId,
        name: catForm.name.trim(),
        color: catForm.color || null,
      });
    } else {
      await createCategoryMutation.mutateAsync({
        name: catForm.name.trim(),
        color: catForm.color || null,
      });
    }
    setShowCatForm(false);
    setEditingCatId(null);
    setCatForm(emptyCategory);
  }

  async function handleCategoryArchive(catId: string, archived: boolean) {
    await updateCategoryMutation.mutateAsync({
      categoryId: catId,
      archivedAt: archived ? new Date().toISOString() : null,
    });
  }

  // Recurring CRUD
  function openCreateRecurring() {
    setEditingRecId(null);
    setRecForm(emptyRecurring);
    setShowRecForm(true);
  }

  function openEditRecurring(item: typeof recurringExpenses[number]) {
    setEditingRecId(item.id);
    setRecForm({
      title: item.title,
      expenseCategoryId: item.expenseCategoryId ?? "",
      defaultAmount: item.defaultAmountMinor ? String(item.defaultAmountMinor / 100) : "",
      recurrenceRule: item.recurrenceRule,
      recurrenceInput: item.recurrence?.rule ?? null,
      nextDueOn: item.nextDueOn,
      remindDaysBefore: String(item.remindDaysBefore),
    });
    setShowRecForm(true);
  }

  async function handleRecurringSave() {
    if (!recForm.title.trim() || !recForm.nextDueOn) return;
    const amountMinor = recForm.defaultAmount ? parseAmountToMinor(recForm.defaultAmount) : null;
    const recurrence = recForm.recurrenceInput
      ? buildRecurrenceInput(recForm.recurrenceInput)
      : undefined;
    if (editingRecId) {
      await updateRecurringMutation.mutateAsync({
        recurringExpenseId: editingRecId,
        title: recForm.title.trim(),
        expenseCategoryId: recForm.expenseCategoryId || null,
        defaultAmountMinor: amountMinor,
        recurrenceRule: recForm.recurrenceRule,
        recurrence,
        nextDueOn: recForm.nextDueOn,
        remindDaysBefore: Number(recForm.remindDaysBefore) || 3,
      });
    } else {
      await createRecurringMutation.mutateAsync({
        title: recForm.title.trim(),
        expenseCategoryId: recForm.expenseCategoryId || undefined,
        defaultAmountMinor: amountMinor,
        recurrenceRule: recForm.recurrenceRule,
        recurrence,
        nextDueOn: recForm.nextDueOn,
        remindDaysBefore: Number(recForm.remindDaysBefore) || 3,
      });
    }
    setShowRecForm(false);
    setEditingRecId(null);
    setRecForm(emptyRecurring);
  }

  async function handleRecurringStatusChange(id: string, status: "active" | "paused" | "archived") {
    await updateRecurringMutation.mutateAsync({ recurringExpenseId: id, status });
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Spending visibility"
        title="Finance"
        description="Fast expense entry, category breakdown, and upcoming bills at a glance."
      />

      <div className="dashboard-grid stagger">
        {/* ── Current period ── */}
        <SectionCard
          title="Current period"
          subtitle={formatMonthLabel(summary?.month ?? today.slice(0, 7))}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 400 }}>
                {formatMinorCurrency(summary?.totalSpentMinor ?? 0, summary?.currencyCode ?? "USD")}
              </span>
              <span className="list__subtle">this month</span>
            </div>
            <ul className="list">
              {[
                { label: "Top category", value: topCategory ? topCategory.name : "No spend yet" },
                { label: "Upcoming bills", value: String(summary?.upcomingBills.length ?? 0) },
              ].map((item) => (
                <li key={item.label}>
                  <strong>{item.label}</strong>
                  <span className="list__subtle">{item.value}</span>
                </li>
              ))}
            </ul>

            {/* Inline expense creation form */}
            {showExpenseForm ? (
              <div className="inline-editor">
                <div className="stack-form">
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <label className="field" style={{ flex: 1 }}>
                      <span>Amount</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={expenseForm.amount}
                        autoFocus
                        onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") void handleAddExpense(); if (e.key === "Escape") setShowExpenseForm(false); }}
                      />
                    </label>
                    <label className="field" style={{ flex: 1 }}>
                      <span>Date</span>
                      <input
                        type="date"
                        value={expenseForm.spentOn}
                        onChange={(e) => setExpenseForm((f) => ({ ...f, spentOn: e.target.value }))}
                      />
                    </label>
                  </div>
                  <label className="field">
                    <span>Description</span>
                    <input
                      type="text"
                      placeholder="What was it for?"
                      value={expenseForm.description}
                      onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") void handleAddExpense(); }}
                    />
                  </label>
                  <label className="field">
                    <span>Category</span>
                    <select
                      value={expenseForm.categoryId}
                      onChange={(e) => setExpenseForm((f) => ({ ...f, categoryId: e.target.value }))}
                    >
                      <option value="">Uncategorized</option>
                      {activeCategories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </label>
                  <div className="button-row button-row--tight">
                    <button className="button button--primary button--small" type="button" disabled={createExpenseMutation.isPending} onClick={() => void handleAddExpense()}>
                      {createExpenseMutation.isPending ? "Saving…" : "Add expense"}
                    </button>
                    <button className="button button--ghost button--small" type="button" onClick={() => setShowExpenseForm(false)}>Cancel</button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                className="button button--primary button--small"
                type="button"
                onClick={() => setShowExpenseForm(true)}
                style={{ alignSelf: "flex-start" }}
              >
                Add expense
              </button>
            )}
          </div>
        </SectionCard>

        {/* ── Categories ── */}
        <SectionCard title="Categories" subtitle="Manage expense categories">
          {financeQuery.data.sectionErrors.categories ? (
            <InlineErrorState
              message={financeQuery.data.sectionErrors.categories.message}
              onRetry={() => void financeQuery.refetch()}
            />
          ) : showCatForm ? (
            <div className="stack-form">
              <label className="field">
                <span>Name</span>
                <input
                  type="text"
                  value={catForm.name}
                  placeholder="Category name"
                  onChange={(e) => setCatForm((p) => ({ ...p, name: e.target.value }))}
                />
              </label>
              <label className="field">
                <span>Color (optional hex)</span>
                <input
                  type="text"
                  value={catForm.color}
                  placeholder="#d9993a"
                  maxLength={7}
                  onChange={(e) => setCatForm((p) => ({ ...p, color: e.target.value }))}
                />
              </label>
              <div className="button-row">
                <button className="button button--primary button--small" type="button" onClick={() => void handleCategorySave()} disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}>
                  {editingCatId ? "Update" : "Create"}
                </button>
                <button className="button button--ghost button--small" type="button" onClick={() => { setShowCatForm(false); setEditingCatId(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              {activeCategories.length > 0 ? (
                <div className="category-grid">
                  {activeCategories.map((cat) => (
                    <div key={cat.id} className="category-card category-card--interactive">
                      {cat.color && (
                        <span className="category-card__swatch" style={{ background: cat.color }} />
                      )}
                      <span className="category-card__label">{cat.name}</span>
                      <span className="category-card__amount">
                        {formatMinorCurrency(
                          summary.categoryTotals.find((ct) => ct.expenseCategoryId === cat.id)?.totalAmountMinor ?? 0,
                          summary.currencyCode ?? "USD",
                        )}
                      </span>
                      <div className="button-row button-row--tight" style={{ marginTop: "0.3rem", justifyContent: "center" }}>
                        <button className="button button--ghost button--small" type="button" onClick={() => openEditCategory(cat)}>Edit</button>
                        <button className="button button--ghost button--small" type="button" onClick={() => void handleCategoryArchive(cat.id, true)}>Archive</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No categories" description="Add your first expense category." />
              )}
              <button className="button button--ghost button--small" type="button" onClick={openCreateCategory} style={{ marginTop: "0.6rem" }}>
                Add category
              </button>
            </>
          )}
        </SectionCard>

        {/* ── Recent expenses with edit/delete ── */}
        <SectionCard title="Recent expenses" subtitle="Last 7 days">
          {financeQuery.data.sectionErrors.expenses ? (
            <InlineErrorState
              message={financeQuery.data.sectionErrors.expenses.message}
              onRetry={() => void financeQuery.refetch()}
            />
          ) : expenses.length > 0 ? (
            <div>
              {expenses
                .slice()
                .sort((left, right) => right.spentOn.localeCompare(left.spentOn))
                .slice(0, 10)
                .map((expense) => (
                  <div key={expense.id}>
                    <div className="log-row">
                      <div className="log-row__info">
                        <span className="log-row__primary">{expense.description ?? "Expense"}</span>
                        <span className="log-row__secondary">
                          {categoryNameById.get(expense.expenseCategoryId ?? "") ?? "Uncategorized"} · {formatRelativeDate(expense.spentOn)}
                        </span>
                      </div>
                      <span className="log-row__value">
                        {formatMinorCurrency(expense.amountMinor, expense.currencyCode)}
                      </span>
                      <div className="log-row__actions">
                        <button className="button button--ghost button--small" type="button" onClick={() => openEditExpense(expense)} aria-label="Edit expense">Edit</button>
                        <button className="button button--ghost button--small" type="button" onClick={() => { setDeletingExpenseId(expense.id); setEditingExpenseId(null); }} aria-label="Delete expense">Delete</button>
                      </div>
                    </div>

                    {/* Inline expense editor */}
                    {editingExpenseId === expense.id && (
                      <div className="inline-editor">
                        <div className="stack-form">
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <label className="field" style={{ flex: 1 }}>
                              <span>Amount</span>
                              <input type="text" inputMode="decimal" value={editExpenseForm.amount} autoFocus onChange={(e) => setEditExpenseForm((f) => ({ ...f, amount: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") void handleUpdateExpense(expense.id); if (e.key === "Escape") setEditingExpenseId(null); }} />
                            </label>
                            <label className="field" style={{ flex: 1 }}>
                              <span>Date</span>
                              <input type="date" value={editExpenseForm.spentOn} onChange={(e) => setEditExpenseForm((f) => ({ ...f, spentOn: e.target.value }))} />
                            </label>
                          </div>
                          <label className="field">
                            <span>Description</span>
                            <input type="text" value={editExpenseForm.description} onChange={(e) => setEditExpenseForm((f) => ({ ...f, description: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") void handleUpdateExpense(expense.id); }} />
                          </label>
                          <label className="field">
                            <span>Category</span>
                            <select value={editExpenseForm.categoryId} onChange={(e) => setEditExpenseForm((f) => ({ ...f, categoryId: e.target.value }))}>
                              <option value="">Uncategorized</option>
                              {activeCategories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                            </select>
                          </label>
                          <div className="button-row button-row--tight">
                            <button className="button button--primary button--small" type="button" disabled={updateExpenseMutation.isPending} onClick={() => void handleUpdateExpense(expense.id)}>
                              {updateExpenseMutation.isPending ? "Saving…" : "Save"}
                            </button>
                            <button className="button button--ghost button--small" type="button" onClick={() => setEditingExpenseId(null)}>Cancel</button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Delete confirmation */}
                    {deletingExpenseId === expense.id && (
                      <div className="confirm-bar">
                        <span className="confirm-bar__text">Delete &ldquo;{expense.description ?? "expense"}&rdquo;?</span>
                        <button className="button button--ghost button--small" type="button" disabled={deleteExpenseMutation.isPending} onClick={() => void deleteExpenseMutation.mutateAsync(expense.id).then(() => setDeletingExpenseId(null))}>
                          {deleteExpenseMutation.isPending ? "Deleting…" : "Confirm"}
                        </button>
                        <button className="button button--ghost button--small" type="button" onClick={() => setDeletingExpenseId(null)}>Cancel</button>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          ) : (
            <EmptyState title="No recent expenses" description="Recent expense history appears after the first log." />
          )}
        </SectionCard>

        {/* ── Recurring ── */}
        <SectionCard title="Recurring bills" subtitle="Manage recurring expenses">
          {financeQuery.data.sectionErrors.recurringExpenses ? (
            <InlineErrorState
              message={financeQuery.data.sectionErrors.recurringExpenses.message}
              onRetry={() => void financeQuery.refetch()}
            />
          ) : showRecForm ? (
            <div className="stack-form">
              <label className="field">
                <span>Title</span>
                <input type="text" value={recForm.title} placeholder="e.g. Rent, Spotify" onChange={(e) => setRecForm((p) => ({ ...p, title: e.target.value }))} />
              </label>
              <label className="field">
                <span>Category</span>
                <select value={recForm.expenseCategoryId} onChange={(e) => setRecForm((p) => ({ ...p, expenseCategoryId: e.target.value }))}>
                  <option value="">None</option>
                  {activeCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Default amount</span>
                <input type="text" value={recForm.defaultAmount} placeholder="0.00" onChange={(e) => setRecForm((p) => ({ ...p, defaultAmount: e.target.value }))} />
              </label>
              <div className="manage-form__section">
                <span className="manage-form__section-label">Recurrence</span>
                <RecurrenceEditor
                  value={recForm.recurrenceInput}
                  onChange={(rule) => setRecForm((p) => ({ ...p, recurrenceInput: rule }))}
                  context="finance"
                  startsOn={recForm.nextDueOn || today}
                />
              </div>
              <label className="field">
                <span>Next due date</span>
                <input type="date" value={recForm.nextDueOn} onChange={(e) => setRecForm((p) => ({ ...p, nextDueOn: e.target.value }))} />
              </label>
              <label className="field">
                <span>Remind days before</span>
                <input type="number" min={0} value={recForm.remindDaysBefore} onChange={(e) => setRecForm((p) => ({ ...p, remindDaysBefore: e.target.value }))} />
              </label>
              <div className="button-row">
                <button className="button button--primary button--small" type="button" onClick={() => void handleRecurringSave()} disabled={createRecurringMutation.isPending || updateRecurringMutation.isPending}>
                  {editingRecId ? "Update" : "Create"}
                </button>
                <button className="button button--ghost button--small" type="button" onClick={() => { setShowRecForm(false); setEditingRecId(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              {recurringExpenses.length > 0 ? (
                <div>
                  {recurringExpenses.map((item) => (
                    <div key={item.id} className="expense-row expense-row--interactive">
                      <div className="expense-row__info">
                        <div className="expense-row__title">{item.title}</div>
                        <div className="expense-row__meta">
                          {isRecurring(item.recurrence) ? (
                            <span className="expense-row__recurrence">
                              <span className="recurrence-badge recurrence-badge--compact" title={formatFullRecurrenceSummary(item.recurrence!.rule)}>↻</span>
                              {" "}{formatFullRecurrenceSummary(item.recurrence!.rule)}
                              {" · "}
                            </span>
                          ) : null}
                          Due in {formatDueLabel(item.nextDueOn)} &middot;{" "}
                          <span className={`tag ${item.status === "active" ? "tag--positive" : item.status === "paused" ? "tag--warning" : "tag--neutral"}`}>
                            {item.status}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span className="expense-row__amount">
                          {formatMinorCurrency(item.defaultAmountMinor, item.currencyCode)}
                        </span>
                        <button className="button button--ghost button--small" type="button" onClick={() => openEditRecurring(item)}>Edit</button>
                        {item.status === "active" ? (
                          <button className="button button--ghost button--small" type="button" onClick={() => void handleRecurringStatusChange(item.id, "paused")}>Pause</button>
                        ) : item.status === "paused" ? (
                          <button className="button button--ghost button--small" type="button" onClick={() => void handleRecurringStatusChange(item.id, "active")}>Resume</button>
                        ) : null}
                        {item.status !== "archived" && (
                          <button className="button button--ghost button--small" type="button" onClick={() => void handleRecurringStatusChange(item.id, "archived")}>Archive</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No recurring bills" description="Recurring expense templates have not been set up yet." />
              )}
              <button className="button button--ghost button--small" type="button" onClick={openCreateRecurring} style={{ marginTop: "0.5rem" }}>
                Add recurring bill
              </button>
            </>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
