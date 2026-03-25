import { useState, useRef, useEffect } from "react";
import type { TaskItem, DayPlannerBlockItem } from "../../../shared/lib/api";

export function UnplannedTasks({
  tasks,
  blocks,
  onQuickAssign,
}: {
  tasks: TaskItem[];
  blocks: DayPlannerBlockItem[];
  onQuickAssign: (taskId: string, block: DayPlannerBlockItem) => void;
}) {
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

  return (
    <div className="unplanned-lane">
      <div className="unplanned-lane__header">
        <h3 className="unplanned-lane__title">Unplanned</h3>
        <span className="unplanned-lane__count">{tasks.length}</span>
      </div>
      {blocks.length === 0 ? (
        <div className="unplanned-lane__helper">
          Create a block first, then assign tasks from here or from inside a block.
        </div>
      ) : null}

      <div className="unplanned-lane__list">
        {tasks.map((task) => (
          <UnplannedTaskRow
            key={task.id}
            task={task}
            blocks={blocks}
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
  onQuickAssign,
}: {
  task: TaskItem;
  blocks: DayPlannerBlockItem[];
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
    <div className="unplanned-task">
      <div className="unplanned-task__info">
        <span className="unplanned-task__title">{task.title}</span>
        {task.goal ? (
          <span className={`unplanned-task__goal goal-chip__dot--${task.goal.domain}`}>
            {task.goal.title}
          </span>
        ) : null}
      </div>

      <div className="unplanned-task__actions" ref={pickerRef}>
        {blocks.length > 0 ? (
          <>
            {blocks.length === 1 ? (
              <button
                className="unplanned-task__assign-btn"
                type="button"
                onClick={() => onQuickAssign(blocks[0])}
                title={`Assign to ${blocks[0].title || "block"}`}
              >
                → {formatBlockLabel(blocks[0])}
              </button>
            ) : (
              <>
                <button
                  className="unplanned-task__assign-btn"
                  type="button"
                  onClick={() => setShowPicker(!showPicker)}
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
