import { useMemo } from "react";

export type FocusTaskOption = {
  id: string;
  title: string;
  status: string;
};

type FocusTaskPickerProps = {
  id: string;
  label: string;
  tasks: FocusTaskOption[];
  selectedTaskId: string;
  onSelectTaskId: (taskId: string) => void;
  newTaskLabel?: string;
};

const MAX_VISIBLE_TASKS = 4;

export function FocusTaskPicker({
  id,
  label,
  tasks,
  selectedTaskId,
  onSelectTaskId,
  newTaskLabel = "New task",
}: FocusTaskPickerProps) {
  const pendingTasks = useMemo(
    () => tasks.filter((task) => task.status === "pending"),
    [tasks],
  );
  const selectedTask = selectedTaskId
    ? pendingTasks.find((task) => task.id === selectedTaskId)
    : null;
  const visibleTasks = pendingTasks.slice(0, MAX_VISIBLE_TASKS);
  const visibleTaskIds = new Set(visibleTasks.map((task) => task.id));
  const taskChoices =
    selectedTask && !visibleTaskIds.has(selectedTask.id)
      ? [selectedTask, ...visibleTasks.slice(0, MAX_VISIBLE_TASKS - 1)]
      : visibleTasks;
  const hiddenTaskCount = Math.max(0, pendingTasks.length - taskChoices.length);

  return (
    <fieldset className="focus-task-picker" aria-labelledby={`${id}-label`}>
      <legend className="focus-task-picker__label" id={`${id}-label`}>
        {label}
      </legend>
      <div className="focus-task-picker__choices">
        <button
          className={`focus-task-picker__choice${!selectedTaskId ? " focus-task-picker__choice--active" : ""}`}
          type="button"
          onClick={() => onSelectTaskId("")}
          aria-pressed={!selectedTaskId}
        >
          {newTaskLabel}
        </button>
        {taskChoices.map((task) => (
          <button
            key={task.id}
            className={`focus-task-picker__choice${selectedTaskId === task.id ? " focus-task-picker__choice--active" : ""}`}
            type="button"
            onClick={() => onSelectTaskId(task.id)}
            aria-pressed={selectedTaskId === task.id}
          >
            {task.title}
          </button>
        ))}
      </div>
      {hiddenTaskCount > 0 ? (
        <span className="focus-task-picker__more">
          +{hiddenTaskCount} more in the queue
        </span>
      ) : null}
    </fieldset>
  );
}
