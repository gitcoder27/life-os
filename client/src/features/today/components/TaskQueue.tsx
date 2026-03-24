import { EmptyState } from "../../../shared/ui/PageState";
import { TaskCard } from "./TaskCard";
import type { TaskGroup } from "../hooks/useTodayData";
import type { useTaskActions } from "../hooks/useTaskActions";

type TaskActions = ReturnType<typeof useTaskActions>;

const GROUP_ICONS: Record<string, string> = {
  carried: "↩",
  scheduled: "📋",
  recurring: "↻",
};

export function TaskQueue({
  taskGroups,
  completedCount,
  totalCount,
  taskActions,
}: {
  taskGroups: TaskGroup[];
  completedCount: number;
  totalCount: number;
  taskActions: TaskActions;
}) {
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <section className="today-task-queue">
      <div className="today-task-queue__header">
        <div>
          <h2 className="today-task-queue__title">Tasks</h2>
        </div>
        {totalCount > 0 ? (
          <div className="today-task-queue__progress">
            <span className="today-task-queue__counter">
              {completedCount}/{totalCount} done
            </span>
            <div className="today-task-queue__bar">
              <div
                className="today-task-queue__bar-fill"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {taskGroups.length === 0 ? (
        <EmptyState
          title="No tasks scheduled"
          description="This lane is empty until something is assigned to today."
        />
      ) : (
        <div className="today-task-groups">
          {taskGroups.map((group) => (
            <TaskGroupSection key={group.key} group={group} taskActions={taskActions} />
          ))}
        </div>
      )}
    </section>
  );
}

function TaskGroupSection({
  group,
  taskActions,
}: {
  group: TaskGroup;
  taskActions: TaskActions;
}) {
  const icon = GROUP_ICONS[group.key] ?? "•";
  const groupDone = group.tasks.filter((t) => t.status === "completed").length;

  return (
    <div className={`today-task-group today-task-group--${group.key}`}>
      <div className="today-task-group__header">
        <span className="today-task-group__icon">{icon}</span>
        <span className="today-task-group__label">{group.label}</span>
        <span className="today-task-group__count">
          {groupDone}/{group.tasks.length}
        </span>
      </div>
      <div className="today-task-group__list">
        {group.tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            isPending={taskActions.isPending}
            rescheduleDate={taskActions.getRescheduleDate(task.id)}
            onRescheduleDateChange={(date) => taskActions.setRescheduleDate(task.id, date)}
            onStatusChange={(status) => taskActions.changeStatus(task.id, status)}
            onCarryForward={() => taskActions.moveToTomorrow(task.id)}
            onReschedule={() => taskActions.reschedule(task.id)}
          />
        ))}
      </div>
    </div>
  );
}
