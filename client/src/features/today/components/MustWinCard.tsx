import { useState } from "react";
import { useUpdateTaskMutation, type TaskItem } from "../../../shared/lib/api";
import { StartProtocolSheet } from "./StartProtocolSheet";
import { StuckFlowSheet } from "./StuckFlowSheet";

export function MustWinCard({
  date,
  task,
}: {
  date: string;
  task: TaskItem;
}) {
  const updateTaskMutation = useUpdateTaskMutation(date);
  const [protocolOpen, setProtocolOpen] = useState(false);
  const [stuckOpen, setStuckOpen] = useState(false);
  const isCompleted = task.status === "completed";
  const isStarted = task.progressState === "started" || task.progressState === "advanced" || isCompleted;
  const isAdvanced = task.progressState === "advanced" || isCompleted;
  const stateLabel = isCompleted
    ? "Completed"
    : task.progressState === "advanced"
      ? "Advanced"
      : task.progressState === "started"
        ? "Started"
        : "Not started";
  const stateDetail = isCompleted
    ? "The must-win is done for today."
    : task.progressState === "advanced"
      ? "You have already made meaningful progress on the must-win."
      : task.progressState === "started"
        ? "The must-win has been started. Mark progress when you have moved it forward."
        : "Start the must-win when you are ready to take the first visible step.";

  return (
    <>
      <section className="must-win-card">
        <div className="must-win-card__header">
          <div>
            <p className="must-win-card__eyebrow">Must-Win</p>
            <h2 className="must-win-card__title">{task.title}</h2>
          </div>
          <span className={`must-win-card__state must-win-card__state--${isCompleted ? "completed" : task.progressState}`}>
            {stateLabel}
          </span>
        </div>

        <p className="must-win-card__state-detail">{stateDetail}</p>

        <div className="must-win-card__details">
          <div>
            <span className="must-win-card__label">Next action</span>
            <strong>{task.nextAction ?? "Add the first visible step"}</strong>
          </div>
          {task.fiveMinuteVersion ? (
            <div>
              <span className="must-win-card__label">5-minute version</span>
              <strong>{task.fiveMinuteVersion}</strong>
            </div>
          ) : null}
          {task.likelyObstacle ? (
            <div>
              <span className="must-win-card__label">Likely obstacle</span>
              <strong>{task.likelyObstacle}</strong>
            </div>
          ) : null}
        </div>

        <div className="must-win-card__actions">
          {!isStarted ? (
            <button
              className="button button--primary button--small"
              type="button"
              disabled={updateTaskMutation.isPending}
              onClick={() => updateTaskMutation.mutate({
                taskId: task.id,
                progressState: "started",
                startedAt: task.startedAt ?? new Date().toISOString(),
              })}
            >
              Start
            </button>
          ) : (
            <span className="must-win-card__action-chip">Started</span>
          )}

          {isStarted && !isAdvanced && !isCompleted ? (
            <button
              className="button button--ghost button--small"
              type="button"
              disabled={updateTaskMutation.isPending}
              onClick={() => updateTaskMutation.mutate({
                taskId: task.id,
                progressState: "advanced",
                startedAt: task.startedAt ?? new Date().toISOString(),
              })}
            >
              Mark progress
            </button>
          ) : null}

          {isAdvanced && !isCompleted ? (
            <span className="must-win-card__action-chip must-win-card__action-chip--advanced">
              Progress marked
            </span>
          ) : null}

          {!isCompleted ? (
            <button
              className="button button--ghost button--small"
              type="button"
              disabled={updateTaskMutation.isPending}
              onClick={() => updateTaskMutation.mutate({
                taskId: task.id,
                status: "completed",
                progressState: "advanced",
                startedAt: task.startedAt ?? new Date().toISOString(),
              })}
            >
              Complete
            </button>
          ) : (
            <span className="must-win-card__action-chip must-win-card__action-chip--completed">
              Completed
            </span>
          )}

          <button className="button button--ghost button--small" type="button" onClick={() => setProtocolOpen(true)}>
            Edit protocol
          </button>
          {!isCompleted ? (
            <button className="button button--ghost button--small" type="button" onClick={() => setStuckOpen(true)}>
              I'm stuck
            </button>
          ) : null}
        </div>
      </section>

      <StartProtocolSheet open={protocolOpen} date={date} task={task} onClose={() => setProtocolOpen(false)} />
      <StuckFlowSheet open={stuckOpen} date={date} task={task} onClose={() => setStuckOpen(false)} />
    </>
  );
}
