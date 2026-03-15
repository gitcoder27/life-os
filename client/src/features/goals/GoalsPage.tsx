import {
  formatMonthLabel,
  getTodayDate,
  useGoalsDataQuery,
} from "../../shared/lib/api";
import { PageHeader } from "../../shared/ui/PageHeader";
import { SectionCard } from "../../shared/ui/SectionCard";

const domainLabels: Record<string, string> = {
  health: "Health",
  money: "Money",
  work_growth: "Work & Growth",
  home_admin: "Home admin",
  discipline: "Discipline",
  other: "Other",
};

export function GoalsPage() {
  const today = getTodayDate();
  const goalsQuery = useGoalsDataQuery(today);
  const goals = goalsQuery.data?.goals.goals ?? [];
  const weeklyPriorities = goalsQuery.data?.weekPlan.priorities ?? [];
  const monthPlan = goalsQuery.data?.monthPlan;

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
          subtitle={formatMonthLabel(monthPlan?.startDate.slice(0, 7) ?? today.slice(0, 7))}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", fontWeight: 500 }}>
              {monthPlan?.theme ?? "Set the current monthly theme in planning"}
            </div>
            <p className="support-copy">
              {monthPlan?.topOutcomes[0]?.title ??
                "Live planning data will surface your top monthly outcomes here."}
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="Weekly priorities"
          subtitle="This week"
        >
          <ol className="priority-list">
            {weeklyPriorities.map((item, index) => (
              <li key={item.id} className="priority-list__item">
                <span>
                  <span className="tag tag--neutral" style={{ marginRight: "0.5rem" }}>W{index + 1}</span>
                  {item.title}
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
              <div key={goal.id} className="goal-card">
                <div className="goal-card__domain">{domainLabels[goal.domain] || goal.domain}</div>
                <div className="goal-card__title">{goal.title}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Three monthly outcomes"
          subtitle="Current month"
        >
          <ol className="priority-list">
            {(monthPlan?.topOutcomes ?? []).map((outcome) => (
              <li key={outcome.id} className="priority-list__item">
                <span>{outcome.title}</span>
                <span className={outcome.status === "completed" ? "tag tag--positive" : "tag tag--warning"}>
                  {outcome.status === "completed" ? "achieved" : "tracking"}
                </span>
              </li>
            ))}
          </ol>
        </SectionCard>
      </div>
    </div>
  );
}
