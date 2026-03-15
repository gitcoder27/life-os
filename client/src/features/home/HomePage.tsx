import { Link, useNavigate } from "react-router-dom";

import {
  formatMajorCurrency,
  formatWorkoutStatus,
  getTodayDate,
  useDailyScoreQuery,
  useHabitCheckinMutation,
  useHomeOverviewQuery,
  useUpdatePriorityMutation,
  useTaskStatusMutation,
  useWeeklyMomentumQuery,
  type LinkedGoal,
} from "../../shared/lib/api";
import { MetricPill } from "../../shared/ui/MetricPill";
import {
  EmptyState,
  InlineErrorState,
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";
import { ScoreRing } from "../../shared/ui/ScoreRing";
import { SectionCard } from "../../shared/ui/SectionCard";

function GoalChip({ goal }: { goal: LinkedGoal }) {
  return (
    <Link to="/goals" className="goal-chip">
      <span className={`goal-chip__dot goal-chip__dot--${goal.domain}`} />
      <span>{goal.title}</span>
    </Link>
  );
}

export function HomePage() {
  const today = getTodayDate();
  const navigate = useNavigate();
  const homeQuery = useHomeOverviewQuery(today);
  const scoreQuery = useDailyScoreQuery(today);
  const weeklyMomentumQuery = useWeeklyMomentumQuery(today);
  const updateTaskMutation = useTaskStatusMutation(today);
  const habitCheckinMutation = useHabitCheckinMutation(today);
  const updatePriorityMutation = useUpdatePriorityMutation(today);
  const retryAll = () => {
    void homeQuery.refetch();
    void scoreQuery.refetch();
    void weeklyMomentumQuery.refetch();
  };

  if (homeQuery.isLoading && !homeQuery.data) {
    return (
      <PageLoadingState
        title="Loading command center"
        description="Pulling together today’s priorities, score, and attention items."
      />
    );
  }

  if (homeQuery.isError || !homeQuery.data) {
    return (
      <PageErrorState
        title="Home is unavailable"
        message={homeQuery.error instanceof Error ? homeQuery.error.message : undefined}
        onRetry={retryAll}
      />
    );
  }

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
  const attentionItems = home?.attentionItems ?? [];
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
  const scoreReasons = scoreQuery.data?.topReasons ?? [];
  const scoreBuckets =
    scoreQuery.data?.buckets?.filter((bucket) => bucket.applicablePoints > 0) ?? [];
  const taskMutationError =
    updateTaskMutation.error instanceof Error
      ? updateTaskMutation.error.message
      : habitCheckinMutation.error instanceof Error
        ? habitCheckinMutation.error.message
        : updatePriorityMutation.error instanceof Error
          ? updatePriorityMutation.error.message
          : null;

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
              {score ? (
                <p className="score-hero__detail">
                  {Math.round(score.earnedPoints)} of {score.possiblePoints} available points earned today.
                </p>
              ) : null}
            </div>
          </div>
          {scoreQuery.isError ? (
            <InlineErrorState
              message={scoreQuery.error instanceof Error ? scoreQuery.error.message : "Score details could not load."}
              onRetry={() => void scoreQuery.refetch()}
            />
          ) : null}
          <div className="bucket-bar">
            {scoreBuckets.map((bucket) => (
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
          {scoreBuckets.length > 0 ? (
            <div className="score-bucket-notes">
              {scoreBuckets.map((bucket) => (
                <div key={bucket.key} className="score-bucket-notes__item">
                  <strong>{bucket.label}</strong>
                  <span>{bucket.explanation}</span>
                </div>
              ))}
            </div>
          ) : null}
          {scoreReasons.length > 0 ? (
            <div className="score-reasons">
              {scoreReasons.map((reason) => (
                <div key={reason.label} className="score-reasons__item">
                  <strong>{reason.label}</strong>
                  <span>{reason.missingPoints} points still open</span>
                </div>
              ))}
            </div>
          ) : null}
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
          {attentionItems.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {attentionItems.map((item) => {
                const action = item.action;
                return (
                  <div key={item.id} className="attention-item">
                    <span className="attention-item__icon" />
                    <div className="attention-item__content">
                      <div className="attention-item__title">{item.title}</div>
                      <div className="attention-item__detail">
                        {item.detail ?? `${item.kind.replace(/_/g, " ")} • ${item.tone}`}
                      </div>
                    </div>
                    {action.type === "complete_task" ? (
                      <button
                        className="button button--ghost button--small"
                        type="button"
                        disabled={updateTaskMutation.isPending}
                        onClick={() =>
                          updateTaskMutation.mutate({
                            taskId: action.entityId,
                            status: "completed",
                          })
                        }
                      >
                        {updateTaskMutation.isPending ? "Saving..." : "Done task"}
                      </button>
                    ) : action.type === "complete_habit" ? (
                      <button
                        className="button button--ghost button--small"
                        type="button"
                        disabled={habitCheckinMutation.isPending}
                        onClick={() => habitCheckinMutation.mutate(action.entityId)}
                      >
                        {habitCheckinMutation.isPending ? "Saving..." : "Done habit"}
                      </button>
                    ) : (
                      <button
                        className="button button--ghost button--small"
                        type="button"
                        onClick={() => navigate(action.route)}
                      >
                        {action.type === "open_review" ? "Open review" : "Open"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="Nothing urgent"
              description="The command center is clear for now. Use Today to push the next important task."
            />
          )}
        </SectionCard>

        <SectionCard
          title="Top priorities"
          subtitle="Ordered by importance with quick status updates."
        >
          {home.topPriorities.length > 0 ? (
            <ol className="priority-list">
              {home.topPriorities.map((priority) => (
                <li
                  key={priority.id}
                  className={
                    priority.status === "completed"
                      ? "priority-list__item priority-list__item--done"
                      : priority.status === "dropped"
                        ? "priority-list__item priority-list__item--dropped"
                        : "priority-list__item"
                  }
                >
                  <div>
                    <span>{priority.title}</span>
                    {priority.goal ? (
                      <div style={{ marginTop: "0.2rem" }}>
                        <GoalChip goal={priority.goal} />
                      </div>
                    ) : null}
                  </div>
                  <div className="button-row button-row--tight">
                    <span
                      className={
                        priority.status === "completed"
                          ? "tag tag--positive"
                          : priority.status === "dropped"
                            ? "tag tag--negative"
                            : "tag tag--warning"
                      }
                    >
                      {priority.status === "completed"
                        ? "done"
                        : priority.status === "dropped"
                          ? "dropped"
                          : "open"}
                    </span>
                    <button
                      className="button button--ghost button--small"
                      type="button"
                      disabled={priority.status === "completed" || updatePriorityMutation.isPending}
                      onClick={() =>
                        updatePriorityMutation.mutate({
                          priorityId: priority.id,
                          status: "completed",
                        })
                      }
                    >
                      Done
                    </button>
                    <button
                      className="button button--ghost button--small"
                      type="button"
                      disabled={priority.status === "dropped" || updatePriorityMutation.isPending}
                      onClick={() =>
                        updatePriorityMutation.mutate({
                          priorityId: priority.id,
                          status: "dropped",
                        })
                      }
                    >
                      Drop
                    </button>
                  </div>
                  </li>
                ))}
              </ol>
          ) : (
            <EmptyState
              title="No priorities yet"
              description="Today has no ranked priorities. The daily planning loop is still open."
            />
          )}
        </SectionCard>

        <SectionCard
          title="Task lane"
          subtitle="Today only"
        >
          {taskMutationError ? (
            <InlineErrorState message={taskMutationError} onRetry={retryAll} />
          ) : null}
          {home.tasks.length > 0 ? (
            <ul className="list">
              {home.tasks.map((task) => (
                <li key={task.id}>
                  <div>
                    <strong>{task.title}</strong>
                    <div className="list__subtle">
                      {task.status === "completed"
                        ? "Completed"
                        : task.scheduledForDate ?? "Scheduled today"}
                      {task.goal ? (
                        <span style={{ marginLeft: "0.5rem" }}>
                          <GoalChip goal={task.goal} />
                        </span>
                      ) : null}
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
                    {updateTaskMutation.isPending ? "Saving..." : "Done"}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="Task lane is clear"
              description="There are no day-specific tasks scheduled right now."
            />
          )}
        </SectionCard>

        <SectionCard
          title="Routines"
          subtitle="Morning and evening"
        >
          {routines.length > 0 ? (
            <ul className="list">
              {routines.map((routine) => (
                <li key={routine.title}>
                  <strong>{routine.title}</strong>
                  <span className="list__subtle">{routine.detail}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No active routines"
              description="Routine progress will appear here once a morning or evening routine is active."
            />
          )}
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
