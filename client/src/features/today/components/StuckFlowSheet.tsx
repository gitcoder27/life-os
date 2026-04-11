import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  useCarryForwardTaskMutation,
  useLogTaskStuckMutation,
  type TaskItem,
} from "../../../shared/lib/api";

type StuckFlowSheetProps = {
  open: boolean;
  date: string;
  task: TaskItem | null;
  onClose: () => void;
};

const REASONS = [
  { value: "unclear", label: "Too unclear" },
  { value: "too_big", label: "Too big" },
  { value: "avoidance", label: "Avoiding it" },
  { value: "low_energy", label: "Low energy" },
  { value: "interrupted", label: "Interrupted" },
  { value: "overloaded", label: "Overloaded" },
] as const;

const ACTIONS = [
  { value: "clarify", label: "Clarify" },
  { value: "shrink", label: "Shrink" },
  { value: "downgrade", label: "Downgrade" },
  { value: "reschedule", label: "Reschedule" },
  { value: "recover", label: "Recover" },
] as const;

export function StuckFlowSheet({
  open,
  date,
  task,
  onClose,
}: StuckFlowSheetProps) {
  const logTaskStuckMutation = useLogTaskStuckMutation(date);
  const carryForwardTaskMutation = useCarryForwardTaskMutation(date);
  const [reason, setReason] = useState<(typeof REASONS)[number]["value"]>("unclear");
  const [actionTaken, setActionTaken] = useState<(typeof ACTIONS)[number]["value"]>("clarify");
  const [note, setNote] = useState("");
  const [targetDate, setTargetDate] = useState(date);

  useEffect(() => {
    if (!open) {
      return;
    }

    setReason("unclear");
    setActionTaken("clarify");
    setNote("");
    setTargetDate(date);
  }, [date, open]);

  const handleSave = useCallback(async () => {
    if (!task) {
      return;
    }

    await logTaskStuckMutation.mutateAsync({
      taskId: task.id,
      reason,
      actionTaken,
      note: note.trim() || null,
      targetDate: actionTaken === "reschedule" ? targetDate : null,
    });

    if (actionTaken === "reschedule" && targetDate) {
      await carryForwardTaskMutation.mutateAsync({
        taskId: task.id,
        targetDate,
      });
    }

    onClose();
  }, [actionTaken, carryForwardTaskMutation, logTaskStuckMutation, note, onClose, reason, targetDate, task]);

  if (!open || !task) {
    return null;
  }

  const sheet = (
    <div className="capture-sheet capture-sheet--open">
      <div className="capture-sheet__backdrop" onClick={onClose} />
      <section className="capture-sheet__panel stuck-flow-sheet">
        <div className="capture-sheet__header">
          <div>
            <p className="page-eyebrow">I'm Stuck</p>
            <h3 className="capture-sheet__title">{task.title}</h3>
          </div>
          <button className="button button--ghost button--small" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="stack-form">
          <label className="field">
            <span>What's blocking the start?</span>
            <select value={reason} onChange={(event) => setReason(event.target.value as typeof reason)}>
              {REASONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Best next move</span>
            <select value={actionTaken} onChange={(event) => setActionTaken(event.target.value as typeof actionTaken)}>
              {ACTIONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          {actionTaken === "reschedule" ? (
            <label className="field">
              <span>Move to</span>
              <input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
            </label>
          ) : null}

          <label className="field">
            <span>Note</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="What needs to change so this becomes doable?" />
          </label>

          <div className="button-row">
            <button
              className="button button--primary"
              type="button"
              onClick={() => void handleSave()}
              disabled={logTaskStuckMutation.isPending || carryForwardTaskMutation.isPending}
            >
              {logTaskStuckMutation.isPending || carryForwardTaskMutation.isPending ? "Saving..." : "Save stuck step"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );

  return createPortal(sheet, document.body);
}
