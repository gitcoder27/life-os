import {
  formatTimeLabel,
  formatWorkoutStatus,
  getTodayDate,
  useDayPlanQuery,
  useHealthDataQuery,
  useTaskStatusMutation,
} from "../../shared/lib/api";
import { PageHeader } from "../../shared/ui/PageHeader";
import {
  EmptyState,
  InlineErrorState,
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";
import { SectionCard } from "../../shared/ui/SectionCard";

export function TodayPage() {
  const today = getTodayDate();
  const dayPlanQuery = useDayPlanQuery(today);
  const healthQuery = useHealthDataQuery(today);
  const updateTaskMutation = useTaskStatusMutation(today);
  const retryAll = () => {
    void dayPlanQuery.refetch();
    void healthQuery.refetch();
  };
  if (dayPlanQuery.isLoading && !dayPlanQuery.data) {
    return (
      <PageLoadingState
        title="Loading execution lane"
        description="Pulling in priorities, today-only tasks, and immediate health context."
      />
    );
  }

  if (dayPlanQuery.isError || !dayPlanQuery.data) {
    return (
      <PageErrorState
        title="Today could not load"
        message={dayPlanQuery.error instanceof Error ? dayPlanQuery.error.message : undefined}
        onRetry={retryAll}
      />
    );
  }

  const priorities = dayPlanQuery.data?.priorities ?? [];
  const tasks = dayPlanQuery.data?.tasks ?? [];
  const timedTasks = tasks.filter((task) => task.dueAt);
  const currentDay = healthQuery.data?.summary.currentDay;
  const taskMutationError =
    updateTaskMutation.error instanceof Error ? updateTaskMutation.error.message : null;
  const planBits = [
    `Water progress: ${((currentDay?.waterMl ?? 0) / 1000).toFixed(1)}L / ${((currentDay?.waterTargetMl ?? 0) / 1000).toFixed(1)}L`,
    `Meals logged: ${currentDay?.mealCount ?? 0}`,
    `Workout: ${formatWorkoutStatus(currentDay?.workoutDay?.actualStatus)}`,
  ];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Execution view"
        title="Today"
        description="Priorities, today-only tasks, and the immediate plan. Focus on what moves the day forward."
      />

      {taskMutationError ? (
        <InlineErrorState message={taskMutationError} onRetry={retryAll} />
      ) : null}

      <div className="two-column-grid stagger">
        <SectionCard
          title="Priority stack"
          subtitle="Ordered by impact. Ranking stays read-only in Phase 0."
        >
          {priorities.length > 0 ? (
            <ol className="priority-list">
              {priorities.map((item, index) => (
                <li key={item.id} className="priority-list__item">
                  <span>
                    <span className="tag tag--neutral" style={{ marginRight: "0.5rem" }}>
                      P{index + 1}
                    </span>
                    {item.title}
                  </span>
                  <span className="tag tag--neutral">Read only</span>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState
              title="No ranked priorities"
              description="The day has no active top-three priorities yet."
            />
          )}
        </SectionCard>

        <SectionCard
          title="Task lane"
          subtitle="Today only"
        >
          {tasks.length > 0 ? (
            <ul className="list">
              {tasks.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <div className="list__subtle">{item.notes ?? item.originType}</div>
                  </div>
                  <button
                    className="button button--ghost button--small"
                    type="button"
                    disabled={item.status === "completed" || updateTaskMutation.isPending}
                    onClick={() =>
                      updateTaskMutation.mutate({
                        taskId: item.id,
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
              title="No tasks scheduled"
              description="This lane is empty until something is assigned to today."
            />
          )}
        </SectionCard>

        <SectionCard
          title="Time blocks"
          subtitle="Day structure"
        >
          {timedTasks.length > 0 ? (
            <div>
              {timedTasks.map((task) => (
                <div key={task.id} className="time-block">
                  <span className="time-block__time">{formatTimeLabel(task.dueAt)}</span>
                  <span className="time-block__label">{task.title}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No timed blocks"
              description="Nothing on today’s lane has a due time yet."
            />
          )}
        </SectionCard>

        <SectionCard
          title="Meals and training"
          subtitle="Keep the day realistic"
        >
          {healthQuery.isError ? (
            <InlineErrorState
              message={healthQuery.error instanceof Error ? healthQuery.error.message : "Health context could not load."}
              onRetry={() => void healthQuery.refetch()}
            />
          ) : (
            <ul className="list">
              {planBits.map((item) => (
                <li key={item}>
                  <span>{item}</span>
                  <span
                    className={
                      item.includes("complete")
                        ? "tag tag--positive"
                        : item.includes("unplanned")
                          ? "tag tag--warning"
                          : "tag tag--neutral"
                    }
                  >
                    {item.includes("complete")
                      ? "done"
                      : item.includes("unplanned")
                        ? "open"
                        : "queued"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
