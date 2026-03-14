import {
  financeSnapshot,
  financeCategories,
  recentExpenses,
  recurringExpenses,
} from "../../shared/lib/demo-data";
import { PageHeader } from "../../shared/ui/PageHeader";
import { SectionCard } from "../../shared/ui/SectionCard";

export function FinancePage() {
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
          subtitle="March 2026"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 400 }}>
                {financeSnapshot[0].value}
              </span>
              <span className="list__subtle">this month</span>
            </div>
            <ul className="list">
              {financeSnapshot.slice(1).map((item) => (
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
            {financeCategories.map((cat) => (
              <div key={cat.label} className="category-card">
                <span className="category-card__amount">{cat.amount}</span>
                <span className="category-card__label">{cat.label}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Recent expenses"
          subtitle="Last 7 days"
        >
          <div>
            {recentExpenses.map((expense) => (
              <div key={expense.title} className="expense-row">
                <div className="expense-row__info">
                  <div className="expense-row__title">{expense.title}</div>
                  <div className="expense-row__meta">{expense.category} &middot; {expense.date}</div>
                </div>
                <span className="expense-row__amount">{expense.amount}</span>
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
              <div key={item.title} className="expense-row">
                <div className="expense-row__info">
                  <div className="expense-row__title">{item.title}</div>
                  <div className="expense-row__meta">Due in {item.dueIn}</div>
                </div>
                <span className="expense-row__amount">{item.amount}</span>
              </div>
            ))}
          </div>
          <button
            className="button button--primary"
            type="button"
            style={{ marginTop: "0.85rem", width: "100%" }}
          >
            Add expense
          </button>
        </SectionCard>
      </div>
    </div>
  );
}
