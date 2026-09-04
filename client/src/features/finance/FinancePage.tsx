import { useCallback, useMemo, useRef, useState } from "react";

import {
  daysUntil,
  formatMinorCurrency,
  formatMonthLabel,
  formatShortDate,
  getMonthString,
  getTodayDate,
  parseAmountToMinor,
  type FinanceBillItem,
  useCreateBillMutation,
  useCreateCategoryMutation,
  useCreateCreditCardMutation,
  useCreateExpenseMutation,
  useCreateFinanceAccountMutation,
  useCreateFinanceTransactionMutation,
  useCreateLoanMutation,
  useCreateRecurringExpenseMutation,
  useCreateRecurringIncomeMutation,
  useDismissBillMutation,
  useFinanceDataQuery,
  useMarkBillPaidMutation,
  usePayAndLogBillMutation,
  usePayCreditCardMutation,
  usePayLoanMutation,
  useReceiveRecurringIncomeMutation,
  useRescheduleBillMutation,
  useUpdateCategoryMutation,
  useUpdateCreditCardMutation,
  useUpdateFinanceAccountMutation,
  useUpdateFinanceGoalMutation,
  useUpdateFinanceMonthPlanMutation,
  useUpdateLoanMutation,
  useUpdateRecurringExpenseMutation,
  useUpdateRecurringIncomeMutation,
  useUndoRecurringIncomeReceiptMutation,
} from "../../shared/lib/api";
import {
  formatLegacyFinanceRecurrenceRule,
  getDefaultRecurrenceRule,
} from "../../shared/lib/recurrence";
import {
  EmptyState,
  InlineErrorState,
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";
import { useDialogAccessibility } from "../../shared/ui/DialogSurface";
import { buildRecurrenceInput } from "../../shared/ui/RecurrenceEditor";
import {
  DebtList,
  DebtSummary,
} from "./FinanceDebtPanels";
import {
  FinanceBillEditor,
  FinanceLegacyExpenseEditor,
  FinanceTransactionEditor,
  type BillForm,
  type LegacyExpenseForm,
  type TransactionForm,
} from "./FinanceEntryEditors";
import { FinanceInsightsPanel } from "./FinanceInsightsPanel";
import {
  BillRow,
  TransactionList,
  type BillPaymentFormState,
} from "./FinanceLedgerPanels";
import {
  MonthJourney,
  QuickLinks,
  SafeSpendMath,
  SafeThisMonthPanel,
  TodayMoneyActions,
} from "./FinanceOverviewPanels";
import { FinancePlanPanel } from "./FinancePlanPanel";
import { MoneyEventsTable } from "./MoneyEventsTable";
import {
  FinanceSetupDrawer,
  type AccountForm,
  type CategoryForm,
  type CreditCardForm,
  type IncomeForm,
  type LoanForm,
  type RecurringBillForm,
  type SetupTab,
} from "./FinanceSetupDrawer";
import {
  getPlannedIncomeMinor,
  getTimelineStatusLabel,
  getTimelineTone,
  getTimelineType,
  navigateMonth,
  type MoneyEvent,
} from "./finance-page-model";

type CockpitTab = "overview" | "timeline" | "transactions" | "bills" | "accounts" | "debt";

type BillPaymentForm = BillPaymentFormState;

const emptyAccountForm: AccountForm = {
  name: "",
  accountType: "bank",
  openingBalance: "",
};

const emptyCategoryForm: CategoryForm = {
  name: "",
  color: "",
};

export function FinancePage() {
  const today = getTodayDate();
  const currentMonth = getMonthString(today);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [tab, setTab] = useState<CockpitTab>("overview");
  const [showSetup, setShowSetup] = useState(false);
  const setupDrawerRef = useRef<HTMLElement | null>(null);
  const setupCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeSetup = useCallback(() => setShowSetup(false), []);
  const [setupTab, setSetupTab] = useState<SetupTab>("accounts");
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showBillForm, setShowBillForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [payingBillId, setPayingBillId] = useState<string | null>(null);
  const [reschedulingBillId, setReschedulingBillId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");

  useDialogAccessibility({
    open: showSetup,
    onClose: closeSetup,
    dialogRef: setupDrawerRef,
    initialFocusRef: setupCloseButtonRef,
  });

  const financeQuery = useFinanceDataQuery(selectedMonth);
  const financeData = financeQuery.data;
  const dashboard = financeData?.dashboard;
  const summary = financeData?.summary;
  const bills = financeData?.bills?.bills ?? [];
  const categories = financeData?.categories?.categories ?? [];
  const recurringExpenses = financeData?.recurringExpenses?.recurringExpenses ?? [];
  const monthPlan = financeData?.monthPlan?.monthPlan ?? null;
  const insights = financeData?.insights?.insights ?? null;
  const currency = dashboard?.currencyCode ?? summary?.currencyCode ?? "USD";
  const activeCategories = categories.filter((category) => !category.archivedAt);
  const activeAccounts = dashboard?.accounts.filter((account) => !account.archivedAt) ?? [];

  const createAccountMutation = useCreateFinanceAccountMutation(today);
  const updateAccountMutation = useUpdateFinanceAccountMutation(today);
  const createTransactionMutation = useCreateFinanceTransactionMutation(today);
  const createIncomeMutation = useCreateRecurringIncomeMutation(today);
  const receiveIncomeMutation = useReceiveRecurringIncomeMutation(today);
  const updateIncomeMutation = useUpdateRecurringIncomeMutation(today);
  const undoIncomeReceiptMutation = useUndoRecurringIncomeReceiptMutation(today);
  const createCreditCardMutation = useCreateCreditCardMutation(today);
  const updateCreditCardMutation = useUpdateCreditCardMutation(today);
  const payCreditCardMutation = usePayCreditCardMutation(today);
  const createLoanMutation = useCreateLoanMutation(today);
  const updateLoanMutation = useUpdateLoanMutation(today);
  const payLoanMutation = usePayLoanMutation(today);
  const createBillMutation = useCreateBillMutation(today);
  const createExpenseMutation = useCreateExpenseMutation(today);
  const payAndLogBillMutation = usePayAndLogBillMutation(today);
  const markBillPaidMutation = useMarkBillPaidMutation(today);
  const rescheduleBillMutation = useRescheduleBillMutation(today);
  const dismissBillMutation = useDismissBillMutation(today);
  const createCategoryMutation = useCreateCategoryMutation();
  const updateCategoryMutation = useUpdateCategoryMutation();
  const createRecurringMutation = useCreateRecurringExpenseMutation();
  const updateRecurringMutation = useUpdateRecurringExpenseMutation();
  const updateFinanceGoalMutation = useUpdateFinanceGoalMutation(selectedMonth);
  const updateFinanceMonthPlanMutation = useUpdateFinanceMonthPlanMutation(selectedMonth);

  const [accountForm, setAccountForm] = useState<AccountForm>(emptyAccountForm);
  const [transactionForm, setTransactionForm] = useState<TransactionForm>({
    transactionType: "expense",
    accountId: "",
    transferAccountId: "",
    amount: "",
    occurredOn: today,
    description: "",
    expenseCategoryId: "",
  });
  const [billForm, setBillForm] = useState<BillForm>({
    title: "",
    dueOn: today,
    amount: "",
    categoryId: "",
  });
  const [expenseForm, setExpenseForm] = useState<LegacyExpenseForm>({
    amount: "",
    description: "",
    categoryId: "",
    spentOn: today,
  });
  const [billPaymentForm, setBillPaymentForm] = useState<BillPaymentForm>({
    paidOn: today,
    amount: "",
    categoryId: "",
    accountId: "",
    description: "",
  });
  const [incomeForm, setIncomeForm] = useState<IncomeForm>({
    title: "Salary",
    accountId: "",
    amount: "",
    nextExpectedOn: today,
  });
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategoryForm);
  const [recurringBillForm, setRecurringBillForm] = useState<RecurringBillForm>({
    title: "",
    amount: "",
    categoryId: "",
    nextDueOn: today,
  });
  const [creditCardForm, setCreditCardForm] = useState<CreditCardForm>({
    name: "",
    issuer: "",
    paymentAccountId: "",
    creditLimit: "",
    outstandingBalance: "",
    minimumDue: "",
    paymentDueDay: "",
  });
  const [loanForm, setLoanForm] = useState<LoanForm>({
    name: "",
    lender: "",
    paymentAccountId: "",
    principalAmount: "",
    outstandingBalance: "",
    emiAmount: "",
    dueDay: "",
  });

  const openBills = bills
    .filter((bill) => bill.status === "pending" || bill.status === "rescheduled")
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  const paidBills = bills.filter((bill) => bill.status === "done");
  const dueNow = openBills.filter((bill) => daysUntil(bill.dueOn) <= 7);
  const recentTransactions = dashboard?.recentTransactions ?? [];
  const activeCreditCards = dashboard?.creditCards.filter((card) => card.status === "active") ?? [];
  const activeLoans = dashboard?.loans.filter((loan) => loan.status === "active") ?? [];
  const visibleRecurringBills = recurringExpenses.filter((item) => item.status !== "archived");

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const accountMap = useMemo(
    () => new Map((dashboard?.accounts ?? []).map((account) => [account.id, account])),
    [dashboard?.accounts],
  );
  const activeIncomePlans = dashboard?.recurringIncome.filter((income) => income.status === "active") ?? [];
  const plannedIncomeMinor = getPlannedIncomeMinor(activeIncomePlans, dashboard?.plannedIncomeMinor);
  const nextIncomePlan = activeIncomePlans[0] ?? null;
  const nextBill = dueNow[0] ?? openBills[0] ?? null;
  const nextCardDue = activeCreditCards.find((card) => (card.minimumDueMinor ?? 0) > 0) ?? activeCreditCards[0] ?? null;
  const nextLoanDue = activeLoans[0] ?? null;
  const timelineGroupTitles = new Map((financeData?.timeline?.groups ?? []).flatMap((group) => group.items.map((item) => [item.id, group.title])));
  const moneyEvents: MoneyEvent[] = (financeData?.timeline?.items ?? []).map((item): MoneyEvent => {
    const accountName = typeof item.metadata.accountName === "string" ? item.metadata.accountName : null;
    const income = activeIncomePlans.find((plan) => plan.id === item.sourceId);
    const bill = bills.find((candidate) => candidate.id === item.sourceId);
    const card = activeCreditCards.find((candidate) => candidate.id === item.sourceId);
    const loan = activeLoans.find((candidate) => candidate.id === item.sourceId);

    const onAction =
      item.primaryAction?.type === "mark_income_received" && income
        ? () => void handleReceiveIncome(income, item.date)
        : item.primaryAction?.type === "pay_bill" && bill
          ? () => openBillPaymentFromAnySurface(bill)
          : item.primaryAction?.type === "pay_card_due" && card
            ? () => void handlePayCreditCard(card, item.date)
            : item.primaryAction?.type === "pay_emi" && loan
              ? () => void handlePayLoan(loan, item.date)
              : undefined;

    return {
      id: item.id,
      sortKey: item.date,
      dateLabel: formatShortDate(item.date),
      type: getTimelineType(item),
      title: item.title,
      amountMinor: item.amountMinor,
      accountName: accountName ?? (item.accountId ? accountMap.get(item.accountId)?.name ?? "Account" : "-"),
      status: getTimelineStatusLabel(item.status),
      actionLabel: item.primaryAction?.label ?? "Done",
      tone: getTimelineTone(item),
      groupTitle: timelineGroupTitles.get(item.id),
      onAction,
    };
  });

  const setupSteps = [
    { key: "account", label: "Account", done: activeAccounts.length > 0, action: () => openSetup("accounts") },
    { key: "income", label: "Salary", done: (dashboard?.recurringIncome.length ?? 0) > 0 || (dashboard?.incomeReceivedMinor ?? 0) > 0, action: () => openSetup("income") },
    { key: "dues", label: "Dues", done: recurringExpenses.some((item) => item.status === "active") || openBills.length > 0, action: () => openSetup("recurring") },
  ];
  const setupNavItems: Array<{ key: SetupTab; label: string; count: number }> = [
    { key: "accounts", label: "Accounts", count: activeAccounts.length },
    { key: "income", label: "Income", count: dashboard?.recurringIncome.filter((item) => item.status !== "archived").length ?? 0 },
    { key: "cards", label: "Cards", count: activeCreditCards.length },
    { key: "loans", label: "Loans", count: activeLoans.length },
    { key: "categories", label: "Categories", count: activeCategories.length },
    { key: "recurring", label: "Bills", count: visibleRecurringBills.length },
  ];

  if (financeQuery.isLoading && !financeData) {
    return <PageLoadingState title="Loading finance" description="Preparing your money cockpit." />;
  }

  if (financeQuery.isError || !financeData) {
    return (
      <PageErrorState
        title="Finance could not load"
        message={financeQuery.error instanceof Error ? financeQuery.error.message : undefined}
        onRetry={() => void financeQuery.refetch()}
      />
    );
  }

  function openSetup(nextTab: SetupTab) {
    setSetupTab(nextTab);
    setShowSetup(true);
  }

  async function handleCreateAccount() {
    if (!accountForm.name.trim()) return;

    await createAccountMutation.mutateAsync({
      name: accountForm.name.trim(),
      accountType: accountForm.accountType,
      currencyCode: currency,
      openingBalanceMinor: parseAmountToMinor(accountForm.openingBalance) ?? 0,
    });
    setAccountForm(emptyAccountForm);
  }

  async function handleCreateTransaction() {
    const amountMinor = parseAmountToMinor(transactionForm.amount);
    if (!amountMinor || !transactionForm.accountId) return;

    await createTransactionMutation.mutateAsync({
      accountId: transactionForm.accountId,
      transferAccountId: transactionForm.transactionType === "transfer" ? transactionForm.transferAccountId : null,
      transactionType: transactionForm.transactionType,
      amountMinor,
      currencyCode: currency,
      occurredOn: transactionForm.occurredOn || today,
      description: transactionForm.description || null,
      expenseCategoryId: transactionForm.transactionType === "expense" ? transactionForm.expenseCategoryId || null : null,
    });
    setTransactionForm((form) => ({
      ...form,
      amount: "",
      description: "",
      expenseCategoryId: "",
      transferAccountId: "",
    }));
    setShowTransactionForm(false);
  }

  async function handleCreateIncome() {
    const amountMinor = parseAmountToMinor(incomeForm.amount);
    if (!amountMinor || !incomeForm.accountId || !incomeForm.title.trim()) return;

    await createIncomeMutation.mutateAsync({
      accountId: incomeForm.accountId,
      title: incomeForm.title.trim(),
      amountMinor,
      currencyCode: currency,
      recurrenceRule: "monthly",
      nextExpectedOn: incomeForm.nextExpectedOn || today,
    });
    setIncomeForm({ title: "Salary", accountId: incomeForm.accountId, amount: "", nextExpectedOn: today });
  }

  async function handleReceiveIncome(income: {
    id: string;
    accountId: string;
    amountMinor: number;
    currencyCode?: string;
    title: string;
  }, receivedOn = today) {
    await receiveIncomeMutation.mutateAsync({
      recurringIncomeId: income.id,
      accountId: income.accountId,
      amountMinor: income.amountMinor,
      currencyCode: income.currencyCode ?? currency,
      receivedOn,
      description: income.title,
    });
  }

  async function handleAddBill() {
    if (!billForm.title.trim() || !billForm.dueOn) return;

    await createBillMutation.mutateAsync({
      title: billForm.title.trim(),
      dueOn: billForm.dueOn,
      amountMinor: billForm.amount ? parseAmountToMinor(billForm.amount) : null,
      expenseCategoryId: billForm.categoryId || null,
    });
    setBillForm({ title: "", dueOn: today, amount: "", categoryId: "" });
    setShowBillForm(false);
    setTab("bills");
  }

  async function handleAddLegacyExpense() {
    const amountMinor = parseAmountToMinor(expenseForm.amount);
    if (!amountMinor) return;

    await createExpenseMutation.mutateAsync({
      spentOn: expenseForm.spentOn || today,
      amountMinor,
      currencyCode: currency,
      description: expenseForm.description || "Expense",
      expenseCategoryId: expenseForm.categoryId || null,
      source: "manual",
    });
    setExpenseForm({ amount: "", description: "", categoryId: "", spentOn: today });
    setShowExpenseForm(false);
  }

  function openBillPayment(bill: FinanceBillItem) {
    setBillPaymentForm({
      paidOn: bill.paidAt?.slice(0, 10) ?? today,
      amount: bill.amountMinor != null ? String(bill.amountMinor / 100) : "",
      description: bill.title,
      categoryId: bill.expenseCategoryId ?? "",
      accountId: activeAccounts[0]?.id ?? "",
    });
    setPayingBillId(bill.id);
  }

  function openBillPaymentFromAnySurface(bill: FinanceBillItem) {
    setTab("bills");
    openBillPayment(bill);
  }

  async function handlePayAndLogBill(bill: FinanceBillItem) {
    await payAndLogBillMutation.mutateAsync({
      billId: bill.id,
      paidOn: billPaymentForm.paidOn || today,
      amountMinor: billPaymentForm.amount ? parseAmountToMinor(billPaymentForm.amount) : null,
      description: billPaymentForm.description || bill.title,
      expenseCategoryId: billPaymentForm.categoryId || null,
      accountId: billPaymentForm.accountId || null,
      currencyCode: currency,
    });
    setPayingBillId(null);
  }

  async function handleBillReschedule(billId: string) {
    if (!rescheduleDate) return;
    const bill = bills.find((item) => item.id === billId);
    await rescheduleBillMutation.mutateAsync({ billId, dueOn: rescheduleDate, previousDueOn: bill?.dueOn ?? null });
    setReschedulingBillId(null);
    setRescheduleDate("");
  }

  async function handleCreateCategory() {
    if (!categoryForm.name.trim()) return;

    await createCategoryMutation.mutateAsync({
      name: categoryForm.name.trim(),
      color: categoryForm.color || null,
    });
    setCategoryForm(emptyCategoryForm);
  }

  async function handleCreateRecurringBill() {
    const amountMinor = recurringBillForm.amount ? parseAmountToMinor(recurringBillForm.amount) : null;
    if (!recurringBillForm.title.trim() || !recurringBillForm.nextDueOn) return;

    const rule = getDefaultRecurrenceRule("finance", recurringBillForm.nextDueOn);
    await createRecurringMutation.mutateAsync({
      title: recurringBillForm.title.trim(),
      expenseCategoryId: recurringBillForm.categoryId || undefined,
      defaultAmountMinor: amountMinor,
      currencyCode: currency,
      recurrenceRule: formatLegacyFinanceRecurrenceRule(rule),
      recurrence: buildRecurrenceInput(rule),
      nextDueOn: recurringBillForm.nextDueOn,
      remindDaysBefore: 3,
    });
    setRecurringBillForm({ title: "", amount: "", categoryId: "", nextDueOn: today });
  }

  async function handleCreateCreditCard() {
    const creditLimitMinor = parseAmountToMinor(creditCardForm.creditLimit);
    if (!creditCardForm.name.trim() || !creditLimitMinor) return;

    await createCreditCardMutation.mutateAsync({
      name: creditCardForm.name.trim(),
      issuer: creditCardForm.issuer || null,
      paymentAccountId: creditCardForm.paymentAccountId || null,
      creditLimitMinor,
      outstandingBalanceMinor: parseAmountToMinor(creditCardForm.outstandingBalance) ?? 0,
      minimumDueMinor: creditCardForm.minimumDue ? parseAmountToMinor(creditCardForm.minimumDue) : null,
      paymentDueDay: creditCardForm.paymentDueDay ? Number(creditCardForm.paymentDueDay) : null,
      currencyCode: currency,
    });
    setCreditCardForm({
      name: "",
      issuer: "",
      paymentAccountId: "",
      creditLimit: "",
      outstandingBalance: "",
      minimumDue: "",
      paymentDueDay: "",
    });
  }

  async function handleCreateLoan() {
    const outstandingBalanceMinor = parseAmountToMinor(loanForm.outstandingBalance);
    const emiAmountMinor = parseAmountToMinor(loanForm.emiAmount);
    if (!loanForm.name.trim() || !outstandingBalanceMinor || !emiAmountMinor) return;

    await createLoanMutation.mutateAsync({
      name: loanForm.name.trim(),
      lender: loanForm.lender || null,
      paymentAccountId: loanForm.paymentAccountId || null,
      principalAmountMinor: loanForm.principalAmount ? parseAmountToMinor(loanForm.principalAmount) : null,
      outstandingBalanceMinor,
      emiAmountMinor,
      dueDay: loanForm.dueDay ? Number(loanForm.dueDay) : null,
      currencyCode: currency,
    });
    setLoanForm({
      name: "",
      lender: "",
      paymentAccountId: "",
      principalAmount: "",
      outstandingBalance: "",
      emiAmount: "",
      dueDay: "",
    });
  }

  async function handlePayCreditCard(card: {
    id: string;
    paymentAccountId: string | null;
    outstandingBalanceMinor: number;
    minimumDueMinor: number | null;
  }, paidOn = today) {
    const amountMinor = card.minimumDueMinor ?? card.outstandingBalanceMinor;
    if (!card.paymentAccountId || amountMinor <= 0) return;

    await payCreditCardMutation.mutateAsync({
      creditCardId: card.id,
      accountId: card.paymentAccountId,
      amountMinor,
      paidOn,
    });
  }

  async function handlePayLoan(loan: {
    id: string;
    paymentAccountId: string | null;
    emiAmountMinor: number;
  }, paidOn = today) {
    if (!loan.paymentAccountId || loan.emiAmountMinor <= 0) return;

    await payLoanMutation.mutateAsync({
      loanId: loan.id,
      accountId: loan.paymentAccountId,
      amountMinor: loan.emiAmountMinor,
      paidOn,
    });
  }

  return (
    <div className="fc">
      <header className="fc__header">
        <div className="fc__title-row">
          <h1>Finance</h1>
          <div className="month-nav">
            <button
              aria-label="Previous month"
              className="month-nav__btn"
              type="button"
              onClick={() => setSelectedMonth(navigateMonth(selectedMonth, -1))}
            >
              ‹
            </button>
            <button
              aria-label="Go to current month"
              className="month-nav__label"
              type="button"
              onClick={() => setSelectedMonth(currentMonth)}
            >
              {formatMonthLabel(selectedMonth)}
            </button>
            <button
              aria-label="Next month"
              className="month-nav__btn"
              type="button"
              disabled={selectedMonth >= currentMonth}
              onClick={() => setSelectedMonth(navigateMonth(selectedMonth, 1))}
            >
              ›
            </button>
          </div>
        </div>
        <div className="fc__actions">
          <button className="button button--primary button--small" type="button" onClick={() => setShowTransactionForm(true)}>Add entry</button>
          <button className="button button--ghost button--small" type="button" onClick={() => setShowBillForm(true)}>Add bill</button>
          <button className="button button--ghost button--small" type="button" onClick={() => openSetup("accounts")}>Setup</button>
        </div>
      </header>

      {financeData.sectionErrors.dashboard ? (
        <InlineErrorState message={financeData.sectionErrors.dashboard.message} onRetry={() => void financeQuery.refetch()} />
      ) : null}

      <div className="fc__body">
        <main className="fc-workbench">
          <SafeThisMonthPanel
            currency={currency}
            safeToSpendMinor={dashboard?.safeToSpendMinor ?? 0}
            cashAvailableMinor={dashboard?.cashAvailableMinor ?? 0}
            plannedIncomeMinor={plannedIncomeMinor}
            reservedMinor={dashboard?.safeToSpendBreakdown.totalDeductionsMinor ?? ((dashboard?.upcomingDueMinor ?? 0) + (dashboard?.debtDueMinor ?? 0))}
            totalSpentMinor={dashboard?.totalSpentMinor ?? 0}
          />
          <MonthJourney
            month={selectedMonth}
            currency={currency}
            incomePlan={nextIncomePlan}
            nextBill={nextBill}
            nextCard={nextCardDue}
            nextLoan={nextLoanDue}
            goals={insights?.moneyGoals ?? []}
            onMarkIncomeReceived={nextIncomePlan ? () => void handleReceiveIncome(nextIncomePlan) : () => openSetup("income")}
            onOpenBills={() => setTab("bills")}
            onOpenDebt={() => setTab("debt")}
            onOpenGoals={() => setTab("overview")}
          />
          <nav className="fc-tabs" aria-label="Finance sections">
            {(["overview", "timeline", "transactions", "accounts", "debt"] as const).map((item) => (
              <button
                key={item}
                className={`fc-tab${tab === item ? " fc-tab--active" : ""}`}
                type="button"
                onClick={() => setTab(item)}
              >
                {item === "overview" ? "Overview" : item === "timeline" ? "Timeline" : item === "transactions" ? "Transactions" : item === "accounts" ? "Accounts" : "Debt"}
              </button>
            ))}
          </nav>

          {showTransactionForm ? (
            <FinanceTransactionEditor
              accounts={activeAccounts}
              categories={activeCategories}
              form={transactionForm}
              setForm={setTransactionForm}
              isSaving={createTransactionMutation.isPending}
              onSave={() => void handleCreateTransaction()}
              onCancel={() => setShowTransactionForm(false)}
            />
          ) : null}

          {showBillForm ? (
            <FinanceBillEditor
              categories={activeCategories}
              form={billForm}
              setForm={setBillForm}
              isSaving={createBillMutation.isPending}
              onSave={() => void handleAddBill()}
              onCancel={() => setShowBillForm(false)}
              onManageCategories={() => openSetup("categories")}
            />
          ) : null}

          {tab === "overview" ? (
            <section className="fc-panel">
              <div className="fc-section-head">
                <h2>Upcoming events</h2>
                <button className="button button--ghost button--small" type="button" onClick={() => setTab("timeline")}>Full timeline</button>
              </div>
              {financeData.sectionErrors.timeline ? (
                <InlineErrorState message={financeData.sectionErrors.timeline.message} onRetry={() => void financeQuery.refetch()} />
              ) : (
                <MoneyEventsTable events={moneyEvents.slice(0, 6)} currency={currency} />
              )}

              {setupSteps.some((step) => !step.done) ? (
                <div className="fc-setup-strip">
                  {setupSteps.map((step) => (
                    <button key={step.key} className={`fc-setup-step${step.done ? " fc-setup-step--done" : ""}`} type="button" onClick={step.action}>
                      <span>{step.done ? "✓" : "○"}</span>
                      {step.label}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="fc-section-head">
                <h2>Recent money</h2>
                <button className="button button--ghost button--small" type="button" onClick={() => setTab("transactions")}>All</button>
              </div>
              <TransactionList
                transactions={recentTransactions.slice(0, 8)}
                currency={currency}
                accountMap={accountMap}
                categoryMap={categoryMap}
              />
            </section>
          ) : null}

          {tab === "timeline" ? (
            <section className="fc-panel">
              <div className="fc-section-head">
                <h2>Timeline</h2>
                <button className="button button--ghost button--small" type="button" onClick={() => setShowTransactionForm(true)}>Add entry</button>
              </div>
              {financeData.sectionErrors.timeline ? (
                <InlineErrorState message={financeData.sectionErrors.timeline.message} onRetry={() => void financeQuery.refetch()} />
              ) : (
                <MoneyEventsTable events={moneyEvents} currency={currency} showGroups />
              )}
            </section>
          ) : null}

          {tab === "transactions" ? (
            <section className="fc-panel">
              <div className="fc-section-head">
                <h2>Transactions</h2>
                <div className="button-row button-row--tight">
                  <button className="button button--primary button--small" type="button" onClick={() => setShowTransactionForm(true)}>Add entry</button>
                  <button className="button button--ghost button--small" type="button" onClick={() => setShowExpenseForm((value) => !value)}>Legacy expense</button>
                </div>
              </div>
              {showExpenseForm ? (
                <FinanceLegacyExpenseEditor
                  categories={activeCategories}
                  form={expenseForm}
                  setForm={setExpenseForm}
                  isSaving={createExpenseMutation.isPending}
                  onSave={() => void handleAddLegacyExpense()}
                />
              ) : null}
              <TransactionList transactions={recentTransactions} currency={currency} accountMap={accountMap} categoryMap={categoryMap} />
            </section>
          ) : null}

          {tab === "bills" ? (
            <section className="fc-panel">
              <div className="fc-section-head">
                <h2>Bills</h2>
                <span className="fc-muted">{openBills.length} open · {paidBills.length} paid</span>
              </div>
              {bills.length > 0 ? (
                <div className="fc-list">
                  {[...openBills, ...paidBills].map((bill) => (
                    <BillRow
                      key={bill.id}
                      bill={bill}
                      currency={currency}
                      payingBillId={payingBillId}
                      reschedulingBillId={reschedulingBillId}
                      rescheduleDate={rescheduleDate}
                      setRescheduleDate={setRescheduleDate}
                      onPay={openBillPayment}
                      onMarkPaid={(item) => void markBillPaidMutation.mutateAsync({ billId: item.id, paidOn: today })}
                      onDrop={(item) => void dismissBillMutation.mutateAsync(item.id)}
                      onStartReschedule={(item) => {
                        setReschedulingBillId(item.id);
                        setRescheduleDate(item.dueOn);
                      }}
                      onReschedule={handleBillReschedule}
                      onCancelReschedule={() => setReschedulingBillId(null)}
                      paymentForm={billPaymentForm}
                      setPaymentForm={setBillPaymentForm}
                      categories={activeCategories}
                      accounts={activeAccounts}
                      onPayAndLog={handlePayAndLogBill}
                      isPaying={payAndLogBillMutation.isPending}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState title="No bills" description="Add a bill or recurring due from setup." actionLabel="Add bill" onAction={() => setShowBillForm(true)} />
              )}
            </section>
          ) : null}

          {tab === "accounts" ? (
            <section className="fc-panel">
              <div className="fc-section-head">
                <h2>Accounts</h2>
                <button className="button button--primary button--small" type="button" onClick={() => openSetup("accounts")}>Add account</button>
              </div>
              {dashboard?.accounts.length ? (
                <div className="fc-account-grid">
                  {dashboard.accounts.map((account) => (
                    <div key={account.id} className={`fc-account${account.archivedAt ? " fc-account--archived" : ""}`}>
                      <span className="fc-label">{account.accountType}</span>
                      <strong>{account.name}</strong>
                      <span>{formatMinorCurrency(account.currentBalanceMinor, account.currencyCode)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No accounts" description="Add one account to start tracking cash." actionLabel="Add account" onAction={() => openSetup("accounts")} />
              )}
            </section>
          ) : null}

          {tab === "debt" ? (
            <section className="fc-panel">
              <div className="fc-section-head">
                <h2>Debt</h2>
                <div className="button-row button-row--tight">
                  <button className="button button--primary button--small" type="button" onClick={() => openSetup("cards")}>Add card</button>
                  <button className="button button--ghost button--small" type="button" onClick={() => openSetup("loans")}>Add loan</button>
                </div>
              </div>
              <DebtSummary
                creditCards={activeCreditCards}
                loans={activeLoans}
                currency={currency}
                outstandingMinor={dashboard?.debtOutstandingMinor ?? 0}
                dueMinor={dashboard?.debtDueMinor ?? 0}
              />
              <DebtList
                creditCards={activeCreditCards}
                loans={activeLoans}
                currency={currency}
                onArchiveCard={(cardId) => void updateCreditCardMutation.mutateAsync({ creditCardId: cardId, status: "archived" })}
                onArchiveLoan={(loanId) => void updateLoanMutation.mutateAsync({ loanId, status: "archived" })}
                onPayCard={(card) => void handlePayCreditCard(card)}
                onPayLoan={(loan) => void handlePayLoan(loan)}
                isPaying={payCreditCardMutation.isPending || payLoanMutation.isPending}
              />
            </section>
          ) : null}
        </main>

        <aside className="fc-rail">
          <TodayMoneyActions
            incomePlan={nextIncomePlan}
            nextBill={nextBill}
            nextCard={nextCardDue}
            nextLoan={nextLoanDue}
            currency={currency}
            onMarkIncomeReceived={nextIncomePlan ? () => void handleReceiveIncome(nextIncomePlan) : undefined}
            onOpenBill={nextBill ? () => openBillPaymentFromAnySurface(nextBill) : undefined}
            onOpenDebt={() => setTab("debt")}
            onAddBill={() => setShowBillForm(true)}
          />
          <SafeSpendMath
            currency={currency}
            breakdown={dashboard?.safeToSpendBreakdown ?? null}
          />
          <QuickLinks
            onTransactions={() => setTab("transactions")}
            onAccounts={() => setTab("accounts")}
            onBills={() => setTab("bills")}
            onDebt={() => setTab("debt")}
          />
          <FinancePlanPanel
            monthPlan={monthPlan}
            monthTotalSpentMinor={dashboard?.totalSpentMinor ?? summary?.totalSpentMinor ?? 0}
            previousMonthTotalSpentMinor={summary?.previousMonthTotalSpentMinor ?? 0}
            currencyCode={currency}
            categories={activeCategories}
            categoryTotals={summary?.categoryTotals ?? []}
            isCurrentMonth={selectedMonth === currentMonth}
            errorMessage={financeData.sectionErrors.monthPlan?.message ?? null}
            isSaving={updateFinanceMonthPlanMutation.isPending}
            onRetry={() => void financeQuery.refetch()}
            onSave={(payload) => updateFinanceMonthPlanMutation.mutateAsync(payload)}
          />
          <FinanceInsightsPanel
            insights={insights}
            currencyCode={currency}
            errorMessage={financeData.sectionErrors.insights?.message ?? null}
            savingGoalId={updateFinanceGoalMutation.isPending ? updateFinanceGoalMutation.variables?.goalId ?? null : null}
            onRetry={() => void financeQuery.refetch()}
            onSaveGoal={(goalId, payload) => updateFinanceGoalMutation.mutateAsync({ goalId, ...payload })}
          />
        </aside>
      </div>

      {showSetup ? (
        <FinanceSetupDrawer
          activeAccounts={activeAccounts}
          activeCategories={activeCategories}
          activeCreditCards={activeCreditCards}
          activeLoans={activeLoans}
          accountForm={accountForm}
          accountMap={accountMap}
          accounts={dashboard?.accounts ?? []}
          categoryForm={categoryForm}
          categoryMap={categoryMap}
          closeButtonRef={setupCloseButtonRef}
          creditCardForm={creditCardForm}
          currency={currency}
          drawerRef={setupDrawerRef}
          incomeForm={incomeForm}
          incomePlans={dashboard?.recurringIncome ?? []}
          isCreatingAccount={createAccountMutation.isPending}
          isCreatingCategory={createCategoryMutation.isPending}
          isCreatingCreditCard={createCreditCardMutation.isPending}
          isCreatingIncome={createIncomeMutation.isPending}
          isCreatingLoan={createLoanMutation.isPending}
          isCreatingRecurringBill={createRecurringMutation.isPending}
          isReceivingIncome={receiveIncomeMutation.isPending}
          isUndoingIncome={undoIncomeReceiptMutation.isPending}
          isUpdatingAccount={updateAccountMutation.isPending}
          isUpdatingCategory={updateCategoryMutation.isPending}
          isUpdatingCreditCard={updateCreditCardMutation.isPending}
          isUpdatingIncome={updateIncomeMutation.isPending}
          isUpdatingLoan={updateLoanMutation.isPending}
          isUpdatingRecurringBill={updateRecurringMutation.isPending}
          loanForm={loanForm}
          onArchiveAccount={(accountId) => void updateAccountMutation.mutateAsync({ accountId, archived: true })}
          onArchiveCard={(cardId) => void updateCreditCardMutation.mutateAsync({ creditCardId: cardId, status: "archived" })}
          onArchiveCategory={(categoryId) => void updateCategoryMutation.mutateAsync({ categoryId, archived: true })}
          onArchiveIncome={(incomeId) => void updateIncomeMutation.mutateAsync({ recurringIncomeId: incomeId, status: "archived" })}
          onArchiveLoan={(loanId) => void updateLoanMutation.mutateAsync({ loanId, status: "archived" })}
          onArchiveRecurringBill={(recurringExpenseId) => void updateRecurringMutation.mutateAsync({ recurringExpenseId, status: "archived" })}
          onClose={closeSetup}
          onCreateAccount={() => void handleCreateAccount()}
          onCreateCategory={() => void handleCreateCategory()}
          onCreateCreditCard={() => void handleCreateCreditCard()}
          onCreateIncome={() => void handleCreateIncome()}
          onCreateLoan={() => void handleCreateLoan()}
          onCreateRecurringBill={() => void handleCreateRecurringBill()}
          onMarkIncomeReceived={(income) => void handleReceiveIncome(income)}
          onPauseIncome={(incomeId) => void updateIncomeMutation.mutateAsync({ recurringIncomeId: incomeId, status: "paused" })}
          onRestoreAccount={(accountId) => void updateAccountMutation.mutateAsync({ accountId, archived: false })}
          onToggleRecurringBill={(item) => void updateRecurringMutation.mutateAsync({ recurringExpenseId: item.id, status: item.status === "active" ? "paused" : "active" })}
          onUndoIncomeReceipt={(incomeId) => void undoIncomeReceiptMutation.mutateAsync({ recurringIncomeId: incomeId })}
          plannedIncomeMinor={plannedIncomeMinor}
          recurringBillForm={recurringBillForm}
          setupNavItems={setupNavItems}
          setupTab={setupTab}
          setAccountForm={setAccountForm}
          setCategoryForm={setCategoryForm}
          setCreditCardForm={setCreditCardForm}
          setIncomeForm={setIncomeForm}
          setLoanForm={setLoanForm}
          setRecurringBillForm={setRecurringBillForm}
          setSetupTab={setSetupTab}
          totalCashMinor={dashboard?.cashAvailableMinor ?? 0}
          visibleRecurringBills={visibleRecurringBills}
        />
      ) : null}
    </div>
  );
}
