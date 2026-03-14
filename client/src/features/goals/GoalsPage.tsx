import { goals, weeklyPriorities } from "../../shared/lib/demo-data";
import { PageHeader } from "../../shared/ui/PageHeader";
import { SectionCard } from "../../shared/ui/SectionCard";

const domainLabels: Record<string, string> = {
  health: "Health",
  money: "Money",
  work_growth: "Work & Growth",
};

export function GoalsPage() {
  return (
    <div className="page">
      <PageHeader
        eyebrow="Direction"
        title="Goals and planning"
        description="Life-area outcomes, weekly priorities, and monthly focus. Intentionally lightweight."
      />

      <div className="dashboard-grid stagger">
        <SectionCard
          title="Monthly focus"
          subtitle="March 2026"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", fontWeight: 500 }}>
              Build consistency before adding complexity
            </div>
            <p className="support-copy">
              Focus on the daily loop: morning routine, priorities, health basics, and closing the day with a review.
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="Weekly priorities"
          subtitle="This week"
        >
          <ol className="priority-list">
            {weeklyPriorities.map((item, i) => (
              <li key={item} className="priority-list__item">
                <span>
                  <span className="tag tag--neutral" style={{ marginRight: "0.5rem" }}>W{i + 1}</span>
                  {item}
                </span>
              </li>
            ))}
          </ol>
        </SectionCard>

        <SectionCard
          title="Life-area goals"
          subtitle={`${goals.length} active goals`}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {goals.map((goal) => (
              <div key={goal.title} className="goal-card">
                <div className="goal-card__domain">{domainLabels[goal.domain] || goal.domain}</div>
                <div className="goal-card__title">{goal.title}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Three monthly outcomes"
          subtitle="March targets"
        >
          <ol className="priority-list">
            <li className="priority-list__item">
              <span>Complete Life OS MVP with all core screens</span>
              <span className="tag tag--warning">in progress</span>
            </li>
            <li className="priority-list__item">
              <span>7-day strong-day streak at least once</span>
              <span className="tag tag--positive">achieved</span>
            </li>
            <li className="priority-list__item">
              <span>Monthly spend under $1,400</span>
              <span className="tag tag--warning">tracking</span>
            </li>
          </ol>
        </SectionCard>
      </div>
    </div>
  );
}
