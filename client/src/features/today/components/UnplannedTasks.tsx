import { useState, useRef, useEffect } from "react";
import type { TaskItem, DayPlannerBlockItem } from "../../../shared/lib/api";

export function UnplannedTasks({
  tasks,
  blocks,
  isPending,
  onQuickAssign,
  onBulkAssign,
}: {
  tasks: TaskItem[];
  blocks: DayPlannerBlockItem[];
  isPending: boolean;
  onQuickAssign: (taskId: string, block: DayPlannerBlockItem) => void;
  onBulkAssign: (taskIds: string[], block: DayPlannerBlockItem) => Promise<void> | void;
}) {
  const [batchMode, setBatchMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [targetBlockId, setTargetBlockId] = useState(blocks[0]?.id ?? "");

  useEffect(() => {
    setSelectedTaskIds((current) =>
      current.filter((taskId) => tasks.some((task) => task.id === taskId)),
    );
  }, [tasks]);

  useEffect(() => {
    if (!blocks.some((block) => block.id === targetBlockId)) {
      setTargetBlockId(blocks[0]?.id ?? "");
    }
  }, [blocks, targetBlockId]);

  if (tasks.length === 0) {
    return (
      <div className="unplanned-lane">
        <h3 className="unplanned-lane__title">Unplanned tasks</h3>
        <div className="unplanned-lane__empty">
          <span className="unplanned-lane__empty-icon">✓</span>
          <p>All tasks are planned!</p>
        </div>
      </div>
    );
  }

  const selectedCount = selectedTaskIds.length;
  const allVisibleSelected = tasks.length > 0 && selectedCount === tasks.length;

  function toggleTaskSelection(taskId: string) {
    setSelectedTaskIds((current) =>
      current.includes(taskId)
        ? current.filter((id) => id !== taskId)
        : [...current, taskId],
    );
  }

  async function handleAssignSelected() {
    const targetBlock = blocks.find((block) => block.id === targetBlockId);
    if (!targetBlock || selectedTaskIds.length === 0) {
      return;
    }

    const orderedTaskIds = tasks
      .filter((task) => selectedTaskIds.includes(task.id))
      .map((task) => task.id);

    await Promise.resolve(onBulkAssign(orderedTaskIds, targetBlock));
    setSelectedTaskIds([]);
  }

  return (
    <div className="unplanned-lane">
      <div className="unplanned-lane__header">
        <div className="unplanned-lane__header-main">
          <h3 className="unplanned-lane__title">Unplanned</h3>
          <span className="unplanned-lane__count">{tasks.length}</span>
        </div>
        {blocks.length > 0 ? (
          <button
            className="button button--ghost button--small"
            type="button"
            onClick={() => {
              setBatchMode((current) => !current);
              setSelectedTaskIds([]);
            }}
            disabled={isPending}
          >
            {batchMode ? "Done" : "Plan multiple"}
          </button>
        ) : null}
      </div>

      {blocks.length === 0 ? (
        <div className="unplanned-lane__helper">
          Create a block first, then assign tasks from here or from inside a block.
        </div>
      ) : null}

      {batchMode && blocks.length > 0 ? (
        <div
          className="unplanned-lane__batch"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setBatchMode(false);
              setSelectedTaskIds([]);
              return;
            }

            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
              event.preventDefault();
              setSelectedTaskIds(tasks.map((task) => task.id));
            }
          }}
        >
          <div className="unplanned-lane__batch-summary">
            <strong>{selectedCount}</strong>
            <span>{selectedCount === 1 ? "task selected" : "tasks selected"}</span>
          </div>
          <div className="unplanned-lane__batch-actions">
            <button
              className="button button--ghost button--small"
              type="button"
              onClick={() => setSelectedTaskIds(allVisibleSelected ? [] : tasks.map((task) => task.id))}
              disabled={isPending}
            >
              {allVisibleSelected ? "Clear visible" : "Select all visible"}
            </button>
            {selectedCount > 0 ? (
              <button
                className="button button--ghost button--small"
                type="button"
                onClick={() => setSelectedTaskIds([])}
                disabled={isPending}
              >
                Clear selection
              </button>
            ) : null}
          </div>
          <div className="unplanned-lane__batch-controls">
            <label className="unplanned-lane__batch-field">
              <span>Assign to</span>
              <select
                className="unplanned-lane__batch-select"
                value={targetBlockId}
                onChange={(event) => setTargetBlockId(event.target.value)}
                disabled={isPending}
              >
                {blocks.map((block) => (
                  <option key={block.id} value={block.id}>
                    {formatBlockTime(block)} · {block.title || "Untitled"}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="button button--primary button--small"
              type="button"
              onClick={() => {
                void handleAssignSelected();
              }}
              disabled={isPending || selectedCount === 0 || !targetBlockId}
            >
              Assign selected
            </button>
          </div>
        </div>
      ) : null}

      <div className="unplanned-lane__list">
        {tasks.map((task) => (
          <UnplannedTaskRow
            key={task.id}
            task={task}
            blocks={blocks}
            batchMode={batchMode}
            checked={selectedTaskIds.includes(task.id)}
            isPending={isPending}
            onToggleSelection={() => toggleTaskSelection(task.id)}
            onQuickAssign={(block) => onQuickAssign(task.id, block)}
          />
        ))}
      </div>
    </div>
  );
}

