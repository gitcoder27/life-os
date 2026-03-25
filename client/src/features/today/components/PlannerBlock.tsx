import { useState } from "react";
import type { DayPlannerBlockItem } from "../../../shared/lib/api";
import { formatTimeLabel } from "../../../shared/lib/api";
import { CheckIcon } from "../helpers/icons";

export function PlannerBlock({
  block,
  isAssigning,
  onSelectForAssign,
  onEditBlock,
  onDeleteBlock,
  onRemoveTask,
  onReorderTasks,
  isPending,
}: {
  block: DayPlannerBlockItem;
  isAssigning: boolean;
  onSelectForAssign: () => void;
  onEditBlock: (updates: { title?: string | null; startsAt?: string; endsAt?: string }) => void;
  onDeleteBlock: () => void;
  onRemoveTask: (taskId: string) => void;
  onReorderTasks: (taskIds: string[]) => void;
  isPending: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(block.title ?? "");
  const [editStart, setEditStart] = useState(toTimeInputValue(block.startsAt));
  const [editEnd, setEditEnd] = useState(toTimeInputValue(block.endsAt));

  const isEmpty = block.tasks.length === 0;
  const sortedTasks = [...block.tasks].sort((a, b) => a.sortOrder - b.sortOrder);
  const completedCount = sortedTasks.filter((bt) => bt.task.status === "completed").length;

  function handleSaveEdit() {
    const datePrefix = block.startsAt.slice(0, 11);
    const tzSuffix = block.startsAt.slice(-6);

    const updates: { title?: string | null; startsAt?: string; endsAt?: string } = {};
    const newTitle = editTitle.trim() || null;
    if (newTitle !== block.title) updates.title = newTitle;

    const newStart = `${datePrefix}${editStart}:00${tzSuffix}`;
    const newEnd = `${datePrefix}${editEnd}:00${tzSuffix}`;
    if (newStart !== block.startsAt) updates.startsAt = newStart;
    if (newEnd !== block.endsAt) updates.endsAt = newEnd;

    if (Object.keys(updates).length > 0) {
      onEditBlock(updates);
    }
    setEditing(false);
  }

  function handleCancelEdit() {
    setEditTitle(block.title ?? "");
    setEditStart(toTimeInputValue(block.startsAt));
    setEditEnd(toTimeInputValue(block.endsAt));
    setEditing(false);
  }

  function handleMoveTask(index: number, direction: -1 | 1) {
    const ids = sortedTasks.map((bt) => bt.taskId);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    onReorderTasks(ids);
  }

  if (isAssigning) {
    return (
      <button
        type="button"
        className="planner-block planner-block--assign-target"
        onClick={onSelectForAssign}
        disabled={isPending}
      >
        <div className="planner-block__time-badge">
          {formatTimeLabel(block.startsAt)} – {formatTimeLabel(block.endsAt)}
        </div>
        <div className="planner-block__title">
          {block.title || "Untitled block"}
        </div>
        <div className="planner-block__assign-hint">Tap to assign here</div>
      </button>
    );
  }

  return (
    <div className={`planner-block ${isEmpty ? "planner-block--empty" : ""}`}>
      <div className="planner-block__header">
        {editing ? (
          <div className="planner-block__edit-form">
            <input
              className="planner-block__edit-title"
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Block title (optional)"
              autoFocus
            />
            <div className="planner-block__edit-times">
              <input
                className="planner-block__edit-time"
                type="time"
                value={editStart}
                onChange={(e) => setEditStart(e.target.value)}
              />
              <span className="planner-block__edit-sep">→</span>
              <input
                className="planner-block__edit-time"
                type="time"
                value={editEnd}
                onChange={(e) => setEditEnd(e.target.value)}
              />
            </div>
            <div className="planner-block__edit-actions">
              <button
                className="button button--primary button--small"
                type="button"
                onClick={handleSaveEdit}
                disabled={isPending}
              >
                Save
              </button>
              <button
                className="button button--ghost button--small"
                type="button"
                onClick={handleCancelEdit}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="planner-block__info">
              <div className="planner-block__time-badge">
                {formatTimeLabel(block.startsAt)} – {formatTimeLabel(block.endsAt)}
              </div>
              <div className="planner-block__title">
                {block.title || <span className="planner-block__untitled">Untitled block</span>}
              </div>
              {sortedTasks.length > 0 ? (
                <span className="planner-block__task-count">
                  {completedCount}/{sortedTasks.length} tasks
                </span>
              ) : null}
            </div>
            <div className="planner-block__actions">
              <button
                className="planner-block__action-btn"
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Edit block"
              >
                ✎
              </button>
              {isEmpty ? (
                <button
                  className="planner-block__action-btn planner-block__action-btn--delete"
                  type="button"
                  onClick={onDeleteBlock}
                  disabled={isPending}
                  aria-label="Delete block"
                >
                  ✕
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>

      {sortedTasks.length > 0 ? (
        <div className="planner-block__tasks">
          {sortedTasks.map((bt, index) => (
            <div
              key={bt.taskId}
              className={`planner-block__task ${bt.task.status === "completed" ? "planner-block__task--done" : ""}`}
            >
              <span className="planner-block__task-check">
                {bt.task.status === "completed" ? <CheckIcon /> : null}
              </span>
              <span className="planner-block__task-title">{bt.task.title}</span>
              <div className="planner-block__task-actions">
                {index > 0 ? (
                  <button
                    className="planner-block__task-move"
                    type="button"
                    onClick={() => handleMoveTask(index, -1)}
                    disabled={isPending}
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                ) : null}
                {index < sortedTasks.length - 1 ? (
                  <button
                    className="planner-block__task-move"
                    type="button"
                    onClick={() => handleMoveTask(index, 1)}
                    disabled={isPending}
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                ) : null}
                <button
                  className="planner-block__task-remove"
                  type="button"
                  onClick={() => onRemoveTask(bt.taskId)}
                  disabled={isPending}
                  aria-label="Remove from block"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="planner-block__empty-hint">
          No tasks assigned — use the task list to add some, or keep as a free block.
        </div>
      )}
    </div>
  );
}

function toTimeInputValue(isoDateTime: string): string {
  try {
    const date = new Date(isoDateTime);
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  } catch {
    return "09:00";
  }
}
