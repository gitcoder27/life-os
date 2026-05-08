import { useCallback, useEffect, useRef, useState } from "react";

import {
  useCreateTaskMutation,
  type TaskItem,
} from "../../../../shared/lib/api";
import { taskTextAutocompleteProps } from "../../../../shared/ui/task-autocomplete";
import {
  formatEstimatedMinutes,
  getTaskKindLabel,
  getUpcomingDayLabel,
  getUpcomingTaskTitle,
  type UpcomingDayTotal,
} from "../../helpers/upcoming-calendar";

type UpcomingDayDetailProps = {
  day: UpcomingDayTotal | null;
  date: string | null;
  onOpenDate: (date: string) => void;
  onEditTask: (task: TaskItem) => void;
};

export function UpcomingDayDetail({
  day,
  date,
  onOpenDate,
  onEditTask,
}: UpcomingDayDetailProps) {
  if (!date) {
    return null;
  }

  return (
    <UpcomingDayDetailContent
      day={day}
      date={date}
      onOpenDate={onOpenDate}
      onEditTask={onEditTask}
    />
  );
}

function UpcomingDayDetailContent({
  day,
  date,
  onOpenDate,
  onEditTask,
}: {
  day: UpcomingDayTotal | null;
  date: string;
  onOpenDate: (date: string) => void;
  onEditTask: (task: TaskItem) => void;
}) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const createTaskMutation = useCreateTaskMutation(date, {
    successMessage: "Task added.",
    errorMessage: "Task could not be added.",
  });
  const estimatedLabel = formatEstimatedMinutes(day?.estimatedMinutes ?? null);
  const tasks = day?.tasks ?? [];

  useEffect(() => {
    setComposerOpen(false);
    setDraftTitle("");
    createTaskMutation.reset();
  }, [date]);

  useEffect(() => {
    if (!composerOpen) {
      return;
    }

    inputRef.current?.focus();
  }, [composerOpen]);

  const handleSaveTask = useCallback(async () => {
    const title = draftTitle.trim();
    if (!title) {
      return;
    }

    await createTaskMutation.mutateAsync({
      title: title.split("\n")[0]?.trim() || title,
      notes: title,
      kind: "task",
      scheduledForDate: date,
      originType: "manual",
    });

    setDraftTitle("");
    setComposerOpen(false);
  }, [createTaskMutation, date, draftTitle]);

  const isSaveDisabled = createTaskMutation.isPending || !draftTitle.trim();

  return (
    <aside className="planner-upcoming-day-detail" aria-label={`Tasks for ${getUpcomingDayLabel(date)}`}>
      <div className="planner-upcoming-day-detail__header">
        <div>
          <span className="planner-upcoming-day-detail__eyebrow">Selected day</span>
          <h3>{getUpcomingDayLabel(date)}</h3>
        </div>
        <button
          className="planner-upcoming__open-day"
          type="button"
          onClick={() => onOpenDate(date)}
        >
          Open day
        </button>
      </div>

      <div className="planner-upcoming-day-detail__stats">
        <span>{tasks.length} item{tasks.length === 1 ? "" : "s"}</span>
        {estimatedLabel ? <span>{estimatedLabel}</span> : null}
      </div>

      <div className="planner-upcoming-day-detail__composer">
        {composerOpen ? (
          <div className="planner-upcoming-day-detail__composer-form">
            <label className="planner-upcoming-day-detail__composer-field">
              <span>New task</span>
              <textarea
                ref={inputRef}
                {...taskTextAutocompleteProps}
                rows={2}
                value={draftTitle}
                placeholder="Add work for this day"
                onChange={(event) => setDraftTitle(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                    event.preventDefault();
                    void handleSaveTask();
                  }
                }}
              />
            </label>
            {createTaskMutation.error instanceof Error ? (
              <p className="planner-upcoming-day-detail__composer-error">
                {createTaskMutation.error.message}
              </p>
            ) : null}
            <div className="planner-upcoming-day-detail__composer-actions">
              <button
                className="planner-upcoming-day-detail__composer-save"
                type="button"
                disabled={isSaveDisabled}
                onClick={() => void handleSaveTask()}
              >
                {createTaskMutation.isPending ? "Adding..." : "Add task"}
              </button>
              <button
                className="planner-upcoming-day-detail__composer-cancel"
                type="button"
                onClick={() => {
                  setComposerOpen(false);
                  setDraftTitle("");
                  createTaskMutation.reset();
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            className="planner-upcoming-day-detail__add"
            type="button"
            onClick={() => setComposerOpen(true)}
          >
            <span aria-hidden="true">+</span>
            Add new task
          </button>
        )}
      </div>

      {tasks.length > 0 ? (
        <div className="planner-upcoming-day-detail__tasks">
          {tasks.map((task) => (
            <button
              className="planner-upcoming-day-detail__task"
              type="button"
              key={task.id}
              onClick={() => onEditTask(task)}
            >
              <span className={`planner-upcoming-day-detail__kind planner-upcoming__kind--${task.kind}`}>
                {getTaskKindLabel(task.kind)}
              </span>
              <span>{getUpcomingTaskTitle(task)}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="planner-upcoming-day-detail__empty">No scheduled work on this day.</p>
      )}
    </aside>
  );
}
