import { Link } from "react-router-dom";
import type { LinkedGoal } from "../../shared/lib/api";

type TimePhase = "morning" | "midday" | "evening";

type CommandBlockProps = {
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
  phase: TimePhase;
};

function phaseGreeting(phase: TimePhase, hasPriority: boolean) {
  if (phase === "morning") {
    return hasPriority ? "Start here" : "Plan your morning";
  }
  if (phase === "midday") {
    return hasPriority ? "Stay on track" : "Check your progress";
  }
  return hasPriority ? "Close this out" : "Wind down the day";
}

function phaseCta(phase: TimePhase) {
  if (phase === "evening") return "Close the day";
  return "Open Today";
}

export function CommandBlock({
  topPriority,
  openTaskCount,
  nextTimedTask,
  phase,
}: CommandBlockProps) {
  const headline = topPriority
    ? topPriority.title
    : openTaskCount > 0
      ? `${openTaskCount} task${openTaskCount > 1 ? "s" : ""} waiting`
      : phase === "evening"
        ? "Ready to close the day"
        : "All clear";

  const eyebrow = phaseGreeting(phase, Boolean(topPriority));

  return (
    <div className="command-block">
      <div className="command-block__eyebrow">{eyebrow}</div>
      <h2 className="command-block__headline">{headline}</h2>

      {topPriority?.goal ? (
        <span className="command-block__goal">
          <span className={`command-block__goal-dot command-block__goal-dot--${topPriority.goal.domain}`} />
          {topPriority.goal.title}
        </span>
      ) : null}

      <div className="command-block__meta">
        {openTaskCount > 0 ? (
          <span className="command-block__meta-item">
            <strong>{openTaskCount}</strong> open task{openTaskCount !== 1 ? "s" : ""}
          </span>
        ) : null}
        {nextTimedTask ? (
          <span className="command-block__meta-item">
            Next: <strong>{nextTimedTask.timeLabel}</strong> &mdash; {nextTimedTask.title}
          </span>
        ) : null}
      </div>

      <div className="command-block__actions">
        <Link to="/today" className="command-block__cta">
          {phaseCta(phase)}
        </Link>
      </div>
    </div>
  );
}
