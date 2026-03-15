import {
  formatMajorCurrency,
  formatWorkoutStatus,
  getTodayDate,
  useDailyScoreQuery,
  useHomeOverviewQuery,
  useTaskStatusMutation,
  useWeeklyMomentumQuery,
} from "../../shared/lib/api";
import { MetricPill } from "../../shared/ui/MetricPill";
import { ScoreRing } from "../../shared/ui/ScoreRing";
import { SectionCard } from "../../shared/ui/SectionCard";

export function HomePage() {
  const today = getTodayDate();
  const homeQuery = useHomeOverviewQuery(today);
  const scoreQuery = useDailyScoreQuery(today);
  const weeklyMomentumQuery = useWeeklyMomentumQuery(today);
  const updateTaskMutation = useTaskStatusMutation(today);

  const home = homeQuery.data;
  const score = scoreQuery.data ?? home?.dailyScore;
  const homeMetrics = [
    {
      label: "Weekly momentum",
      value: String(home?.weeklyMomentum ?? 0),
    },
    {
      label: "Strong day streak",
      value: `${weeklyMomentumQuery.data?.strongDayStreak ?? 0} days`,
    },
    {
      label: "Review readiness",
      value: scoreQuery.data?.finalizedAt ? "Daily closed" : "Daily open",
    },
  ];
  const attentionItems = (home?.attentionItems ?? []).map((item) => ({
    title: item.title,
    detail: `${item.kind.replace(/_/g, " ")} • ${item.tone}`,
  }));
  const routines = home
    ? [
        {
          title:
            home.routineSummary.currentPeriod === "none"
              ? "Routines"
              : `${home.routineSummary.currentPeriod[0].toUpperCase()}${home.routineSummary.currentPeriod.slice(1)} routine`,
          detail: `${home.routineSummary.completedItems} of ${home.routineSummary.totalItems} complete`,
        },
      ]
    : [];
  const healthSnapshot = [
    {
      label: "Water",
      value: `${((home?.healthSummary.waterMl ?? 0) / 1000).toFixed(1)}L / ${((home?.healthSummary.waterTargetMl ?? 0) / 1000).toFixed(1)}L`,
    },
    {
      label: "Meals",
      value: `${home?.healthSummary.mealsLogged ?? 0} logged`,
    },
    {
      label: "Workout",
      value: formatWorkoutStatus(home?.healthSummary.workoutStatus),
    },
  ];
  const financeSnapshot = [
    {
      label: "Month spend",
      value: formatMajorCurrency(home?.financeSummary.spentThisMonth ?? 0),
    },
    {
      label: "Budget label",
      value: home?.financeSummary.budgetLabel ?? "Tracking",
    },
    {
      label: "Upcoming bills",
      value: String(home?.financeSummary.upcomingBills ?? 0),
    },
  ];

  return (
    <div className="page">
      <section className="score-hero">
        <div className="score-hero__primary">
          <p className="score-hero__label">Daily score</p>
          <div className="score-hero__ring-area">
            <ScoreRing value={score?.value ?? 0} label={score?.label ?? "Loading"} size={140} />
            <div>
              <div className="score-hero__value-row">
                <span className="score-hero__value">{score?.value ?? 0}</span>
                <span className="score-hero__band">{score?.label ?? "Loading"}</span>
              </div>
              <p className="score-hero__copy">
                {scoreQuery.data?.topReasons[0]?.label ??
                  "Live score details will reflect your latest planning, habits, and health data."}
              </p>
            </div>
          </div>
          <div className="bucket-bar">
            {(scoreQuery.data?.buckets ?? [])
              .filter((bucket) => bucket.applicablePoints > 0)
              .map((bucket) => (
                <div key={bucket.key} className="bucket-row">
                  <span className="bucket-row__label">{bucket.label}</span>
                  <div className="bucket-row__bar">
                    <div
                      className="bucket-row__fill"
                      style={{
                        width: `${(bucket.earnedPoints / bucket.applicablePoints) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="bucket-row__value">
                    {Math.round(bucket.earnedPoints)}/{bucket.applicablePoints}
                  </span>
                </div>
              ))}
          </div>
        </div>
        <div className="score-hero__metrics">
          {homeMetrics.map((metric) => (
            <MetricPill
              key={metric.label}
              label={metric.label}
              value={metric.value}
            />
          ))}
        </div>
      </section>

      <div className="dashboard-grid stagger">
        <SectionCard
          title="Attention"
          subtitle="Items needing action now"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {attentionItems.map((item) => (
              <div key={item.title} className="attention-item">
                <span className="attention-item__icon" />
                <div>
                  <div className="attention-item__title">{item.title}</div>
                  <div className="attention-item__detail">{item.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Top priorities"
          subtitle="Ordered by importance"
        >
          <ol className="priority-list">
            {(home?.topPriorities ?? []).map((priority) => (
              <li
                key={priority.id}
                className={
                  priority.status === "completed"
                    ? "priority-list__item priority-list__item--done"
                    : "priority-list__item"
                }
              >
                <span>{priority.title}</span>
                <span
                  className={
                    priority.status === "completed" ? "tag tag--positive" : "tag tag--warning"
                  }
                >
                  {priority.status === "completed" ? "done" : "open"}
                </span>
              </li>
            ))}
          </ol>
        </SectionCard>

        <SectionCard
          title="Task lane"
          subtitle="Today only"
        >
          <ul className="list">
            {(home?.tasks ?? []).map((task) => (
              <li key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <div className="list__subtle">
                    {task.status === "completed"
                      ? "Completed"
                      : task.scheduledForDate ?? "Scheduled today"}
                  </div>
                </div>
                <button
                  className="button button--ghost button--small"
                  type="button"
                  disabled={task.status === "completed" || updateTaskMutation.isPending}
                  onClick={() =>
                    updateTaskMutation.mutate({
                      taskId: task.id,
                      status: "completed",
                    })
                  }
                >
                  Done
                </button>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="Routines"
          subtitle="Morning and evening"
        >
          <ul className="list">
            {routines.map((routine) => (
              <li key={routine.title}>
                <strong>{routine.title}</strong>
                <span className="list__subtle">{routine.detail}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="Health snapshot"
          subtitle="Body basics today"
        >
          <ul className="list">
            {healthSnapshot.map((item) => (
              <li key={item.label}>
                <strong>{item.label}</strong>
                <span className="list__subtle">{item.value}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="Finance snapshot"
          subtitle="Spend visibility"
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
      </div>
    </div>
  );
}
