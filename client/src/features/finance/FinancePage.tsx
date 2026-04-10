import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";

import {
  daysUntil,
  formatDueLabel,
  type FinanceBillItem,
  formatMinorCurrency,
  formatMonthLabel,
  formatRelativeDate,
  formatShortDate,
  getMonthString,
  getTodayDate,
  parseAmountToMinor,
  useCreateBillMutation,
  useCreateCategoryMutation,
  useCreateExpenseMutation,
  useCreateRecurringExpenseMutation,
  useDeleteExpenseMutation,
  useDismissBillMutation,
  useFinanceDataQuery,
  useLinkBillExpenseMutation,
  useMarkBillPaidMutation,
  usePayAndLogBillMutation,
  useRescheduleBillMutation,
  useUpdateCategoryMutation,
  useUpdateExpenseMutation,
  useUpdateFinanceGoalMutation,
  useUpdateFinanceMonthPlanMutation,
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
import {
  EmptyState,
  InlineErrorState,
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";
import { RecurrenceEditor, buildRecurrenceInput } from "../../shared/ui/RecurrenceEditor";
import { readHomeDestinationState } from "../../shared/lib/homeNavigation";
import { FinanceInsightsPanel } from "./FinanceInsightsPanel";
import { readFinanceRouteRequest } from "./finance-navigation";
import { FinancePlanPanel } from "./FinancePlanPanel";

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

type BillForm = {
  title: string;
  dueOn: string;
  amount: string;
  categoryId: string;
  note: string;
};

type BillPaymentForm = {
  paidOn: string;
  amount: string;
  categoryId: string;
  description: string;
};

type BillLinkForm = {
  expenseId: string;
};

type ActivityFilter = "all" | "uncategorized" | "recurring" | "today";
type ManageFocus = "categories" | "recurring";
type FeedTab = "bills" | "expenses";

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
const emptyBill: BillForm = {
  title: "",
  dueOn: "",
  amount: "",
  categoryId: "",
  note: "",
};
const emptyBillPayment = (today: string): BillPaymentForm => ({
  paidOn: today,
  amount: "",
  categoryId: "",
  description: "",
});

function navigateMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function FinancePage() {
  const location = useLocation();
  const today = getTodayDate();
  const currentMonth = getMonthString(today);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [highlightedBillId, setHighlightedBillId] = useState<string | null>(null);
  const isCurrentMonth = selectedMonth === currentMonth;

  const financeQuery = useFinanceDataQuery(selectedMonth);
  const createBillMutation = useCreateBillMutation(today);
  const createExpenseMutation = useCreateExpenseMutation(today);
  const updateExpenseMutation = useUpdateExpenseMutation(today);
  const deleteExpenseMutation = useDeleteExpenseMutation(today);
  const payAndLogBillMutation = usePayAndLogBillMutation(today);
  const linkBillExpenseMutation = useLinkBillExpenseMutation(today);
  const markBillPaidMutation = useMarkBillPaidMutation(today);
  const rescheduleBillMutation = useRescheduleBillMutation(today);
  const dismissBillMutation = useDismissBillMutation(today);
  const updateFinanceGoalMutation = useUpdateFinanceGoalMutation(selectedMonth);
  const updateFinanceMonthPlanMutation = useUpdateFinanceMonthPlanMutation(selectedMonth);
  const createCategoryMutation = useCreateCategoryMutation();
  const updateCategoryMutation = useUpdateCategoryMutation();
  const createRecurringMutation = useCreateRecurringExpenseMutation();
  const updateRecurringMutation = useUpdateRecurringExpenseMutation();

  // Bill form
  const [showBillForm, setShowBillForm] = useState(false);
  const [billForm, setBillForm] = useState<BillForm>({
    ...emptyBill,
    dueOn: today,
  });

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

  // Setup drawer
  const [showSetupDrawer, setShowSetupDrawer] = useState(false);
  const [setupFocus, setSetupFocus] = useState<ManageFocus>("recurring");

  // Feed tab
  const [feedTab, setFeedTab] = useState<FeedTab>("bills");

  // Reschedule state
  const [reschedulingBillId, setReschedulingBillId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [payingBillId, setPayingBillId] = useState<string | null>(null);
  const [billPaymentForm, setBillPaymentForm] = useState<BillPaymentForm>(emptyBillPayment(today));
  const [linkingBillId, setLinkingBillId] = useState<string | null>(null);
  const [billLinkForm, setBillLinkForm] = useState<BillLinkForm>({ expenseId: "" });
  const handledRouteRef = useRef<string | null>(null);

  const financeData = financeQuery.data;
  const homeDestination = readHomeDestinationState(location.state);
  const financeRouteRequest = useMemo(
    () => readFinanceRouteRequest(location.search),
    [location.search],
  );
  const bills = financeData?.bills?.bills ?? [];
  const summary = financeData?.summary;
  const expenses = financeData?.expenses?.expenses ?? [];
  const recurringExpenses = financeData?.recurringExpenses?.recurringExpenses ?? [];
  const categories = financeData?.categories?.categories ?? [];
  const monthPlan = financeData?.monthPlan?.monthPlan ?? null;
  const insights = financeData?.insights?.insights ?? null;
  const activeCategories = categories.filter((c) => !c.archivedAt);
  const activeRecurringExpenses = recurringExpenses.filter((item) => item.status !== "archived");
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const currency = summary?.currencyCode ?? "USD";

  // ── Derived data ──

  // Bills: overdue, due today, due this week, upcoming
  const openBills = bills
    .filter((item) => item.status === "pending" || item.status === "rescheduled")
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  const pendingBills = (summary?.upcomingBills ?? [])
    .filter((item) => item.status === "pending" || item.status === "rescheduled")
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn));

  const overdueBills = openBills.filter((b) => daysUntil(b.dueOn) < 0);
  const todayBills = openBills.filter((b) => daysUntil(b.dueOn) === 0);
  const dueBills = [...overdueBills, ...todayBills, ...openBills.filter((b) => { const d = daysUntil(b.dueOn); return d > 0 && d <= 7; })];
  const completedBills = bills.filter((b) => b.status === "done");
  const unreconciledBills = completedBills.filter((b) => b.reconciliationStatus === "paid_without_expense");
  const workflowBills = [...openBills, ...completedBills];

  // Today's logged spending
  const todayExpenses = expenses.filter((e) => e.spentOn === today);
  const todaySpent = todayExpenses.reduce((sum, e) => sum + e.amountMinor, 0);

  // Uncategorized count
  const uncategorizedCount = expenses.filter((e) => !e.expenseCategoryId).length;

  // Month pace
  const dayOfMonth = new Date(`${today}T12:00:00`).getDate();
  const daysInMonth = new Date(Number(selectedMonth.split("-")[0]), Number(selectedMonth.split("-")[1]), 0).getDate();
  const prevTotal = summary?.previousMonthTotalSpentMinor ?? 0;

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

  useEffect(() => {
    if (!financeRouteRequest.month || financeRouteRequest.month === selectedMonth) {
      return;
    }

    setSelectedMonth(financeRouteRequest.month);
  }, [financeRouteRequest.month, selectedMonth]);

  useEffect(() => {
    const routeKey = `${location.key}:${location.search}`;
    const hasFinanceRouteTarget =
      Boolean(financeRouteRequest.billId)
      || financeRouteRequest.intent !== "view"
      || Boolean(financeRouteRequest.section);

    if (!hasFinanceRouteTarget || handledRouteRef.current === routeKey) {
      return;
    }

    if (financeRouteRequest.month && financeRouteRequest.month !== selectedMonth) {
      return;
    }

    const targetBill = financeRouteRequest.billId
      ? workflowBills.find((bill) => bill.id === financeRouteRequest.billId)
      : null;

    if (financeRouteRequest.billId && !targetBill) {
      return;
    }

    setHighlightedBillId(targetBill?.id ?? null);
    setFeedTab("bills");

    if (targetBill && financeRouteRequest.intent === "pay" && targetBill.status !== "done") {
      openBillPayment(targetBill);
    }

    requestAnimationFrame(() => {
      const targetId = targetBill
        ? `finance-bill-${targetBill.id}`
        : "finance-feed";

      document.getElementById(targetId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    handledRouteRef.current = routeKey;
  }, [
    financeRouteRequest.billId,
    financeRouteRequest.intent,
    financeRouteRequest.month,
    financeRouteRequest.section,
    location.key,
    location.search,
    selectedMonth,
    workflowBills,
  ]);

  useEffect(() => {
    if (
      financeRouteRequest.billId
      || financeRouteRequest.month
      || financeRouteRequest.intent !== "view"
      || financeRouteRequest.section
    ) {
      return;
    }

    if (homeDestination?.kind !== "finance_bills") {
      setHighlightedBillId(null);
      return;
    }

    setSelectedMonth(currentMonth);
    setHighlightedBillId(homeDestination.adminItemId ?? null);
    setFeedTab("bills");

    requestAnimationFrame(() => {
      const targetId = homeDestination.adminItemId
        ? `finance-bill-${homeDestination.adminItemId}`
        : "finance-feed";

      document.getElementById(targetId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [currentMonth, financeRouteRequest, homeDestination, location.key]);

  useEffect(() => {
    const manageTarget = new URLSearchParams(location.search).get("manage");
    if (manageTarget === "categories" || manageTarget === "recurring") {
      openManagement(manageTarget);
    }
  }, [location.search]);

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

  function openCreateBill() {
    setBillForm({
      ...emptyBill,
      dueOn: isCurrentMonth ? today : `${selectedMonth}-01`,
    });
    setShowBillForm(true);
    setFeedTab("bills");
  }

  async function handleAddBill() {
    if (!billForm.title.trim() || !billForm.dueOn) return;
    await createBillMutation.mutateAsync({
      title: billForm.title.trim(),
      dueOn: billForm.dueOn,
      amountMinor: billForm.amount ? parseAmountToMinor(billForm.amount) : null,
      expenseCategoryId: billForm.categoryId || null,
      note: billForm.note || null,
    });
    setBillForm({
      ...emptyBill,
      dueOn: isCurrentMonth ? today : `${selectedMonth}-01`,
    });
    setShowBillForm(false);
  }

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

  function openBillPayment(bill: FinanceBillItem) {
    const recurringTemplate = bill.recurringExpenseTemplateId
      ? recurringExpenses.find((item) => item.id === bill.recurringExpenseTemplateId)
      : null;

    setBillPaymentForm({
      paidOn: bill.paidAt?.slice(0, 10) ?? today,
      amount: bill.amountMinor != null
        ? String(bill.amountMinor / 100)
        : recurringTemplate?.defaultAmountMinor
          ? String(recurringTemplate.defaultAmountMinor / 100)
          : "",
      description: bill.title,
      categoryId: bill.expenseCategoryId ?? recurringTemplate?.expenseCategoryId ?? "",
    });
    setPayingBillId(bill.id);
    setReschedulingBillId(null);
    setLinkingBillId(null);
  }

  function getUnlinkedExpenseCandidates(bill: FinanceBillItem) {
    return [...expenses]
      .filter((expense) => !expense.billId)
      .sort((left, right) => {
        const leftScore =
          (left.amountMinor === bill.amountMinor ? 2 : 0)
          + (left.spentOn === (bill.paidAt?.slice(0, 10) ?? bill.dueOn) ? 2 : 0)
          + (left.expenseCategoryId === bill.expenseCategoryId ? 1 : 0);
        const rightScore =
          (right.amountMinor === bill.amountMinor ? 2 : 0)
          + (right.spentOn === (bill.paidAt?.slice(0, 10) ?? bill.dueOn) ? 2 : 0)
          + (right.expenseCategoryId === bill.expenseCategoryId ? 1 : 0);

        if (leftScore !== rightScore) {
          return rightScore - leftScore;
        }

        return right.spentOn.localeCompare(left.spentOn) || right.createdAt.localeCompare(left.createdAt);
      });
  }

  function openLinkExpense(bill: FinanceBillItem) {
    const candidates = getUnlinkedExpenseCandidates(bill);
    setBillLinkForm({
      expenseId: candidates[0]?.id ?? "",
    });
    setLinkingBillId(bill.id);
    setPayingBillId(null);
    setReschedulingBillId(null);
  }

  async function handlePayAndLogBill(bill: FinanceBillItem) {
    const amountMinor = billPaymentForm.amount ? parseAmountToMinor(billPaymentForm.amount) : null;
    await payAndLogBillMutation.mutateAsync({
      billId: bill.id,
      paidOn: billPaymentForm.paidOn || today,
      amountMinor,
      description: billPaymentForm.description || bill.title,
      expenseCategoryId: billPaymentForm.categoryId || null,
      currencyCode: currency,
    });
    setPayingBillId(null);
    setBillPaymentForm(emptyBillPayment(today));
  }

  async function handleMarkBillPaid(bill: FinanceBillItem) {
    await markBillPaidMutation.mutateAsync({
      billId: bill.id,
      paidOn: today,
    });
  }

  async function handleLinkExpense(bill: FinanceBillItem) {
    if (!billLinkForm.expenseId) return;
    await linkBillExpenseMutation.mutateAsync({
      billId: bill.id,
      expenseId: billLinkForm.expenseId,
    });
    setLinkingBillId(null);
  }

  async function handleBillDrop(bill: FinanceBillItem) {
    await dismissBillMutation.mutateAsync(bill.id);
  }

  async function handleBillReschedule(billId: string) {
    if (!rescheduleDate) return;
    await rescheduleBillMutation.mutateAsync({ billId, dueOn: rescheduleDate });
    setReschedulingBillId(null);
    setRescheduleDate("");
  }

  async function handleQuickRecategorize(expenseId: string, expenseCategoryId: string) {
    await updateExpenseMutation.mutateAsync({
      expenseId,
      expenseCategoryId: expenseCategoryId || null,
    });
  }

  function openManagement(focus: ManageFocus) {
    setSetupFocus(focus);
    setShowSetupDrawer(true);
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

  function getBillRowClass(bill: FinanceBillItem) {
    if (bill.status === "done") {
      return bill.reconciliationStatus === "paid_with_expense"
        ? "bill-row bill-row--settled"
        : "bill-row bill-row--unreconciled";
    }
    const d = daysUntil(bill.dueOn);
    if (d < 0) return "bill-row bill-row--overdue";
    if (d === 0) return "bill-row bill-row--today";
    return "bill-row";
  }

  function getBillDueText(bill: FinanceBillItem) {
    if (bill.status === "done") {
      return bill.paidAt
        ? `Paid ${formatShortDate(bill.paidAt.slice(0, 10))}`
        : "Paid";
    }

    if (bill.status === "dropped") {
      return "Dismissed";
    }

    if (bill.status === "rescheduled") {
      return `Rescheduled to ${formatShortDate(bill.dueOn)}`;
    }

    const d = daysUntil(bill.dueOn);
    if (d < 0) return `Overdue by ${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"}`;
    if (d === 0) return "Due today";
    return `Due ${formatShortDate(bill.dueOn)}`;
  }

  function getBillReconciliationLabel(bill: FinanceBillItem) {
    switch (bill.reconciliationStatus) {
      case "paid_with_expense":
        return "Expense linked";
      case "paid_without_expense":
        return "Needs expense log";
      case "rescheduled":
        return "Open bill";
      case "dropped":
        return "Dismissed";
      default:
        return "Due";
    }
  }

  async function handleMonthPlanSave(payload: Parameters<typeof updateFinanceMonthPlanMutation.mutateAsync>[0]) {
    await updateFinanceMonthPlanMutation.mutateAsync(payload);
  }

  async function handleFinanceGoalSave(
    goalId: string,
    payload: Omit<Parameters<typeof updateFinanceGoalMutation.mutateAsync>[0], "goalId">,
  ) {
    await updateFinanceGoalMutation.mutateAsync({
      goalId,
      ...payload,
    });
  }

  // ── Render ──

  return (
    <div className="finance">
      {/* ── Slim Header ── */}
      <div className="finance__header">
        <div className="finance__header-left">
          <h1 className="finance__title">Finance</h1>
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
        </div>
        <div className="finance__header-actions">
          <button
            className="button button--primary button--small"
            type="button"
            onClick={openCreateBill}
          >
            Add bill
          </button>
          <button
            className="button button--ghost button--small"
            type="button"
            onClick={() => { setShowExpenseForm(true); setFeedTab("expenses"); }}
          >
            Log expense
          </button>
          <button
            className="finance__setup-trigger"
            type="button"
            onClick={() => setShowSetupDrawer(true)}
            aria-label="Finance setup"
            title="Manage categories and recurring bills"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6.5 1.5h3l.4 1.8.6.3 1.7-.8 2.1 2.1-.8 1.7.3.6 1.8.4v3l-1.8.4-.3.6.8 1.7-2.1 2.1-1.7-.8-.6.3-.4 1.8h-3l-.4-1.8-.6-.3-1.7.8-2.1-2.1.8-1.7-.3-.6-1.8-.4v-3l1.8-.4.3-.6-.8-1.7 2.1-2.1 1.7.8.6-.3.4-1.8z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2"/></svg>
          </button>
        </div>
      </div>

      {/* ── Inline Metrics Strip ── */}
      <div className="finance__metrics">
        <span className="metric">
          <span className={`metric__value${todaySpent > 0 ? " metric__value--positive" : ""}`}>
            {todaySpent > 0 ? formatMinorCurrency(todaySpent, currency) : "Nothing yet"}
          </span>
          <span className="metric__label">today</span>
        </span>
        <span className="metric__divider" />
        <span className="metric">
          <span className={`metric__value${overdueBills.length > 0 ? " metric__value--negative" : ""}`}>
            {overdueBills.length > 0
              ? `${overdueBills.length} overdue`
              : todayBills.length > 0
                ? `${todayBills.length} today`
                : dueBills.length > 0
                  ? `${dueBills.length} this week`
                  : "All clear"}
          </span>
          <span className="metric__label">bills</span>
        </span>
        <span className="metric__divider" />
        <span className="metric">
          <span className={`metric__value${monthPlan?.paceStatus === "off_track" ? " metric__value--negative" : monthPlan?.paceStatus === "on_pace" ? " metric__value--positive" : ""}`}>
            {monthPlan?.paceStatus === "no_plan"
              ? "Set a plan"
              : monthPlan?.paceStatus === "on_pace"
                ? "On pace"
                : monthPlan?.paceStatus === "slightly_heavy"
                  ? "Slightly heavy"
                  : monthPlan?.paceStatus === "off_track"
                    ? "Off track"
                    : `Day ${dayOfMonth}/${daysInMonth}`}
          </span>
          <span className="metric__label">pace</span>
        </span>
        {uncategorizedCount > 0 && (
          <>
            <span className="metric__divider" />
            <span className="metric">
              <span className="metric__value metric__value--accent">{uncategorizedCount}</span>
              <span className="metric__label">uncategorized</span>
            </span>
          </>
        )}
      </div>

      {/* ── Main Body: Feed + Rail ── */}
      <div className="finance__body">
        <div className="finance__main">

          {/* ── Unified Feed ── */}
          <div className="finance__feed" id="finance-feed">
            <div className="feed__toolbar">
              <div className="feed__tabs">
                <button
                  className={`feed__tab${feedTab === "bills" ? " feed__tab--active" : ""}`}
                  type="button"
                  onClick={() => setFeedTab("bills")}
                >
                  Bills
                  {dueBills.length > 0 && <span className="feed__tab-badge">{dueBills.length}</span>}
                </button>
                <button
                  className={`feed__tab${feedTab === "expenses" ? " feed__tab--active" : ""}`}
                  type="button"
                  onClick={() => setFeedTab("expenses")}
                >
                  Expenses
                </button>
              </div>
              {feedTab === "bills" && (
                <div className="feed__summary">
                  <span>{openBills.length} open</span>
                  <span className="metric__divider" />
                  <span>{completedBills.length} paid</span>
                  {unreconciledBills.length > 0 && (
                    <>
                      <span className="metric__divider" />
                      <span className="feed__summary--alert">{unreconciledBills.length} unreconciled</span>
                    </>
                  )}
                </div>
              )}
              {feedTab === "expenses" && (
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
              )}
            </div>

            {/* ── Bill Form (inline, when adding) ── */}
            {showBillForm && feedTab === "bills" && (
              <div className="inline-editor" style={{ animation: "slideUp 0.25s var(--ease) both" }}>
                <div className="stack-form">
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <label className="field" style={{ flex: 2 }}>
                      <span>Bill title</span>
                      <input
                        type="text"
                        value={billForm.title}
                        autoFocus
                        placeholder="Rent, internet, insurance..."
                        onChange={(e) => setBillForm((form) => ({ ...form, title: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") void handleAddBill(); if (e.key === "Escape") setShowBillForm(false); }}
                      />
                    </label>
                    <label className="field" style={{ flex: 1 }}>
                      <span>Due date</span>
                      <input
                        type="date"
                        value={billForm.dueOn}
                        onChange={(e) => setBillForm((form) => ({ ...form, dueOn: e.target.value }))}
                      />
                    </label>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <label className="field" style={{ flex: 1 }}>
                      <span>Expected amount</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={billForm.amount}
                        placeholder="0.00"
                        onChange={(e) => setBillForm((form) => ({ ...form, amount: e.target.value }))}
                      />
                    </label>
                    <label className="field" style={{ flex: 1 }}>
                      <span>Category</span>
                      <select
                        value={billForm.categoryId}
                        onChange={(e) => setBillForm((form) => ({ ...form, categoryId: e.target.value }))}
                      >
                        <option value="">Choose later</option>
                        {activeCategories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="field">
                    <span>Note</span>
                    <input
                      type="text"
                      value={billForm.note}
                      placeholder="Optional reminder or account detail"
                      onChange={(e) => setBillForm((form) => ({ ...form, note: e.target.value }))}
                    />
                  </label>
                  <div className="button-row button-row--tight">
                    <button className="button button--primary button--small" type="button" disabled={createBillMutation.isPending} onClick={() => void handleAddBill()}>
                      {createBillMutation.isPending ? "Saving..." : "Add bill"}
                    </button>
                    <button className="button button--ghost button--small" type="button" onClick={() => setShowBillForm(false)}>Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Expense Form (inline, when adding) ── */}
            {showExpenseForm && feedTab === "expenses" && (
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

            {/* ── Bills Tab Content ── */}
            {feedTab === "bills" && (
              <>
                {financeQuery.data.sectionErrors.bills ? (
                  <InlineErrorState
                    message={financeQuery.data.sectionErrors.bills.message}
                    onRetry={() => void financeQuery.refetch()}
                  />
                ) : workflowBills.length > 0 ? (
                  <div className="feed__list">
                    {workflowBills.map((bill) => (
                      <div key={bill.id} id={`finance-bill-${bill.id}`}>
                        <div
                          className={getBillRowClass(bill)}
                          style={highlightedBillId === bill.id
                            ? {
                                borderColor: "rgba(217, 153, 58, 0.4)",
                                boxShadow: "0 0 0 1px rgba(217, 153, 58, 0.25)",
                                background: "rgba(217, 153, 58, 0.06)",
                              }
                            : undefined}
                        >
                          <span className="bill-row__indicator" />
                          <div className="bill-row__info">
                            <span className="bill-row__title">{bill.title}</span>
                            <span className="bill-row__due">{getBillDueText(bill)}</span>
                          </div>
                          <div className="bill-row__meta">
                            <span className={`bill-status-pill bill-status-pill--${bill.reconciliationStatus}`}>
                              {getBillReconciliationLabel(bill)}
                            </span>
                            {bill.completionMode === "mark_paid_only" ? (
                              <span className="bill-status-pill">Secondary path</span>
                            ) : null}
                          </div>
                          {bill.amountMinor != null ? (
                            <span className="bill-row__amount">{formatMinorCurrency(bill.amountMinor, currency)}</span>
                          ) : null}
                          <div className="bill-row__actions">
                            {(bill.status === "pending" || bill.status === "rescheduled") ? (
                              <>
                                <button
                                  className="button button--primary button--small"
                                  type="button"
                                  disabled={payAndLogBillMutation.isPending}
                                  onClick={() => openBillPayment(bill)}
                                >
                                  Pay and log
                                </button>
                                <button
                                  className="button button--ghost button--small"
                                  type="button"
                                  disabled={markBillPaidMutation.isPending}
                                  onClick={() => void handleMarkBillPaid(bill)}
                                >
                                  Mark paid only
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
                                    onClick={() => { setReschedulingBillId(bill.id); setRescheduleDate(bill.dueOn); }}
                                  >
                                    Reschedule
                                  </button>
                                )}
                                <button
                                  className="button button--ghost button--small"
                                  type="button"
                                  onClick={() => void handleBillDrop(bill)}
                                >
                                  Drop
                                </button>
                              </>
                            ) : null}
                            {bill.status === "done" && bill.reconciliationStatus === "paid_without_expense" ? (
                              <>
                                <button
                                  className="button button--primary button--small"
                                  type="button"
                                  disabled={payAndLogBillMutation.isPending}
                                  onClick={() => openBillPayment(bill)}
                                >
                                  Log expense
                                </button>
                                <button
                                  className="button button--ghost button--small"
                                  type="button"
                                  disabled={linkBillExpenseMutation.isPending}
                                  onClick={() => openLinkExpense(bill)}
                                >
                                  Link existing
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>
                        {payingBillId === bill.id && (
                          <div className="inline-editor" style={{ marginLeft: "1.5rem" }}>
                            <div className="stack-form">
                              <div style={{ display: "flex", gap: "0.5rem" }}>
                                <label className="field" style={{ flex: 1 }}>
                                  <span>Paid on</span>
                                  <input
                                    type="date"
                                    value={billPaymentForm.paidOn}
                                    onChange={(e) => setBillPaymentForm((form) => ({ ...form, paidOn: e.target.value }))}
                                  />
                                </label>
                                <label className="field" style={{ flex: 1 }}>
                                  <span>Amount</span>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={billPaymentForm.amount}
                                    placeholder={bill.amountMinor != null ? String(bill.amountMinor / 100) : "0.00"}
                                    onChange={(e) => setBillPaymentForm((form) => ({ ...form, amount: e.target.value }))}
                                  />
                                </label>
                              </div>
                              <div style={{ display: "flex", gap: "0.5rem" }}>
                                <label className="field" style={{ flex: 1 }}>
                                  <span>Category</span>
                                  <select
                                    value={billPaymentForm.categoryId}
                                    onChange={(e) => setBillPaymentForm((form) => ({ ...form, categoryId: e.target.value }))}
                                  >
                                    <option value="">Uncategorized</option>
                                    {activeCategories.map((c) => (
                                      <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                  </select>
                                </label>
                                <label className="field" style={{ flex: 2 }}>
                                  <span>Description</span>
                                  <input
                                    type="text"
                                    value={billPaymentForm.description}
                                    onChange={(e) => setBillPaymentForm((form) => ({ ...form, description: e.target.value }))}
                                  />
                                </label>
                              </div>
                              <div className="button-row button-row--tight">
                                <button className="button button--primary button--small" type="button" disabled={payAndLogBillMutation.isPending} onClick={() => void handlePayAndLogBill(bill)}>
                                  {payAndLogBillMutation.isPending ? "Saving..." : "Pay and log expense"}
                                </button>
                                <button className="button button--ghost button--small" type="button" onClick={() => setPayingBillId(null)}>Cancel</button>
                              </div>
                            </div>
                          </div>
                        )}
                        {linkingBillId === bill.id && (
                          <div className="inline-editor" style={{ marginLeft: "1.5rem" }}>
                            <div className="stack-form">
                              <label className="field">
                                <span>Link an existing expense</span>
                                <select
                                  value={billLinkForm.expenseId}
                                  onChange={(e) => setBillLinkForm({ expenseId: e.target.value })}
                                >
                                  {getUnlinkedExpenseCandidates(bill).length === 0 ? (
                                    <option value="">No unlinked expenses in this month</option>
                                  ) : null}
                                  {getUnlinkedExpenseCandidates(bill).map((expense) => (
                                    <option key={expense.id} value={expense.id}>
                                      {`${formatShortDate(expense.spentOn)} · ${formatMinorCurrency(expense.amountMinor, expense.currencyCode)} · ${expense.description ?? "Expense"}`}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <div className="button-row button-row--tight">
                                <button
                                  className="button button--primary button--small"
                                  type="button"
                                  disabled={linkBillExpenseMutation.isPending || !billLinkForm.expenseId}
                                  onClick={() => void handleLinkExpense(bill)}
                                >
                                  {linkBillExpenseMutation.isPending ? "Linking..." : "Link expense"}
                                </button>
                                <button className="button button--ghost button--small" type="button" onClick={() => setLinkingBillId(null)}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        {reschedulingBillId === bill.id && bill.status === "done" && (
                          <div className="confirm-bar" style={{ marginLeft: "1.5rem" }}>
                            <span className="confirm-bar__text">Move this bill to</span>
                            <input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} />
                            <button className="button button--ghost button--small" type="button" onClick={() => void handleBillReschedule(bill.id)}>Save</button>
                            <button className="button button--ghost button--small" type="button" onClick={() => setReschedulingBillId(null)}>Cancel</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No bills yet"
                    description="Add a one-off bill or set up recurring bills so Finance can keep future obligations visible."
                    actionLabel={activeRecurringExpenses.length === 0 ? "Add recurring bill" : "Add bill"}
                    onAction={activeRecurringExpenses.length === 0 ? () => openManagement("recurring") : openCreateBill}
                  />
                )}
              </>
            )}

            {/* ── Expenses Tab Content ── */}
            {feedTab === "expenses" && (
              <>
                {financeQuery.data.sectionErrors.expenses ? (
                  <InlineErrorState
                    message={financeQuery.data.sectionErrors.expenses.message}
                    onRetry={() => void financeQuery.refetch()}
                  />
                ) : sortedExpenses.length > 0 ? (
                  <div className="feed__list">
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
                  </div>
                ) : (
                  <EmptyState
                    title="No expenses"
                    description={activityFilter !== "all" ? "No expenses match this filter." : "Log your first expense to see activity here."}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Side Rail ── */}
        <div className="finance__rail">
          <FinancePlanPanel
            monthPlan={monthPlan}
            monthTotalSpentMinor={summary?.totalSpentMinor ?? 0}
            previousMonthTotalSpentMinor={prevTotal}
            currencyCode={currency}
            categories={activeCategories}
            categoryTotals={summary?.categoryTotals ?? []}
            isCurrentMonth={isCurrentMonth}
            errorMessage={financeQuery.data.sectionErrors.monthPlan?.message ?? null}
            isSaving={updateFinanceMonthPlanMutation.isPending}
            onRetry={() => void financeQuery.refetch()}
            onSave={handleMonthPlanSave}
          />

          <FinanceInsightsPanel
            insights={insights}
            currencyCode={currency}
            errorMessage={financeQuery.data.sectionErrors.insights?.message ?? null}
            savingGoalId={updateFinanceGoalMutation.isPending ? updateFinanceGoalMutation.variables?.goalId ?? null : null}
            onRetry={() => void financeQuery.refetch()}
            onSaveGoal={handleFinanceGoalSave}
          />
        </div>
      </div>

      {/* ── Setup Drawer ── */}
      {showSetupDrawer && (
        <div className="setup-drawer__backdrop" onClick={() => setShowSetupDrawer(false)}>
          <aside className="setup-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="setup-drawer__header">
              <h2 className="setup-drawer__title">Finance setup</h2>
              <button
                className="button button--ghost button--small"
                type="button"
                onClick={() => setShowSetupDrawer(false)}
              >
                Close
              </button>
            </div>

            <div className="setup-drawer__tabs" role="tablist">
              <button
                className={`feed__tab${setupFocus === "categories" ? " feed__tab--active" : ""}`}
                type="button"
                role="tab"
                aria-selected={setupFocus === "categories"}
                onClick={() => setSetupFocus("categories")}
              >
                Categories
              </button>
              <button
                className={`feed__tab${setupFocus === "recurring" ? " feed__tab--active" : ""}`}
                type="button"
                role="tab"
                aria-selected={setupFocus === "recurring"}
                onClick={() => setSetupFocus("recurring")}
              >
                Recurring bills
              </button>
            </div>

            <div className="setup-drawer__content">
              {setupFocus === "categories" && (
                <div id="finance-manage-categories">
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
                        <div className="setup-drawer__list">
                          {activeCategories.map((cat) => (
                            <div key={cat.id} className="setup-drawer__item">
                              <div className="setup-drawer__item-info">
                                {cat.color && (
                                  <span className="activity-row__category-dot" style={{ background: cat.color }} />
                                )}
                                <span className="setup-drawer__item-name">{cat.name}</span>
                                <span className="setup-drawer__item-meta">
                                  {formatMinorCurrency(
                                    summary?.categoryTotals.find((ct) => ct.expenseCategoryId === cat.id)?.totalAmountMinor ?? 0,
                                    currency,
                                  )}
                                </span>
                              </div>
                              <div className="setup-drawer__item-actions">
                                <button className="button button--ghost button--small" type="button" onClick={() => openEditCategory(cat)}>Edit</button>
                                <button className="button button--ghost button--small" type="button" onClick={() => void handleCategoryArchive(cat.id, true)}>Archive</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState
                          title="No categories yet"
                          description="Create the first category so bills and expenses have a stable structure."
                          actionLabel="Add category"
                          onAction={openCreateCategory}
                        />
                      )}
                      {activeCategories.length > 0 ? (
                        <button className="button button--ghost button--small" type="button" onClick={openCreateCategory} style={{ marginTop: "0.6rem" }}>
                          Add category
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              )}

              {setupFocus === "recurring" && (
                <div id="finance-manage-recurring">
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
                      {activeRecurringExpenses.length > 0 ? (
                        <div className="setup-drawer__list">
                          {activeRecurringExpenses.map((item) => (
                            <div key={item.id} className="setup-drawer__item">
                              <div className="setup-drawer__item-info">
                                <span className="setup-drawer__item-name">{item.title}</span>
                                <span className="setup-drawer__item-meta">
                                  {isRecurring(item.recurrence) ? (
                                    <>{formatFullRecurrenceSummary(item.recurrence!.rule)} · </>
                                  ) : null}
                                  {formatDueLabel(item.nextDueOn)}
                                  {" · "}
                                  <span className={`tag ${item.status === "active" ? "tag--positive" : item.status === "paused" ? "tag--warning" : "tag--neutral"}`}>
                                    {item.status}
                                  </span>
                                </span>
                              </div>
                              <div className="setup-drawer__item-actions">
                                <span className="setup-drawer__item-amount">
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
                        <EmptyState
                          title="No recurring bills yet"
                          description="Recurring bills power the daily bill lane. Add the first one so Finance can surface future due dates automatically."
                          actionLabel="Add recurring bill"
                          onAction={openCreateRecurring}
                        />
                      )}
                      {activeRecurringExpenses.length > 0 ? (
                        <button className="button button--ghost button--small" type="button" onClick={openCreateRecurring} style={{ marginTop: "0.5rem" }}>
                          Add recurring bill
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
