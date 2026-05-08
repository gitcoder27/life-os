import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  getTodayDate,
  toIsoDate,
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
const DEFAULT_REMINDER_TIME = "09:00";
const DEFAULT_DUE_TIME = "17:00";

const TASK_STATUS_OPTIONS: Array<{
  value: TaskItem["status"];
  label: string;
}> = [
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "dropped", label: "Dropped" },
];

const isDateOnlyValue = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const getTimezoneOffsetForDateTime = (date: string, time: string) => {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const offset = localDate.getTimezoneOffset();
  const sign = offset <= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offset);
  const offsetHours = String(Math.floor(absoluteOffset / 60)).padStart(2, "0");
  const offsetMinutes = String(absoluteOffset % 60).padStart(2, "0");

  return `${sign}${offsetHours}:${offsetMinutes}`;
};

const buildLocalDateTime = (date: string, time: string) =>
  `${date}T${time}:00${getTimezoneOffsetForDateTime(date, time)}`;

const toDateInputValue = (value: string | null | undefined) => {
  if (!value) {
    return "";
  }

  if (isDateOnlyValue(value)) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return toIsoDate(date);
};

const toTimeInputValue = (value: string | null | undefined) => {
  if (!value || isDateOnlyValue(value)) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

const dateTimeValuesMatch = (
  left: string | null | undefined,
  right: string | null | undefined,
) => {
  const normalizedLeft = left ?? null;
  const normalizedRight = right ?? null;

  if (normalizedLeft === normalizedRight) {
    return true;
  }

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  if (isDateOnlyValue(normalizedLeft) || isDateOnlyValue(normalizedRight)) {
    return normalizedLeft === normalizedRight;
  }

  const leftDate = new Date(normalizedLeft);
  const rightDate = new Date(normalizedRight);

  return !Number.isNaN(leftDate.getTime()) &&
    !Number.isNaN(rightDate.getTime()) &&
    leftDate.getTime() === rightDate.getTime();
};

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
  const [scheduledDate, setScheduledDate] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [status, setStatus] = useState<TaskItem["status"]>("pending");

  const initialTitle = task?.title ?? "";
  const initialNotes = normalizeNotes(task?.notes);
  const initialScheduledDate = task?.scheduledForDate ?? null;
  const initialReminderAt = task?.reminderAt ?? null;
  const initialDueAt = task?.dueAt ?? null;
  const initialStatus = task?.status ?? "pending";

  useEffect(() => {
    if (!open || !task) {
      return;
    }

    setTitle(task.title);
    setNotes(normalizeNotes(task.notes));
    setNotesTouched(false);
    setScheduledDate(task.scheduledForDate ?? "");
    setReminderDate(toDateInputValue(task.reminderAt));
    setReminderTime(toTimeInputValue(task.reminderAt));
    setDueDate(toDateInputValue(task.dueAt));
    setDueTime(toTimeInputValue(task.dueAt));
    setStatus(task.status);
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
  const nextScheduledDate = scheduledDate || null;
  const nextReminderAt = reminderDate
    ? reminderTime
      ? buildLocalDateTime(reminderDate, reminderTime)
      : reminderDate
    : null;
  const nextDueAt = dueDate && dueTime ? buildLocalDateTime(dueDate, dueTime) : null;
  const hasDueTimeWithoutDate = Boolean(dueTime && !dueDate);
  const hasDueDateWithoutTime = Boolean(dueDate && !dueTime);
  const hasDateTimeError = hasDueTimeWithoutDate || hasDueDateWithoutTime;
  const dateTimeErrorMessage = hasDueDateWithoutTime
    ? "Add a due time or clear the due date."
    : hasDueTimeWithoutDate
      ? "Add a due date or clear the due time."
      : null;
  const hasChanges =
    nextTitle !== initialTitle ||
    nextNotes !== initialNotes ||
    nextScheduledDate !== initialScheduledDate ||
    !dateTimeValuesMatch(nextReminderAt, initialReminderAt) ||
    !dateTimeValuesMatch(nextDueAt, initialDueAt) ||
    status !== initialStatus;
  const canSave = Boolean(task && nextTitle && hasChanges && !hasDateTimeError && !updateTaskMutation.isPending);

  const handleClose = useCallback(() => {
    updateTaskMutation.reset();
    onClose();
  }, [onClose, updateTaskMutation]);

  const handleSave = useCallback(async () => {
    if (!task || !canSave) {
      return;
    }

    const payload: {
      taskId: string;
      title?: string;
      notes?: string | null;
      reminderAt?: string | null;
      status?: TaskItem["status"];
      scheduledForDate?: string | null;
      dueAt?: string | null;
    } = {
      taskId: task.id,
    };

    if (nextTitle !== initialTitle) {
      payload.title = nextTitle;
    }

    if (nextNotes !== initialNotes) {
      payload.notes = nextNotes || null;
    }

    if (nextScheduledDate !== initialScheduledDate) {
      payload.scheduledForDate = nextScheduledDate;
    }

    if (!dateTimeValuesMatch(nextReminderAt, initialReminderAt)) {
      payload.reminderAt = nextReminderAt;
    }

    if (!dateTimeValuesMatch(nextDueAt, initialDueAt)) {
      payload.dueAt = nextDueAt;
    }

    if (status !== initialStatus) {
      payload.status = status;
    }

    await updateTaskMutation.mutateAsync(payload);
    handleClose();
  }, [
    canSave,
    handleClose,
    initialDueAt,
    initialNotes,
    initialReminderAt,
    initialScheduledDate,
    initialStatus,
    initialTitle,
    nextDueAt,
    nextNotes,
    nextReminderAt,
    nextScheduledDate,
    nextTitle,
    status,
    task,
    updateTaskMutation,
  ]);

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
        {dateTimeErrorMessage ? (
          <InlineErrorState message={dateTimeErrorMessage} />
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

        <div className="task-edit-sheet__grid">
          <label className="field">
            <span>Schedule date</span>
            <input
              type="date"
              value={scheduledDate}
              onChange={(event) => setScheduledDate(event.target.value)}
              disabled={updateTaskMutation.isPending}
            />
          </label>

          <label className="field">
            <span>Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as TaskItem["status"])}
              disabled={updateTaskMutation.isPending}
            >
              {TASK_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="task-edit-sheet__grid task-edit-sheet__grid--date-time">
          <label className="field">
            <span>Reminder date</span>
            <input
              type="date"
              value={reminderDate}
              onChange={(event) => {
                const nextDate = event.target.value;
                setReminderDate(nextDate);
                setReminderTime((currentTime) =>
                  nextDate && !currentTime ? DEFAULT_REMINDER_TIME : currentTime,
                );
              }}
              disabled={updateTaskMutation.isPending}
            />
          </label>

          <label className="field">
            <span>Reminder time</span>
            <input
              type="time"
              value={reminderTime}
              onChange={(event) => {
                const nextTime = event.target.value;
                setReminderTime(nextTime);
                setReminderDate((currentDate) =>
                  nextTime && !currentDate ? scheduledDate || dueDate || getTodayDate() : currentDate,
                );
              }}
              disabled={updateTaskMutation.isPending || !reminderDate}
            />
          </label>
        </div>

        <div className="task-edit-sheet__grid task-edit-sheet__grid--date-time">
          <label className="field">
            <span>Due date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(event) => {
                const nextDate = event.target.value;
                setDueDate(nextDate);
                setDueTime((currentTime) =>
                  nextDate && !currentTime ? DEFAULT_DUE_TIME : currentTime,
                );
              }}
              disabled={updateTaskMutation.isPending}
            />
          </label>

          <label className="field">
            <span>Due time</span>
            <input
              type="time"
              value={dueTime}
              onChange={(event) => {
                const nextTime = event.target.value;
                setDueTime(nextTime);
                setDueDate((currentDate) =>
                  nextTime && !currentDate ? scheduledDate || reminderDate || getTodayDate() : currentDate,
                );
              }}
              disabled={updateTaskMutation.isPending}
            />
          </label>
        </div>

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
