import { Link } from "react-router-dom";
import type { LinkedGoal } from "../../shared/lib/api";

type FocusBlockProps = {
  topPriority: {
    slot: number;
    title: string;
    goal: LinkedGoal | null;
  } | null;
  openTaskCount: number;
  nextTimedTask: {
    title: string;
    timeLabel: string;
  } | null;
};

export function FocusBlock({
  topPriority,
  openTaskCount,
  nextTimedTask,
}: FocusBlockProps) {
  const headline = topPriority
    ? topPriority.title
    : openTaskCount > 0
      ? `${openTaskCount} open task${openTaskCount > 1 ? "s" : ""} waiting`
      : "All clear";

  const eyebrow = topPriority
    ? `Priority ${topPriority.slot}`
    : "Today's focus";

  return (
    <Link to="/today" className="dash-card dash-card--link focus-sidebar-card">
      <h3 className="dash-card__title">
        Today
        <span className="dash-card__arrow">&rarr;</span>
      </h3>
      <div className="focus-sidebar__eyebrow">{eyebrow}</div>
      <div className="focus-sidebar__headline">{headline}</div>
      {topPriority?.goal ? (
        <span className="focus-sidebar__goal">
          <span
            className={`focus-block__goal-dot focus-block__goal-dot--${topPriority.goal.domain}`}
          />
          {topPriority.goal.title}
        </span>
      ) : null}
      <div className="focus-sidebar__stats">
        <div className="focus-sidebar__stat">
          <span className="focus-sidebar__stat-value">{openTaskCount}</span>
          <span className="focus-sidebar__stat-label">Open tasks</span>
        </div>
        {nextTimedTask ? (
          <div className="focus-sidebar__stat">
            <span className="focus-sidebar__stat-value">
              {nextTimedTask.timeLabel}
            </span>
            <span className="focus-sidebar__stat-label">Next block</span>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
