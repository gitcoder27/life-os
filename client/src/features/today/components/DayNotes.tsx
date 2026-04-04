import { useEffect, useMemo, useState } from "react";
import {
  useUpdateTaskMutation,
  type TaskItem,
} from "../../../shared/lib/api";
import { InlineErrorState } from "../../../shared/ui/PageState";
import {
  getQuickCaptureDisplayText,
  getQuickCaptureText,
} from "../../../shared/lib/quickCapture";
import { getTomorrowDate } from "../helpers/date-helpers";

function getKindLabel(kind: TaskItem["kind"]) {
  if (kind === "reminder") return "Reminder";
  if (kind === "note") return "Note";
  return "Task";
}

function getEditableText(task: TaskItem) {
  return getQuickCaptureText(task, task.title);
}

function getTaskDate(task: TaskItem, today: string) {
  return task.scheduledForDate ?? task.reminderAt?.slice(0, 10) ?? today;
}

type DayNotesProps = {
  tasks: TaskItem[];
  today: string;
};

type DayNoteRowProps = {
  task: TaskItem;
  today: string;
  expanded: boolean;
  disabled: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onUpdate: (
    taskId: string,
    payload: {
      notes?: string | null;
      scheduledForDate?: string | null;
      reminderAt?: string | null;
      kind?: TaskItem["kind"];
      status?: TaskItem["status"];
    },
    onSuccess?: () => void,
  ) => void;
};

