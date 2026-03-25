import { Fragment, useEffect, useState } from "react";
import type { DayPlannerBlockItem, TaskItem } from "../../../shared/lib/api";
import { formatTimeLabel } from "../../../shared/lib/api";
import {
  toTimeInputValue,
  validatePlannerBlockDraft,
} from "../helpers/planner-blocks";
import { CheckIcon } from "../helpers/icons";

export function PlannerBlock({
  block,
  existingBlocks,
  availableTasks,
  availableBlocks,
  canMoveUp,
  canMoveDown,
  onMoveBlock,
  onAddTask,
  onMoveTaskToBlock,
  onEditBlock,
  onDeleteBlock,
  onRemoveTask,
  onReorderTasks,
  isPending,
}: {
  block: DayPlannerBlockItem;
  existingBlocks: DayPlannerBlockItem[];
  availableTasks: TaskItem[];
  availableBlocks: DayPlannerBlockItem[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveBlock: (direction: -1 | 1) => void;
  onAddTask: (taskId: string) => void;
  onMoveTaskToBlock: (taskId: string, targetBlock: DayPlannerBlockItem) => void;
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
  const [showAddTaskPicker, setShowAddTaskPicker] = useState(false);
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);

  const isEmpty = block.tasks.length === 0;
  const sortedTasks = [...block.tasks].sort((a, b) => a.sortOrder - b.sortOrder);
  const completedCount = sortedTasks.filter((bt) => bt.task.status === "completed").length;
  const validation = validatePlannerBlockDraft({
    date: block.startsAt.slice(0, 10),
    startTime: editStart,
    endTime: editEnd,
    timezoneOffset: block.startsAt.slice(-6),
    existingBlocks,
    ignoreBlockId: block.id,
  });

  useEffect(() => {
    setEditTitle(block.title ?? "");
    setEditStart(toTimeInputValue(block.startsAt));
    setEditEnd(toTimeInputValue(block.endsAt));
  }, [block.endsAt, block.startsAt, block.title]);

  function handleSaveEdit() {
    if (validation.error) {
      return;
    }

    const updates: { title?: string | null; startsAt?: string; endsAt?: string } = {};
    const newTitle = editTitle.trim() || null;
    if (newTitle !== block.title) updates.title = newTitle;

    if (validation.startsAt !== block.startsAt) updates.startsAt = validation.startsAt;
    if (validation.endsAt !== block.endsAt) updates.endsAt = validation.endsAt;

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
                disabled={isPending || Boolean(validation.error)}
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
            {validation.error ? (
              <div className="planner-block__edit-error">{validation.error}</div>
            ) : null}
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
                onClick={() => onMoveBlock(-1)}
                disabled={!canMoveUp || isPending}
                aria-label="Move block up"
              >
                ↑
              </button>
              <button
                className="planner-block__action-btn"
                type="button"
                onClick={() => onMoveBlock(1)}
                disabled={!canMoveDown || isPending}
                aria-label="Move block down"
              >
                ↓
              </button>
              <button
                className="planner-block__action-btn planner-block__action-btn--text"
                type="button"
                onClick={() => setShowAddTaskPicker((current) => !current)}
                disabled={availableTasks.length === 0 || isPending}
                aria-label="Add tasks to block"
              >
                + Task
              </button>
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

      {showAddTaskPicker ? (
        <div className="planner-block__picker">
          <div className="planner-block__picker-header">
            <span>Add tasks to this block</span>
            <button
              className="button button--ghost button--small"
              type="button"
              onClick={() => setShowAddTaskPicker(false)}
            >
              Close
            </button>
          </div>
          {availableTasks.length > 0 ? (
            <div className="planner-block__picker-list">
              {availableTasks.map((task) => (
                <button
                  key={task.id}
                  className="planner-block__picker-item"
                  type="button"
                  onClick={() => {
                    onAddTask(task.id);
                    setShowAddTaskPicker(false);
                  }}
                  disabled={isPending}
                >
                  <span className="planner-block__picker-title">{task.title}</span>
                  <span className="planner-block__picker-action">Add</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="planner-block__picker-empty">
              All pending tasks are already planned.
            </div>
          )}
        </div>
      ) : null}

      {sortedTasks.length > 0 ? (
        <div className="planner-block__tasks">
          {sortedTasks.map((bt, index) => (
            <Fragment key={bt.taskId}>
              <div
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
                      aria-label="Move task up"
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
                      aria-label="Move task down"
                    >
                      ↓
                    </button>
                  ) : null}
                  <button
                    className="planner-block__task-move planner-block__task-move--label"
                    type="button"
                    onClick={() =>
                      setMovingTaskId((current) => (current === bt.taskId ? null : bt.taskId))
                    }
                    disabled={availableBlocks.length <= 1 || isPending}
                    aria-label="Move task to another block"
                  >
                    Move
                  </button>
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
              {movingTaskId === bt.taskId ? (
                <div className="planner-block__task-picker">
                  <div className="planner-block__task-picker-label">Move to block</div>
                  <div className="planner-block__task-picker-list">
                    {availableBlocks
                      .filter((candidate) => candidate.id !== block.id)
                      .map((candidate) => (
                        <button
                          key={candidate.id}
                          className="planner-block__task-picker-item"
                          type="button"
                          onClick={() => {
                            onMoveTaskToBlock(bt.taskId, candidate);
                            setMovingTaskId(null);
                          }}
                          disabled={isPending}
                        >
                          <span className="planner-block__task-picker-time">
                            {formatTimeLabel(candidate.startsAt)}
                          </span>
                          <span className="planner-block__task-picker-title">
                            {candidate.title || "Untitled block"}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              ) : null}
            </Fragment>
          ))}
        </div>
      ) : (
        <div className="planner-block__empty-hint">
          No tasks assigned yet. Use + Task to place work here, or keep it as a free block.
        </div>
      )}
    </div>
  );
}
