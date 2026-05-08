import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { DialogSurface } from "../../../shared/ui/DialogSurface";
import {
  useSizeTasksMutation,
  type TaskItem,
} from "../../../shared/lib/api";

type SizeTasksSheetProps = {
  open: boolean;
  date: string;
  tasks: TaskItem[];
  onClose: () => void;
  onShapeDay?: () => void;
};

const DEFAULT_SIZE_MINUTES = 25;
const SIZE_PRESETS = [10, 25, 45, 90];
const MIN_SIZE_MINUTES = 1;
const MAX_SIZE_MINUTES = 480;

const taskNeedsSize = (task: TaskItem) =>
  task.kind === "task" &&
  task.status === "pending" &&
  task.estimatedDurationMinutes == null &&
  task.focusLengthMinutes == null;

const getInitialDrafts = (tasks: TaskItem[]) =>
  Object.fromEntries(
    tasks.map((task) => [
      task.id,
      String(task.estimatedDurationMinutes ?? task.focusLengthMinutes ?? DEFAULT_SIZE_MINUTES),
    ]),
  );

const parseMinutes = (value: string) => {
  const minutes = Number(value);
  if (!Number.isInteger(minutes) || minutes < MIN_SIZE_MINUTES || minutes > MAX_SIZE_MINUTES) {
    return null;
  }

  return minutes;
};

export function SizeTasksSheet({
  open,
  date,
  tasks,
  onClose,
  onShapeDay,
}: SizeTasksSheetProps) {
  const sizeTasksMutation = useSizeTasksMutation(date);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const titleId = "size-tasks-sheet-title";
  const tasksToSize = useMemo(() => tasks.filter(taskNeedsSize), [tasks]);

  useEffect(() => {
    if (!open) {
      setFormError(null);
      return;
    }

    setDrafts(getInitialDrafts(tasksToSize));
    sizeTasksMutation.reset();
  }, [open, tasksToSize]);

  if (!open) {
    return null;
  }

  const updates = tasksToSize
    .map((task) => ({
      taskId: task.id,
      estimatedDurationMinutes: parseMinutes(drafts[task.id] ?? ""),
    }))
    .filter((update): update is { taskId: string; estimatedDurationMinutes: number } =>
      update.estimatedDurationMinutes !== null,
    );
  const hasInvalidDraft = tasksToSize.some((task) => parseMinutes(drafts[task.id] ?? "") === null);
  const canSave = tasksToSize.length > 0 && !hasInvalidDraft && !sizeTasksMutation.isPending;

  const setTaskDraft = (taskId: string, minutes: string) => {
    setFormError(null);
    setDrafts((current) => ({
      ...current,
      [taskId]: minutes,
    }));
  };

  const saveSizes = async (shapeAfterSave: boolean) => {
    if (!canSave) {
      setFormError("Use 1-480 minutes.");
      return;
    }

    try {
      await sizeTasksMutation.mutateAsync(updates);
    } catch {
      return;
    }

    onClose();

    if (shapeAfterSave) {
      onShapeDay?.();
    }
  };

  const sheet = (
    <DialogSurface
      className="capture-sheet capture-sheet--open"
      backdropClassName="capture-sheet__backdrop"
      panelClassName="capture-sheet__panel adaptive-sheet size-tasks-sheet"
      titleId={titleId}
      onClose={onClose}
    >
      <div className="capture-sheet__header size-tasks-sheet__header">
        <div>
          <p className="page-eyebrow">Today</p>
          <h3 className="capture-sheet__title" id={titleId}>Size tasks</h3>
        </div>
        <div className="size-tasks-sheet__header-actions">
          <span className="size-tasks-sheet__count">
            {tasksToSize.length} unsized
          </span>
          <button className="button button--ghost button--small" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {tasksToSize.length > 0 ? (
        <div className="size-task-list">
          {tasksToSize.map((task) => {
            const draft = drafts[task.id] ?? "";
            const parsedDraft = parseMinutes(draft);

            return (
              <div className="size-task-row" key={task.id}>
                <span className="size-task-row__title">{task.title}</span>
                <div className="size-task-row__controls" role="group" aria-label={`Size ${task.title}`}>
                  {SIZE_PRESETS.map((minutes) => (
                    <button
                      className={`size-task-row__preset${parsedDraft === minutes ? " size-task-row__preset--active" : ""}`}
                      type="button"
                      key={minutes}
                      onClick={() => setTaskDraft(task.id, String(minutes))}
                    >
                      {minutes}m
                    </button>
                  ))}
                  <label className="size-task-row__custom">
                    <span className="sr-only">Custom minutes</span>
                    <input
                      value={draft}
                      onChange={(event) => setTaskDraft(task.id, event.target.value)}
                      inputMode="numeric"
                      aria-invalid={parsedDraft === null}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="adaptive-sheet__state size-tasks-sheet__empty">
          All open tasks have a size.
        </div>
      )}

      {formError || sizeTasksMutation.error ? (
        <div className="adaptive-sheet__error size-tasks-sheet__error">
          <span>
            {formError ??
              (sizeTasksMutation.error instanceof Error
                ? sizeTasksMutation.error.message
                : "Task sizing failed.")}
          </span>
        </div>
      ) : null}

      <div className="adaptive-sheet__footer">
        {onShapeDay && tasksToSize.length === 0 ? (
          <button
            className="button button--primary"
            type="button"
            onClick={() => {
              onClose();
              onShapeDay();
            }}
          >
            Shape day
          </button>
        ) : null}
        {tasksToSize.length > 0 ? (
          <>
            <button
              className="button button--ghost"
              type="button"
              disabled={!canSave}
              onClick={() => void saveSizes(false)}
            >
              Save sizes
            </button>
            <button
              className="button button--primary"
              type="button"
              disabled={!canSave}
              onClick={() => void saveSizes(true)}
            >
              {sizeTasksMutation.isPending ? "Saving..." : "Save & shape"}
            </button>
          </>
        ) : null}
      </div>
    </DialogSurface>
  );

  return createPortal(sheet, document.body);
}
