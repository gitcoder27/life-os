import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { createPortal } from "react-dom";
import { formatTimeLabel, type DayPlannerBlockItem, type TaskItem } from "../../../shared/lib/api";
import {
  addMinutes,
  getDuplicateBlockWindow,
  getPlannerBlockDate,
  getPlannerBlockTimezoneOffset,
  getSplitBlockTime,
  formatDurationMinutes,
  minutesToTimeString,
  toTimeInputValue,
  validatePlannerBlockDraft,
} from "../helpers/planner-blocks";
import { nextDraftKey } from "../helpers/date-helpers";
import type { usePlannerActions } from "../hooks/usePlannerActions";
import {
  buildPlannerTimelineModel,
  clearStoredPlannerVisibleHours,
  getDefaultPlannerVisibleHours,
  readStoredPlannerVisibleHours,
  sortPlannerBlocksByTime,
  validatePlannerVisibleHours,
  writeStoredPlannerVisibleHours,
  type PlannerTimelineSegment,
} from "../helpers/planner-timeline";
import type { PlannerExecutionModel } from "../helpers/planner-execution";
import {
  PLANNER_BLOCK_DROP_TYPE,
  UNPLANNED_TASK_DRAG_TYPE,
} from "../helpers/planner-drag";
import { PlannerBlock } from "./PlannerBlock";
import { PlannerBlockForm } from "./PlannerBlockForm";
import { UnplannedTasks } from "./UnplannedTasks";
import type { useTaskActions } from "../hooks/useTaskActions";

type PlannerActions = ReturnType<typeof usePlannerActions>;
type TaskActions = ReturnType<typeof useTaskActions>;

type PlannerFormDraft = {
  key: string;
  title?: string;
  startTime?: string;
  endTime?: string;
};

