import { useState } from "react";
import { useUpdateTaskMutation, type FocusSessionItem, type TaskItem } from "../../../shared/lib/api";
import { FocusSessionLauncher } from "./FocusSessionLauncher";
import { StartProtocolSheet } from "./StartProtocolSheet";
import { StuckFlowSheet } from "./StuckFlowSheet";

export function MustWinCard({
  date,
  task,
  activeFocusSession = null,
}: {
  date: string;
  task: TaskItem;
  activeFocusSession?: FocusSessionItem | null;
}) {
  const updateTaskMutation = useUpdateTaskMutation(date);
  const [protocolOpen, setProtocolOpen] = useState(false);
  const [stuckOpen, setStuckOpen] = useState(false);
  const isCompleted = task.status === "completed";
  const isStarted = task.progressState === "started" || task.progressState === "advanced" || isCompleted;
  const isAdvanced = task.progressState === "advanced" || isCompleted;
  const isMinimal = isCompleted;
  const stateLabel = isCompleted
    ? "Complete"
    : task.progressState === "advanced"
      ? "In progress"
      : task.progressState === "started"
        ? "Started"
        : "Ready";

  return (
    <>
      <section className={`must-win-card${isMinimal ? " must-win-card--minimal" : ""}`}>
        <div className="must-win-card__header">
          <div>
            <p className="must-win-card__eyebrow">Your focus</p>
            <h2 className="must-win-card__title">{task.title}</h2>
          </div>
          <span className={`must-win-card__state must-win-card__state--${isCompleted ? "completed" : task.progressState}`}>
            {stateLabel}
          </span>
        </div>

        <div className={`must-win-card__details${isMinimal ? " must-win-card__details--minimal" : ""}`}>
          <div className="must-win-card__detail must-win-card__detail--primary">
            <span className="must-win-card__label">Next action</span>
            <strong>{task.nextAction ?? "Define the first visible step"}</strong>
          </div>
          {task.fiveMinuteVersion ? (
            <div className="must-win-card__detail">
              <span className="must-win-card__label">5-minute version</span>
              <strong>{task.fiveMinuteVersion}</strong>
            </div>
          ) : null}
          {task.likelyObstacle ? (
            <div className="must-win-card__detail">
              <span className="must-win-card__label">Likely obstacle</span>
              <strong>{task.likelyObstacle}</strong>
            </div>
          ) : null}
        </div>

        <div className="must-win-card__actions">
          {!isStarted && !task.nextAction?.trim() ? (
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
          ) : null}

          {!isCompleted && task.nextAction?.trim() ? (
            <FocusSessionLauncher
              date={date}
              task={task}
              activeSession={activeFocusSession}
              buttonClassName="button button--primary button--small"
              activeChipClassName="must-win-card__action-chip"
            />
          ) : null}

          {isStarted && !task.nextAction?.trim() ? (
            <span className="must-win-card__action-chip">Started</span>
          ) : null}

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
            Protocol
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
