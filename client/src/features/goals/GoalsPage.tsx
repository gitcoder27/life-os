import { goals } from "../../shared/lib/demo-data";
import { PageHeader } from "../../shared/ui/PageHeader";
import { SectionCard } from "../../shared/ui/SectionCard";

export function GoalsPage() {
  return (
    <div className="page">
      <PageHeader
        eyebrow="Direction"
        title="Goals and planning"
        description="Goals stay intentionally light in MVP: life-area outcomes, weekly priorities, and monthly focus without project-manager depth."
      />

      <div className="dashboard-grid">
        <SectionCard
          title="Monthly focus"
          subtitle="April theme"
        >
          <p className="support-copy">Build consistency before adding complexity.</p>
        </SectionCard>

        <SectionCard
          title="Life-area goals"
          subtitle="Grouped for scan speed"
        >
          <ul className="list">
            {goals.map((goal) => (
              <li key={goal.title}>
                <strong>{goal.title}</strong>
                <span className="list__subtle">{goal.domain}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
