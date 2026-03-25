import { Fragment, useEffect, useMemo, useState } from "react";
import type { DayPlannerBlockItem, TaskItem } from "../../../shared/lib/api";
import { formatTimeLabel } from "../../../shared/lib/api";
import {
  addMinutes,
  getSplitBlockTime,
  minutesToTimeString,
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
  onAddTasks,
  onMoveTaskToBlock,
  onEditBlock,
  onDeleteBlock,
  onRemoveTask,
  onReorderTasks,
  onNudgeDuration,
  onDuplicateBlock,
  onSplitBlock,
  onCarryPendingToNext,
  timelineStatus,
  isUpNext,
  durationLabel,
  segmentStartMinutes,
  segmentEndMinutes,
  hourMarkers,
  currentMarkerPercent,
  minHeight,
  nextBlock,
  canDuplicate,
  isPending,
}: {
  block: DayPlannerBlockItem;
  existingBlocks: DayPlannerBlockItem[];
  availableTasks: TaskItem[];
  availableBlocks: DayPlannerBlockItem[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveBlock: (direction: -1 | 1) => void;
  onAddTasks: (taskIds: string[]) => Promise<void> | void;
  onMoveTaskToBlock: (taskId: string, targetBlock: DayPlannerBlockItem) => void;
  onEditBlock: (updates: { title?: string | null; startsAt?: string; endsAt?: string }) => void;
  onDeleteBlock: () => void;
  onRemoveTask: (taskId: string) => void;
  onReorderTasks: (taskIds: string[]) => void;
  onNudgeDuration: (direction: -1 | 1) => void;
  onDuplicateBlock: () => void;
  onSplitBlock: () => void;
  onCarryPendingToNext: () => void;
  timelineStatus: "past" | "current" | "upcoming";
  isUpNext: boolean;
  durationLabel: string;
  segmentStartMinutes: number;
  segmentEndMinutes: number;
  hourMarkers: number[];
  currentMarkerPercent: number | null;
  minHeight: number;
  nextBlock: DayPlannerBlockItem | null;
  canDuplicate: boolean;
  isPending: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(block.title ?? "");
  const [editStart, setEditStart] = useState(toTimeInputValue(block.startsAt));
  const [editEnd, setEditEnd] = useState(toTimeInputValue(block.endsAt));
  const [showAddTaskPicker, setShowAddTaskPicker] = useState(false);
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  const isEmpty = block.tasks.length === 0;
  const sortedTasks = [...block.tasks].sort((a, b) => a.sortOrder - b.sortOrder);
  const completedCount = sortedTasks.filter((bt) => bt.task.status === "completed").length;
  const pendingCount = sortedTasks.filter((bt) => bt.task.status === "pending").length;
  const canCarryPending = Boolean(nextBlock) && pendingCount > 0;
  const canSplit = Boolean(getSplitBlockTime(block));
  const quickBatchSizes = useMemo(() => {
    const sizes = [Math.min(3, availableTasks.length), Math.min(5, availableTasks.length)];
    return [...new Set(sizes)].filter((size) => size > 1);
  }, [availableTasks.length]);
  const validation = validatePlannerBlockDraft({
    date: block.startsAt.slice(0, 10),
    startTime: editStart,
    endTime: editEnd,
    timezoneOffset: block.startsAt.slice(-6),
    existingBlocks,
    ignoreBlockId: block.id,
  });
  const shortenValidation = validatePlannerBlockDraft({
    date: block.startsAt.slice(0, 10),
    startTime: toTimeInputValue(block.startsAt),
    endTime: addMinutes(toTimeInputValue(block.endsAt), -15),
    timezoneOffset: block.startsAt.slice(-6),
    existingBlocks,
    ignoreBlockId: block.id,
  });
  const extendValidation = validatePlannerBlockDraft({
    date: block.startsAt.slice(0, 10),
    startTime: toTimeInputValue(block.startsAt),
    endTime: addMinutes(toTimeInputValue(block.endsAt), 15),
    timezoneOffset: block.startsAt.slice(-6),
    existingBlocks,
    ignoreBlockId: block.id,
  });

  useEffect(() => {
    setEditTitle(block.title ?? "");
    setEditStart(toTimeInputValue(block.startsAt));
    setEditEnd(toTimeInputValue(block.endsAt));
  }, [block.endsAt, block.startsAt, block.title]);

  useEffect(() => {
    setSelectedTaskIds((current) =>
      current.filter((taskId) => availableTasks.some((task) => task.id === taskId)),
    );
  }, [availableTasks]);

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

  function toggleSelectedTask(taskId: string) {
    setSelectedTaskIds((current) =>
      current.includes(taskId)
        ? current.filter((id) => id !== taskId)
        : [...current, taskId],
    );
  }

  async function handleAddSelectedTasks(taskIds: string[]) {
    if (taskIds.length === 0) {
      return;
    }

    const orderedTaskIds = availableTasks
      .filter((task) => taskIds.includes(task.id))
      .map((task) => task.id);

    await Promise.resolve(onAddTasks(orderedTaskIds));
    setSelectedTaskIds([]);
    setShowAddTaskPicker(false);
  }

  const statusLabel =
    timelineStatus === "current"
      ? "Now"
      : isUpNext
        ? "Up next"
        : timelineStatus === "past"
          ? "Past"
          : "Later";

  return (
    <div
      className={[
        "planner-block",
        isEmpty ? "planner-block--empty" : "",
        timelineStatus === "current" ? "planner-block--current" : "",
        timelineStatus === "past" ? "planner-block--past" : "",
        isUpNext ? "planner-block--up-next" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ minHeight: `${minHeight}px` }}
    >
      {hourMarkers.length > 0 ? (
        <div className="planner-segment__markers" aria-hidden="true">
          {hourMarkers.map((marker) => (
            <div
              key={marker}
              className="planner-segment__tick"
              style={{
                top: `${((marker - segmentStartMinutes) / Math.max(segmentEndMinutes - segmentStartMinutes, 1)) * 100}%`,
              }}
            >
              <span className="planner-segment__tick-label">{minutesToTimeString(marker)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {currentMarkerPercent !== null ? (
        <div
          className="planner-segment__now-line"
          style={{ top: `${currentMarkerPercent}%` }}
          aria-hidden="true"
        />
      ) : null}

      <div className="planner-block__header">
        {editing ? (
          <div
            className="planner-block__edit-form"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                handleCancelEdit();
                return;
              }

              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSaveEdit();
              }
            }}
          >
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
              <div className="planner-block__meta-row">
                <div className="planner-block__time-badge">
                  {formatTimeLabel(block.startsAt)} – {formatTimeLabel(block.endsAt)}
                </div>
                <span className="planner-block__duration">{durationLabel}</span>
                <span
                  className={`planner-block__status planner-block__status--${timelineStatus} ${isUpNext ? "planner-block__status--up-next" : ""}`}
                >
                  {statusLabel}
                </span>
              </div>
              <div className="planner-block__title">
                {block.title || <span className="planner-block__untitled">Untitled block</span>}
              </div>
              <div className="planner-block__subline">
                {sortedTasks.length > 0 ? (
                  <span className="planner-block__task-count">
                    {completedCount}/{sortedTasks.length} tasks
                  </span>
                ) : (
                  <span className="planner-block__task-count">Open block</span>
                )}
                {canCarryPending && nextBlock ? (
                  <span className="planner-block__task-count">
                    Carry open into {nextBlock.title || formatTimeLabel(nextBlock.startsAt)}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="planner-block__actions">
              <button
                className="planner-block__action-btn planner-block__action-btn--text"
                type="button"
                onClick={() => onNudgeDuration(-1)}
                disabled={isPending || Boolean(shortenValidation.error)}
                aria-label="Shorten block by fifteen minutes"
              >
                -15m
              </button>
              <button
                className="planner-block__action-btn planner-block__action-btn--text"
                type="button"
                onClick={() => onNudgeDuration(1)}
                disabled={isPending || Boolean(extendValidation.error)}
                aria-label="Extend block by fifteen minutes"
              >
                +15m
              </button>
              <button
                className="planner-block__action-btn"
                type="button"
                onClick={() => onMoveBlock(-1)}
                disabled={!canMoveUp || isPending}
                aria-label="Move block up"
                title="Move block up in list order"
              >
                ↑
              </button>
              <button
                className="planner-block__action-btn"
                type="button"
                onClick={() => onMoveBlock(1)}
                disabled={!canMoveDown || isPending}
                aria-label="Move block down"
                title="Move block down in list order"
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
                className="planner-block__action-btn planner-block__action-btn--text"
                type="button"
                onClick={onCarryPendingToNext}
                disabled={!canCarryPending || isPending}
                aria-label="Carry unfinished tasks into the next block"
              >
                Carry
              </button>
              <button
                className="planner-block__action-btn planner-block__action-btn--text"
                type="button"
                onClick={onDuplicateBlock}
                disabled={!canDuplicate || isPending}
                aria-label="Duplicate block"
              >
                Duplicate
              </button>
              <button
                className="planner-block__action-btn planner-block__action-btn--text"
                type="button"
                onClick={onSplitBlock}
                disabled={!canSplit || isPending}
                aria-label="Split block in two"
              >
                Split
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
        <div
          className="planner-block__picker"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setShowAddTaskPicker(false);
              setSelectedTaskIds([]);
              return;
            }

            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
              event.preventDefault();
              setSelectedTaskIds(availableTasks.map((task) => task.id));
            }
          }}
        >
          <div className="planner-block__picker-header">
            <span>Plan several tasks into this block</span>
            <button
              className="button button--ghost button--small"
              type="button"
              onClick={() => {
                setShowAddTaskPicker(false);
                setSelectedTaskIds([]);
              }}
            >
              Close
            </button>
          </div>
          {availableTasks.length > 0 ? (
            <>
              <div className="planner-block__picker-shortcuts">
                {quickBatchSizes.map((size) => (
                  <button
                    key={size}
                    className="planner-block__picker-shortcut"
                    type="button"
                    onClick={() => {
                      void handleAddSelectedTasks(
                        availableTasks.slice(0, size).map((task) => task.id),
                      );
                    }}
                    disabled={isPending}
                  >
                    Next {size}
                  </button>
                ))}
                <button
                  className="planner-block__picker-shortcut"
                  type="button"
                  onClick={() => setSelectedTaskIds(availableTasks.map((task) => task.id))}
                  disabled={isPending}
                >
                  Select all
                </button>
                {selectedTaskIds.length > 0 ? (
                  <button
                    className="planner-block__picker-shortcut"
                    type="button"
                    onClick={() => setSelectedTaskIds([])}
                    disabled={isPending}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <div className="planner-block__picker-list">
                {availableTasks.map((task) => {
                  const checked = selectedTaskIds.includes(task.id);
                  return (
                    <label
                      key={task.id}
                      className={`planner-block__picker-option${checked ? " planner-block__picker-option--checked" : ""}`}
                    >
                      <input
                        className="planner-block__picker-checkbox"
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelectedTask(task.id)}
                        disabled={isPending}
                      />
                      <span className="planner-block__picker-option-copy">
                        <span className="planner-block__picker-title">{task.title}</span>
                        {task.goal ? (
                          <span className="planner-block__picker-goal">
                            {task.goal.title}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="planner-block__picker-actions">
                <button
                  className="button button--primary button--small"
                  type="button"
                  onClick={() => {
                    void handleAddSelectedTasks(selectedTaskIds);
                  }}
                  disabled={isPending || selectedTaskIds.length === 0}
                >
                  Add selected
                </button>
              </div>
            </>
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
