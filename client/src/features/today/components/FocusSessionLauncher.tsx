import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  useStartFocusSessionMutation,
  type FocusSessionDepth,
  type FocusSessionItem,
  type TaskItem,
} from "../../../shared/lib/api";

type FocusSessionLauncherProps = {
  date: string;
  task: TaskItem;
  activeSession: FocusSessionItem | null;
  buttonLabel?: string;
  activeLabel?: string;
  disabledLabel?: string;
  buttonClassName?: string;
  activeChipClassName?: string;
};

export function FocusSessionLauncher({
  date,
  task,
  activeSession,
  buttonLabel = "Start focus",
  activeLabel = "Focus active",
  disabledLabel = "Focus locked",
  buttonClassName = "button button--ghost button--small",
  activeChipClassName = "must-win-card__action-chip",
}: FocusSessionLauncherProps) {
  const startFocusSessionMutation = useStartFocusSessionMutation(date);
  const [open, setOpen] = useState(false);
  const [depth, setDepth] = useState<FocusSessionDepth>("deep");
  const [plannedMinutes, setPlannedMinutes] = useState("25");
  const isSameTaskActive = activeSession?.taskId === task.id;
  const isAnotherTaskActive = Boolean(activeSession && activeSession.taskId !== task.id);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDepth("deep");
    setPlannedMinutes(task.focusLengthMinutes ? String(task.focusLengthMinutes) : "25");
  }, [open, task.focusLengthMinutes]);

  if (task.kind !== "task" || task.status !== "pending" || !task.nextAction?.trim()) {
    return null;
  }

  async function handleStart() {
    await startFocusSessionMutation.mutateAsync({
      taskId: task.id,
      depth,
      plannedMinutes: Number(plannedMinutes),
    });
    setOpen(false);
  }

  if (isSameTaskActive) {
    return <span className={activeChipClassName}>{activeLabel}</span>;
  }

  return (
    <>
      <button
        className={buttonClassName}
        type="button"
        disabled={isAnotherTaskActive || startFocusSessionMutation.isPending}
        onClick={() => setOpen(true)}
      >
        {isAnotherTaskActive ? disabledLabel : buttonLabel}
      </button>

      {open
        ? createPortal(
            <div className="capture-sheet capture-sheet--open">
              <div className="capture-sheet__backdrop" onClick={() => setOpen(false)} />
              <section className="capture-sheet__panel focus-session-sheet">
                <div className="capture-sheet__header">
                  <div>
                    <p className="page-eyebrow">Guided Execution</p>
                    <h3 className="capture-sheet__title">{task.title}</h3>
                  </div>
                  <button
                    className="button button--ghost button--small"
                    type="button"
                    onClick={() => setOpen(false)}
                  >
                    Close
                  </button>
                </div>

                <div className="stack-form">
                  <div className="focus-session-sheet__summary">
                    <span className="focus-session-sheet__label">Next action</span>
                    <strong>{task.nextAction}</strong>
                  </div>

                  <div className="field">
                    <span>Session depth</span>
                    <div className="focus-session-choice-row">
                      <button
                        className={`focus-session-choice${depth === "deep" ? " focus-session-choice--active" : ""}`}
                        type="button"
                        onClick={() => setDepth("deep")}
                      >
                        Deep
                      </button>
                      <button
                        className={`focus-session-choice${depth === "shallow" ? " focus-session-choice--active" : ""}`}
                        type="button"
                        onClick={() => setDepth("shallow")}
                      >
                        Shallow
                      </button>
                    </div>
                  </div>

                  <label className="field">
                    <span>Planned minutes</span>
                    <input
                      value={plannedMinutes}
                      onChange={(event) => setPlannedMinutes(event.target.value)}
                      inputMode="numeric"
                      placeholder="25"
                    />
                  </label>

                  <div className="button-row">
                    <button
                      className="button button--primary"
                      type="button"
                      onClick={() => void handleStart()}
                      disabled={startFocusSessionMutation.isPending || !plannedMinutes.trim()}
                    >
                      {startFocusSessionMutation.isPending ? "Starting..." : "Start focus"}
                    </button>
                  </div>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
