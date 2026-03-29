import { EmptyState } from "../../../shared/ui/PageState";
import { TaskCard } from "./TaskCard";
import type { TaskGroup } from "../hooks/useTodayData";
import type { useTaskActions } from "../hooks/useTaskActions";
import type { DayPlannerBlockItem } from "../../../shared/lib/api";
import { formatTimeLabel } from "../../../shared/lib/api";

type TaskActions = ReturnType<typeof useTaskActions>;

const GROUP_ICONS: Record<string, string> = {
  carried: "↩",
  scheduled: "📋",
  recurring: "↻",
};

function getTaskBlockInfo(
  taskId: string,
  blocks: DayPlannerBlockItem[],
): { blockTitle: string; startsAt: string } | null {
  for (const block of blocks) {
    for (const bt of block.tasks) {
      if (bt.taskId === taskId) {
        return { blockTitle: block.title || "Untitled block", startsAt: block.startsAt };
      }
    }
  }
  return null;
}

function MiniProgressRing({ percent }: { percent: number }) {
  const size = 28;
  const strokeWidth = 3;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const color = percent >= 100 ? "var(--positive)" : "var(--accent)";

  return (
    <svg
      className="daily-stream__progress-ring"
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
    >
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.5s var(--ease)" }}
      />
    </svg>
  );
}

export function TaskQueue({
  taskGroups,
  completedCount,
  totalCount,
  taskActions,
  plannerBlocks = [],
  plannedTaskCount,
  unplannedTaskCount,
  onSwitchToPlanner,
}: {
  taskGroups: TaskGroup[];
  completedCount: number;
  totalCount: number;
  taskActions: TaskActions;
  plannerBlocks?: DayPlannerBlockItem[];
  plannedTaskCount: number;
  unplannedTaskCount: number;
  onSwitchToPlanner: () => void;
}) {
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <section className="today-task-queue">
      <div className="today-task-queue__header">
        <div>
          <h2 className="today-task-queue__title">Daily Stream</h2>
          {totalCount > 0 ? (
            <div className="today-task-queue__planner-status">
              <span className="today-task-queue__planner-chip">
                {plannedTaskCount} planned
              </span>
              <span
                className={`today-task-queue__planner-chip ${unplannedTaskCount > 0 ? "today-task-queue__planner-chip--warning" : ""}`}
              >
                {unplannedTaskCount} unplanned
              </span>
              {unplannedTaskCount > 0 ? (
                <button
                  className="today-task-queue__planner-cta"
                  type="button"
                  onClick={onSwitchToPlanner}
                >
                  Plan day
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        {totalCount > 0 ? (
          <div className="today-task-queue__progress">
            <MiniProgressRing percent={progressPct} />
            <span className="today-task-queue__counter">
              {completedCount}/{totalCount}
            </span>
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
            <TaskGroupSection
              key={group.key}
              group={group}
              taskActions={taskActions}
              plannerBlocks={plannerBlocks}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function TaskGroupSection({
  group,
  taskActions,
  plannerBlocks,
}: {
  group: TaskGroup;
  taskActions: TaskActions;
  plannerBlocks: DayPlannerBlockItem[];
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
        {group.tasks.map((task) => {
          const blockInfo = plannerBlocks.length > 0
            ? getTaskBlockInfo(task.id, plannerBlocks)
            : null;
          return (
            <div key={task.id}>
              {blockInfo ? (
                <div className="today-task-card__planned-badge">
                  🕐 {formatTimeLabel(blockInfo.startsAt)} · {blockInfo.blockTitle}
                </div>
              ) : task.status === "pending" ? (
                <div className="today-task-card__planned-badge today-task-card__planned-badge--unplanned">
                  Unplanned
                </div>
              ) : null}
              <TaskCard
                task={task}
                isPending={taskActions.isPending}
                rescheduleDate={taskActions.getRescheduleDate(task.id)}
                onRescheduleDateChange={(date) => taskActions.setRescheduleDate(task.id, date)}
                onStatusChange={(status) => taskActions.changeStatus(task.id, status)}
                onCarryForward={() => taskActions.moveToTomorrow(task.id)}
                onReschedule={() => taskActions.reschedule(task.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
