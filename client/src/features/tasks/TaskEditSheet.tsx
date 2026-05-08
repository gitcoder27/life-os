import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  useUpdateTaskMutation,
  type TaskItem,
} from "../../shared/lib/api";
import { DialogSurface } from "../../shared/ui/DialogSurface";
import { InlineErrorState } from "../../shared/ui/PageState";
import { taskTextAutocompleteProps } from "../../shared/ui/task-autocomplete";

type TaskEditSheetProps = {
  open: boolean;
  task: TaskItem | null;
  date: string;
  onClose: () => void;
};

const normalizeNotes = (notes: string | null | undefined) => notes?.trim() ?? "";

export function TaskEditSheet({
  open,
  task,
  date,
  onClose,
}: TaskEditSheetProps) {
  const updateTaskMutation = useUpdateTaskMutation(date);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const titleId = "task-edit-sheet-title";
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [notesTouched, setNotesTouched] = useState(false);

  const initialTitle = task?.title ?? "";
  const initialNotes = normalizeNotes(task?.notes);

  useEffect(() => {
    if (!open || !task) {
      return;
    }

    setTitle(task.title);
    setNotes(normalizeNotes(task.notes));
    setNotesTouched(false);
    updateTaskMutation.reset();
  }, [open, task?.id]);

  const nextTitle = title.trim();
  const nextNotes = useMemo(() => {
    const trimmedNotes = notes.trim();

    if (!notesTouched && initialNotes && initialNotes === initialTitle && nextTitle !== initialTitle) {
      return nextTitle;
    }

    return trimmedNotes;
  }, [initialNotes, initialTitle, nextTitle, notes, notesTouched]);
  const hasChanges = nextTitle !== initialTitle || nextNotes !== initialNotes;
  const canSave = Boolean(task && nextTitle && hasChanges && !updateTaskMutation.isPending);

  const handleClose = useCallback(() => {
    updateTaskMutation.reset();
    onClose();
  }, [onClose, updateTaskMutation]);

  const handleSave = useCallback(async () => {
    if (!task || !canSave) {
      return;
    }

    await updateTaskMutation.mutateAsync({
      taskId: task.id,
      title: nextTitle,
      notes: nextNotes || null,
    });
    handleClose();
  }, [canSave, handleClose, nextNotes, nextTitle, task, updateTaskMutation]);

  if (!open || !task) {
    return null;
  }

  const sheet = (
    <DialogSurface
      open={open}
      className="capture-sheet capture-sheet--open"
      backdropClassName="capture-sheet__backdrop"
      panelClassName="capture-sheet__panel task-edit-sheet"
      titleId={titleId}
      onClose={handleClose}
      initialFocusRef={titleInputRef}
      onPanelKeyDown={(event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          event.preventDefault();
          void handleSave();
        }
      }}
    >
      <div className="capture-sheet__header">
        <div>
          <p className="page-eyebrow">Task</p>
          <h3 className="capture-sheet__title" id={titleId}>Edit task</h3>
        </div>
        <button
          className="button button--ghost button--small"
          type="button"
          onClick={handleClose}
        >
          Close
        </button>
      </div>

      <div className="stack-form">
        {updateTaskMutation.error instanceof Error ? (
          <InlineErrorState message={updateTaskMutation.error.message} />
        ) : null}

        <label className="field">
          <span>Title</span>
          <input
            ref={titleInputRef}
            {...taskTextAutocompleteProps}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Task title"
            disabled={updateTaskMutation.isPending}
          />
        </label>

        <label className="field">
          <span>Notes</span>
          <textarea
            {...taskTextAutocompleteProps}
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              setNotesTouched(true);
            }}
            placeholder="Add detail, context, or the full captured thought"
            rows={5}
            disabled={updateTaskMutation.isPending}
          />
        </label>

        <div className="button-row">
          <button
            className="button button--primary"
            type="button"
            onClick={() => void handleSave()}
            disabled={!canSave}
          >
            {updateTaskMutation.isPending ? "Saving..." : "Save changes"}
          </button>
          <span className="kbd-hint"><span className="kbd">Ctrl</span><span className="kbd">Enter</span> save</span>
        </div>
      </div>
    </DialogSurface>
  );

  return createPortal(sheet, document.body);
}
