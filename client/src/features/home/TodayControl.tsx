import { Link } from "react-router-dom";
import type { LinkedGoal } from "../../shared/lib/api";

type Priority = {
  id: string;
  slot: 1 | 2 | 3;
  title: string;
  status: "pending" | "completed" | "dropped";
  goal: LinkedGoal | null;
};

type TodayControlProps = {
  priorities: Priority[];
  openTaskCount: number;
  overdueTaskCount: number;
};

function statusMark(status: Priority["status"]) {
  if (status === "completed") return "done";
  if (status === "dropped") return "skip";
  return "";
}

function formatOpenTaskLabel(openTaskCount: number) {
  return `${openTaskCount} open task${openTaskCount !== 1 ? "s" : ""}`;
}

function formatMoreTaskLabel(openTaskCount: number) {
  return `${openTaskCount} more open task${openTaskCount !== 1 ? "s" : ""}`;
}

export function TodayControl({ priorities, openTaskCount, overdueTaskCount }: TodayControlProps) {
  const hasPriorities = priorities.length > 0;
  const hasOpenTasks = openTaskCount > 0;
  const hasOverdueTasks = overdueTaskCount > 0;

  if (!hasPriorities && !hasOpenTasks && !hasOverdueTasks) return null;

  const completedCount = priorities.filter((p) => p.status === "completed").length;

  return (
    <div className="today-control">
      <div className="today-control__header">
        <h3 className="section-label">Today</h3>
        {hasPriorities ? (
          <span className="today-control__progress">
            {completedCount}/{priorities.length} priorities
          </span>
        ) : null}
      </div>

      {hasPriorities ? (
        <div className="today-control__priorities">
          {priorities.map((p) => (
            <div
              key={p.id}
              className={`priority-line${p.status !== "pending" ? ` priority-line--${p.status}` : ""}`}
            >
              <span className="priority-line__slot">{p.slot}</span>
              <div className="priority-line__body">
                <span className="priority-line__title">{p.title}</span>
                {p.goal ? (
                  <span className="priority-line__goal">{p.goal.title}</span>
                ) : null}
              </div>
              {p.status !== "pending" ? (
                <span className="priority-line__mark">{statusMark(p.status)}</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : hasOpenTasks || hasOverdueTasks ? (
        <Link to={hasOverdueTasks ? "/today?view=overdue" : "/today"} className="today-control__summary-card">
          <div className="today-control__summary-copy">
            <span className="today-control__summary-eyebrow">No priorities set</span>
            <span className="today-control__summary-headline">Open Today and set the day up.</span>
          </div>

          <div className="today-control__summary-stats">
            <div className="today-control__summary-stat">
              <span className="today-control__summary-count">{openTaskCount}</span>
              <span className="today-control__summary-label">Open today</span>
            </div>

            {hasOverdueTasks ? (
              <div className="today-control__summary-stat today-control__summary-stat--overdue">
                <span className="today-control__summary-count">{overdueTaskCount}</span>
                <span className="today-control__summary-label">Overdue</span>
              </div>
            ) : null}
          </div>
        </Link>
      ) : null}

      {hasOpenTasks && hasPriorities ? (
        <div className="today-control__tasks">
          + {formatMoreTaskLabel(openTaskCount)}
        </div>
      ) : null}
    </div>
  );
}