function DayNoteRow({
  task,
  today,
  expanded,
  disabled,
  onExpand,
  onCollapse,
  onUpdate,
}: DayNoteRowProps) {
  const tomorrow = getTomorrowDate(today);
  const [draftText, setDraftText] = useState(() => getEditableText(task));
  const [draftDate, setDraftDate] = useState(() => getTaskDate(task, today));

  const savedText = getEditableText(task);
  const savedDate = getTaskDate(task, today);
  const isDone = task.status === "completed";

  useEffect(() => {
    if (!expanded) {
      return;
    }

    setDraftText(savedText);
    setDraftDate(savedDate);
  }, [expanded, savedDate, savedText, task.id]);

  const hasTextChange = draftText.trim() !== savedText;
  const hasDateChange = draftDate !== savedDate;
  const hasPendingChanges = hasTextChange || hasDateChange;

  function handleSave() {
    if (!hasPendingChanges) {
      onCollapse();
      return;
    }

    onUpdate(
      task.id,
      {
        notes: hasTextChange ? draftText.trim() || null : undefined,
        scheduledForDate: hasDateChange ? draftDate : undefined,
        reminderAt:
          task.kind === "reminder" && hasDateChange
            ? draftDate
            : undefined,
      },
      onCollapse,
    );
  }

  function handleConvert(nextKind: TaskItem["kind"]) {
    const nextDate = draftDate || savedDate || today;
    onUpdate(
      task.id,
      {
        kind: nextKind,
        reminderAt:
          nextKind === "reminder"
            ? nextDate
            : null,
      },
      onCollapse,
    );
  }

  function handleStatus(nextStatus: TaskItem["status"]) {
    onUpdate(task.id, { status: nextStatus }, onCollapse);
  }

  function handleDismiss() {
    onUpdate(task.id, { status: "dropped" }, onCollapse);
  }

  return (
    <li
      className={`today-day-note${expanded ? " today-day-note--expanded" : ""}${isDone ? " today-day-note--done" : ""}`}
    >
      <button
        className="today-day-note__body"
        type="button"
        onClick={expanded ? onCollapse : onExpand}
        aria-expanded={expanded}
      >
        <span className="today-day-note__text">
          {getQuickCaptureDisplayText(task, task.title)}
        </span>
      </button>

      <span className="today-day-note__meta">
        <span className={`today-day-note__kind today-day-note__kind--${task.kind}`}>
          {getKindLabel(task.kind)}
        </span>
        {isDone ? (
          <span className="today-day-note__status today-day-note__status--done">
            Done
          </span>
        ) : null}
      </span>

      <button
        className="today-day-note__manage"
        type="button"
        onClick={expanded ? onCollapse : onExpand}
        disabled={disabled}
      >
        {expanded ? "Close" : "Edit"}
      </button>

      {expanded ? (
        <div className="today-day-note__editor">
          <textarea
            className="today-day-note__input"
            rows={3}
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                handleSave();
              }
            }}
            disabled={disabled}
          />

          <div className="today-day-note__schedule">
            <button
              className={`today-day-note__chip${draftDate === today ? " today-day-note__chip--active" : ""}`}
              type="button"
              onClick={() => setDraftDate(today)}
              disabled={disabled}
            >
              Today
            </button>
            <button
              className={`today-day-note__chip${draftDate === tomorrow ? " today-day-note__chip--active" : ""}`}
              type="button"
              onClick={() => setDraftDate(tomorrow)}
              disabled={disabled}
            >
              Tomorrow
            </button>
            <input
              className="today-day-note__date-input"
              type="date"
              value={draftDate}
              onChange={(event) => setDraftDate(event.target.value)}
              disabled={disabled}
            />
            <button
              className="button button--primary button--small"
              type="button"
              onClick={handleSave}
              disabled={disabled || !hasPendingChanges}
            >
              Save
            </button>
          </div>

          <div className="today-day-note__actions">
            <button
              className="today-day-note__action"
              type="button"
              onClick={() => handleConvert("task")}
              disabled={disabled}
            >
              Convert to task
            </button>
            <button
              className="today-day-note__action"
              type="button"
              onClick={() => handleConvert(task.kind === "note" ? "reminder" : "note")}
              disabled={disabled}
            >
              {task.kind === "note" ? "Convert to reminder" : "Convert to note"}
            </button>
            <button
              className="today-day-note__action"
              type="button"
              onClick={() => handleStatus(isDone ? "pending" : "completed")}
              disabled={disabled}
            >
              {isDone ? "Reopen" : "Mark done"}
            </button>
            <button
              className="today-day-note__action today-day-note__action--danger"
              type="button"
              onClick={handleDismiss}
              disabled={disabled}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function DayNotes({ tasks, today }: DayNotesProps) {
  const visibleTasks = useMemo(
    () => tasks.filter((task) => task.status !== "dropped"),
    [tasks],
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const updateTaskMutation = useUpdateTaskMutation(today);

  useEffect(() => {
    if (!expandedId) {
      return;
    }

    if (!visibleTasks.some((task) => task.id === expandedId)) {
      setExpandedId(null);
    }
  }, [expandedId, visibleTasks]);

  if (visibleTasks.length === 0) return null;

  const mutationError =
    updateTaskMutation.error instanceof Error
      ? updateTaskMutation.error.message
      : null;

  function handleUpdate(
    taskId: string,
    payload: {
      notes?: string | null;
      scheduledForDate?: string | null;
      reminderAt?: string | null;
      kind?: TaskItem["kind"];
      status?: TaskItem["status"];
    },
    onSuccess?: () => void,
  ) {
    updateTaskMutation.mutate(
      { taskId, ...payload },
      { onSuccess },
    );
  }

  return (
    <section className="today-day-notes" aria-label="Day notes">
      <div className="today-day-notes__header">
        <h3 className="today-context-title">Day Notes</h3>
        <span className="today-day-notes__count">{visibleTasks.length}</span>
      </div>

      {mutationError ? (
        <InlineErrorState message={mutationError} />
      ) : null}

      <ul className="today-day-notes__list">
        {visibleTasks.map((task) => (
          <DayNoteRow
            key={task.id}
            task={task}
            today={today}
            expanded={expandedId === task.id}
            disabled={updateTaskMutation.isPending}
            onExpand={() => setExpandedId(task.id)}
            onCollapse={() => setExpandedId((current) => (current === task.id ? null : current))}
            onUpdate={handleUpdate}
          />
        ))}
      </ul>
    </section>
  );
}
