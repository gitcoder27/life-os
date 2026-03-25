import { useEffect, useMemo, useState } from "react";
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
import { PlannerBlock } from "./PlannerBlock";
import { PlannerBlockForm } from "./PlannerBlockForm";
import { UnplannedTasks } from "./UnplannedTasks";

type PlannerActions = ReturnType<typeof usePlannerActions>;

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
  actions,
}: {
  date: string;
  blocks: DayPlannerBlockItem[];
  unplannedTasks: TaskItem[];
  actions: PlannerActions;
}) {
  const [formDraft, setFormDraft] = useState<PlannerFormDraft | null>(null);
  const [showHoursEditor, setShowHoursEditor] = useState(false);
  const [visibleHours, setVisibleHours] = useState(() => readStoredPlannerVisibleHours());
  const [hoursDraft, setHoursDraft] = useState(visibleHours);
  const [now, setNow] = useState(() => new Date());

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

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    setHoursDraft(visibleHours);
  }, [visibleHours]);

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

  return (
    <div className="planner">
      <div className="planner__header">
        <div className="planner__heading">
          <h2 className="planner__title">Day Plan</h2>
          <div className="planner__meta">
            <span>{orderedBlocks.length} block{orderedBlocks.length === 1 ? "" : "s"}</span>
            <span>
              {timeline.totalFreeMinutes > 0
                ? `${formatDurationMinutes(timeline.totalFreeMinutes)} free`
                : "Fully allocated"}
            </span>
            <span>{timeline.visibleRangeLabel} preferred hours</span>
          </div>
        </div>
        <div className="planner__header-actions">
          <button
            className="button button--ghost button--small"
            type="button"
            onClick={() => setShowHoursEditor((current) => !current)}
          >
            Visible hours
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

      <div className="planner__body">
        <div className="planner__timeline-pane">
          {orderedBlocks.length === 0 && !formDraft ? (
            <div className="planner__empty">
              <div className="planner__empty-icon">📅</div>
              <p className="planner__empty-title">Build the shape of the day first</p>
              <p className="planner__empty-desc">
                Start with one block, then use the visible gaps to shape the rest of the day.
              </p>
              <div className="planner__empty-steps">
                <span>1. Create your first block.</span>
                <span>2. Fill obvious free time with focus, admin, meals, or recovery.</span>
                <span>3. Assign tasks into the right block from the unplanned lane or inside a block.</span>
              </div>
              <button
                className="button button--primary button--small"
                type="button"
                onClick={() => openBlockForm()}
              >
                Create first block
              </button>
            </div>
          ) : null}

          <div className="planner__surface">
            <div className="planner__surface-header">
              <div className="planner__surface-title">Timeline view</div>
              <div className="planner__surface-range">
                Rendering {timeline.renderedRange.startTime} - {timeline.renderedRange.endTime}
              </div>
            </div>

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

            <div className="planner__timeline-track">
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
                    nextBlock={orderedBlocks[(blockIndexMap.get(segment.block!.id) ?? -1) + 1] ?? null}
                    canDuplicate={!formDraft}
                    isPending={actions.isPending}
                  />
                ),
              )}
            </div>
          </div>
        </div>

        <UnplannedTasks
          tasks={unplannedTasks}
          blocks={orderedBlocks}
          isPending={actions.isPending}
          onQuickAssign={(taskId, block) => actions.assignTaskToBlock(block, taskId)}
          onBulkAssign={(taskIds, block) => actions.assignTasksToBlock(block, taskIds)}
        />
      </div>
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
      style={{ minHeight: `${segment.minHeight}px` }}
    >
      <div className="planner-gap__main">
        <div className="planner-gap__header">
          <div className="planner-gap__time">
            <span>{formatTimeLabel(segment.startsAt)}</span>
            <span>→</span>
            <span>{formatTimeLabel(segment.endsAt)}</span>
          </div>
          <span className="planner-gap__duration">{segment.durationLabel} free</span>
        </div>
        <div className="planner-gap__title">
          {segment.status === "current" ? "Free right now" : "Open time"}
        </div>
        <div className="planner-gap__copy">
          Leave this open or turn it into a named block for the next part of the day.
        </div>
        <button
          className="button button--ghost button--small"
          type="button"
          onClick={onAddBlock}
        >
          Add block here
        </button>
      </div>

      {segment.hourMarkers.length > 0 ? (
        <div className="planner-segment__markers" aria-hidden="true">
          {segment.hourMarkers.map((marker) => (
            <div
              key={marker}
              className="planner-segment__tick"
              style={{
                top: `${((marker - segment.startMinutes) / Math.max(segment.durationMinutes, 1)) * 100}%`,
              }}
            >
              <span className="planner-segment__tick-label">
                {minutesToTimeString(marker)}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {segment.currentMarkerPercent !== null ? (
        <div
          className="planner-segment__now-line"
          style={{ top: `${segment.currentMarkerPercent}%` }}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}
