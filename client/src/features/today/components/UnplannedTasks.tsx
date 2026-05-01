import { useState, useEffect } from "react";
import { useDraggable } from "@dnd-kit/core";
import type { TaskItem, DayPlannerBlockItem } from "../../../shared/lib/api";
import { getRecoveryTaskCompactMeta, getRecoveryTaskDetail } from "../helpers/date-helpers";
import { UNPLANNED_TASK_DRAG_TYPE, getUnplannedTaskDragId } from "../helpers/planner-drag";
import { BlockTargetPicker } from "./BlockTargetPicker";
import { PlannerRailSection } from "./PlannerRailSection";

export function UnplannedTasks({
  title = "Unplanned",
  description,
  emptyText,
  tone = "default",
  showRecoveryDetail = false,
  tasks,
  blocks,
  readOnly,
  isHistoryDate,
  isPending,
  draggedTaskId,
  suppressedTaskId,
  onQuickAssign,
  onBulkAssign,
}: {
  title?: string;
  description?: string;
  emptyText?: string;
  tone?: "default" | "recovery";
  showRecoveryDetail?: boolean;
  tasks: TaskItem[];
  blocks: DayPlannerBlockItem[];
  readOnly: boolean;
  isHistoryDate: boolean;
  isPending: boolean;
  draggedTaskId: string | null;
  suppressedTaskId: string | null;
  onQuickAssign: (taskId: string, block: DayPlannerBlockItem) => void;
  onBulkAssign: (taskIds: string[], block: DayPlannerBlockItem) => Promise<void> | void;
}) {
  const [batchMode, setBatchMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [targetBlockId, setTargetBlockId] = useState(blocks[0]?.id ?? "");
  const [expanded, setExpanded] = useState(true);

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
      <PlannerRailSection
        title={title}
        tone={tone}
        expanded={expanded}
        className={`unplanned-lane unplanned-lane--${tone}${expanded ? " unplanned-lane--expanded" : ""}`}
        onToggle={() => setExpanded((current) => !current)}
      >
        <div className="unplanned-lane__empty">
          <span className="unplanned-lane__empty-icon">✓</span>
          <p>{emptyText ?? (isHistoryDate ? "No unplanned tasks saved" : "All planned")}</p>
        </div>
      </PlannerRailSection>
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
    <PlannerRailSection
      title={title}
      count={tasks.length}
      tone={tone}
      expanded={expanded}
      className={`unplanned-lane unplanned-lane--${tone}${expanded ? " unplanned-lane--expanded" : ""}`}
      headerMeta={
        tone === "recovery" ? (
          <span className="planner-rail-section__meta">drag to plan</span>
        ) : null
      }
      actions={
        !readOnly && blocks.length > 0 ? (
          <button
            className="unplanned-lane__mode-btn"
            type="button"
            onClick={() => {
              setBatchMode((current) => !current);
              setSelectedTaskIds([]);
            }}
            disabled={isPending}
          >
            {batchMode ? "Done" : "Select"}
          </button>
        ) : null
      }
      onToggle={() => setExpanded((current) => !current)}
    >
      {description ? (
        <p className="unplanned-lane__description">{description}</p>
      ) : null}

      {!readOnly && blocks.length === 0 ? (
        <div className="unplanned-lane__helper">
          Create a block first, then assign tasks from here.
        </div>
      ) : null}

      {!readOnly && draggedTaskId ? (
        <div className="unplanned-lane__drag-hint">
          Drop on a time block to assign this task.
        </div>
      ) : null}

      {!readOnly && batchMode && blocks.length > 0 ? (
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
            readOnly={readOnly}
            batchMode={batchMode}
            checked={selectedTaskIds.includes(task.id)}
            isPending={isPending}
            onToggleSelection={() => toggleTaskSelection(task.id)}
            isActiveDrag={draggedTaskId === task.id}
            isSuppressed={suppressedTaskId === task.id}
            onQuickAssign={(block) => onQuickAssign(task.id, block)}
            meta={showRecoveryDetail && task.scheduledForDate ? getRecoveryTaskDetail(task.scheduledForDate) : null}
            compactMeta={showRecoveryDetail && task.scheduledForDate ? getRecoveryTaskCompactMeta(task.scheduledForDate) : null}
            tone={tone}
          />
        ))}
      </div>
    </PlannerRailSection>
  );
}

function UnplannedTaskRow({
  task,
  blocks,
  readOnly,
  batchMode,
  checked,
  isPending,
  onToggleSelection,
  isActiveDrag,
  isSuppressed,
  onQuickAssign,
  meta,
  compactMeta,
  tone,
}: {
  task: TaskItem;
  blocks: DayPlannerBlockItem[];
  readOnly: boolean;
  batchMode: boolean;
  checked: boolean;
  isPending: boolean;
  onToggleSelection: () => void;
  isActiveDrag: boolean;
  isSuppressed: boolean;
  onQuickAssign: (block: DayPlannerBlockItem) => void;
  meta?: string | null;
  compactMeta?: { scheduledLabel: string; overdueLabel: string } | null;
  tone?: "default" | "recovery";
}) {
  const isDraggable = !readOnly && !batchMode && blocks.length > 0 && !isPending;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: getUnplannedTaskDragId(task.id),
    data: {
      type: UNPLANNED_TASK_DRAG_TYPE,
      taskId: task.id,
    },
    disabled: !isDraggable,
  });

  return (
    <div
      ref={setNodeRef}
      className={[
        "unplanned-task",
        tone === "recovery" ? " unplanned-task--recovery" : "",
        batchMode ? " unplanned-task--batch" : "",
        isDraggable ? " unplanned-task--draggable" : "",
        isDragging || isActiveDrag ? " unplanned-task--dragging" : "",
        isSuppressed ? " unplanned-task--suppressed" : "",
      ].join("")}
      aria-grabbed={isDragging || isActiveDrag}
      {...attributes}
      {...listeners}
    >
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

      {isDraggable ? (
        <span
          className="unplanned-task__drag-handle"
          aria-hidden="true"
        >
          <span className="unplanned-task__drag-handle-mark" aria-hidden="true" />
        </span>
      ) : null}

      <div className="unplanned-task__info" title={task.title}>
        <div className="unplanned-task__title-row">
          <span className="unplanned-task__title">{task.title}</span>
          {compactMeta ? (
            <span className="unplanned-task__status">{compactMeta.overdueLabel}</span>
          ) : null}
        </div>
        {compactMeta || task.goal ? (
          <div className="unplanned-task__meta-row">
            {compactMeta ? (
              <span className="unplanned-task__meta-pill">{compactMeta.scheduledLabel}</span>
            ) : null}
            {task.goal ? (
              <span className={`unplanned-task__goal goal-chip__dot--${task.goal.domain}`}>
                {task.goal.title}
              </span>
            ) : null}
          </div>
        ) : meta ? (
          <span className="unplanned-task__meta">{meta}</span>
        ) : null}
      </div>

      {!readOnly && !batchMode ? (
        <div className="unplanned-task__actions">
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
                  Plan
                </button>
              ) : (
                <BlockTargetPicker
                  label="Plan"
                  blocks={blocks}
                  disabled={isPending}
                  triggerClassName="unplanned-task__assign-btn"
                  menuClassName="unplanned-task__picker"
                  onSelect={onQuickAssign}
                />
              )}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function formatBlockTime(block: DayPlannerBlockItem): string {
  try {
    const start = new Date(block.startsAt);
    return start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}
