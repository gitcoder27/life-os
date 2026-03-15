import {
  formatMonthLabel,
  getTodayDate,
  useGoalsDataQuery,
} from "../../shared/lib/api";
import { PageHeader } from "../../shared/ui/PageHeader";
import {
  EmptyState,
  InlineErrorState,
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";
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
  if (goalsQuery.isLoading && !goalsQuery.data) {
    return (
      <PageLoadingState
        title="Loading goals"
        description="Pulling together life-area goals, weekly priorities, and monthly focus."
      />
    );
  }

  if (goalsQuery.isError || !goalsQuery.data) {
    return (
      <PageErrorState
        title="Goals could not load"
        message={goalsQuery.error instanceof Error ? goalsQuery.error.message : undefined}
        onRetry={() => void goalsQuery.refetch()}
      />
    );
  }

  const goals = goalsQuery.data.goals.goals ?? [];
  const weeklyPriorities = goalsQuery.data.weekPlan?.priorities ?? [];
  const monthPlan = goalsQuery.data.monthPlan;

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
          {goalsQuery.data.sectionErrors.monthPlan ? (
            <InlineErrorState
              message={goalsQuery.data.sectionErrors.monthPlan.message}
              onRetry={() => void goalsQuery.refetch()}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", fontWeight: 500 }}>
                {monthPlan?.theme ?? "Set the current monthly theme in planning"}
              </div>
              <p className="support-copy">
                {monthPlan?.topOutcomes[0]?.title ??
                  "Live planning data will surface your top monthly outcomes here."}
              </p>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Weekly priorities"
          subtitle="This week"
        >
          {goalsQuery.data.sectionErrors.weekPlan ? (
            <InlineErrorState
              message={goalsQuery.data.sectionErrors.weekPlan.message}
              onRetry={() => void goalsQuery.refetch()}
            />
          ) : weeklyPriorities.length > 0 ? (
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
          ) : (
            <EmptyState
              title="No weekly priorities"
              description="This week has not been seeded with priorities yet."
            />
          )}
        </SectionCard>

        <SectionCard
          title="Life-area goals"
          subtitle={`${goals.length} active goals`}
        >
          {goals.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {goals.map((goal) => (
                <div key={goal.id} className="goal-card">
                  <div className="goal-card__domain">{domainLabels[goal.domain] || goal.domain}</div>
                  <div className="goal-card__title">{goal.title}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No goals yet"
              description="Goals are still empty, so this page is acting as a shell only."
            />
          )}
        </SectionCard>

        <SectionCard
          title="Three monthly outcomes"
          subtitle="Current month"
        >
          {monthPlan?.topOutcomes.length ? (
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
          ) : (
            <EmptyState
              title="No monthly outcomes"
              description="Monthly outcomes will appear here once planning data is seeded."
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
