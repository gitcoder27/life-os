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
import { SectionCard } from "../../shared/ui/SectionCard";

export function FinancePage() {
  const today = getTodayDate();
  const financeQuery = useFinanceDataQuery(today);
  const createExpenseMutation = useCreateExpenseMutation(today);
  const summary = financeQuery.data?.summary;
  const expenses = financeQuery.data?.expenses.expenses ?? [];
  const recurringExpenses = financeQuery.data?.recurringExpenses.recurringExpenses ?? [];
  const categories = financeQuery.data?.categories.categories ?? [];
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
          <div className="category-grid">
            {(summary?.categoryTotals ?? []).map((category) => (
              <div key={category.name} className="category-card">
                <span className="category-card__amount">
                  {formatMinorCurrency(category.totalAmountMinor, summary?.currencyCode ?? "USD")}
                </span>
                <span className="category-card__label">{category.name}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Recent expenses"
          subtitle="Last 7 days"
        >
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
        </SectionCard>

        <SectionCard
          title="Recurring"
          subtitle="Upcoming bills"
        >
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
