import { useMemo, useState } from "react";
import { taskTextAutocompleteProps } from "./task-autocomplete";

export type FocusTaskOption = {
  id: string;
  title: string;
  status: string;
  scheduledForDate?: string | null;
};

type FocusTaskPickerProps = {
  id: string;
  label: string;
  tasks: FocusTaskOption[];
  selectedTaskId: string;
  onSelectTaskId: (taskId: string) => void;
  newTaskLabel?: string;
  referenceDate?: string;
};

const MAX_SUGGESTED_TASKS = 3;

const isOverdueTask = (task: FocusTaskOption, referenceDate?: string) =>
  Boolean(referenceDate && task.scheduledForDate && task.scheduledForDate < referenceDate);

export function FocusTaskPicker({
  id,
  label,
  tasks,
  selectedTaskId,
  onSelectTaskId,
  newTaskLabel = "New task",
  referenceDate,
}: FocusTaskPickerProps) {
  const [browseOpen, setBrowseOpen] = useState(false);
  const [query, setQuery] = useState("");
  const pendingTasks = useMemo(
    () => tasks.filter((task) => task.status === "pending"),
    [tasks],
  );
  const todayTasks = useMemo(
    () => pendingTasks.filter((task) => !isOverdueTask(task, referenceDate)),
    [pendingTasks, referenceDate],
  );
  const overdueTasks = useMemo(
    () => pendingTasks.filter((task) => isOverdueTask(task, referenceDate)),
    [pendingTasks, referenceDate],
  );
  const selectedTask = selectedTaskId
    ? pendingTasks.find((task) => task.id === selectedTaskId)
    : null;
  const suggestedTasks = useMemo(() => {
    const sourceTasks = todayTasks.length > 0 ? todayTasks : overdueTasks;
    const suggestions = sourceTasks.slice(0, MAX_SUGGESTED_TASKS);
    if (!selectedTask || suggestions.some((task) => task.id === selectedTask.id)) {
      return suggestions;
    }

    return [selectedTask, ...suggestions.slice(0, MAX_SUGGESTED_TASKS - 1)];
  }, [overdueTasks, selectedTask, todayTasks]);
  const normalizedQuery = query.trim().toLowerCase();
  const filterTasks = (items: FocusTaskOption[]) =>
    normalizedQuery
      ? items.filter((task) => task.title.toLowerCase().includes(normalizedQuery))
      : items;
  const browsedTodayTasks = filterTasks(todayTasks);
  const browsedOverdueTasks = filterTasks(overdueTasks);
  const browsedTaskCount = browsedTodayTasks.length + browsedOverdueTasks.length;

  function selectTask(taskId: string) {
    onSelectTaskId(taskId);
    setBrowseOpen(false);
    setQuery("");
  }

  return (
    <fieldset
      className={`focus-task-picker${browseOpen ? " focus-task-picker--open" : ""}`}
      aria-labelledby={`${id}-label`}
    >
      <legend className="focus-task-picker__label" id={`${id}-label`}>
        {label}
      </legend>
      <div className="focus-task-picker__choices">
        <button
          className={`focus-task-picker__choice${!selectedTaskId ? " focus-task-picker__choice--active" : ""}`}
          type="button"
          onClick={() => selectTask("")}
          aria-pressed={!selectedTaskId}
        >
          {newTaskLabel}
        </button>
        {suggestedTasks.map((task) => (
          <button
            key={task.id}
            className={`focus-task-picker__choice${selectedTaskId === task.id ? " focus-task-picker__choice--active" : ""}${isOverdueTask(task, referenceDate) ? " focus-task-picker__choice--overdue" : ""}`}
            type="button"
            onClick={() => selectTask(task.id)}
            aria-pressed={selectedTaskId === task.id}
          >
            {task.title}
          </button>
        ))}
        {pendingTasks.length > suggestedTasks.length ? (
          <button
            className="focus-task-picker__choice focus-task-picker__choice--browse"
            type="button"
            onClick={() => setBrowseOpen((current) => !current)}
            aria-expanded={browseOpen}
            aria-controls={`${id}-browse`}
          >
            Browse all
          </button>
        ) : null}
      </div>

      {browseOpen ? (
        <div className="focus-task-picker__browser" id={`${id}-browse`}>
          <div className="focus-task-picker__browser-header">
            <input
              className="focus-task-picker__search"
              {...taskTextAutocompleteProps}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tasks"
              autoFocus
            />
            <span className="focus-task-picker__count">
              {todayTasks.length} today · {overdueTasks.length} overdue
            </span>
          </div>

          <div className="focus-task-picker__list" role="listbox" aria-label="Today tasks">
            <button
              className={`focus-task-picker__option${!selectedTaskId ? " focus-task-picker__option--active" : ""}`}
              type="button"
              onClick={() => selectTask("")}
              role="option"
              aria-selected={!selectedTaskId}
            >
              <span>{newTaskLabel}</span>
              <small>Write a fresh focus</small>
            </button>
            {browsedTodayTasks.length > 0 ? (
              <TaskOptionGroup
                label="Today"
                tasks={browsedTodayTasks}
                selectedTaskId={selectedTaskId}
                onSelect={selectTask}
              />
            ) : null}
            {browsedOverdueTasks.length > 0 ? (
              <TaskOptionGroup
                label="Overdue"
                tasks={browsedOverdueTasks}
                selectedTaskId={selectedTaskId}
                onSelect={selectTask}
                metaLabel="Pull into today"
              />
            ) : null}
            {browsedTaskCount === 0 ? (
              <p className="focus-task-picker__empty">No matching task.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </fieldset>
  );
}

function TaskOptionGroup({
  label,
  tasks,
  selectedTaskId,
  onSelect,
  metaLabel,
}: {
  label: string;
  tasks: FocusTaskOption[];
  selectedTaskId: string;
  onSelect: (taskId: string) => void;
  metaLabel?: string;
}) {
  return (
    <div className="focus-task-picker__group" role="group" aria-label={label}>
      <span className="focus-task-picker__group-label">{label}</span>
      {tasks.map((task) => (
        <button
          key={task.id}
          className={`focus-task-picker__option${selectedTaskId === task.id ? " focus-task-picker__option--active" : ""}`}
          type="button"
          onClick={() => onSelect(task.id)}
          role="option"
          aria-selected={selectedTaskId === task.id}
        >
          <span>{task.title}</span>
          {metaLabel ? <small>{metaLabel}</small> : null}
        </button>
      ))}
    </div>
  );
}
