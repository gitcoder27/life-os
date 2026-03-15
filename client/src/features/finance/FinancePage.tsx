import {
  formatDueLabel,
  formatMinorCurrency,
  formatMonthLabel,
  formatRelativeDate,
  getTodayDate,
  parseAmountToMinor,
  useCreateExpenseMutation,
  useFinanceDataQuery,
} from "../../shared/lib/api";
import { PageHeader } from "../../shared/ui/PageHeader";
import {
  EmptyState,
  InlineErrorState,
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";
import { SectionCard } from "../../shared/ui/SectionCard";

export function FinancePage() {
  const today = getTodayDate();
  const financeQuery = useFinanceDataQuery(today);
  const createExpenseMutation = useCreateExpenseMutation(today);
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
  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
  const topCategory = summary?.categoryTotals[0];

  async function handleAddExpense() {
    const amountInput = window.prompt("Enter expense amount");
    const amountMinor = amountInput ? parseAmountToMinor(amountInput) : null;
    if (!amountMinor) {
      return;
    }

    const description = window.prompt("Enter expense description") ?? "Quick expense";
    await createExpenseMutation.mutateAsync({
      spentOn: today,
      amountMinor,
      currencyCode: summary?.currencyCode ?? "USD",
      description,
      source: "quick_capture",
    });
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Spending visibility"
        title="Finance"
        description="Fast expense entry, category breakdown, and upcoming bills at a glance."
      />

      <div className="dashboard-grid stagger">
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
                {
                  label: "Top category",
                  value: topCategory ? topCategory.name : "No spend yet",
                },
                {
                  label: "Upcoming bills",
                  value: String(summary?.upcomingBills.length ?? 0),
                },
              ].map((item) => (
                <li key={item.label}>
                  <strong>{item.label}</strong>
                  <span className="list__subtle">{item.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </SectionCard>

        <SectionCard
          title="By category"
          subtitle="Spend distribution"
        >
          {financeQuery.data.sectionErrors.categories ? (
            <InlineErrorState
              message={financeQuery.data.sectionErrors.categories.message}
              onRetry={() => void financeQuery.refetch()}
            />
          ) : summary.categoryTotals.length > 0 ? (
            <div className="category-grid">
              {summary.categoryTotals.map((category) => (
                <div key={category.name} className="category-card">
                  <span className="category-card__amount">
                    {formatMinorCurrency(category.totalAmountMinor, summary.currencyCode ?? "USD")}
                  </span>
                  <span className="category-card__label">{category.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No category spend yet"
              description="Category breakdown starts after the first structured expense lands."
            />
          )}
        </SectionCard>

        <SectionCard
          title="Recent expenses"
          subtitle="Last 7 days"
        >
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
                .slice(0, 7)
                .map((expense) => (
                  <div key={expense.id} className="expense-row">
                    <div className="expense-row__info">
                      <div className="expense-row__title">{expense.description ?? "Expense"}</div>
                      <div className="expense-row__meta">
                        {categoryNameById.get(expense.expenseCategoryId ?? "") ?? "Uncategorized"} &middot; {formatRelativeDate(expense.spentOn)}
                      </div>
                    </div>
                    <span className="expense-row__amount">
                      {formatMinorCurrency(expense.amountMinor, expense.currencyCode)}
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <EmptyState
              title="No recent expenses"
              description="Recent expense history appears after the first log."
            />
          )}
        </SectionCard>

        <SectionCard
          title="Recurring"
          subtitle="Upcoming bills"
        >
          {financeQuery.data.sectionErrors.recurringExpenses ? (
            <InlineErrorState
              message={financeQuery.data.sectionErrors.recurringExpenses.message}
              onRetry={() => void financeQuery.refetch()}
            />
          ) : recurringExpenses.length > 0 ? (
            <div>
              {recurringExpenses.map((item) => (
                <div key={item.id} className="expense-row">
                  <div className="expense-row__info">
                    <div className="expense-row__title">{item.title}</div>
                    <div className="expense-row__meta">Due in {formatDueLabel(item.nextDueOn)}</div>
                  </div>
                  <span className="expense-row__amount">
                    {formatMinorCurrency(item.defaultAmountMinor, item.currencyCode)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No recurring bills"
              description="Recurring expense templates have not been set up yet."
            />
          )}
          <button
            className="button button--primary"
            type="button"
            style={{ marginTop: "0.85rem", width: "100%" }}
            onClick={() => void handleAddExpense()}
          >
            Add expense
          </button>
        </SectionCard>
      </div>
    </div>
  );
}
