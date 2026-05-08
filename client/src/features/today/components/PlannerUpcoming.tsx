import { useMemo } from "react";

import {
  formatLongDate,
  formatShortDate,
  useTasksQuery,
  type TaskItem,
} from "../../../shared/lib/api";
import { getQuickCaptureDisplayText } from "../../../shared/lib/quickCapture";
import { InlineErrorState } from "../../../shared/ui/PageState";
import { getOffsetDate } from "../helpers/date-helpers";

type PlannerUpcomingProps = {
  todayDate: string;
  onOpenDate: (date: string) => void;
  onEditTask: (task: TaskItem) => void;
};

type UpcomingGroup = {
  date: string;
  tasks: TaskItem[];
};

const LOOKAHEAD_DAYS = 30;

const getTaskTitle = (task: TaskItem) => getQuickCaptureDisplayText(task, task.title);

const getTaskKindLabel = (kind: TaskItem["kind"]) => {
  switch (kind) {
    case "note":
      return "Note";
    case "reminder":
      return "Reminder";
    default:
      return "Task";
  }
};

const getRelativeLabel = (date: string, todayDate: string) => {
  if (date === todayDate) {
    return "Today";
  }

  if (date === getOffsetDate(todayDate, 1)) {
    return "Tomorrow";
  }

  const daysAhead = Math.round(
    (new Date(`${date}T12:00:00`).getTime() - new Date(`${todayDate}T12:00:00`).getTime()) /
      86_400_000,
  );

  if (daysAhead > 1 && daysAhead < 7) {
    return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
      weekday: "long",
    });
  }

  return formatShortDate(date);
};

const groupUpcomingTasks = (tasks: TaskItem[]) => {
  const groupsByDate = new Map<string, TaskItem[]>();

  for (const task of tasks) {
    if (!task.scheduledForDate) {
      continue;
    }

    const existing = groupsByDate.get(task.scheduledForDate) ?? [];
    existing.push(task);
    groupsByDate.set(task.scheduledForDate, existing);
  }

  return [...groupsByDate.entries()]
    .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
    .map(([date, groupTasks]) => ({
      date,
      tasks: groupTasks.sort((left, right) => {
        const sortOrderDiff = left.todaySortOrder - right.todaySortOrder;
        if (sortOrderDiff !== 0) {
          return sortOrderDiff;
        }

        return left.createdAt.localeCompare(right.createdAt);
      }),
    }));
};

function PlannerUpcomingSkeleton() {
  return (
    <div className="planner-upcoming__skeleton" aria-label="Loading upcoming work">
      {[0, 1, 2].map((index) => (
        <div className="planner-upcoming__skeleton-group" key={index}>
          <div className="planner-upcoming__skeleton-date" />
          <div className="planner-upcoming__skeleton-lines">
            <span />
            <span />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PlannerUpcoming({
  todayDate,
  onOpenDate,
  onEditTask,
}: PlannerUpcomingProps) {
  const rangeStartDate = getOffsetDate(todayDate, 1);
  const horizonEndDate = getOffsetDate(todayDate, LOOKAHEAD_DAYS);
  const tasksQuery = useTasksQuery({
    from: rangeStartDate,
    to: horizonEndDate,
    status: "pending",
  });

  const tasks = useMemo(
    () =>
      (tasksQuery.data?.tasks ?? []).filter(
        (task) => task.scheduledForDate && task.status === "pending",
      ),
    [tasksQuery.data?.tasks],
  );
  const groups = useMemo<UpcomingGroup[]>(() => groupUpcomingTasks(tasks), [tasks]);
  const taskCount = tasks.length;
  const rangeLabel = `${formatShortDate(rangeStartDate)} to ${formatShortDate(horizonEndDate)}`;
  const isInitialLoading = tasksQuery.isLoading && !tasksQuery.data;
  const hasBlockingError = tasksQuery.isError && !tasksQuery.data;

  return (
    <section className="planner-upcoming" aria-labelledby="planner-upcoming-title">
      <div className="planner-upcoming__header">
        <div>
          <p className="planner-upcoming__eyebrow">Upcoming</p>
          <h2 className="planner-upcoming__title" id="planner-upcoming-title">
            Scheduled work
          </h2>
        </div>
        <div className="planner-upcoming__summary" aria-label="Upcoming summary">
          <span>{taskCount} item{taskCount === 1 ? "" : "s"}</span>
          <span>{rangeLabel}</span>
        </div>
      </div>

      {tasksQuery.isError ? (
        <InlineErrorState
          message={tasksQuery.error instanceof Error ? tasksQuery.error.message : "Upcoming work could not load."}
          onRetry={() => void tasksQuery.refetch()}
        />
      ) : null}

      {hasBlockingError ? null : isInitialLoading ? (
        <PlannerUpcomingSkeleton />
      ) : groups.length > 0 ? (
        <div className="planner-upcoming__list">
          {groups.map((group) => (
            <section className="planner-upcoming__group" key={group.date}>
              <div className="planner-upcoming__date">
                <div>
                  <span className="planner-upcoming__relative">
                    {getRelativeLabel(group.date, todayDate)}
                  </span>
                  <span className="planner-upcoming__full-date">
                    {formatLongDate(group.date)}
                  </span>
                </div>
                <button
                  className="planner-upcoming__open-day"
                  type="button"
                  onClick={() => onOpenDate(group.date)}
                >
                  Open day
                </button>
              </div>

              <div className="planner-upcoming__tasks">
                {group.tasks.map((task) => {
                  const estimatedMinutes = task.estimatedDurationMinutes
                    ? `${task.estimatedDurationMinutes}m`
                    : null;
                  const focusMinutes = task.focusLengthMinutes
                    ? `${task.focusLengthMinutes}m focus`
                    : null;

                  return (
                    <div className="planner-upcoming__task" key={task.id}>
                      <button
                        className="planner-upcoming__task-main"
                        type="button"
                        onClick={() => onOpenDate(group.date)}
                      >
                        <span className={`planner-upcoming__kind planner-upcoming__kind--${task.kind}`}>
                          {getTaskKindLabel(task.kind)}
                        </span>
                        <span className="planner-upcoming__task-copy">
                          <span className="planner-upcoming__task-title">{getTaskTitle(task)}</span>
                          <span className="planner-upcoming__task-meta">
                            {task.goal ? <span>{task.goal.title}</span> : null}
                            {estimatedMinutes ? <span>{estimatedMinutes}</span> : null}
                            {focusMinutes ? <span>{focusMinutes}</span> : null}
                            {task.recurrence ? <span>Recurring</span> : null}
                          </span>
                        </span>
                      </button>
                      <button
                        className="planner-upcoming__task-action"
                        type="button"
                        onClick={() => onEditTask(task)}
                      >
                        Edit
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="planner-upcoming__empty">
          <div className="planner-upcoming__empty-mark" aria-hidden="true" />
          <h3>No upcoming work scheduled.</h3>
          <p>Items scheduled from Inbox or Today will collect here.</p>
        </div>
      )}
    </section>
  );
}
