import { useState } from "react";
import type { TaskItem } from "../../../shared/lib/api";
import { getTodayDate } from "../../../shared/lib/api";
import { getRecoveryTaskDetail } from "../helpers/date-helpers";
import type { useTaskActions } from "../hooks/useTaskActions";

type TaskActions = ReturnType<typeof useTaskActions>;

export function RecoveryTray({
  overdueTasks,
  taskActions,
}: {
  overdueTasks: TaskItem[];
  taskActions: TaskActions;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (overdueTasks.length === 0) return null;

  const allSelected = selected.size === overdueTasks.length;
  const someSelected = selected.size > 0;
  const selectedIds = [...selected];

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(overdueTasks.map((t) => t.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBatchAction(action: "today" | "tomorrow" | "complete" | "drop") {
    const ids = selectedIds;
    if (ids.length === 0) return;

    switch (action) {
      case "today":
        for (const id of ids) taskActions.moveToToday(id);
        break;
      case "tomorrow":
        void taskActions.moveTasksToTomorrow(ids);
        break;
      case "complete":
        for (const id of ids) taskActions.changeStatus(id, "completed");
        break;
      case "drop":
        for (const id of ids) taskActions.changeStatus(id, "dropped");
        break;
    }
    setSelected(new Set());
  }

  return (
    <section className="recovery-tray">
      <button
        className="recovery-tray__header"
        type="button"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="recovery-tray__count">{overdueTasks.length}</span>
        <span className="recovery-tray__label">
          overdue item{overdueTasks.length === 1 ? "" : "s"}
        </span>
        <span className="recovery-tray__cta">{expanded ? "Hide" : "Review now"}</span>
        <span className={`recovery-tray__chevron${expanded ? " recovery-tray__chevron--open" : ""}`}>
          ▾
        </span>
      </button>

      {expanded ? (
        <div className="recovery-tray__body">
          {/* Batch actions bar */}
          <div className="recovery-tray__batch">
            <label className="recovery-tray__select-all">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
              />
              <span>{allSelected ? "Deselect all" : "Select all"}</span>
            </label>
            {someSelected ? (
              <div className="recovery-tray__batch-actions">
                <span className="recovery-tray__batch-count">
                  {selected.size} selected
                </span>
                <button
                  className="button button--primary button--small"
                  type="button"
                  disabled={taskActions.isPending}
                  onClick={() => handleBatchAction("today")}
                >
                  Pull to today
                </button>
                <button
                  className="button button--ghost button--small"
                  type="button"
                  disabled={taskActions.isPending}
                  onClick={() => handleBatchAction("tomorrow")}
                >
                  Tomorrow
                </button>
                <button
                  className="button button--ghost button--small"
                  type="button"
                  disabled={taskActions.isPending}
                  onClick={() => handleBatchAction("complete")}
                >
                  Complete
                </button>
                <button
                  className="button button--ghost button--small"
                  type="button"
                  disabled={taskActions.isPending}
                  onClick={() => handleBatchAction("drop")}
                >
                  Drop
                </button>
              </div>
            ) : null}
          </div>

          {/* Task list */}
          <div className="recovery-tray__list">
            {overdueTasks.map((task) => (
              <RecoveryRow
                key={task.id}
                task={task}
                isSelected={selected.has(task.id)}
                onToggle={() => toggleOne(task.id)}
                taskActions={taskActions}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function RecoveryRow({
  task,
  isSelected,
  onToggle,
  taskActions,
}: {
  task: TaskItem;
  isSelected: boolean;
  onToggle: () => void;
  taskActions: TaskActions;
}) {
  return (
    <div className={`recovery-row${isSelected ? " recovery-row--selected" : ""}`}>
      <input
        type="checkbox"
        className="recovery-row__checkbox"
        checked={isSelected}
        onChange={onToggle}
      />
      <div className="recovery-row__content">
        <span className="recovery-row__title">{task.title}</span>
        <span className="recovery-row__meta">
          {getRecoveryTaskDetail(task.scheduledForDate ?? getTodayDate())}
        </span>
      </div>
      <div className="recovery-row__actions">
        <button
          className="recovery-row__btn"
          type="button"
          disabled={taskActions.isPending}
          onClick={() => taskActions.moveToToday(task.id)}
          title="Pull to today"
        >
          Today
        </button>
        <button
          className="recovery-row__btn"
          type="button"
          disabled={taskActions.isPending}
          onClick={() => taskActions.moveToTomorrow(task.id)}
          title="Move to tomorrow"
        >
          →
        </button>
      </div>
    </div>
  );
}
