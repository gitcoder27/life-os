import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { DayPlannerBlockItem, TaskItem } from "../../../shared/lib/api";
import { formatTimeLabel } from "../../../shared/lib/api";
import {
  addMinutes,
  getPlannerBlockDate,
  getPlannerBlockTimezoneOffset,
  getSplitBlockTime,
  minutesToTimeString,
  formatDurationMinutes,
  toTimeInputValue,
  validatePlannerBlockDraft,
} from "../helpers/planner-blocks";
import { getPlannerBlockDropId, PLANNER_BLOCK_DROP_TYPE } from "../helpers/planner-drag";
import { CheckIcon, GripIcon } from "../helpers/icons";

const OVERFLOW_VIEWPORT_MARGIN_PX = 12;
const OVERFLOW_MENU_GAP_PX = 8;
const OVERFLOW_MENU_MIN_WIDTH_PX = 220;

type OverflowMenuPosition = {
  top: number;
  left: number;
  minWidth: number;
  placement: "top" | "bottom";
};

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
  onToggleTaskStatus,
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
  topPx,
  heightPx,
  nextBlock,
  canDuplicate,
  readOnly,
  isPending,
  activeUnplannedTaskId,
  editRequestKey,
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
  onEditBlock: (updates: {
    title?: string | null;
    startsAt?: string;
    endsAt?: string;
  }) => Promise<unknown> | void;
  onDeleteBlock: () => Promise<unknown> | void;
  onRemoveTask: (taskId: string) => void;
  onToggleTaskStatus: (taskId: string, status: TaskItem["status"]) => void;
  onReorderTasks: (taskIds: string[]) => void;
  onNudgeDuration: (direction: -1 | 1) => void;
  onDuplicateBlock: () => void;
  onSplitBlock: () => void;
  onCarryPendingToNext: () => void;
  timelineStatus: "past" | "current" | "upcoming" | "neutral";
  isUpNext: boolean;
  durationLabel: string;
  segmentStartMinutes: number;
  segmentEndMinutes: number;
  hourMarkers: number[];
  currentMarkerPercent: number | null;
  minHeight: number;
  topPx: number;
  heightPx: number;
  nextBlock: DayPlannerBlockItem | null;
  canDuplicate: boolean;
  readOnly: boolean;
  isPending: boolean;
  activeUnplannedTaskId: string | null;
  editRequestKey?: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(block.title ?? "");
  const [editStart, setEditStart] = useState(toTimeInputValue(block.startsAt));
  const [editEnd, setEditEnd] = useState(toTimeInputValue(block.endsAt));
  const [showAddTaskPicker, setShowAddTaskPicker] = useState(false);
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [showOverflow, setShowOverflow] = useState(false);
  const [overflowMenuPosition, setOverflowMenuPosition] = useState<OverflowMenuPosition>({
    top: OVERFLOW_VIEWPORT_MARGIN_PX,
    left: OVERFLOW_VIEWPORT_MARGIN_PX,
    minWidth: OVERFLOW_MENU_MIN_WIDTH_PX,
    placement: "bottom",
  });
  const [resizeDraft, setResizeDraft] = useState<{
    endMinutes: number;
    endsAt: string;
  } | null>(null);
  const overflowTriggerRef = useRef<HTMLButtonElement>(null);
  const overflowMenuRef = useRef<HTMLDivElement>(null);
  const resizeDraftRef = useRef<{
    endMinutes: number;
    endsAt: string;
  } | null>(null);
  const isDraggingResizeRef = useRef(false);

  const PIXELS_PER_MINUTE = 1.4; // must match CALENDAR_PIXELS_PER_MINUTE in planner-timeline.ts
  const SNAP_MINUTES = 15;
  const blockTimezoneOffset = useMemo(
    () => getPlannerBlockTimezoneOffset(block),
    [block],
  );
  const displayedEndsAt = resizeDraft?.endsAt ?? block.endsAt;
  const displayedEndMinutes = resizeDraft?.endMinutes ?? segmentEndMinutes;
  const displayedDurationLabel = resizeDraft
    ? formatDurationMinutes(Math.max(displayedEndMinutes - segmentStartMinutes, 0))
    : durationLabel;
  const displayedHeightPx = resizeDraft
    ? Math.max(Math.round((displayedEndMinutes - segmentStartMinutes) * PIXELS_PER_MINUTE), 40)
    : heightPx;
  const canDropUnplannedTask =
    !readOnly &&
    activeUnplannedTaskId !== null &&
    !block.tasks.some((blockTask) => blockTask.taskId === activeUnplannedTaskId) &&
    !isPending;
  const { isOver, setNodeRef } = useDroppable({
    id: getPlannerBlockDropId(block.id),
    data: {
      type: PLANNER_BLOCK_DROP_TYPE,
      blockId: block.id,
    },
    disabled: !canDropUnplannedTask,
  });

  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isPending) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    const startY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const origEndMinutes = segmentEndMinutes;
    isDraggingResizeRef.current = true;

    function onMove(ev: MouseEvent | TouchEvent) {
      if ("cancelable" in ev && ev.cancelable) {
        ev.preventDefault();
      }

      const currentY = "touches" in ev ? ev.touches[0].clientY : ev.clientY;
      const deltaMinutes = Math.round((currentY - startY) / PIXELS_PER_MINUTE);
      const rawEnd = origEndMinutes + deltaMinutes;
      const snapped = Math.round(rawEnd / SNAP_MINUTES) * SNAP_MINUTES;
      const newEndMinutes = Math.max(segmentStartMinutes + SNAP_MINUTES, Math.min(snapped, 23 * 60 + 59));
      const newEndTime = minutesToTimeString(newEndMinutes);

      const validation = validatePlannerBlockDraft({
        date: getPlannerBlockDate(block),
        startTime: toTimeInputValue(block.startsAt),
        endTime: newEndTime,
        timezoneOffset: blockTimezoneOffset,
        existingBlocks,
        ignoreBlockId: block.id,
      });

      if (validation.error) {
        return;
      }

      const nextDraft =
        validation.endsAt === block.endsAt
          ? null
          : {
              endMinutes: newEndMinutes,
              endsAt: validation.endsAt,
            };
      resizeDraftRef.current = nextDraft;
      setResizeDraft(nextDraft);
    }

    function onEnd() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);

      isDraggingResizeRef.current = false;
      const nextDraft = resizeDraftRef.current;
      if (!nextDraft || nextDraft.endsAt === block.endsAt) {
        resizeDraftRef.current = null;
        setResizeDraft(null);
        return;
      }

      void Promise.resolve(onEditBlock({ endsAt: nextDraft.endsAt })).catch(() => {
        resizeDraftRef.current = null;
        setResizeDraft(null);
      });
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchmove", onMove);
    document.addEventListener("touchend", onEnd);
  }, [
    block,
    blockTimezoneOffset,
    existingBlocks,
    isPending,
    onEditBlock,
    segmentStartMinutes,
    segmentEndMinutes,
  ]);

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
    date: getPlannerBlockDate(block),
    startTime: editStart,
    endTime: editEnd,
    timezoneOffset: blockTimezoneOffset,
    existingBlocks,
    ignoreBlockId: block.id,
  });
  const shortenValidation = validatePlannerBlockDraft({
    date: getPlannerBlockDate(block),
    startTime: toTimeInputValue(block.startsAt),
    endTime: addMinutes(toTimeInputValue(block.endsAt), -15),
    timezoneOffset: blockTimezoneOffset,
    existingBlocks,
    ignoreBlockId: block.id,
  });
  const extendValidation = validatePlannerBlockDraft({
    date: getPlannerBlockDate(block),
    startTime: toTimeInputValue(block.startsAt),
    endTime: addMinutes(toTimeInputValue(block.endsAt), 15),
    timezoneOffset: blockTimezoneOffset,
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

  useEffect(() => {
    if (resizeDraftRef.current?.endsAt === block.endsAt) {
      resizeDraftRef.current = null;
      setResizeDraft(null);
    }
  }, [block.endsAt]);

  useEffect(() => {
    if (!editRequestKey || readOnly) {
      return;
    }

    setShowAddTaskPicker(false);
    setShowOverflow(false);
    setEditing(true);
  }, [editRequestKey, readOnly]);

  useEffect(() => {
    if (!showOverflow) {
      return;
    }

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        overflowTriggerRef.current?.contains(target) ||
        overflowMenuRef.current?.contains(target)
      ) {
        return;
      }

      setShowOverflow(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowOverflow(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showOverflow]);

  useLayoutEffect(() => {
    if (!showOverflow) {
      return;
    }

    const updateOverflowMenuPosition = () => {
      const trigger = overflowTriggerRef.current;
      const menu = overflowMenuRef.current;
      if (!trigger || !menu) {
        return;
      }

      const triggerRect = trigger.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const safeWidth = Math.min(
        Math.max(menuRect.width, OVERFLOW_MENU_MIN_WIDTH_PX),
        window.innerWidth - OVERFLOW_VIEWPORT_MARGIN_PX * 2,
      );
      const maxLeft = window.innerWidth - safeWidth - OVERFLOW_VIEWPORT_MARGIN_PX;
      const left = Math.max(
        OVERFLOW_VIEWPORT_MARGIN_PX,
        Math.min(triggerRect.right - safeWidth, maxLeft),
      );
      const spaceBelow = window.innerHeight - triggerRect.bottom - OVERFLOW_VIEWPORT_MARGIN_PX;
      const spaceAbove = triggerRect.top - OVERFLOW_VIEWPORT_MARGIN_PX;
      const shouldFlipUp =
        spaceBelow < Math.min(menuRect.height, 280) && spaceAbove > spaceBelow;
      const top = shouldFlipUp
        ? Math.max(
            OVERFLOW_VIEWPORT_MARGIN_PX,
            triggerRect.top - menuRect.height - OVERFLOW_MENU_GAP_PX,
          )
        : Math.min(
            triggerRect.bottom + OVERFLOW_MENU_GAP_PX,
            window.innerHeight - menuRect.height - OVERFLOW_VIEWPORT_MARGIN_PX,
          );

      setOverflowMenuPosition({
        top,
        left,
        minWidth: safeWidth,
        placement: shouldFlipUp ? "top" : "bottom",
      });
    };

    updateOverflowMenuPosition();
    window.addEventListener("resize", updateOverflowMenuPosition);
    document.addEventListener("scroll", updateOverflowMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateOverflowMenuPosition);
      document.removeEventListener("scroll", updateOverflowMenuPosition, true);
    };
  }, [showOverflow]);

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
        ? "Next"
        : null;
  const taskIds = sortedTasks.map((bt) => bt.taskId);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleTaskDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = taskIds.findIndex((taskId) => taskId === active.id);
    const newIndex = taskIds.findIndex((taskId) => taskId === over.id);

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const reordered = arrayMove(taskIds, oldIndex, newIndex);
    onReorderTasks(reordered);
  }

  async function handleDeleteBlock() {
    const confirmed = window.confirm(
      sortedTasks.length > 0
        ? "Remove this time block? Any tasks in it will move back to unplanned."
        : "Remove this time block?",
    );
    if (!confirmed) {
      return;
    }

    setShowOverflow(false);
    await Promise.resolve(onDeleteBlock());
  }

  return (
    <div
      ref={setNodeRef}
      className={[
        "planner-block",
        isEmpty ? "planner-block--empty" : "",
        timelineStatus === "current" ? "planner-block--current" : "",
        timelineStatus === "past" ? "planner-block--past" : "",
        isUpNext ? "planner-block--up-next" : "",
        canDropUnplannedTask ? "planner-block--drop-ready" : "",
        isOver ? "planner-block--drop-target" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        position: "absolute",
        top: `${topPx}px`,
        minHeight: `${displayedHeightPx}px`,
        left: 0,
        right: 0,
      }}
    >
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
              <span className="planner-block__time-badge">
                {formatTimeLabel(block.startsAt)} – {formatTimeLabel(displayedEndsAt)}
              </span>
              <span className="planner-block__info-sep">·</span>
              <span className="planner-block__title">
                {block.title || <span className="planner-block__untitled">Untitled block</span>}
              </span>
              <span className="planner-block__info-sep">·</span>
              <span className="planner-block__duration">{displayedDurationLabel}</span>
              {sortedTasks.length > 0 ? (
                <>
                  <span className="planner-block__info-sep">·</span>
                  <span className="planner-block__task-count">
                    {completedCount}/{sortedTasks.length}
                  </span>
                </>
              ) : null}
              {statusLabel ? (
                <span
                  className={`planner-block__status planner-block__status--${timelineStatus} ${isUpNext ? "planner-block__status--up-next" : ""}`}
                >
                  {statusLabel}
                </span>
              ) : null}
            </div>
            <div className="planner-block__actions">
              {!readOnly ? (
                <>
                  <button
                    className="planner-block__action-icon"
                    type="button"
                    onClick={() => setEditing(true)}
                    aria-label="Edit block"
                    title="Edit"
                  >
                    ✎
                  </button>
                  <button
                    className="planner-block__action-icon"
                    type="button"
                    onClick={() => setShowAddTaskPicker((current) => !current)}
                    disabled={availableTasks.length === 0 || isPending}
                    aria-label="Add tasks to block"
                    title="Add tasks"
                  >
                    +
                  </button>
                  <div className="planner-block__overflow">
                    <button
                      ref={overflowTriggerRef}
                      className="planner-block__action-icon planner-block__overflow-trigger"
                      type="button"
                      onClick={() => setShowOverflow((current) => !current)}
                      aria-label="More actions"
                      title="More"
                      aria-expanded={showOverflow}
                      aria-haspopup="menu"
                    >
                      ···
                    </button>
                    {showOverflow
                      ? createPortal(
                          <div
                            ref={overflowMenuRef}
                            className={`planner-block__overflow-menu planner-block__overflow-menu--${overflowMenuPosition.placement}`}
                            style={{
                              top: `${overflowMenuPosition.top}px`,
                              left: `${overflowMenuPosition.left}px`,
                              minWidth: `${overflowMenuPosition.minWidth}px`,
                            }}
                            role="menu"
                            aria-label="Block actions"
                          >
                            <button
                              className="planner-block__overflow-item planner-block__overflow-item--danger"
                              type="button"
                              onClick={() => {
                                void handleDeleteBlock();
                              }}
                              disabled={isPending}
                              role="menuitem"
                            >
                              Remove time block
                            </button>
                            <div className="planner-block__overflow-divider" />
                            <button
                              className="planner-block__overflow-item"
                              type="button"
                              onClick={() => { onNudgeDuration(-1); setShowOverflow(false); }}
                              disabled={isPending || Boolean(shortenValidation.error)}
                              role="menuitem"
                            >
                              Shorten 15m
                            </button>
                            <button
                              className="planner-block__overflow-item"
                              type="button"
                              onClick={() => { onNudgeDuration(1); setShowOverflow(false); }}
                              disabled={isPending || Boolean(extendValidation.error)}
                              role="menuitem"
                            >
                              Extend 15m
                            </button>
                            <div className="planner-block__overflow-divider" />
                            <button
                              className="planner-block__overflow-item"
                              type="button"
                              onClick={() => { onMoveBlock(-1); setShowOverflow(false); }}
                              disabled={!canMoveUp || isPending}
                              role="menuitem"
                            >
                              Move up
                            </button>
                            <button
                              className="planner-block__overflow-item"
                              type="button"
                              onClick={() => { onMoveBlock(1); setShowOverflow(false); }}
                              disabled={!canMoveDown || isPending}
                              role="menuitem"
                            >
                              Move down
                            </button>
                            <div className="planner-block__overflow-divider" />
                            <button
                              className="planner-block__overflow-item"
                              type="button"
                              onClick={() => { onDuplicateBlock(); setShowOverflow(false); }}
                              disabled={!canDuplicate || isPending}
                              role="menuitem"
                            >
                              Duplicate
                            </button>
                            <button
                              className="planner-block__overflow-item"
                              type="button"
                              onClick={() => { onSplitBlock(); setShowOverflow(false); }}
                              disabled={!canSplit || isPending}
                              role="menuitem"
                            >
                              Split in two
                            </button>
                            {canCarryPending && nextBlock ? (
                              <button
                                className="planner-block__overflow-item"
                                type="button"
                                onClick={() => { onCarryPendingToNext(); setShowOverflow(false); }}
                                disabled={isPending}
                                role="menuitem"
                              >
                                Carry open to {nextBlock.title || formatTimeLabel(nextBlock.startsAt)}
                              </button>
                            ) : null}
                          </div>,
                          document.body,
                        )
                      : null}
                  </div>
                </>
              ) : null}
            </div>
          </>
        )}
      </div>

      {!readOnly && showAddTaskPicker ? (
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
            <span>Plan tasks into this block</span>
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

      {/* Resize handle */}
      {!readOnly ? (
        <div
          className="planner-block__resize-handle"
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeStart}
          title="Drag to resize"
        />
      ) : null}

      {sortedTasks.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleTaskDragEnd}
        >
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            <div className="planner-block__tasks">
              {sortedTasks.map((bt) => (
                <SortablePlannerTaskRow
                  key={bt.taskId}
                  item={bt}
                  isMovePickerOpen={movingTaskId === bt.taskId}
                  canMoveToAnotherBlock={availableBlocks.length > 1}
                  readOnly={readOnly}
                  isPending={isPending}
                  availableBlocks={availableBlocks}
                  currentBlockId={block.id}
                  onToggleMovePicker={() =>
                    setMovingTaskId((current) => (current === bt.taskId ? null : bt.taskId))
                  }
                  onMoveToBlock={(targetBlock) => {
                    onMoveTaskToBlock(bt.taskId, targetBlock);
                    setMovingTaskId(null);
                  }}
                  onToggleStatus={() =>
                    onToggleTaskStatus(
                      bt.taskId,
                      bt.task.status === "completed" ? "pending" : "completed",
                    )
                  }
                  onRemove={() => onRemoveTask(bt.taskId)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="planner-block__empty-hint">
          No tasks yet
        </div>
      )}
    </div>
  );
}

function SortablePlannerTaskRow({
  item,
  isMovePickerOpen,
  canMoveToAnotherBlock,
  readOnly,
  isPending,
  availableBlocks,
  currentBlockId,
  onToggleMovePicker,
  onMoveToBlock,
  onToggleStatus,
  onRemove,
}: {
  item: DayPlannerBlockItem["tasks"][number];
  isMovePickerOpen: boolean;
  canMoveToAnotherBlock: boolean;
  readOnly: boolean;
  isPending: boolean;
  availableBlocks: DayPlannerBlockItem[];
  currentBlockId: string;
  onToggleMovePicker: () => void;
  onMoveToBlock: (targetBlock: DayPlannerBlockItem) => void;
  onToggleStatus: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.taskId,
    disabled: isPending || readOnly,
  });

  return (
    <Fragment>
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        className={`planner-block__task${
          item.task.status === "completed" ? " planner-block__task--done" : ""
        }${isDragging ? " planner-block__task--dragging" : ""}`}
      >
        {!readOnly ? (
          <button
            className="planner-block__task-handle"
            type="button"
            aria-label="Drag to reorder task"
            disabled={isPending}
            {...attributes}
            {...listeners}
          >
            <GripIcon />
          </button>
        ) : (
          <span className="planner-block__task-handle planner-block__task-handle--static" />
        )}
        <button
          className="planner-block__task-check"
          type="button"
          onClick={onToggleStatus}
          disabled={readOnly || isPending}
          aria-label={item.task.status === "completed" ? "Reopen task" : "Mark task complete"}
        >
          {item.task.status === "completed" ? <CheckIcon /> : null}
        </button>
        <span className="planner-block__task-title">{item.task.title}</span>
        {!readOnly ? (
          <div className="planner-block__task-actions">
            <button
              className="planner-block__task-move planner-block__task-move--label"
              type="button"
              onClick={onToggleMovePicker}
              disabled={!canMoveToAnotherBlock || isPending}
              aria-label="Move task to another block"
            >
              Move
            </button>
            <button
              className="planner-block__task-remove"
              type="button"
              onClick={onRemove}
              disabled={isPending}
              aria-label="Remove from block"
            >
              ✕
            </button>
          </div>
        ) : null}
      </div>
      {!readOnly && isMovePickerOpen ? (
        <div className="planner-block__task-picker">
          <div className="planner-block__task-picker-label">Move to block</div>
          <div className="planner-block__task-picker-list">
            {availableBlocks
              .filter((candidate) => candidate.id !== currentBlockId)
              .map((candidate) => (
                <button
                  key={candidate.id}
                  className="planner-block__task-picker-item"
                  type="button"
                  onClick={() => onMoveToBlock(candidate)}
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
  );
}
