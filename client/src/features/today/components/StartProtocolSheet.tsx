import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useUpdateTaskMutation, type TaskItem } from "../../../shared/lib/api";

type StartProtocolSheetProps = {
  open: boolean;
  date: string;
  task: TaskItem | null;
  onClose: () => void;
};

export function StartProtocolSheet({
  open,
  date,
  task,
  onClose,
}: StartProtocolSheetProps) {
  const updateTaskMutation = useUpdateTaskMutation(date);
  const [nextAction, setNextAction] = useState("");
  const [fiveMinuteVersion, setFiveMinuteVersion] = useState("");
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState("");
  const [likelyObstacle, setLikelyObstacle] = useState("");
  const [focusLengthMinutes, setFocusLengthMinutes] = useState("25");

  useEffect(() => {
    if (!open || !task) {
      return;
    }

    setNextAction(task.nextAction ?? "");
    setFiveMinuteVersion(task.fiveMinuteVersion ?? "");
    setEstimatedDurationMinutes(task.estimatedDurationMinutes ? String(task.estimatedDurationMinutes) : "");
    setLikelyObstacle(task.likelyObstacle ?? "");
    setFocusLengthMinutes(task.focusLengthMinutes ? String(task.focusLengthMinutes) : "25");
  }, [open, task]);

  const handleSave = useCallback(async () => {
    if (!task) {
      return;
    }

    await updateTaskMutation.mutateAsync({
      taskId: task.id,
      nextAction: nextAction.trim() || null,
      fiveMinuteVersion: fiveMinuteVersion.trim() || null,
      estimatedDurationMinutes: estimatedDurationMinutes.trim() ? Number(estimatedDurationMinutes) : null,
      likelyObstacle: likelyObstacle.trim() || null,
      focusLengthMinutes: focusLengthMinutes.trim() ? Number(focusLengthMinutes) : null,
    });
    onClose();
  }, [
    estimatedDurationMinutes,
    fiveMinuteVersion,
    focusLengthMinutes,
    likelyObstacle,
    nextAction,
    onClose,
    task,
    updateTaskMutation,
  ]);

  if (!open || !task) {
    return null;
  }

  const sheet = (
    <div className="capture-sheet capture-sheet--open">
      <div className="capture-sheet__backdrop" onClick={onClose} />
      <section className="capture-sheet__panel start-protocol-sheet">
        <div className="capture-sheet__header">
          <div>
            <p className="page-eyebrow">Start Protocol</p>
            <h3 className="capture-sheet__title">{task.title}</h3>
          </div>
          <button className="button button--ghost button--small" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="stack-form">
          <label className="field">
            <span>Next visible action</span>
            <input value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="Open the file and write the first paragraph" />
          </label>

          <label className="field">
            <span>5-minute version</span>
            <input value={fiveMinuteVersion} onChange={(event) => setFiveMinuteVersion(event.target.value)} placeholder="Write three bullets" />
          </label>

          <div className="stack-form stack-form--two">
            <label className="field">
              <span>Estimated minutes</span>
              <input value={estimatedDurationMinutes} onChange={(event) => setEstimatedDurationMinutes(event.target.value)} inputMode="numeric" placeholder="45" />
            </label>

            <label className="field">
              <span>Focus length</span>
              <input value={focusLengthMinutes} onChange={(event) => setFocusLengthMinutes(event.target.value)} inputMode="numeric" placeholder="25" />
            </label>
          </div>

          <label className="field">
            <span>Likely obstacle</span>
            <input value={likelyObstacle} onChange={(event) => setLikelyObstacle(event.target.value)} placeholder="I keep avoiding the blank page" />
          </label>

          <div className="button-row">
            <button
              className="button button--primary"
              type="button"
              onClick={() => void handleSave()}
              disabled={updateTaskMutation.isPending || !nextAction.trim()}
            >
              {updateTaskMutation.isPending ? "Saving..." : "Save protocol"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );

  return createPortal(sheet, document.body);
}
