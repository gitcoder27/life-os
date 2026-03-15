import {
  formatTimeLabel,
  formatWorkoutStatus,
  getTodayDate,
  useDayPlanQuery,
  useHealthDataQuery,
  useTaskStatusMutation,
} from "../../shared/lib/api";
import { PageHeader } from "../../shared/ui/PageHeader";
import { SectionCard } from "../../shared/ui/SectionCard";

export function TodayPage() {
  const today = getTodayDate();
  const dayPlanQuery = useDayPlanQuery(today);
  const healthQuery = useHealthDataQuery(today);
  const updateTaskMutation = useTaskStatusMutation(today);
  const priorities = dayPlanQuery.data?.priorities ?? [];
  const tasks = dayPlanQuery.data?.tasks ?? [];
  const timedTasks = tasks.filter((task) => task.dueAt);
  const currentDay = healthQuery.data?.summary.currentDay;
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

      <div className="two-column-grid stagger">
        <SectionCard
          title="Priority stack"
          subtitle="Ordered by impact"
        >
          <ol className="priority-list">
            {priorities.map((item, index) => (
              <li
                key={item.id}
                className="priority-list__item"
              >
                <span>
                  <span className="tag tag--neutral" style={{ marginRight: "0.5rem" }}>P{index + 1}</span>
                  {item.title}
                </span>
                <button
                  className="button button--ghost button--small"
                  type="button"
                  disabled
                >
                  Done
                </button>
              </li>
            ))}
          </ol>
        </SectionCard>

        <SectionCard
          title="Task lane"
          subtitle="Today only"
        >
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
                  Done
                </button>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="Time blocks"
          subtitle="Day structure"
        >
          <div>
            {timedTasks.map((task) => (
              <div key={task.id} className="time-block">
                <span className="time-block__time">{formatTimeLabel(task.dueAt)}</span>
                <span className="time-block__label">{task.title}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Meals and training"
          subtitle="Keep the day realistic"
        >
          <ul className="list">
            {planBits.map((item) => (
              <li key={item}>
                <span>{item}</span>
                <span className={
                  item.includes("complete") ? "tag tag--positive" :
                  item.includes("unplanned") ? "tag tag--warning" :
                  "tag tag--neutral"
                }>
                  {item.includes("complete") ? "done" : item.includes("unplanned") ? "open" : "queued"}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
