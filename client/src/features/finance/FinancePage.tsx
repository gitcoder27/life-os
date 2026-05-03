import { useCallback, useMemo, useRef, useState, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from "react";

import {
  daysUntil,
  formatDueLabel,
  formatMinorCurrency,
  formatMonthLabel,
  formatShortDate,
  type FinanceDashboardResponse,
  getMonthString,
  getTodayDate,
  parseAmountToMinor,
  type FinanceBillItem,
  type FinanceTransactionType,
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
  formatFullRecurrenceSummary,
  formatLegacyFinanceRecurrenceRule,
  getDefaultRecurrenceRule,
  isRecurring,
  type RecurrenceDefinition,
} from "../../shared/lib/recurrence";
import {
  EmptyState,
  InlineErrorState,
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";
import { useDialogAccessibility } from "../../shared/ui/DialogSurface";
import { buildRecurrenceInput } from "../../shared/ui/RecurrenceEditor";
import { FinanceInsightsPanel } from "./FinanceInsightsPanel";
import { FinancePlanPanel } from "./FinancePlanPanel";
import {
  formatSafeSpendLineAmount,
  getBillDueText,
  getBillStatusLabel,
  getMonthShort,
  getPlannedIncomeMinor,
  getTimelineStatusLabel,
  getTimelineTone,
  getTimelineType,
  navigateMonth,
  type MoneyEvent,
} from "./finance-page-model";

type CockpitTab = "overview" | "timeline" | "transactions" | "bills" | "accounts" | "debt";
type SetupTab = "accounts" | "income" | "cards" | "loans" | "categories" | "recurring";

type AccountForm = {
  name: string;
  accountType: "bank" | "cash" | "wallet" | "other";
  openingBalance: string;
};

type TransactionForm = {
  transactionType: FinanceTransactionType;
  accountId: string;
  transferAccountId: string;
  amount: string;
  occurredOn: string;
  description: string;
  expenseCategoryId: string;
};

type BillForm = {
  title: string;
  dueOn: string;
  amount: string;
  categoryId: string;
};

type BillPaymentForm = {
  paidOn: string;
  amount: string;
  categoryId: string;
  accountId: string;
  description: string;
};

type IncomeForm = {
  title: string;
  accountId: string;
  amount: string;
  nextExpectedOn: string;
};

type CategoryForm = {
  name: string;
  color: string;
};

type RecurringBillForm = {
  title: string;
  amount: string;
  categoryId: string;
  nextDueOn: string;
};

type CreditCardForm = {
  name: string;
  issuer: string;
  paymentAccountId: string;
  creditLimit: string;
  outstandingBalance: string;
  minimumDue: string;
  paymentDueDay: string;
};

type LoanForm = {
  name: string;
  lender: string;
  paymentAccountId: string;
  principalAmount: string;
  outstandingBalance: string;
  emiAmount: string;
  dueDay: string;
};

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
  const [expenseForm, setExpenseForm] = useState({
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
    await rescheduleBillMutation.mutateAsync({ billId, dueOn: rescheduleDate });
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
            <button className="month-nav__btn" type="button" onClick={() => setSelectedMonth(navigateMonth(selectedMonth, -1))}>‹</button>
            <button className="month-nav__label" type="button" onClick={() => setSelectedMonth(currentMonth)}>
              {formatMonthLabel(selectedMonth)}
            </button>
            <button
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
            <section className="fc-editor">
              <div className="fc-form-grid">
                <label className="field">
                  <span>Type</span>
                  <select value={transactionForm.transactionType} onChange={(event) => setTransactionForm((form) => ({ ...form, transactionType: event.target.value as FinanceTransactionType }))}>
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                    <option value="transfer">Transfer</option>
                    <option value="adjustment">Adjustment</option>
                  </select>
                </label>
                <label className="field">
                  <span>Account</span>
                  <select value={transactionForm.accountId} onChange={(event) => setTransactionForm((form) => ({ ...form, accountId: event.target.value }))}>
                    <option value="">Select</option>
                    {activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                  </select>
                </label>
                {transactionForm.transactionType === "transfer" ? (
                  <label className="field">
                    <span>To</span>
                    <select value={transactionForm.transferAccountId} onChange={(event) => setTransactionForm((form) => ({ ...form, transferAccountId: event.target.value }))}>
                      <option value="">Select</option>
                      {activeAccounts.filter((account) => account.id !== transactionForm.accountId).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                    </select>
                  </label>
                ) : null}
                <label className="field">
                  <span>Amount</span>
                  <input type="text" inputMode="decimal" value={transactionForm.amount} onChange={(event) => setTransactionForm((form) => ({ ...form, amount: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Date</span>
                  <input type="date" value={transactionForm.occurredOn} onChange={(event) => setTransactionForm((form) => ({ ...form, occurredOn: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Category</span>
                  <select value={transactionForm.expenseCategoryId} onChange={(event) => setTransactionForm((form) => ({ ...form, expenseCategoryId: event.target.value }))} disabled={transactionForm.transactionType !== "expense"}>
                    <option value="">None</option>
                    {activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>
                <label className="field fc-field--wide">
                  <span>Description</span>
                  <input type="text" value={transactionForm.description} onChange={(event) => setTransactionForm((form) => ({ ...form, description: event.target.value }))} />
                </label>
              </div>
              <div className="button-row">
                <button className="button button--primary button--small" type="button" disabled={createTransactionMutation.isPending} onClick={() => void handleCreateTransaction()}>
                  {createTransactionMutation.isPending ? "Saving..." : "Save entry"}
                </button>
                <button className="button button--ghost button--small" type="button" onClick={() => setShowTransactionForm(false)}>Cancel</button>
              </div>
            </section>
          ) : null}

          {showBillForm ? (
            <section className="fc-editor">
              <div className="fc-form-grid">
                <label className="field fc-field--wide">
                  <span>Bill</span>
                  <input type="text" value={billForm.title} onChange={(event) => setBillForm((form) => ({ ...form, title: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Due</span>
                  <input type="date" value={billForm.dueOn} onChange={(event) => setBillForm((form) => ({ ...form, dueOn: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Amount</span>
                  <input type="text" inputMode="decimal" value={billForm.amount} onChange={(event) => setBillForm((form) => ({ ...form, amount: event.target.value }))} />
                </label>
                <label className="field">
                  <span className="field__split-label">
                    Category
                    <button type="button" onClick={() => openSetup("categories")}>Manage</button>
                  </span>
                  <select value={billForm.categoryId} onChange={(event) => setBillForm((form) => ({ ...form, categoryId: event.target.value }))}>
                    <option value="">None</option>
                    {activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>
              </div>
              <div className="button-row">
                <button className="button button--primary button--small" type="button" disabled={createBillMutation.isPending} onClick={() => void handleAddBill()}>
                  {createBillMutation.isPending ? "Saving..." : "Save bill"}
                </button>
                <button className="button button--ghost button--small" type="button" onClick={() => setShowBillForm(false)}>Cancel</button>
              </div>
            </section>
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
                <section className="fc-editor fc-editor--nested">
                  <div className="fc-form-grid">
                    <label className="field">
                      <span>Amount</span>
                      <input type="text" inputMode="decimal" value={expenseForm.amount} onChange={(event) => setExpenseForm((form) => ({ ...form, amount: event.target.value }))} />
                    </label>
                    <label className="field">
                      <span>Date</span>
                      <input type="date" value={expenseForm.spentOn} onChange={(event) => setExpenseForm((form) => ({ ...form, spentOn: event.target.value }))} />
                    </label>
                    <label className="field">
                      <span>Category</span>
                      <select value={expenseForm.categoryId} onChange={(event) => setExpenseForm((form) => ({ ...form, categoryId: event.target.value }))}>
                        <option value="">None</option>
                        {activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                      </select>
                    </label>
                    <label className="field fc-field--wide">
                      <span>Description</span>
                      <input type="text" value={expenseForm.description} onChange={(event) => setExpenseForm((form) => ({ ...form, description: event.target.value }))} />
                    </label>
                  </div>
                  <button className="button button--primary button--small" type="button" disabled={createExpenseMutation.isPending} onClick={() => void handleAddLegacyExpense()}>Save expense</button>
                </section>
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
        <div className="setup-drawer__backdrop" onClick={closeSetup}>
          <aside
            ref={setupDrawerRef}
            className="setup-drawer setup-drawer--money"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finance-setup-drawer-title"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="setup-drawer__header">
              <h2 className="setup-drawer__title" id="finance-setup-drawer-title">Money setup</h2>
              <button ref={setupCloseButtonRef} className="button button--ghost button--small" type="button" onClick={closeSetup}>Close</button>
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
                    <button className="button button--primary button--small" type="button" disabled={createAccountMutation.isPending} onClick={() => void handleCreateAccount()}>Add account</button>
                  </SetupBlock>
                  <SetupBlock title="Accounts" meta={formatMinorCurrency(dashboard?.cashAvailableMinor ?? 0, currency)}>
                    <SetupAccountList
                      accounts={dashboard?.accounts ?? []}
                      currency={currency}
                      isUpdating={updateAccountMutation.isPending}
                      onArchive={(accountId) => void updateAccountMutation.mutateAsync({ accountId, archived: true })}
                      onRestore={(accountId) => void updateAccountMutation.mutateAsync({ accountId, archived: false })}
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
                    <button className="button button--primary button--small" type="button" disabled={createIncomeMutation.isPending} onClick={() => void handleCreateIncome()}>Add income</button>
                  </SetupBlock>
                  <SetupBlock title="Income plans" meta={`${dashboard?.recurringIncome.filter((income) => income.status !== "archived").length ?? 0} saved`}>
                    <IncomePlanList
                      incomePlans={dashboard?.recurringIncome ?? []}
                      currency={currency}
                      accountMap={accountMap}
                      onMarkReceived={(income) => void handleReceiveIncome(income)}
                      onUndoReceipt={(incomeId) => void undoIncomeReceiptMutation.mutateAsync({ recurringIncomeId: incomeId })}
                      onPause={(incomeId) => void updateIncomeMutation.mutateAsync({ recurringIncomeId: incomeId, status: "paused" })}
                      onArchive={(incomeId) => void updateIncomeMutation.mutateAsync({ recurringIncomeId: incomeId, status: "archived" })}
                      isUpdating={updateIncomeMutation.isPending}
                      isReceiving={receiveIncomeMutation.isPending}
                      isUndoing={undoIncomeReceiptMutation.isPending}
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
                    <button className="button button--primary button--small" type="button" disabled={createCreditCardMutation.isPending} onClick={() => void handleCreateCreditCard()}>Add card</button>
                  </SetupBlock>
                  <SetupBlock title="Cards" meta={formatMinorCurrency(activeCreditCards.reduce((sum, card) => sum + card.outstandingBalanceMinor, 0), currency)}>
                    <SetupCardList
                      cards={activeCreditCards}
                      currency={currency}
                      accountMap={accountMap}
                      isUpdating={updateCreditCardMutation.isPending}
                      onArchive={(cardId) => void updateCreditCardMutation.mutateAsync({ creditCardId: cardId, status: "archived" })}
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
                    <button className="button button--primary button--small" type="button" disabled={createLoanMutation.isPending} onClick={() => void handleCreateLoan()}>Add loan</button>
                  </SetupBlock>
                  <SetupBlock title="Loans" meta={formatMinorCurrency(activeLoans.reduce((sum, loan) => sum + loan.outstandingBalanceMinor, 0), currency)}>
                    <SetupLoanList
                      loans={activeLoans}
                      currency={currency}
                      accountMap={accountMap}
                      isUpdating={updateLoanMutation.isPending}
                      onArchive={(loanId) => void updateLoanMutation.mutateAsync({ loanId, status: "archived" })}
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
                    <button className="button button--primary button--small" type="button" disabled={createCategoryMutation.isPending} onClick={() => void handleCreateCategory()}>Add category</button>
                  </SetupBlock>
                  <SetupBlock title="Categories" meta="For bills and expenses">
                    <SetupCategoryList
                      categories={activeCategories}
                      isUpdating={updateCategoryMutation.isPending}
                      onArchive={(categoryId) => void updateCategoryMutation.mutateAsync({ categoryId, archived: true })}
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
                      <label className="field">
                        <span className="field__split-label">
                          Category
                          <button type="button" onClick={() => setSetupTab("categories")}>Manage</button>
                        </span>
                        <select value={recurringBillForm.categoryId} onChange={(event) => setRecurringBillForm((form) => ({ ...form, categoryId: event.target.value }))}>
                          <option value="">None</option>
                          {activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                        </select>
                      </label>
                      <label className="field">
                        <span>Next due</span>
                        <input type="date" value={recurringBillForm.nextDueOn} onChange={(event) => setRecurringBillForm((form) => ({ ...form, nextDueOn: event.target.value }))} />
                      </label>
                    </div>
                    <button className="button button--primary button--small" type="button" disabled={createRecurringMutation.isPending} onClick={() => void handleCreateRecurringBill()}>Add recurring bill</button>
                  </SetupBlock>
                  <SetupBlock title="Recurring bills" meta={formatMinorCurrency(visibleRecurringBills.reduce((sum, item) => sum + (item.defaultAmountMinor ?? 0), 0), currency)}>
                    <SetupRecurringBillList
                      recurringBills={visibleRecurringBills}
                      currency={currency}
                      categoryMap={categoryMap}
                      isUpdating={updateRecurringMutation.isPending}
                      onToggle={(item) => void updateRecurringMutation.mutateAsync({ recurringExpenseId: item.id, status: item.status === "active" ? "paused" : "active" })}
                      onArchive={(recurringExpenseId) => void updateRecurringMutation.mutateAsync({ recurringExpenseId, status: "archived" })}
                    />
                  </SetupBlock>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function SafeThisMonthPanel({
  currency,
  safeToSpendMinor,
  cashAvailableMinor,
  plannedIncomeMinor,
  reservedMinor,
  totalSpentMinor,
}: {
  currency: string;
  safeToSpendMinor: number;
  cashAvailableMinor: number;
  plannedIncomeMinor: number;
  reservedMinor: number;
  totalSpentMinor: number;
}) {
  const allocationTotalMinor = Math.max(
    Math.abs(safeToSpendMinor) + Math.max(reservedMinor, 0) + Math.max(totalSpentMinor, 0),
    1,
  );
  const reservedShare = Math.min((Math.max(reservedMinor, 0) / allocationTotalMinor) * 100, 100);
  const spentShare = Math.min((Math.max(totalSpentMinor, 0) / allocationTotalMinor) * 100, 100);
  const metricItems = [
    {
      icon: "¤",
      label: "Cash",
      value: cashAvailableMinor,
      meta: "Available now",
    },
    {
      icon: "↗",
      label: "Expected",
      value: plannedIncomeMinor,
      meta: "This month",
    },
    {
      icon: "▣",
      label: "Reserved",
      value: reservedMinor,
      meta: "Bills, debt, plans",
    },
    {
      icon: "≡",
      label: "Spent",
      value: totalSpentMinor,
      meta: "This month",
    },
  ];

  return (
    <section className="fc-hero" aria-label="Safe this month">
      <div className="fc-hero__safe">
        <span className="fc-label">Safe to spend</span>
        <strong>{formatMinorCurrency(safeToSpendMinor, currency)}</strong>
        <div className="fc-hero__track" aria-hidden="true">
          <span
            className="fc-hero__track-fill fc-hero__track-fill--reserved"
            style={{ inlineSize: `${reservedShare}%` } as CSSProperties}
          />
          <span
            className="fc-hero__track-fill fc-hero__track-fill--spent"
            style={{ inlineSize: `${spentShare}%` } as CSSProperties}
          />
        </div>
        <span className="fc-status-dot">On track</span>
      </div>
      <div className="fc-hero__metrics">
        {metricItems.map((metric) => (
          <div className="fc-hero__metric" key={metric.label}>
            <span className="fc-icon-box">{metric.icon}</span>
            <span className="fc-label">{metric.label}</span>
            <strong>{formatMinorCurrency(metric.value, currency)}</strong>
            <small>{metric.meta}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function MonthJourney({
  month,
  currency,
  incomePlan,
  nextBill,
  nextCard,
  nextLoan,
  goals,
  onMarkIncomeReceived,
  onOpenBills,
  onOpenDebt,
  onOpenGoals,
}: {
  month: string;
  currency: string;
  incomePlan: {
    title: string;
    amountMinor: number;
    nextExpectedOn: string;
  } | null;
  nextBill: FinanceBillItem | null;
  nextCard: {
    name: string;
    minimumDueMinor: number | null;
    paymentDueDay: number | null;
  } | null;
  nextLoan: {
    name: string;
    emiAmountMinor: number;
    dueDay: number | null;
  } | null;
  goals: Array<{
    goalId: string;
    title: string;
    progressPercent: number;
  }>;
  onMarkIncomeReceived?: () => void;
  onOpenBills: () => void;
  onOpenDebt: () => void;
  onOpenGoals: () => void;
}) {
  const monthName = getMonthShort(month);

  return (
    <section className="fc-journey" aria-label="Month journey">
      <div className="fc-journey__head">
        <span className="fc-label">Month journey</span>
        <div className="fc-dayline" aria-hidden="true">
          {[25, 26, 27, 28, 29, 30].map((day) => <span key={day} className={day === 29 ? "is-today" : ""}>{day}</span>)}
          <i />
          <span>{monthName === "Dec" ? "Jan" : "May"}</span>
          {[1, 2, 3, 4, 5, 6].map((day) => <span key={`next-${day}`}>{day}</span>)}
        </div>
      </div>
      <div className="fc-lanes">
        <div className="fc-lane">
          <span className="fc-lane__name">Income</span>
          {incomePlan ? (
            <div className="fc-lane-pill fc-lane-pill--income">
              <strong>{incomePlan.title}</strong>
              <span>{formatShortDate(incomePlan.nextExpectedOn)}</span>
              <span>{formatMinorCurrency(incomePlan.amountMinor, currency)}</span>
              <button type="button" onClick={onMarkIncomeReceived}>Mark received</button>
            </div>
          ) : (
            <button className="fc-lane-clear" type="button" onClick={onMarkIncomeReceived}>Add salary</button>
          )}
        </div>
        <div className="fc-lane">
          <span className="fc-lane__name">Bills</span>
          {nextBill ? (
            <button className="fc-lane-pill" type="button" onClick={onOpenBills}>
              <strong>{nextBill.title}</strong>
              <span>{formatShortDate(nextBill.dueOn)}</span>
              <span>{nextBill.amountMinor != null ? formatMinorCurrency(nextBill.amountMinor, currency) : "Amount open"}</span>
            </button>
          ) : (
            <button className="fc-lane-clear" type="button" onClick={onOpenBills}>Clear</button>
          )}
        </div>
        <div className="fc-lane">
          <span className="fc-lane__name">Debt</span>
          {nextCard || nextLoan ? (
            <button className="fc-lane-pill" type="button" onClick={onOpenDebt}>
              <strong>{nextCard?.name ?? nextLoan?.name}</strong>
              <span>{nextCard?.paymentDueDay ?? nextLoan?.dueDay ? `${monthName} ${nextCard?.paymentDueDay ?? nextLoan?.dueDay}` : "This month"}</span>
              <span>{formatMinorCurrency(nextCard?.minimumDueMinor ?? nextLoan?.emiAmountMinor ?? 0, currency)}</span>
            </button>
          ) : (
            <button className="fc-lane-clear" type="button" onClick={onOpenDebt}>No EMI / card due</button>
          )}
        </div>
        <div className="fc-lane">
          <span className="fc-lane__name">Goals</span>
          <div className="fc-goal-chips">
            {goals.slice(0, 3).map((goal) => (
              <button key={goal.goalId} className="fc-goal-chip" type="button" onClick={onOpenGoals}>
                <span>{goal.title}</span>
                <strong>{goal.progressPercent}%</strong>
              </button>
            ))}
            {goals.length === 0 ? <button className="fc-lane-clear" type="button" onClick={onOpenGoals}>Open goals</button> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function TodayMoneyActions({
  incomePlan,
  nextBill,
  nextCard,
  nextLoan,
  currency,
  onMarkIncomeReceived,
  onOpenBill,
  onOpenDebt,
  onAddBill,
}: {
  incomePlan: {
    title: string;
    amountMinor: number;
    nextExpectedOn: string;
  } | null;
  nextBill: FinanceBillItem | null;
  nextCard: { name: string; minimumDueMinor: number | null } | null;
  nextLoan: { name: string; emiAmountMinor: number } | null;
  currency: string;
  onMarkIncomeReceived?: () => void;
  onOpenBill?: () => void;
  onOpenDebt: () => void;
  onAddBill: () => void;
}) {
  return (
    <section className="fc-rail-card">
      <span className="fc-label">Today's money actions</span>
      <div className="fc-action-list">
        {incomePlan ? (
          <button className="fc-action" type="button" onClick={onMarkIncomeReceived}>
            <span className="fc-action__icon fc-action__icon--income">↥</span>
            <span><strong>Mark {incomePlan.title.toLowerCase()} received</strong><small>Expected {formatMinorCurrency(incomePlan.amountMinor, currency)} on {formatShortDate(incomePlan.nextExpectedOn)}</small></span>
            <i>›</i>
          </button>
        ) : null}
        {nextBill ? (
          <button className="fc-action" type="button" onClick={onOpenBill}>
            <span className="fc-action__icon">▣</span>
            <span><strong>Pay {nextBill.title}</strong><small>{nextBill.amountMinor != null ? formatMinorCurrency(nextBill.amountMinor, currency) : "Amount open"} due {formatShortDate(nextBill.dueOn)}</small></span>
            <i>›</i>
          </button>
        ) : (
          <button className="fc-action" type="button" onClick={onAddBill}>
            <span className="fc-action__icon">＋</span>
            <span><strong>Add first bill</strong><small>Rent, utilities, subscriptions</small></span>
            <i>›</i>
          </button>
        )}
        {nextCard || nextLoan ? (
          <button className="fc-action" type="button" onClick={onOpenDebt}>
            <span className="fc-action__icon fc-action__icon--debt">▤</span>
            <span><strong>{nextCard ? "Review card due" : "Review EMI"}</strong><small>{formatMinorCurrency(nextCard?.minimumDueMinor ?? nextLoan?.emiAmountMinor ?? 0, currency)} upcoming</small></span>
            <i>›</i>
          </button>
        ) : null}
      </div>
    </section>
  );
}

function SafeSpendMath({
  currency,
  breakdown,
}: {
  currency: string;
  breakdown: FinanceDashboardResponse["safeToSpendBreakdown"] | null;
}) {
  const lines = breakdown?.lines ?? [];
  const detailLines = lines.filter((line) => line.role !== "result");
  const resultLine = lines.find((line) => line.role === "result");

  return (
    <section className="fc-rail-card">
      <span className="fc-label">Safe-to-spend math</span>
      <div className="fc-math">
        {detailLines.map((line) => (
          <span key={line.key} className={`fc-math__line fc-math__line--${line.role}`}>
            <span>
              {line.label}
              {line.sourceCount != null && line.sourceCount > 0 ? <em>{line.sourceCount}</em> : null}
            </span>
            <strong>{formatSafeSpendLineAmount(line, currency)}</strong>
          </span>
        ))}
        <span className="fc-math__total">
          {resultLine?.label ?? "Safe to spend"}
          <strong>{formatMinorCurrency(resultLine?.amountMinor ?? 0, currency)}</strong>
        </span>
      </div>
    </section>
  );
}

function QuickLinks({
  onTransactions,
  onAccounts,
  onBills,
  onDebt,
}: {
  onTransactions: () => void;
  onAccounts: () => void;
  onBills: () => void;
  onDebt: () => void;
}) {
  return (
    <section className="fc-rail-card">
      <span className="fc-label">Quick links</span>
      <div className="fc-links">
        <button type="button" onClick={onTransactions}>Transactions <span>›</span></button>
        <button type="button" onClick={onAccounts}>Accounts <span>›</span></button>
        <button type="button" onClick={onBills}>Bills <span>›</span></button>
        <button type="button" onClick={onDebt}>Debt <span>›</span></button>
      </div>
    </section>
  );
}

function MoneyEventsTable({
  events,
  currency,
  showGroups = false,
}: {
  events: MoneyEvent[];
  currency: string;
  showGroups?: boolean;
}) {
  if (events.length === 0) {
    return <EmptyState title="No upcoming events" description="Add income, bills, cards, or loans from setup." />;
  }

  const rows = showGroups
    ? events.flatMap((event, index) => {
      const previous = events[index - 1];
      const shouldShowGroup = event.groupTitle && previous?.groupTitle !== event.groupTitle;
      return shouldShowGroup
        ? [{ type: "group" as const, id: `group-${event.groupTitle}`, title: event.groupTitle }, { type: "event" as const, event }]
        : [{ type: "event" as const, event }];
    })
    : events.map((event) => ({ type: "event" as const, event }));

  return (
    <div className="fc-event-table">
      <div className="fc-event-table__head">
        <span>Date</span>
        <span>Type</span>
        <span>Title</span>
        <span>Amount</span>
        <span>Account</span>
        <span>Status</span>
        <span>Action</span>
      </div>
      {rows.map((row) => {
        if (row.type === "group") {
          return <div key={row.id} className="fc-event-group">{row.title}</div>;
        }

        const event = row.event;
        return (
          <div key={event.id} className="fc-event-row">
            <span>{event.dateLabel}</span>
            <span className={`fc-event-type fc-event-type--${event.type}`}>{event.type}</span>
            <strong>{event.title}</strong>
            <span className={event.tone === "positive" ? "fc-money-positive" : event.tone === "negative" ? "fc-money-negative" : ""}>
              {formatMinorCurrency(event.amountMinor, currency)}
            </span>
            <span>{event.accountName}</span>
            <span className={`fc-status fc-status--${event.tone}`}>{event.status}</span>
            {event.onAction ? (
              <button className="button button--ghost button--small" type="button" onClick={event.onAction}>{event.actionLabel}</button>
            ) : (
              <span className="fc-event-action-muted">{event.actionLabel}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SetupBlock({
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

function SetupAccountList({
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

function SetupCardList({
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

function SetupLoanList({
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

function SetupCategoryList({
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

function SetupRecurringBillList({
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

function IncomePlanList({
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

function DebtSummary({
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

function DebtList({
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

function TransactionList({
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

function BillRow({
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
  paymentForm: BillPaymentForm;
  setPaymentForm: Dispatch<SetStateAction<BillPaymentForm>>;
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