function UnplannedTaskRow({
  task,
  blocks,
  batchMode,
  checked,
  isPending,
  onToggleSelection,
  onQuickAssign,
}: {
  task: TaskItem;
  blocks: DayPlannerBlockItem[];
  batchMode: boolean;
  checked: boolean;
  isPending: boolean;
  onToggleSelection: () => void;
  onQuickAssign: (block: DayPlannerBlockItem) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    function handler(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPicker]);

  return (
    <div className={`unplanned-task${batchMode ? " unplanned-task--batch" : ""}`}>
      {batchMode ? (
        <label className="unplanned-task__check">
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggleSelection}
            disabled={isPending}
            aria-label={`Select ${task.title}`}
          />
        </label>
      ) : null}

      <div className="unplanned-task__info">
        <span className="unplanned-task__title">{task.title}</span>
        {task.goal ? (
          <span className={`unplanned-task__goal goal-chip__dot--${task.goal.domain}`}>
            {task.goal.title}
          </span>
        ) : null}
      </div>

      {!batchMode ? (
        <div className="unplanned-task__actions" ref={pickerRef}>
          {blocks.length > 0 ? (
            <>
              {blocks.length === 1 ? (
                <button
                  className="unplanned-task__assign-btn"
                  type="button"
                  onClick={() => onQuickAssign(blocks[0])}
                  title={`Assign to ${blocks[0].title || "block"}`}
                  disabled={isPending}
                >
                  → {formatBlockLabel(blocks[0])}
                </button>
              ) : (
                <>
                  <button
                    className="unplanned-task__assign-btn"
                    type="button"
                    onClick={() => setShowPicker(!showPicker)}
                    disabled={isPending}
                  >
                    + Assign
                  </button>
                  {showPicker ? (
                    <div className="unplanned-task__picker">
                      {blocks.map((block) => (
                        <button
                          key={block.id}
                          className="unplanned-task__picker-item"
                          type="button"
                          onClick={() => {
                            onQuickAssign(block);
                            setShowPicker(false);
                          }}
                          disabled={isPending}
                        >
                          <span className="unplanned-task__picker-time">
                            {formatBlockTime(block)}
                          </span>
                          <span className="unplanned-task__picker-label">
                            {block.title || "Untitled"}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function formatBlockLabel(block: DayPlannerBlockItem): string {
  const title = block.title || "Untitled";
  return title.length > 15 ? title.slice(0, 15) + "…" : title;
}

function formatBlockTime(block: DayPlannerBlockItem): string {
  try {
    const start = new Date(block.startsAt);
    return start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}
