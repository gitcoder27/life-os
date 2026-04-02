import { useMemo, useState } from "react";

import {
  daysUntil,
  formatDueLabel,
  formatMinorCurrency,
  formatMonthLabel,
  formatRelativeDate,
  formatShortDate,
  getMonthString,
  getTodayDate,
  parseAmountToMinor,
  useCreateCategoryMutation,
  useCreateExpenseMutation,
  useCreateRecurringExpenseMutation,
  useDeleteExpenseMutation,
  useFinanceDataQuery,
  useUpdateAdminItemMutation,
  useUpdateCategoryMutation,
  useUpdateExpenseMutation,
  useUpdateRecurringExpenseMutation,
} from "../../shared/lib/api";
import {
  formatLegacyFinanceRecurrenceRule,
  type RecurrenceRuleInput,
  formatFullRecurrenceSummary,
  getDefaultRecurrenceRule,
  isRecurring,
  parseLegacyFinanceRecurrenceRule,
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
  recurringExpenseTemplateId: string;
};

type ActivityFilter = "all" | "uncategorized" | "recurring" | "today";

type FinanceBill = {
  id: string;
  title: string;
  dueOn: string;
  amountMinor: number | null;
  status: "pending" | "done" | "rescheduled" | "dropped";
  recurringExpenseTemplateId: string | null;
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

function navigateMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function FinancePage() {
  const today = getTodayDate();
  const currentMonth = getMonthString(today);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const isCurrentMonth = selectedMonth === currentMonth;

  const financeQuery = useFinanceDataQuery(selectedMonth);
  const createExpenseMutation = useCreateExpenseMutation(today);
  const updateExpenseMutation = useUpdateExpenseMutation(today);
  const deleteExpenseMutation = useDeleteExpenseMutation(today);
  const updateAdminItemMutation = useUpdateAdminItemMutation(today);
  const createCategoryMutation = useCreateCategoryMutation();
  const updateCategoryMutation = useUpdateCategoryMutation();
  const createRecurringMutation = useCreateRecurringExpenseMutation();
  const updateRecurringMutation = useUpdateRecurringExpenseMutation();

  // Expense form
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const emptyExpense: ExpenseForm = {
    amount: "",
    description: "",
    categoryId: "",
    spentOn: today,
    recurringExpenseTemplateId: "",
  };
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>(emptyExpense);

  // Expense editing
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editExpenseForm, setEditExpenseForm] = useState<ExpenseForm>(emptyExpense);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);

  // Activity filter
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");

  // Category management
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catForm, setCatForm] = useState<CategoryForm>(emptyCategory);

  // Recurring management
  const [showRecForm, setShowRecForm] = useState(false);
  const [editingRecId, setEditingRecId] = useState<string | null>(null);
  const [recForm, setRecForm] = useState<RecurringForm>(emptyRecurring);

  // Setup panel
  const [showSetup, setShowSetup] = useState(false);

  // Reschedule state
  const [reschedulingBillId, setReschedulingBillId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");

  const financeData = financeQuery.data;
  const summary = financeData?.summary;
  const expenses = financeData?.expenses?.expenses ?? [];
  const recurringExpenses = financeData?.recurringExpenses?.recurringExpenses ?? [];
  const categories = financeData?.categories?.categories ?? [];
  const activeCategories = categories.filter((c) => !c.archivedAt);
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const currency = summary?.currencyCode ?? "USD";

  // ── Derived data ──

  // Bills: overdue, due today, due this week, upcoming
  const pendingBills = (summary?.upcomingBills ?? [])
    .filter((item) => item.status === "pending")
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn));

  const overdueBills = pendingBills.filter((b) => daysUntil(b.dueOn) < 0);
  const todayBills = pendingBills.filter((b) => daysUntil(b.dueOn) === 0);
  const weekBills = pendingBills.filter((b) => { const d = daysUntil(b.dueOn); return d > 0 && d <= 7; });
  const dueBills = [...overdueBills, ...todayBills, ...weekBills];

  // Today's logged spending
  const todayExpenses = expenses.filter((e) => e.spentOn === today);
  const todaySpent = todayExpenses.reduce((sum, e) => sum + e.amountMinor, 0);

  // Uncategorized count
  const uncategorizedCount = expenses.filter((e) => !e.expenseCategoryId).length;

  // Month pace: what day of month, how far through
  const dayOfMonth = new Date(`${today}T12:00:00`).getDate();
  const daysInMonth = new Date(Number(selectedMonth.split("-")[0]), Number(selectedMonth.split("-")[1]), 0).getDate();
  const monthProgress = isCurrentMonth ? dayOfMonth / daysInMonth : 1;

  // Previous month comparison
  const prevTotal = summary?.previousMonthTotalSpentMinor ?? 0;
  const monthDelta = prevTotal > 0
    ? Math.round(((summary?.totalSpentMinor ?? 0) - prevTotal) / prevTotal * 100)
    : 0;

  // Expenses grouped by day (sorted newest first)
  const sortedExpenses = useMemo(() => {
    let filtered = [...expenses];
    if (activityFilter === "uncategorized") {
      filtered = filtered.filter((e) => !e.expenseCategoryId);
    } else if (activityFilter === "recurring") {
      filtered = filtered.filter((e) => e.recurringExpenseTemplateId);
    } else if (activityFilter === "today") {
      filtered = filtered.filter((e) => e.spentOn === today);
    }
    return filtered.sort((a, b) => b.spentOn.localeCompare(a.spentOn) || b.createdAt.localeCompare(a.createdAt));
  }, [expenses, activityFilter, today]);

  const expensesByDay = useMemo(() => {
    const groups = new Map<string, typeof sortedExpenses>();
    for (const exp of sortedExpenses) {
      const day = exp.spentOn;
      const existing = groups.get(day);
      if (existing) {
        existing.push(exp);
      } else {
        groups.set(day, [exp]);
      }
    }
    return Array.from(groups.entries());
  }, [sortedExpenses]);

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

  // ── Handlers ──

  async function handleAddExpense() {
    const amountMinor = parseAmountToMinor(expenseForm.amount);
    if (!amountMinor) return;
    await createExpenseMutation.mutateAsync({
      spentOn: expenseForm.spentOn || today,
      amountMinor,
      currencyCode: currency,
      description: expenseForm.description || "Quick expense",
      expenseCategoryId: expenseForm.categoryId || null,
      source: "manual",
      recurringExpenseTemplateId: expenseForm.recurringExpenseTemplateId || null,
    });
    setExpenseForm(emptyExpense);
    setShowExpenseForm(false);
  }

  function openEditExpense(expense: typeof expenses[number]) {
    setEditingExpenseId(expense.id);
    setEditExpenseForm({
      amount: String(expense.amountMinor / 100),
      description: expense.description ?? "",
      categoryId: expense.expenseCategoryId ?? "",
      spentOn: expense.spentOn,
      recurringExpenseTemplateId: expense.recurringExpenseTemplateId ?? "",
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

  async function handleBillPaid(bill: FinanceBill) {
    await updateAdminItemMutation.mutateAsync({ adminItemId: bill.id, status: "done" });
  }

  async function handleBillDrop(bill: FinanceBill) {
    await updateAdminItemMutation.mutateAsync({ adminItemId: bill.id, status: "dropped" });
  }

  function openExpenseFromBill(bill: FinanceBill) {
    const recurringTemplate = bill.recurringExpenseTemplateId
      ? recurringExpenses.find((item) => item.id === bill.recurringExpenseTemplateId)
      : null;

    setExpenseForm({
      amount: bill.amountMinor != null
        ? String(bill.amountMinor / 100)
        : recurringTemplate?.defaultAmountMinor
          ? String(recurringTemplate.defaultAmountMinor / 100)
          : "",
      description: bill.title,
      categoryId: recurringTemplate?.expenseCategoryId ?? "",
      spentOn: today,
      recurringExpenseTemplateId: bill.recurringExpenseTemplateId ?? "",
    });
    setShowExpenseForm(true);
  }

  async function handleBillReschedule(billId: string) {
    if (!rescheduleDate) return;
    await updateAdminItemMutation.mutateAsync({ adminItemId: billId, status: "rescheduled", dueOn: rescheduleDate });
    setReschedulingBillId(null);
    setRescheduleDate("");
  }

  async function handleQuickRecategorize(expenseId: string, expenseCategoryId: string) {
    await updateExpenseMutation.mutateAsync({
      expenseId,
      expenseCategoryId: expenseCategoryId || null,
    });
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
    await updateCategoryMutation.mutateAsync({ categoryId: catId, archived });
  }

  // Recurring CRUD
  function openCreateRecurring() {
    const defaultRule = getDefaultRecurrenceRule("finance", today);
    setEditingRecId(null);
    setRecForm({
      ...emptyRecurring,
      nextDueOn: today,
      recurrenceInput: defaultRule,
      recurrenceRule: formatLegacyFinanceRecurrenceRule(defaultRule),
    });
    setShowRecForm(true);
  }

  function openEditRecurring(item: typeof recurringExpenses[number]) {
    const recurrenceInput = item.recurrence?.rule
      ?? parseLegacyFinanceRecurrenceRule(item.recurrenceRule, item.nextDueOn)
      ?? getDefaultRecurrenceRule("finance", item.nextDueOn);
    const nextDueOn = recurrenceInput.startsOn;
    setEditingRecId(item.id);
    setRecForm({
      title: item.title,
      expenseCategoryId: item.expenseCategoryId ?? "",
      defaultAmount: item.defaultAmountMinor ? String(item.defaultAmountMinor / 100) : "",
      recurrenceRule: formatLegacyFinanceRecurrenceRule(recurrenceInput),
      recurrenceInput,
      nextDueOn,
      remindDaysBefore: String(item.remindDaysBefore),
    });
    setShowRecForm(true);
  }

  async function handleRecurringSave() {
    if (!recForm.title.trim() || !recForm.nextDueOn) return;
    const amountMinor = recForm.defaultAmount ? parseAmountToMinor(recForm.defaultAmount) : null;
    const recurrenceRuleInput = recForm.recurrenceInput
      ?? parseLegacyFinanceRecurrenceRule(recForm.recurrenceRule, recForm.nextDueOn)
      ?? getDefaultRecurrenceRule("finance", recForm.nextDueOn);
    const recurrence = buildRecurrenceInput(recurrenceRuleInput);
    const recurrenceRule = formatLegacyFinanceRecurrenceRule(recurrenceRuleInput);
    if (editingRecId) {
      await updateRecurringMutation.mutateAsync({
        recurringExpenseId: editingRecId,
        title: recForm.title.trim(),
        expenseCategoryId: recForm.expenseCategoryId || null,
        defaultAmountMinor: amountMinor,
        recurrenceRule,
        recurrence,
        nextDueOn: recurrenceRuleInput.startsOn,
        remindDaysBefore: Number(recForm.remindDaysBefore) || 3,
      });
    } else {
      await createRecurringMutation.mutateAsync({
        title: recForm.title.trim(),
        expenseCategoryId: recForm.expenseCategoryId || undefined,
        defaultAmountMinor: amountMinor,
        recurrenceRule,
        recurrence,
        nextDueOn: recurrenceRuleInput.startsOn,
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

  function getBillRowClass(bill: FinanceBill) {
    const d = daysUntil(bill.dueOn);
    if (d < 0) return "bill-row bill-row--overdue";
    if (d === 0) return "bill-row bill-row--today";
    return "bill-row";
  }

  function getBillDueText(bill: FinanceBill) {
    const d = daysUntil(bill.dueOn);
    if (d < 0) return `Overdue by ${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"}`;
    if (d === 0) return "Due today";
    return `Due ${formatShortDate(bill.dueOn)}`;
  }

  const pacePercent = Math.min(monthProgress * 100, 100);
  const spendPercent = summary && prevTotal > 0
    ? Math.min(((summary.totalSpentMinor ?? 0) / prevTotal) * 100, 120)
    : pacePercent;
  const paceClass = spendPercent > pacePercent * 1.15
    ? "rail-card__pace-fill--over"
    : spendPercent > pacePercent * 0.9
      ? "rail-card__pace-fill--warn"
      : "rail-card__pace-fill--ok";

  // ── Render ──

  return (
    <div className="finance">
      {/* ── Header + Month Nav ── */}
      <div className="finance__header">
        <PageHeader
          eyebrow="Money command"
          title="Finance"
          description="Bills, spending, and monthly awareness in one place."
        />
        <div className="finance__header-actions">
          <div className="month-nav">
            <button
              className="month-nav__btn"
              type="button"
              onClick={() => setSelectedMonth(navigateMonth(selectedMonth, -1))}
              aria-label="Previous month"
            >
              ‹
            </button>
            <span
              className="month-nav__label"
              onClick={() => setSelectedMonth(currentMonth)}
              title="Return to current month"
            >
              {formatMonthLabel(selectedMonth)}
            </span>
            <button
              className="month-nav__btn"
              type="button"
              onClick={() => setSelectedMonth(navigateMonth(selectedMonth, 1))}
              disabled={selectedMonth >= currentMonth}
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          <button
            className="button button--primary button--small"
            type="button"
            onClick={() => setShowExpenseForm(true)}
          >
            Log expense
          </button>
        </div>
      </div>

      {/* ── Money Now Status Strip ── */}
      <div className="money-now">
        <div className={`money-now__cell${todaySpent > 0 ? " money-now__cell--positive" : ""}`}>
          <span className="money-now__label">Logged today</span>
          <span className={`money-now__value${todaySpent > 0 ? " money-now__value--positive" : ""}`}>
            {todaySpent > 0 ? formatMinorCurrency(todaySpent, currency) : "Nothing yet"}
          </span>
          <span className="money-now__detail">
            {todayExpenses.length} expense{todayExpenses.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className={`money-now__cell${overdueBills.length > 0 ? " money-now__cell--alert" : todayBills.length > 0 ? " money-now__cell--accent" : ""}`}>
          <span className="money-now__label">Bills due</span>
          <span className={`money-now__value${overdueBills.length > 0 ? " money-now__value--negative" : ""}`}>
            {overdueBills.length > 0
              ? `${overdueBills.length} overdue`
              : todayBills.length > 0
                ? `${todayBills.length} today`
                : dueBills.length > 0
                  ? `${dueBills.length} this week`
                  : "All clear"}
          </span>
          <span className="money-now__detail">
            {pendingBills.length} pending total
          </span>
        </div>

        <div className="money-now__cell money-now__cell--accent">
          <span className="money-now__label">Month pace</span>
          <span className="money-now__value">
            {formatMinorCurrency(summary?.totalSpentMinor ?? 0, currency)}
          </span>
          <span className="money-now__detail">
            {isCurrentMonth ? `Day ${dayOfMonth} of ${daysInMonth}` : formatMonthLabel(selectedMonth)}
          </span>
        </div>

        {uncategorizedCount > 0 ? (
          <div className="money-now__cell money-now__cell--accent">
            <span className="money-now__label">Needs review</span>
            <span className="money-now__value money-now__value--accent">{uncategorizedCount}</span>
            <span className="money-now__detail">uncategorized expense{uncategorizedCount !== 1 ? "s" : ""}</span>
          </div>
        ) : (
          <div className="money-now__cell">
            <span className="money-now__label">Categories</span>
            <span className="money-now__value">{activeCategories.length}</span>
            <span className="money-now__detail">
              {summary?.categoryTotals[0] ? `Top: ${summary.categoryTotals[0].name}` : "No spend yet"}
            </span>
          </div>
        )}
      </div>

      {/* ── Inline Expense Form (appears below strip) ── */}
      {showExpenseForm && (
        <div className="inline-editor" style={{ animation: "slideUp 0.25s var(--ease) both" }}>
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
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <label className="field" style={{ flex: 2 }}>
                <span>Description</span>
                <input
                  type="text"
                  placeholder="What was it for?"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleAddExpense(); }}
                />
              </label>
              <label className="field" style={{ flex: 1 }}>
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
            </div>
            <div className="button-row button-row--tight">
              <button className="button button--primary button--small" type="button" disabled={createExpenseMutation.isPending} onClick={() => void handleAddExpense()}>
                {createExpenseMutation.isPending ? "Saving..." : "Add expense"}
              </button>
              <button className="button button--ghost button--small" type="button" onClick={() => setShowExpenseForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Body: Action Column + Insight Rail ── */}
      <div className="finance__body">
        <div className="finance__main">

          {/* ── Due Now ── */}
          {dueBills.length > 0 && (
            <div className="due-now">
              <div className="due-now__header">
                <span className="section-label">Due now</span>
                <span className="due-now__count">{dueBills.length}</span>
              </div>
              <div className="due-now__list">
                {dueBills.map((bill) => (
                  <div key={bill.id}>
                    <div className={getBillRowClass(bill)}>
                      <span className="bill-row__indicator" />
                      <div className="bill-row__info">
                        <span className="bill-row__title">{bill.title}</span>
                        <span className="bill-row__due">{getBillDueText(bill)}</span>
                      </div>
                      {bill.amountMinor != null && (
                        <span className="bill-row__amount">
                          {formatMinorCurrency(bill.amountMinor, currency)}
                        </span>
                      )}
                      <div className="bill-row__actions">
                        <button
                          className="button button--primary button--small"
                          type="button"
                          disabled={updateAdminItemMutation.isPending}
                          onClick={() => void handleBillPaid(bill)}
                        >
                          Paid
                        </button>
                        {reschedulingBillId === bill.id ? (
                          <div className="reschedule-input">
                            <input
                              type="date"
                              value={rescheduleDate}
                              onChange={(e) => setRescheduleDate(e.target.value)}
                              autoFocus
                              style={{ fontSize: "var(--fs-micro)", padding: "0.2rem 0.4rem" }}
                              onKeyDown={(e) => { if (e.key === "Enter") void handleBillReschedule(bill.id); if (e.key === "Escape") setReschedulingBillId(null); }}
                            />
                            <button className="button button--ghost button--small" type="button" onClick={() => void handleBillReschedule(bill.id)}>Go</button>
                            <button className="button button--ghost button--small" type="button" onClick={() => setReschedulingBillId(null)}>x</button>
                          </div>
                        ) : (
                          <button
                            className="button button--ghost button--small"
                            type="button"
                            onClick={() => { setReschedulingBillId(bill.id); setRescheduleDate(""); }}
                          >
                            Reschedule
                          </button>
                        )}
                        <button
                          className="button button--ghost button--small"
                          type="button"
                          onClick={() => openExpenseFromBill(bill)}
                        >
                          Log expense
                        </button>
                        <button
                          className="button button--ghost button--small"
                          type="button"
                          onClick={() => void handleBillDrop(bill)}
                        >
                          Drop
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Recent Activity Feed ── */}
          <div className="activity-feed">
            <div className="activity-feed__header">
              <span className="section-label">Activity</span>
              <div className="activity-feed__filters">
                {(["all", "today", "uncategorized", "recurring"] as const).map((f) => (
                  <button
                    key={f}
                    className={`activity-feed__filter${activityFilter === f ? " activity-feed__filter--active" : ""}`}
                    type="button"
                    onClick={() => setActivityFilter(f)}
                  >
                    {f === "all" ? "All" : f === "today" ? "Today" : f === "uncategorized" ? "Uncategorized" : "Recurring"}
                  </button>
                ))}
              </div>
            </div>

            {financeQuery.data.sectionErrors.expenses ? (
              <InlineErrorState
                message={financeQuery.data.sectionErrors.expenses.message}
                onRetry={() => void financeQuery.refetch()}
              />
            ) : sortedExpenses.length > 0 ? (
              <>
                {expensesByDay.map(([day, dayExpenses]) => (
                  <div key={day} className="activity-feed__day-group">
                    <div className="activity-feed__day-label">{formatRelativeDate(day)}</div>
                    {dayExpenses.map((expense) => (
                      <div key={expense.id}>
                        <div className="activity-row">
                          <span
                            className="activity-row__category-dot"
                            style={{
                              background: expense.expenseCategoryId
                                ? (categoryMap.get(expense.expenseCategoryId)?.color ?? "var(--text-tertiary)")
                                : "var(--text-tertiary)",
                            }}
                          />
                          <div className="activity-row__info">
                            <span className="activity-row__title">{expense.description ?? "Expense"}</span>
                            <span className="activity-row__category">
                              {expense.expenseCategoryId
                                ? (categoryMap.get(expense.expenseCategoryId)?.name ?? "Unknown")
                                : "Uncategorized"}
                            </span>
                          </div>
                          <span className="activity-row__amount">
                            {formatMinorCurrency(expense.amountMinor, expense.currencyCode)}
                          </span>
                          <label className="activity-row__category-editor">
                            <select
                              value={expense.expenseCategoryId ?? ""}
                              onChange={(e) => void handleQuickRecategorize(expense.id, e.target.value)}
                              aria-label={`Category for ${expense.description ?? "expense"}`}
                            >
                              <option value="">Uncategorized</option>
                              {activeCategories.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </label>
                          <div className="activity-row__actions">
                            <button className="button button--ghost button--small" type="button" onClick={() => openEditExpense(expense)} aria-label="Edit">Edit</button>
                            <button className="button button--ghost button--small" type="button" onClick={() => { setDeletingExpenseId(expense.id); setEditingExpenseId(null); }} aria-label="Delete">Del</button>
                          </div>
                        </div>

                        {/* Inline editor */}
                        {editingExpenseId === expense.id && (
                          <div className="inline-editor" style={{ marginLeft: "1.5rem" }}>
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
                              <div style={{ display: "flex", gap: "0.5rem" }}>
                                <label className="field" style={{ flex: 2 }}>
                                  <span>Description</span>
                                  <input type="text" value={editExpenseForm.description} onChange={(e) => setEditExpenseForm((f) => ({ ...f, description: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") void handleUpdateExpense(expense.id); }} />
                                </label>
                                <label className="field" style={{ flex: 1 }}>
                                  <span>Category</span>
                                  <select value={editExpenseForm.categoryId} onChange={(e) => setEditExpenseForm((f) => ({ ...f, categoryId: e.target.value }))}>
                                    <option value="">Uncategorized</option>
                                    {activeCategories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                                  </select>
                                </label>
                              </div>
                              <div className="button-row button-row--tight">
                                <button className="button button--primary button--small" type="button" disabled={updateExpenseMutation.isPending} onClick={() => void handleUpdateExpense(expense.id)}>
                                  {updateExpenseMutation.isPending ? "Saving..." : "Save"}
                                </button>
                                <button className="button button--ghost button--small" type="button" onClick={() => setEditingExpenseId(null)}>Cancel</button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Delete confirmation */}
                        {deletingExpenseId === expense.id && (
                          <div className="confirm-bar" style={{ marginLeft: "1.5rem" }}>
                            <span className="confirm-bar__text">Delete &ldquo;{expense.description ?? "expense"}&rdquo;?</span>
                            <button className="button button--ghost button--small" type="button" disabled={deleteExpenseMutation.isPending} onClick={() => void deleteExpenseMutation.mutateAsync(expense.id).then(() => setDeletingExpenseId(null))}>
                              {deleteExpenseMutation.isPending ? "Deleting..." : "Confirm"}
                            </button>
                            <button className="button button--ghost button--small" type="button" onClick={() => setDeletingExpenseId(null)}>Cancel</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </>
            ) : (
              <EmptyState
                title="No expenses"
                description={activityFilter !== "all" ? "No expenses match this filter." : "Log your first expense to see activity here."}
              />
            )}
          </div>
        </div>

        {/* ── Side Rail: Month Insight ── */}
        <div className="finance__rail">
          {/* Month total */}
          <div className="rail-card">
            <span className="rail-card__title">Month total</span>
            <span className="rail-card__hero">
              {formatMinorCurrency(summary?.totalSpentMinor ?? 0, currency)}
            </span>
            {prevTotal > 0 && (
              <span className={`rail-card__detail${monthDelta > 0 ? " rail-card__detail--negative" : " rail-card__detail--positive"}`}>
                {monthDelta > 0 ? "+" : ""}{monthDelta}% vs last month
              </span>
            )}
            {isCurrentMonth && (
              <div className="rail-card__pace-track">
                <div
                  className={`rail-card__pace-fill ${paceClass}`}
                  style={{ width: `${Math.min(spendPercent, 100)}%` }}
                />
              </div>
            )}
          </div>

          {/* Top categories */}
          {summary && summary.categoryTotals.length > 0 && (
            <div className="rail-card">
              <span className="rail-card__title">Top categories</span>
              <div className="rail-card__list">
                {summary.categoryTotals.slice(0, 5).map((ct) => (
                  <div key={ct.expenseCategoryId ?? "uncategorized"} className="rail-card__list-item">
                    <span className="rail-card__list-name">
                      <span
                        className="rail-card__list-dot"
                        style={{ background: ct.color ?? "var(--text-tertiary)" }}
                      />
                      <span className="rail-card__list-label">{ct.name}</span>
                    </span>
                    <span className="rail-card__list-value">
                      {formatMinorCurrency(ct.totalAmountMinor, currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming bills in this month */}
          {pendingBills.length > 0 && (
            <div className="rail-card">
              <span className="rail-card__title">Pending bills</span>
              <div className="rail-card__list">
                {pendingBills.slice(0, 6).map((bill) => (
                  <div key={bill.id} className="rail-card__list-item">
                    <span className="rail-card__list-label" style={{ color: daysUntil(bill.dueOn) < 0 ? "var(--negative)" : undefined }}>
                      {bill.title}
                    </span>
                    <span className="rail-card__list-value" style={{ fontSize: "var(--fs-micro)", color: "var(--text-tertiary)" }}>
                      {formatDueLabel(bill.dueOn)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Rules & Setup (collapsed) ── */}
      <div className="finance__setup">
        <button
          className="setup-toggle"
          type="button"
          onClick={() => setShowSetup(!showSetup)}
        >
          <span className={`setup-toggle__chevron${showSetup ? " setup-toggle__chevron--open" : ""}`}>&#9654;</span>
          Rules & Setup
          <span className="setup-toggle__count">
            {recurringExpenses.filter((r) => r.status !== "archived").length + activeCategories.length}
          </span>
        </button>

        {showSetup && (
          <div className="setup-content">
            {/* Categories */}
            <SectionCard title="Categories" subtitle={`${activeCategories.length} active`}>
              {financeQuery.data.sectionErrors.categories ? (
                <InlineErrorState
                  message={financeQuery.data.sectionErrors.categories.message}
                  onRetry={() => void financeQuery.refetch()}
                />
              ) : showCatForm ? (
                <div className="stack-form">
                  <label className="field">
                    <span>Name</span>
                    <input type="text" value={catForm.name} placeholder="Category name" onChange={(e) => setCatForm((p) => ({ ...p, name: e.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Color (optional hex)</span>
                    <input type="text" value={catForm.color} placeholder="#d9993a" maxLength={7} onChange={(e) => setCatForm((p) => ({ ...p, color: e.target.value }))} />
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
                              summary?.categoryTotals.find((ct) => ct.expenseCategoryId === cat.id)?.totalAmountMinor ?? 0,
                              currency,
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

            {/* Recurring bills */}
            <SectionCard title="Recurring bills" subtitle={`${recurringExpenses.filter((r) => r.status !== "archived").length} active`}>
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
                      onChange={(rule) => setRecForm((p) => ({
                        ...p,
                        recurrenceInput: rule,
                        recurrenceRule: formatLegacyFinanceRecurrenceRule(rule),
                        nextDueOn: rule.startsOn,
                      }))}
                      context="finance"
                      startsOn={recForm.nextDueOn || today}
                    />
                  </div>
                  <label className="field">
                    <span>Next due date</span>
                    <input
                      type="date"
                      value={recForm.nextDueOn}
                      onChange={(e) => setRecForm((p) => {
                        const nextDueOn = e.target.value;
                        const recurrenceInput = p.recurrenceInput
                          ? { ...p.recurrenceInput, startsOn: nextDueOn }
                          : nextDueOn
                            ? getDefaultRecurrenceRule("finance", nextDueOn)
                            : p.recurrenceInput;
                        return {
                          ...p,
                          nextDueOn,
                          recurrenceInput,
                          recurrenceRule: recurrenceInput ? formatLegacyFinanceRecurrenceRule(recurrenceInput) : p.recurrenceRule,
                        };
                      })}
                    />
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
        )}
      </div>
    </div>
  );
}