export function DayPlanner({
  date,
  blocks,
  unplannedTasks,
  execution,
  actions,
  taskActions,
}: {
  date: string;
  blocks: DayPlannerBlockItem[];
  unplannedTasks: TaskItem[];
  execution: PlannerExecutionModel;
  actions: PlannerActions;
  taskActions: TaskActions;
}) {
  const [formDraft, setFormDraft] = useState<PlannerFormDraft | null>(null);
  const [showHoursEditor, setShowHoursEditor] = useState(false);
  const [visibleHours, setVisibleHours] = useState(() => readStoredPlannerVisibleHours());
  const [hoursDraft, setHoursDraft] = useState(visibleHours);
  const [now, setNow] = useState(() => new Date());
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [suppressedTaskId, setSuppressedTaskId] = useState<string | null>(null);
  const [disableDropAnimation, setDisableDropAnimation] = useState(false);

  const orderedBlocks = useMemo(() => sortPlannerBlocksByTime(blocks), [blocks]);
  const blockIndexMap = useMemo(
    () => new Map(orderedBlocks.map((block, index) => [block.id, index])),
    [orderedBlocks],
  );
  const timeline = useMemo(
    () =>
      buildPlannerTimelineModel({
        blocks: orderedBlocks,
        now,
        preferredHours: visibleHours,
      }),
    [orderedBlocks, now, visibleHours],
  );
  const hoursValidation = validatePlannerVisibleHours(hoursDraft);
  const cleanupTarget = execution.cleanup.targetBlock?.block ?? null;
  const isCleanupPending = actions.isPending || taskActions.isPending;
  const activeDraggedTask = useMemo(
    () => unplannedTasks.find((task) => task.id === draggedTaskId) ?? null,
    [draggedTaskId, unplannedTasks],
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    setHoursDraft(visibleHours);
  }, [visibleHours]);

  useEffect(() => {
    if (draggedTaskId && !unplannedTasks.some((task) => task.id === draggedTaskId)) {
      setDraggedTaskId(null);
    }
  }, [draggedTaskId, unplannedTasks]);

  useEffect(() => {
    if (!suppressedTaskId) {
      return;
    }

    const isStillUnplanned = unplannedTasks.some((task) => task.id === suppressedTaskId);
    if (!isStillUnplanned || !actions.isPending) {
      setSuppressedTaskId(null);
    }
  }, [actions.isPending, suppressedTaskId, unplannedTasks]);

  useEffect(() => {
    const className = "planner-dragging-cursor";
    document.body.classList.toggle(className, draggedTaskId !== null);

    return () => {
      document.body.classList.remove(className);
    };
  }, [draggedTaskId]);

  function openBlockForm(initialValues?: {
    title?: string;
    startTime?: string;
    endTime?: string;
  }) {
    setFormDraft({
      key: nextDraftKey(),
      ...initialValues,
    });
  }

  function handleMoveBlock(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= orderedBlocks.length) {
      return;
    }

    const blockIds = orderedBlocks.map((block) => block.id);
    [blockIds[index], blockIds[target]] = [blockIds[target], blockIds[index]];
    actions.reorder(blockIds);
  }

  function handleNudgeBlock(block: DayPlannerBlockItem, direction: -1 | 1) {
    const currentEnd = toTimeInputValue(block.endsAt);
    const nextEndTime = addMinutes(currentEnd, direction * 15);
    const validation = validatePlannerBlockDraft({
      date,
      startTime: toTimeInputValue(block.startsAt),
      endTime: nextEndTime,
      timezoneOffset: block.startsAt.slice(-6),
      existingBlocks: orderedBlocks,
      ignoreBlockId: block.id,
    });

    if (validation.error || validation.endsAt === block.endsAt) {
      return;
    }

    actions.editBlock(block.id, { endsAt: validation.endsAt });
  }

  function handleDuplicateBlock(block: DayPlannerBlockItem) {
    const duplicateWindow = getDuplicateBlockWindow({
      block,
      existingBlocks: orderedBlocks,
    });

    if (duplicateWindow) {
      void actions.duplicateBlock({
        title: block.title,
        startsAt: `${getPlannerBlockDate(block)}T${duplicateWindow.startTime}:00${getPlannerBlockTimezoneOffset(block)}`,
        endsAt: `${getPlannerBlockDate(block)}T${duplicateWindow.endTime}:00${getPlannerBlockTimezoneOffset(block)}`,
      });
      return;
    }

    if (formDraft) {
      return;
    }

    const durationMinutes = Math.max(15, Math.round((new Date(block.endsAt).getTime() - new Date(block.startsAt).getTime()) / 60_000));
    openBlockForm({
      title: block.title ?? "",
      startTime: toTimeInputValue(block.endsAt),
      endTime: addMinutes(toTimeInputValue(block.endsAt), durationMinutes),
    });
  }

  function handleSplitBlock(block: DayPlannerBlockItem) {
    const splitTime = getSplitBlockTime(block);
    if (!splitTime) {
      return;
    }

    void actions.splitBlock(
      block,
      `${getPlannerBlockDate(block)}T${splitTime}:00${getPlannerBlockTimezoneOffset(block)}`,
    );
  }

  function handleCarryPendingToNext(block: DayPlannerBlockItem, nextBlock: DayPlannerBlockItem | null) {
    if (!nextBlock) {
      return;
    }

    void actions.carryPendingTasksToBlock(block, nextBlock);
  }

  function handleSaveVisibleHours() {
    if (hoursValidation) {
      return;
    }

    writeStoredPlannerVisibleHours(hoursDraft);
    setVisibleHours(hoursDraft);
    setShowHoursEditor(false);
  }

  function handleResetVisibleHours() {
    const defaults = getDefaultPlannerVisibleHours();
    clearStoredPlannerVisibleHours();
    setVisibleHours(defaults);
    setHoursDraft(defaults);
    setShowHoursEditor(false);
  }

  function handleCleanupMoveAll(targetBlock: DayPlannerBlockItem | null) {
    if (!targetBlock || execution.cleanup.taskIds.length === 0) {
      return;
    }

    void actions.assignTasksToBlock(targetBlock, execution.cleanup.taskIds);
  }

  function handleCleanupUnplanAll() {
    if (execution.slippedBlocks.length === 0) {
      return;
    }

    void actions.unplanPendingTasksFromBlocks(
      execution.slippedBlocks.map((block) => block.block),
    );
  }

  function handleCleanupTomorrow() {
    if (execution.cleanup.taskIds.length === 0) {
      return;
    }

    void taskActions.moveTasksToTomorrow(execution.cleanup.taskIds);
  }

  function handleUnplannedTaskDragStart(event: DragStartEvent) {
    setDisableDropAnimation(false);

    if (event.active.data.current?.type !== UNPLANNED_TASK_DRAG_TYPE) {
      return;
    }

    const taskId = event.active.data.current?.taskId;
    setDraggedTaskId(typeof taskId === "string" ? taskId : null);
  }

  function handleUnplannedTaskDragCancel() {
    setDraggedTaskId(null);
    setDisableDropAnimation(false);
  }

  function handleUnplannedTaskDragEnd(event: DragEndEvent) {
    const activeTaskId =
      event.active.data.current?.type === UNPLANNED_TASK_DRAG_TYPE
        ? event.active.data.current?.taskId
        : null;
    const targetBlockId =
      event.over?.data.current?.type === PLANNER_BLOCK_DROP_TYPE
        ? event.over.data.current?.blockId
        : null;

    if (typeof activeTaskId === "string" && typeof targetBlockId === "string") {
      const targetBlock = orderedBlocks.find((block) => block.id === targetBlockId);
      if (targetBlock) {
        setDisableDropAnimation(true);
        setSuppressedTaskId(activeTaskId);
        actions.assignTaskToBlock(targetBlock, activeTaskId);
      }
    } else {
      setDisableDropAnimation(false);
    }

    setDraggedTaskId(null);
  }

  return (
    <div className="planner">
      <div className="planner__header">
        <div className="planner__meta">
          <span>{orderedBlocks.length} block{orderedBlocks.length === 1 ? "" : "s"}</span>
          <span>
            {timeline.totalFreeMinutes > 0
              ? `${formatDurationMinutes(timeline.totalFreeMinutes)} free`
              : "Fully allocated"}
          </span>
          <span>{timeline.visibleRangeLabel}</span>
        </div>
        <div className="planner__header-actions">
          <button
            className="button button--ghost button--small"
            type="button"
            onClick={() => setShowHoursEditor((current) => !current)}
            aria-label="Adjust visible hours"
            title="Visible hours"
          >
            ⚙
          </button>
          <button
            className="button button--primary button--small"
            type="button"
            onClick={() => openBlockForm()}
            disabled={Boolean(formDraft)}
          >
            + Add block
          </button>
        </div>
      </div>

      {showHoursEditor ? (
        <div className="planner__hours-card">
          <div className="planner__hours-copy">
            <div className="planner__hours-title">Preferred visible hours</div>
            <div className="planner__hours-desc">
              The planner defaults to this window, but still expands if today has blocks outside it.
            </div>
          </div>
          <div className="planner__hours-controls">
            <label className="planner__hours-field">
              <span>Start</span>
              <input
                className="planner__hours-input"
                type="time"
                value={hoursDraft.startTime}
                onChange={(e) =>
                  setHoursDraft((current) => ({ ...current, startTime: e.target.value }))
                }
              />
            </label>
            <label className="planner__hours-field">
              <span>End</span>
              <input
                className="planner__hours-input"
                type="time"
                value={hoursDraft.endTime}
                onChange={(e) =>
                  setHoursDraft((current) => ({ ...current, endTime: e.target.value }))
                }
              />
            </label>
            <div className="planner__hours-actions">
              <button
                className="button button--primary button--small"
                type="button"
                onClick={handleSaveVisibleHours}
                disabled={Boolean(hoursValidation)}
              >
                Save hours
              </button>
              <button
                className="button button--ghost button--small"
                type="button"
                onClick={handleResetVisibleHours}
              >
                Reset
              </button>
            </div>
          </div>
          {hoursValidation ? <div className="planner__hours-error">{hoursValidation}</div> : null}
        </div>
      ) : null}

      {actions.mutationError ? (
        <div className="planner__error">{actions.mutationError}</div>
      ) : null}

      {execution.cleanup.state !== "none" ? (
        <div className="planner__cleanup-banner">
          <div className="planner__cleanup-indicator" />
          <div className="planner__cleanup-copy">
            <span className="planner__cleanup-count">{execution.cleanup.taskCount}</span>
            <span className="planner__cleanup-label">
              {execution.cleanup.taskCount === 1 ? "task" : "tasks"} in past blocks
            </span>
          </div>
          <div className="planner__cleanup-actions">
            <button
              className="button button--ghost button--small"
              type="button"
              onClick={handleCleanupUnplanAll}
              disabled={isCleanupPending}
            >
              Unplan all slipped
            </button>
            {execution.cleanup.state === "close_day" ? (
              <button
                className="button button--ghost button--small"
                type="button"
                onClick={handleCleanupTomorrow}
                disabled={isCleanupPending}
              >
                Move all to tomorrow
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleUnplannedTaskDragStart}
        onDragCancel={handleUnplannedTaskDragCancel}
        onDragEnd={handleUnplannedTaskDragEnd}
      >
        <div className="planner__body">
          <div className="planner__timeline-pane">
          {orderedBlocks.length === 0 && !formDraft ? (
            <div className="planner__empty">
              <div className="planner__empty-icon">✦</div>
              <h3 className="planner__empty-title">Shape the day</h3>
              <p className="planner__empty-desc">
                Add your first block to start building a plan.
              </p>
              <button
                className="button button--primary button--small"
                type="button"
                onClick={() => openBlockForm()}
              >
                Add block
              </button>
            </div>
          ) : null}

          {formDraft ? (
            <PlannerBlockForm
              key={formDraft.key}
              date={date}
              existingBlocks={orderedBlocks}
              initialValues={formDraft}
              onSubmit={(payload) => {
                actions.addBlock(payload);
                setFormDraft(null);
              }}
              onCancel={() => setFormDraft(null)}
            />
          ) : null}

          {orderedBlocks.length > 0 || formDraft ? (
            <div className="planner__timeline-area">
              <div
                className="planner__gutter"
                aria-hidden="true"
                style={{ height: `${timeline.totalHeightPx}px` }}
              >
                {timeline.gutterMarkers.map((marker) => (
                  <div
                    key={marker.minutes}
                    className={`planner__gutter-hour${
                      timeline.nowLinePx !== null && marker.topPx < timeline.nowLinePx
                        ? " planner__gutter-hour--past"
                        : ""
                    }`}
                    style={{ top: `${marker.topPx}px` }}
                  >
                    {marker.label}
                  </div>
                ))}
                {timeline.nowLinePx !== null ? (
                  <div
                    className="planner__gutter-now"
                    style={{ top: `${timeline.nowLinePx}px` }}
                  />
                ) : null}
              </div>

              <div
                className="planner__timeline-track"
                style={{ height: `${timeline.totalHeightPx}px` }}
              >
                {timeline.segments.map((segment) =>
                  segment.kind === "gap" ? (
                    <PlannerGapCard
                      key={segment.id}
                      segment={segment}
                      onAddBlock={() =>
                        openBlockForm({
                          startTime: minutesToTimeString(segment.startMinutes),
                          endTime: minutesToTimeString(
                            Math.min(segment.startMinutes + 60, segment.endMinutes),
                          ),
                        })
                      }
                    />
                  ) : (
                    <PlannerBlock
                      key={segment.id}
                      block={segment.block!}
                      existingBlocks={orderedBlocks}
                      availableTasks={unplannedTasks}
                      availableBlocks={orderedBlocks}
                      canMoveUp={(blockIndexMap.get(segment.block!.id) ?? -1) > 0}
                      canMoveDown={(blockIndexMap.get(segment.block!.id) ?? -1) < orderedBlocks.length - 1}
                      onMoveBlock={(direction) =>
                        handleMoveBlock(
                          blockIndexMap.get(segment.block!.id) ?? -1,
                          direction,
                        )
                      }
                      onAddTasks={(taskIds) => actions.assignTasksToBlock(segment.block!, taskIds)}
                      onMoveTaskToBlock={(taskId, targetBlock) =>
                        actions.moveTaskToBlock(targetBlock, taskId)
                      }
                      onEditBlock={(updates) => actions.editBlock(segment.block!.id, updates)}
                      onDeleteBlock={() => actions.removeBlock(segment.block!.id)}
                      onRemoveTask={(taskId) => actions.removeTaskFromBlock(segment.block!.id, taskId)}
                      onReorderTasks={(taskIds) => actions.reorderTasksInBlock(segment.block!, taskIds)}
                      onNudgeDuration={(direction) => handleNudgeBlock(segment.block!, direction)}
                      onDuplicateBlock={() => handleDuplicateBlock(segment.block!)}
                      onSplitBlock={() => handleSplitBlock(segment.block!)}
                      onCarryPendingToNext={() =>
                        handleCarryPendingToNext(
                          segment.block!,
                          orderedBlocks[(blockIndexMap.get(segment.block!.id) ?? -1) + 1] ?? null,
                        )
                      }
                      timelineStatus={segment.status}
                      isUpNext={timeline.nextBlockId === segment.block!.id}
                      durationLabel={segment.durationLabel}
                      segmentStartMinutes={segment.startMinutes}
                      segmentEndMinutes={segment.endMinutes}
                      hourMarkers={segment.hourMarkers}
                      currentMarkerPercent={segment.currentMarkerPercent}
                      minHeight={segment.minHeight}
                      topPx={segment.topPx}
                      heightPx={segment.heightPx}
                      nextBlock={orderedBlocks[(blockIndexMap.get(segment.block!.id) ?? -1) + 1] ?? null}
                      canDuplicate={!formDraft}
                      isPending={actions.isPending}
                      activeUnplannedTaskId={draggedTaskId}
                    />
                  ),
                )}

                {timeline.nowLinePx !== null ? (
                  <div
                    className="planner__now-line"
                    style={{ top: `${timeline.nowLinePx}px` }}
                    aria-hidden="true"
                  />
                ) : null}
              </div>
            </div>
          ) : null}
          </div>

          <UnplannedTasks
            tasks={unplannedTasks}
            blocks={orderedBlocks}
            isPending={actions.isPending}
            draggedTaskId={draggedTaskId}
            suppressedTaskId={suppressedTaskId}
            onQuickAssign={(taskId, block) => actions.assignTaskToBlock(block, taskId)}
            onBulkAssign={(taskIds, block) => actions.assignTasksToBlock(block, taskIds)}
          />
        </div>

        {createPortal(
          <DragOverlay dropAnimation={disableDropAnimation ? null : undefined}>
            {activeDraggedTask ? <PlannerTaskDragPreview task={activeDraggedTask} /> : null}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>
    </div>
  );
}

function PlannerGapCard({
  segment,
  onAddBlock,
}: {
  segment: PlannerTimelineSegment;
  onAddBlock: () => void;
}) {
  return (
    <div
      className={`planner-gap planner-gap--${segment.status}`}
      style={{
        position: "absolute",
        top: `${segment.topPx}px`,
        height: `${segment.heightPx}px`,
        left: 0,
        right: 0,
      }}
    >
      <div className="planner-gap__info">
        <span className="planner-gap__time">
          {formatTimeLabel(segment.startsAt)} – {formatTimeLabel(segment.endsAt)}
        </span>
        <span className="planner-gap__duration">{segment.durationLabel}</span>
        {segment.status === "current" ? (
          <span className="planner-gap__free-label">Free now</span>
        ) : null}
      </div>
      {segment.status !== "past" ? (
        <button
          className="planner-gap__add-btn"
          type="button"
          onClick={onAddBlock}
          aria-label="Add block here"
        >
          <span className="planner-gap__add-icon">+</span>
          <span className="planner-gap__add-label">Add block</span>
        </button>
      ) : null}
    </div>
  );
}

function PlannerTaskDragPreview({ task }: { task: TaskItem }) {
  return (
    <div className="unplanned-task unplanned-task--dragging unplanned-task--overlay">
      <div className="unplanned-task__info" title={task.title}>
        <span className="unplanned-task__title">{task.title}</span>
        {task.goal ? (
          <span className={`unplanned-task__goal goal-chip__dot--${task.goal.domain}`}>
            {task.goal.title}
          </span>
        ) : null}
      </div>
    </div>
  );
}
