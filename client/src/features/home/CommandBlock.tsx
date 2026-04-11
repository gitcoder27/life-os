import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useUpdateTaskMutation,
  type LinkedGoal,
  type TaskItem,
} from "../../shared/lib/api";
import { StartProtocolSheet } from "../today/components/StartProtocolSheet";
import { StuckFlowSheet } from "../today/components/StuckFlowSheet";

type TimePhase = "morning" | "midday" | "evening";

type CommandBlockProps = {
  date: string;
  topPriority: {
    slot: number;
    title: string;
    goal: LinkedGoal | null;
  } | null;
  mustWinTask: TaskItem | null;
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
  date,
  topPriority,
  mustWinTask,
  openTaskCount,
  nextTimedTask,
  phase,
}: CommandBlockProps) {
  const updateTaskMutation = useUpdateTaskMutation(date);
  const [protocolOpen, setProtocolOpen] = useState(false);
  const [stuckOpen, setStuckOpen] = useState(false);
  const isCompleted = mustWinTask?.status === "completed";
  const isStarted =
    mustWinTask?.progressState === "started" ||
    mustWinTask?.progressState === "advanced" ||
    isCompleted;
  const isAdvanced = mustWinTask?.progressState === "advanced" || isCompleted;
  const headline = topPriority
    ? topPriority.title
    : openTaskCount > 0
      ? `${openTaskCount} task${openTaskCount > 1 ? "s" : ""} waiting`
      : phase === "evening"
        ? "Ready to close the day"
        : "All clear";

  const eyebrow = phaseGreeting(phase, Boolean(topPriority));

  return (
    <>
      <div className={`command-block${mustWinTask ? " command-block--must-win" : ""}`}>
        <div className="command-block__eyebrow">{eyebrow}</div>
        <h2 className="command-block__headline">{headline}</h2>

        {topPriority?.goal ? (
          <span className="command-block__goal">
            <span className={`command-block__goal-dot command-block__goal-dot--${topPriority.goal.domain}`} />
            {topPriority.goal.title}
          </span>
        ) : null}

        {mustWinTask ? (
          <>
            <div className="command-block__must-win-row">
              <div className="command-block__must-win-detail">
                <span className="command-block__must-win-label">Next action</span>
                <strong>{mustWinTask.nextAction ?? "Add the first visible step"}</strong>
              </div>
              <span
                className={`command-block__must-win-state command-block__must-win-state--${
                  isCompleted ? "completed" : mustWinTask.progressState
                }`}
              >
                {isCompleted
                  ? "Completed"
                  : mustWinTask.progressState === "advanced"
                    ? "Advanced"
                    : mustWinTask.progressState === "started"
                      ? "Started"
                      : "Ready"}
              </span>
            </div>

            <div className="command-block__must-win-actions">
              {!isStarted ? (
                <button
                  className="button button--primary button--small"
                  type="button"
                  disabled={updateTaskMutation.isPending}
                  onClick={() =>
                    updateTaskMutation.mutate({
                      taskId: mustWinTask.id,
                      progressState: "started",
                      startedAt: mustWinTask.startedAt ?? new Date().toISOString(),
                    })}
                >
                  Start
                </button>
              ) : null}

              {isStarted && !isAdvanced && !isCompleted ? (
                <button
                  className="button button--ghost button--small"
                  type="button"
                  disabled={updateTaskMutation.isPending}
                  onClick={() =>
                    updateTaskMutation.mutate({
                      taskId: mustWinTask.id,
                      progressState: "advanced",
                      startedAt: mustWinTask.startedAt ?? new Date().toISOString(),
                    })}
                >
                  Mark progress
                </button>
              ) : null}

              {!isCompleted ? (
                <button
                  className="button button--ghost button--small"
                  type="button"
                  disabled={updateTaskMutation.isPending}
                  onClick={() =>
                    updateTaskMutation.mutate({
                      taskId: mustWinTask.id,
                      status: "completed",
                      progressState: "advanced",
                      startedAt: mustWinTask.startedAt ?? new Date().toISOString(),
                    })}
                >
                  Complete
                </button>
              ) : null}

              <button
                className="button button--ghost button--small"
                type="button"
                onClick={() => setProtocolOpen(true)}
              >
                Protocol
              </button>

              {!isCompleted ? (
                <button
                  className="button button--ghost button--small"
                  type="button"
                  onClick={() => setStuckOpen(true)}
                >
                  I&apos;m stuck
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      <StartProtocolSheet
        open={protocolOpen}
        date={date}
        task={mustWinTask}
        onClose={() => setProtocolOpen(false)}
      />
      <StuckFlowSheet
        open={stuckOpen}
        date={date}
        task={mustWinTask}
        onClose={() => setStuckOpen(false)}
      />
    </>
  );
}
