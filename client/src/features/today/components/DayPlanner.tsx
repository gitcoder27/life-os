import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
  buildPlannerDateTime,
  addMinutes,
  getDuplicateBlockWindow,
  getLocalTimezoneOffset,
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
import { PlannerDateNavigator } from "./PlannerDateNavigator";

type PlannerActions = ReturnType<typeof usePlannerActions>;
type TaskActions = ReturnType<typeof useTaskActions>;

type PlannerFormDraft = {
  key: string;
  title?: string;
  startTime?: string;
  endTime?: string;
};

type PlannerQuickEditRequest = {
  blockId: string;
  key: string;
};

type PlannerGapQuickAddSlot = {
  id: string;
  startTime: string;
  endTime: string;
  durationLabel: string;
  label: string;
  topPercent: number;
  heightPercent: number;
};

const QUICK_ADD_BLOCK_DURATION_MINUTES = 60;

export function DayPlanner({
  date,
  todayDate,
  isEditable,
  isLiveDate,
  isHistoryDate,
  blocks,
  unplannedTasks,
  execution,
  actions,
  taskActions,
  onSelectDate,
  onStepDate,
  sidebarStyle,
}: {
  date: string;
  todayDate: string;
  isEditable: boolean;
  isLiveDate: boolean;
  isHistoryDate: boolean;
  blocks: DayPlannerBlockItem[];
  unplannedTasks: TaskItem[];
  execution: PlannerExecutionModel;
  actions: PlannerActions;
  taskActions: TaskActions;
  onSelectDate: (isoDate: string) => void;
  onStepDate: (direction: -1 | 1) => void;
  sidebarStyle?: CSSProperties;
}) {
  const [formDraft, setFormDraft] = useState<PlannerFormDraft | null>(null);
  const [showHoursEditor, setShowHoursEditor] = useState(false);
  const [visibleHours, setVisibleHours] = useState(() => readStoredPlannerVisibleHours());
  const [hoursDraft, setHoursDraft] = useState(visibleHours);
  const [now, setNow] = useState(() => new Date());
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [suppressedTaskId, setSuppressedTaskId] = useState<string | null>(null);
  const [disableDropAnimation, setDisableDropAnimation] = useState(false);
  const [quickEditRequest, setQuickEditRequest] = useState<PlannerQuickEditRequest | null>(null);
  const nowLineRef = useRef<HTMLDivElement | null>(null);
  const timelineTrackRef = useRef<HTMLDivElement | null>(null);
  const hasAutoCenteredNowRef = useRef(false);
  const lastAutoCenteredDateRef = useRef(date);
  const [guideWidth, setGuideWidth] = useState<number | null>(null);

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
        isLiveDate,
      }),
    [isLiveDate, orderedBlocks, now, visibleHours],
  );
  const hoursValidation = validatePlannerVisibleHours(hoursDraft);
  const isCleanupPending = actions.isPending || taskActions.isPending;
  const hasHistoryContent = orderedBlocks.length > 0 || unplannedTasks.length > 0;
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
    if (lastAutoCenteredDateRef.current === date) {
      return;
    }

    lastAutoCenteredDateRef.current = date;
    hasAutoCenteredNowRef.current = false;
    setQuickEditRequest(null);
  }, [date]);

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

  useLayoutEffect(() => {
    if (!isLiveDate || timeline.nowLinePx === null || hasAutoCenteredNowRef.current) {
      return;
    }

    const nowLineElement = nowLineRef.current;
    if (!nowLineElement) {
      return;
    }

    hasAutoCenteredNowRef.current = true;
    nowLineElement.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: "auto",
    });
  }, [isLiveDate, timeline.nowLinePx]);

  useLayoutEffect(() => {
    const timelineTrackElement = timelineTrackRef.current;
    if (!timelineTrackElement) {
      return;
    }

    const updateGuideWidth = () => {
      setGuideWidth(Math.round(timelineTrackElement.getBoundingClientRect().width));
    };

    updateGuideWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateGuideWidth);
      return () => {
        window.removeEventListener("resize", updateGuideWidth);
      };
    }

    const resizeObserver = new ResizeObserver(() => updateGuideWidth());
    resizeObserver.observe(timelineTrackElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [timeline.totalHeightPx, orderedBlocks.length, Boolean(formDraft)]);

  function openBlockForm(initialValues?: {
    title?: string;
    startTime?: string;
    endTime?: string;
  }) {
    if (!isEditable) {
      return;
    }

    setFormDraft({
      key: nextDraftKey(),
      ...initialValues,
    });
  }

  async function handleQuickAddBlock(slot: PlannerGapQuickAddSlot) {
    if (!isEditable || Boolean(formDraft)) {
      return;
    }

    try {
      const timezoneOffset = getLocalTimezoneOffset();
      const response = await actions.addBlock({
        title: null,
        startsAt: buildPlannerDateTime(date, slot.startTime, timezoneOffset),
        endsAt: buildPlannerDateTime(date, slot.endTime, timezoneOffset),
      });

      setQuickEditRequest({
        blockId: response.plannerBlock.id,
        key: nextDraftKey(),
      });
    } catch {
      return;
    }
  }

  function handleMoveBlock(index: number, direction: -1 | 1) {
    if (!isEditable) {
      return;
    }

    const target = index + direction;
    if (target < 0 || target >= orderedBlocks.length) {
      return;
    }

    const blockIds = orderedBlocks.map((block) => block.id);
    [blockIds[index], blockIds[target]] = [blockIds[target], blockIds[index]];
    actions.reorder(blockIds);
  }

  function handleNudgeBlock(block: DayPlannerBlockItem, direction: -1 | 1) {
    if (!isEditable) {
      return;
    }

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
    if (!isEditable) {
      return;
    }

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
    if (!isEditable) {
      return;
    }

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
    if (!isEditable) {
      return;
    }

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

  function handleCleanupUnplanAll() {
    if (!isLiveDate || !isEditable || execution.slippedBlocks.length === 0) {
      return;
    }

    void actions.unplanPendingTasksFromBlocks(
      execution.slippedBlocks.map((block) => block.block),
    );
  }

  function handleCleanupTomorrow() {
    if (!isLiveDate || !isEditable || execution.cleanup.taskIds.length === 0) {
      return;
    }

    void taskActions.moveTasksToTomorrow(execution.cleanup.taskIds);
  }

  function handleUnplannedTaskDragStart(event: DragStartEvent) {
    if (!isEditable) {
      return;
    }

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
    if (!isEditable) {
      setDraggedTaskId(null);
      setDisableDropAnimation(false);
      return;
    }

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
        <div className="planner__header-main">
          <PlannerDateNavigator
            date={date}
            todayDate={todayDate}
            onSelectDate={onSelectDate}
            onStepDate={onStepDate}
          />
          <div className="planner__meta">
            <span>{orderedBlocks.length} block{orderedBlocks.length === 1 ? "" : "s"}</span>
            <span>
              {timeline.totalFreeMinutes > 0
                ? `${formatDurationMinutes(timeline.totalFreeMinutes)} free`
                : "Fully allocated"}
            </span>
            <span>{timeline.visibleRangeLabel}</span>
          </div>
          {isHistoryDate ? (
            <div className="planner__history-note">
              History snapshot. Past days are read-only.
            </div>
          ) : !isLiveDate ? (
            <div className="planner__history-note">
              Planning ahead. This day stays editable until it becomes history.
            </div>
          ) : null}
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
          {isEditable ? (
            <button
              className="button button--primary button--small"
              type="button"
              onClick={() => openBlockForm()}
              disabled={Boolean(formDraft)}
            >
              + Add block
            </button>
          ) : null}
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

      {isLiveDate && execution.cleanup.state !== "none" ? (
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
                <h3 className="planner__empty-title">
                  {isEditable ? "Shape the day" : "No saved plan"}
                </h3>
                <p className="planner__empty-desc">
                  {isEditable
                    ? "Add your first block to start building a plan."
                    : hasHistoryContent
                      ? "This day has no saved time blocks."
                      : "There is no saved planning history for this day."}
                </p>
                {isEditable ? (
                  <button
                    className="button button--primary button--small"
                    type="button"
                    onClick={() => openBlockForm()}
                  >
                    Add block
                  </button>
                ) : null}
              </div>
            ) : null}
            {formDraft ? (
              <PlannerBlockForm
                key={formDraft.key}
                date={date}
                existingBlocks={orderedBlocks}
                initialValues={formDraft}
                onSubmit={(payload) => {
                  void actions.addBlock(payload);
                  setFormDraft(null);
                }}
                onCancel={() => setFormDraft(null)}
              />
            ) : null}

            {orderedBlocks.length > 0 || formDraft ? (
              <div
                className="planner__timeline-area"
                style={
                  guideWidth !== null
                    ? ({ "--planner-guide-width": `${guideWidth}px` } as CSSProperties)
                    : undefined
                }
              >
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
                  ref={timelineTrackRef}
                  className="planner__timeline-track"
                  style={{ height: `${timeline.totalHeightPx}px` }}
                >
                  {timeline.segments.map((segment) =>
                    segment.kind === "gap" ? (
                      <PlannerGapCard
                        key={segment.id}
                        date={date}
                        segment={segment}
                        isEditable={isEditable && !Boolean(formDraft)}
                        isPending={actions.isPending}
                        onQuickAddBlock={handleQuickAddBlock}
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
                        onDeleteBlock={() => actions.removeBlock(segment.block!)}
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
                        readOnly={!isEditable}
                        isPending={actions.isPending}
                        activeUnplannedTaskId={draggedTaskId}
                        editRequestKey={
                          quickEditRequest?.blockId === segment.block!.id ? quickEditRequest.key : null
                        }
                      />
                    ),
                  )}

                  {isLiveDate && timeline.nowLinePx !== null ? (
                    <div
                      ref={nowLineRef}
                      className="planner__now-line"
                      style={{ top: `${timeline.nowLinePx}px` }}
                      aria-hidden="true"
                    />
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="planner__sidebar-pane" style={sidebarStyle}>
            <UnplannedTasks
              tasks={unplannedTasks}
              blocks={orderedBlocks}
              readOnly={!isEditable}
              isHistoryDate={isHistoryDate}
              isPending={actions.isPending}
              draggedTaskId={draggedTaskId}
              suppressedTaskId={suppressedTaskId}
              onQuickAssign={(taskId, block) => actions.assignTaskToBlock(block, taskId)}
              onBulkAssign={(taskIds, block) => actions.assignTasksToBlock(block, taskIds)}
            />
          </div>
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
  date,
  segment,
  isEditable,
  isPending,
  onQuickAddBlock,
}: {
  date: string;
  segment: PlannerTimelineSegment;
  isEditable: boolean;
  isPending: boolean;
  onQuickAddBlock: (slot: PlannerGapQuickAddSlot) => void | Promise<void>;
}) {
  const timezoneOffset = getLocalTimezoneOffset();
  const slots = useMemo(() => buildPlannerGapQuickAddSlots(segment, date, timezoneOffset), [
    date,
    segment,
    timezoneOffset,
  ]);

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
      {slots.map((slot) => (
        <div
          key={slot.id}
          className="planner-gap__slot"
          style={{
            top: `${slot.topPercent}%`,
            height: `${slot.heightPercent}%`,
          }}
        >
          <button
            className="planner-gap__slot-button"
            type="button"
            onClick={() => {
              void onQuickAddBlock(slot);
            }}
            disabled={!isEditable || isPending || segment.status === "past"}
            aria-label={`Add block from ${slot.label}`}
          >
            <span className="planner-gap__slot-pill">
              <span className="planner-gap__slot-icon">+</span>
              <span className="planner-gap__slot-time">{slot.label}</span>
              {slot.durationLabel !== "1h" ? (
                <span className="planner-gap__slot-duration">{slot.durationLabel}</span>
              ) : null}
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}

function buildPlannerGapQuickAddSlots(
  segment: PlannerTimelineSegment,
  date: string,
  timezoneOffset: string,
): PlannerGapQuickAddSlot[] {
  const totalDuration = Math.max(segment.durationMinutes, 1);
  const slots: PlannerGapQuickAddSlot[] = [];
  let slotStartMinutes = Math.ceil(segment.startMinutes / QUICK_ADD_BLOCK_DURATION_MINUTES)
    * QUICK_ADD_BLOCK_DURATION_MINUTES;

  while (slotStartMinutes + QUICK_ADD_BLOCK_DURATION_MINUTES <= segment.endMinutes) {
    const slotEndMinutes = slotStartMinutes + QUICK_ADD_BLOCK_DURATION_MINUTES;
    const startTime = minutesToTimeString(slotStartMinutes);
    const endTime = minutesToTimeString(slotEndMinutes);
    const startsAt = buildPlannerDateTime(date, startTime, timezoneOffset);
    const endsAt = buildPlannerDateTime(date, endTime, timezoneOffset);

    slots.push({
      id: `${segment.id}-${slotStartMinutes}`,
      startTime,
      endTime,
      durationLabel: formatDurationMinutes(QUICK_ADD_BLOCK_DURATION_MINUTES),
      label: `${formatTimeLabel(startsAt)} – ${formatTimeLabel(endsAt)}`,
      topPercent: ((slotStartMinutes - segment.startMinutes) / totalDuration) * 100,
      heightPercent: (QUICK_ADD_BLOCK_DURATION_MINUTES / totalDuration) * 100,
    });

    slotStartMinutes += QUICK_ADD_BLOCK_DURATION_MINUTES;
  }

  return slots;
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
