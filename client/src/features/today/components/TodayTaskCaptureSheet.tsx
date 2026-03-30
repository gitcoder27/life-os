import { useCallback, useEffect, useRef, useState } from "react";
import { useCreateTaskMutation } from "../../../shared/lib/api";

type TodayTaskCaptureSheetProps = {
  open: boolean;
  today: string;
  onClose: () => void;
};

export function TodayTaskCaptureSheet({
  open,
  today,
  onClose,
}: TodayTaskCaptureSheetProps) {
  const [textValue, setTextValue] = useState("");
  const firstInputRef = useRef<HTMLTextAreaElement | null>(null);
  const createTaskMutation = useCreateTaskMutation(today, {
    successMessage: "Task added to today.",
    errorMessage: "Could not add task to today.",
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    requestAnimationFrame(() => {
      firstInputRef.current?.focus();
    });
  }, [open]);

  const resetAndClose = useCallback(() => {
    setTextValue("");
    onClose();
  }, [onClose]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!open || event.key !== "Escape") {
      return;
    }

    event.preventDefault();
    resetAndClose();
  }, [open, resetAndClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleSave = useCallback(async () => {
    const content = textValue.trim();
    if (!content) {
      return;
    }

    await createTaskMutation.mutateAsync({
      title: content.split("\n")[0]?.trim() || content,
      notes: content,
      kind: "task",
      scheduledForDate: today,
      originType: "manual",
    });

    resetAndClose();
  }, [createTaskMutation, resetAndClose, textValue, today]);

  const isDisabled = createTaskMutation.isPending || !textValue.trim();

  return (
    <div
      aria-hidden={!open}
      className={`capture-sheet${open ? " capture-sheet--open" : ""}`}
    >
      <div className="capture-sheet__backdrop" onClick={resetAndClose} />
      <section className="capture-sheet__panel today-task-capture" onKeyDown={(event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          event.preventDefault();
          void handleSave();
        }
      }}
      >
        <div className="capture-sheet__header">
          <div>
            <p className="page-eyebrow">Today</p>
            <h3 className="capture-sheet__title">Add task</h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span className="kbd-hint"><span className="kbd">Esc</span> close</span>
            <button
              className="button button--ghost button--small"
              onClick={resetAndClose}
              type="button"
            >
              Close
            </button>
          </div>
        </div>

        <p className="today-task-capture__hint">
          Add a task straight to today. It will appear here right away instead of going to inbox.
        </p>

        <div className="stack-form">
          <label className="field">
            <span>Task</span>
            <textarea
              ref={firstInputRef}
              placeholder="What needs to happen today?"
              rows={4}
              value={textValue}
              onChange={(event) => setTextValue(event.target.value)}
            />
          </label>

          <div className="button-row">
            <button
              className="button button--primary"
              type="button"
              onClick={() => void handleSave()}
              disabled={isDisabled}
            >
              {createTaskMutation.isPending ? "Adding..." : "Add to today"}
            </button>
            <span className="kbd-hint"><span className="kbd">Ctrl</span><span className="kbd">Enter</span> save</span>
          </div>
        </div>
      </section>
    </div>
  );
}
