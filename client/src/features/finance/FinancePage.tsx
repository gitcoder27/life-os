import { financeSnapshot } from "../../shared/lib/demo-data";
import { PageHeader } from "../../shared/ui/PageHeader";
import { SectionCard } from "../../shared/ui/SectionCard";

export function FinancePage() {
  return (
    <div className="page">
      <PageHeader
        eyebrow="Spending visibility"
        title="Finance"
        description="The MVP finance surface focuses on fast entry, recent expense context, and upcoming recurring items."
      />

      <div className="dashboard-grid">
        <SectionCard
          title="Current period"
          subtitle="Spend summary"
        >
          <ul className="list">
            {financeSnapshot.map((item) => (
              <li key={item.label}>
                <strong>{item.label}</strong>
                <span className="list__subtle">{item.value}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="Expense action"
          subtitle="Compact modal or inline form later"
        >
          <button
            className="button button--primary"
            type="button"
          >
            Add expense
          </button>
        </SectionCard>
      </div>
    </div>
  );
}
