import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { formatTimeLabel, type DayPlannerBlockItem, type DayPlannerBlockTaskItem, type TaskItem } from "../../../shared/lib/api";
import {
  type PlannerExecutionBlockModel,
  type PlannerExecutionModel,
} from "../helpers/planner-execution";
import { formatDurationMinutes } from "../helpers/planner-blocks";
import type { usePlannerActions } from "../hooks/usePlannerActions";
import type { useTaskActions } from "../hooks/useTaskActions";

type PlannerActions = ReturnType<typeof usePlannerActions>;
type TaskActions = ReturnType<typeof useTaskActions>;

const MAX_UNPLANNED_PREVIEW = 5;
const MAX_UP_NEXT_PREVIEW = 3;

export function ExecutePlannerFocus({
  execution,
  plannerActions,
  taskActions,
  onSwitchToPlanner,
}: {
  execution: PlannerExecutionModel;
  plannerActions: PlannerActions;
  taskActions: TaskActions;
  onSwitchToPlanner: () => void;
}) {
  const replanTargets = execution.orderedBlocks
    .filter((block) => block.timelineStatus !== "past")
    .map((block) => block.block);
  const defaultAssignTarget = execution.currentBlock?.block ?? execution.nextBlock?.block ?? null;
  const defaultAssignLabel = execution.currentBlock
    ? "Assign to now"
    : execution.nextBlock
      ? "Assign to up next"
      : "Assign";
  const unplannedPreview = execution.unplannedTasks.slice(0, MAX_UNPLANNED_PREVIEW);

  return (
    <section className="execute-focus">
      <div className="execute-focus__header">
        <div>
          <h2 className="execute-focus__title">Run the day</h2>
          <p className="execute-focus__subtitle">
            Stay inside the current block, keep the next handoff clear, and fix drift before the plan breaks.
          </p>
        </div>
        <button
          className="button button--ghost button--small"
          type="button"
          onClick={onSwitchToPlanner}
        >
          Adjust plan
        </button>
      </div>

      {execution.cleanup.state !== "none" ? (
        <CleanupSummaryCard
          execution={execution}
          targets={replanTargets}
          plannerActions={plannerActions}
          taskActions={taskActions}
          onSwitchToPlanner={onSwitchToPlanner}
        />
      ) : execution.currentBlock?.health === "at_risk" ? (
        <div className="execute-focus__banner execute-focus__banner--risk">
          <strong>Current block is running tight.</strong>
          <span>
            {execution.currentBlock.pendingCount} task{execution.currentBlock.pendingCount === 1 ? "" : "s"} still open with{" "}
            {formatDurationMinutes(execution.currentBlock.remainingMinutes)} left.
          </span>
        </div>
      ) : null}

      {execution.slippedBlocks.length > 0 ? (
        <div className="execute-focus__stack">
          {execution.slippedBlocks.map((block) => (
            <SlippedBlockCard
              key={block.block.id}
              block={block}
              targets={replanTargets.filter((candidate) => candidate.id !== block.block.id)}
              plannerActions={plannerActions}
              taskActions={taskActions}
              showTomorrowAction={execution.cleanup.state === "close_day"}
            />
          ))}
        </div>
      ) : null}

      {execution.focusState === "no_plan" ? (
        <EmptyExecuteState
          title="No blocks are shaping today yet"
          description={
            execution.unplannedTaskCount > 0
              ? `${execution.unplannedTaskCount} task${execution.unplannedTaskCount === 1 ? "" : "s"} are still sitting outside the day plan.`
              : "Open the planner and give the day a real shape before you work from the backlog."
          }
          actionLabel="Open planner"
          onAction={onSwitchToPlanner}
        />
      ) : null}

      {execution.focusState === "current" && execution.currentBlock ? (
        <CurrentBlockCard
          block={execution.currentBlock}
          targets={replanTargets.filter((candidate) => candidate.id !== execution.currentBlock?.block.id)}
          plannerActions={plannerActions}
          taskActions={taskActions}
        />
      ) : null}

      {execution.focusState === "gap_before_next" && execution.nextBlock ? (
        <GapBeforeNextCard nextBlock={execution.nextBlock} />
      ) : null}

      {execution.focusState === "plan_complete" ? (
        <EmptyExecuteState
          title={
            execution.unplannedTaskCount > 0
              ? "Planned blocks are over, but work is still outside the plan"
              : "The planned day is complete"
          }
          description={
            execution.unplannedTaskCount > 0
              ? "Either assign the remaining work into a live block later in the day, or reopen the planner and reshape the rest of today."
              : "You can keep working from the task list below, or reopen the planner if the day needs another block."
          }
          actionLabel="Adjust plan"
          onAction={onSwitchToPlanner}
        />
      ) : null}

      {execution.nextBlock && execution.focusState !== "gap_before_next" ? (
        <UpNextCard block={execution.nextBlock} />
      ) : null}

      {execution.unplannedTaskCount > 0 ? (
        <section className="execute-focus__card execute-focus__card--unplanned">
          <div className="execute-focus__card-head">
            <div>
              <div className="execute-focus__eyebrow">Unplanned work</div>
              <h3 className="execute-focus__card-title">
                {execution.unplannedTaskCount} task{execution.unplannedTaskCount === 1 ? "" : "s"} still sitting outside the day plan
              </h3>
            </div>
            <button
              className="button button--ghost button--small"
              type="button"
              onClick={onSwitchToPlanner}
            >
              Open planner
            </button>
          </div>
          <div className="execute-focus__helper">
            Put the next real task into the current block or the next handoff so Execute stays grounded in the plan.
          </div>
          <div className="execute-focus__task-list">
            {unplannedPreview.map((task) => (
              <UnplannedTaskRow
                key={task.id}
                task={task}
                targets={replanTargets}
                defaultTarget={defaultAssignTarget}
                defaultLabel={defaultAssignLabel}
                plannerActions={plannerActions}
              />
            ))}
          </div>
          {execution.unplannedTaskCount > MAX_UNPLANNED_PREVIEW ? (
            <div className="execute-focus__footnote">
              +{execution.unplannedTaskCount - MAX_UNPLANNED_PREVIEW} more unplanned task
              {execution.unplannedTaskCount - MAX_UNPLANNED_PREVIEW === 1 ? "" : "s"} still appear in the task list below.
            </div>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}

function CleanupSummaryCard({
  execution,
  targets,
  plannerActions,
  taskActions,
  onSwitchToPlanner,
}: {
  execution: PlannerExecutionModel;
  targets: DayPlannerBlockItem[];
  plannerActions: PlannerActions;
  taskActions: TaskActions;
  onSwitchToPlanner: () => void;
}) {
  const cleanupTarget = execution.cleanup.targetBlock?.block ?? null;
  const isBusy = plannerActions.isPending || taskActions.isPending;

  return (
    <section className="execute-focus__card execute-focus__card--cleanup">
      <div className="execute-focus__card-head">
        <div>
          <div className="execute-focus__eyebrow">Cleanup</div>
          <h3 className="execute-focus__card-title">
            {execution.cleanup.state === "close_day"
              ? "The planned day no longer matches reality"
              : "Earlier blocks slipped"}
          </h3>
          <div className="execute-focus__helper">
            {execution.cleanup.state === "close_day"
              ? `${execution.cleanup.taskCount} task${execution.cleanup.taskCount === 1 ? "" : "s"} are still attached to past blocks.`
              : `${execution.cleanup.taskCount} task${execution.cleanup.taskCount === 1 ? "" : "s"} from ${execution.cleanup.blockCount} earlier block${execution.cleanup.blockCount === 1 ? "" : "s"} still need a clearer plan.`}
            {execution.cleanup.state === "close_day" &&
            execution.cleanup.dayEndedMinutesAgo !== null
              ? ` Last planned block ended ${formatDurationMinutes(execution.cleanup.dayEndedMinutesAgo)} ago.`
              : ""}
          </div>
        </div>
        <HealthChip health="off_track" />
      </div>

      <div className="execute-focus__cleanup-stats">
        <span className="execute-focus__cleanup-chip">
          {execution.cleanup.blockCount} past block{execution.cleanup.blockCount === 1 ? "" : "s"}
        </span>
        <span className="execute-focus__cleanup-chip">
          {execution.cleanup.taskCount} open task{execution.cleanup.taskCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="execute-focus__quick-actions">
        {cleanupTarget ? (
          <button
            className="button button--primary button--small"
            type="button"
            onClick={() => plannerActions.assignTasksToBlock(cleanupTarget, execution.cleanup.taskIds)}
            disabled={isBusy}
          >
            Move all to {cleanupTarget.title || formatTimeLabel(cleanupTarget.startsAt)}
          </button>
        ) : null}
        {targets.length > 1 ? (
          <BlockTargetPicker
            label={cleanupTarget ? "Choose block" : "Move all"}
            blocks={targets}
            disabled={isBusy}
            onSelect={(block) => plannerActions.assignTasksToBlock(block, execution.cleanup.taskIds)}
          />
        ) : null}
        <button
          className="button button--ghost button--small"
          type="button"
          onClick={() =>
            plannerActions.unplanPendingTasksFromBlocks(
              execution.slippedBlocks.map((block) => block.block),
            )
          }
          disabled={isBusy}
        >
          Unplan all slipped
        </button>
        {execution.cleanup.state === "close_day" ? (
          <button
            className="button button--ghost button--small"
            type="button"
            onClick={() => taskActions.moveTasksToTomorrow(execution.cleanup.taskIds)}
            disabled={isBusy}
          >
            Move all to tomorrow
          </button>
        ) : null}
        <button
          className="button button--ghost button--small"
          type="button"
          onClick={onSwitchToPlanner}
        >
          Adjust plan
        </button>
      </div>
    </section>
  );
}

function CurrentBlockCard({
  block,
  targets,
  plannerActions,
  taskActions,
}: {
  block: PlannerExecutionBlockModel;
  targets: DayPlannerBlockItem[];
  plannerActions: PlannerActions;
  taskActions: TaskActions;
}) {
  const nextTarget = targets[0] ?? null;

  return (
    <section className="execute-focus__card execute-focus__card--current">
      <div className="execute-focus__card-head">
        <div>
          <div className="execute-focus__eyebrow">Current block</div>
          <h3 className="execute-focus__card-title">{block.block.title || "Untitled block"}</h3>
          <div className="execute-focus__time">
            {formatTimeLabel(block.block.startsAt)} - {formatTimeLabel(block.block.endsAt)} · {getCurrentBlockTimingCopy(block)}
          </div>
        </div>
        <HealthChip health={block.health} />
      </div>

      <div className="execute-focus__metrics">
        <MetricBar
          label="Time"
          value={`${Math.round(block.timeProgressPercent)}%`}
          progress={block.timeProgressPercent}
          tone={block.health === "at_risk" ? "warning" : "default"}
        />
        <MetricBar
          label="Tasks"
          value={block.totalCount > 0 ? `${block.completedCount}/${block.totalCount}` : "Open"}
          progress={block.totalCount > 0 ? block.taskProgressPercent : 0}
          tone={block.pendingCount === 0 ? "positive" : "default"}
        />
      </div>

      {nextTarget && block.pendingCount > 0 ? (
        <div className="execute-focus__quick-actions">
          <button
            className="button button--ghost button--small"
            type="button"
            onClick={() => plannerActions.carryPendingTasksToBlock(block.block, nextTarget)}
            disabled={plannerActions.isPending}
          >
            Carry open to {nextTarget.title || formatTimeLabel(nextTarget.startsAt)}
          </button>
        </div>
      ) : null}

      {block.pendingTasks.length > 0 ? (
        <div className="execute-focus__task-list">
          {block.pendingTasks.map((task) => (
            <PlannedTaskRow
              key={task.taskId}
              task={task}
              sourceBlock={block.block}
              targets={targets}
              plannerActions={plannerActions}
              taskActions={taskActions}
            />
          ))}
        </div>
      ) : (
        <div className="execute-focus__empty-note">
          Everything planned for this block is complete. Use the next handoff below or reopen the planner if the block itself needs to change.
        </div>
      )}
    </section>
  );
}

function SlippedBlockCard({
  block,
  targets,
  plannerActions,
  taskActions,
  showTomorrowAction,
}: {
  block: PlannerExecutionBlockModel;
  targets: DayPlannerBlockItem[];
  plannerActions: PlannerActions;
  taskActions: TaskActions;
  showTomorrowAction: boolean;
}) {
  const nextTarget = targets[0] ?? null;
  const pendingTaskIds = block.pendingTasks.map((task) => task.taskId);
  const isBusy = plannerActions.isPending || taskActions.isPending;

  return (
    <section className="execute-focus__card execute-focus__card--slipped">
      <div className="execute-focus__card-head">
        <div>
          <div className="execute-focus__eyebrow">Slipped block</div>
          <h3 className="execute-focus__card-title">{block.block.title || "Untitled block"}</h3>
          <div className="execute-focus__time">
            Ended {block.endedMinutesAgo ? `${formatDurationMinutes(block.endedMinutesAgo)} ago` : "earlier"} ·{" "}
            {formatTimeLabel(block.block.startsAt)} - {formatTimeLabel(block.block.endsAt)}
          </div>
        </div>
        <HealthChip health="off_track" />
      </div>
      <div className="execute-focus__helper">
        {block.pendingCount} task{block.pendingCount === 1 ? "" : "s"} still open from this block.
      </div>
      {block.pendingCount > 0 ? (
        <div className="execute-focus__quick-actions">
          {nextTarget ? (
            <button
              className="button button--ghost button--small"
              type="button"
              onClick={() => plannerActions.carryPendingTasksToBlock(block.block, nextTarget)}
              disabled={isBusy}
            >
              Carry open to {nextTarget.title || formatTimeLabel(nextTarget.startsAt)}
            </button>
          ) : null}
          <button
            className="button button--ghost button--small"
            type="button"
            onClick={() => plannerActions.unplanTaskIdsFromBlock(block.block, pendingTaskIds)}
            disabled={isBusy}
          >
            Unplan all
          </button>
          {showTomorrowAction ? (
            <button
              className="button button--ghost button--small"
              type="button"
              onClick={() => taskActions.moveTasksToTomorrow(pendingTaskIds)}
              disabled={isBusy}
            >
              Tomorrow
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="execute-focus__task-list">
        {block.pendingTasks.map((task) => (
          <PlannedTaskRow
            key={task.taskId}
            task={task}
            sourceBlock={block.block}
            targets={targets}
            plannerActions={plannerActions}
            taskActions={taskActions}
            showTomorrowAction={showTomorrowAction}
          />
        ))}
      </div>
    </section>
  );
}

function GapBeforeNextCard({
  nextBlock,
}: {
  nextBlock: PlannerExecutionBlockModel;
}) {
  return (
    <section className="execute-focus__card">
      <div className="execute-focus__card-head">
        <div>
          <div className="execute-focus__eyebrow">Between blocks</div>
          <h3 className="execute-focus__card-title">
            {nextBlock.startsInMinutes === 0
              ? "The next block is starting now"
              : `${formatDurationMinutes(nextBlock.startsInMinutes ?? 0)} until the next handoff`}
          </h3>
          <div className="execute-focus__time">
            Up next at {formatTimeLabel(nextBlock.block.startsAt)} · {nextBlock.block.title || "Untitled block"}
          </div>
        </div>
      </div>
      <div className="execute-focus__empty-note">
        Use the gap to reset, then step directly into the next block instead of drifting back into the backlog.
      </div>
    </section>
  );
}

function UpNextCard({
  block,
}: {
  block: PlannerExecutionBlockModel;
}) {
  return (
    <section className="execute-focus__card execute-focus__card--next">
      <div className="execute-focus__card-head">
        <div>
          <div className="execute-focus__eyebrow">Up next</div>
          <h3 className="execute-focus__card-title">{block.block.title || "Untitled block"}</h3>
          <div className="execute-focus__time">
            {formatTimeLabel(block.block.startsAt)} - {formatTimeLabel(block.block.endsAt)} · {getUpNextTimingCopy(block)}
          </div>
        </div>
      </div>
      {block.pendingTasks.length > 0 ? (
        <div className="execute-focus__preview-list">
          {block.pendingTasks.slice(0, MAX_UP_NEXT_PREVIEW).map((task) => (
            <div key={task.taskId} className="execute-focus__preview-item">
              {task.task.title}
            </div>
          ))}
          {block.pendingTasks.length > MAX_UP_NEXT_PREVIEW ? (
            <div className="execute-focus__footnote">
              +{block.pendingTasks.length - MAX_UP_NEXT_PREVIEW} more queued for this block
            </div>
          ) : null}
        </div>
      ) : (
        <div className="execute-focus__empty-note">
          This next block is still open. Assign work into it from the unplanned section or the planner.
        </div>
      )}
    </section>
  );
}

function PlannedTaskRow({
  task,
  sourceBlock,
  targets,
  plannerActions,
  taskActions,
  showTomorrowAction = false,
}: {
  task: DayPlannerBlockTaskItem;
  sourceBlock: DayPlannerBlockItem;
  targets: DayPlannerBlockItem[];
  plannerActions: PlannerActions;
  taskActions: TaskActions;
  showTomorrowAction?: boolean;
}) {
  const isBusy = plannerActions.isPending || taskActions.isPending;

  return (
    <div className="execute-focus__task-row">
      <div className="execute-focus__task-copy">
        <div className="execute-focus__task-title">{task.task.title}</div>
      </div>
      <div className="execute-focus__task-actions">
        <button
          className="execute-focus__task-btn execute-focus__task-btn--done"
          type="button"
          onClick={() => taskActions.changeStatus(task.taskId, "completed")}
          disabled={isBusy}
        >
          Done
        </button>
        {targets.length > 0 ? (
          <BlockTargetPicker
            label="Move"
            blocks={targets}
            disabled={isBusy}
            onSelect={(block) => plannerActions.moveTaskToBlock(block, task.taskId)}
          />
        ) : null}
        {showTomorrowAction ? (
          <button
            className="execute-focus__task-btn"
            type="button"
            onClick={() => taskActions.moveToTomorrow(task.taskId)}
            disabled={isBusy}
          >
            Tomorrow
          </button>
        ) : null}
        <button
          className="execute-focus__task-btn"
          type="button"
          onClick={() => plannerActions.removeTaskFromBlock(sourceBlock.id, task.taskId)}
          disabled={plannerActions.isPending}
        >
          Unplan
        </button>
      </div>
    </div>
  );
}

function UnplannedTaskRow({
  task,
  targets,
  defaultTarget,
  defaultLabel,
  plannerActions,
}: {
  task: TaskItem;
  targets: DayPlannerBlockItem[];
  defaultTarget: DayPlannerBlockItem | null;
  defaultLabel: string;
  plannerActions: PlannerActions;
}) {
  const canChooseTarget = targets.length > 0;

  return (
    <div className="execute-focus__task-row">
      <div className="execute-focus__task-copy">
        <div className="execute-focus__task-title">{task.title}</div>
      </div>
      <div className="execute-focus__task-actions">
        {defaultTarget ? (
          <button
            className="execute-focus__task-btn execute-focus__task-btn--done"
            type="button"
            onClick={() => plannerActions.assignTaskToBlock(defaultTarget, task.id)}
            disabled={plannerActions.isPending}
          >
            {defaultLabel}
          </button>
        ) : null}
        {canChooseTarget ? (
          <BlockTargetPicker
            label={defaultTarget ? "Choose block" : "Assign"}
            blocks={targets}
            disabled={plannerActions.isPending}
            onSelect={(block) => plannerActions.assignTaskToBlock(block, task.id)}
          />
        ) : null}
      </div>
    </div>
  );
}

function BlockTargetPicker({
  label,
  blocks,
  disabled,
  onSelect,
}: {
  label: string;
  blocks: DayPlannerBlockItem[];
  disabled: boolean;
  onSelect: (block: DayPlannerBlockItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, open, () => setOpen(false));

  return (
    <div className="execute-focus__picker" ref={ref}>
      <button
        className="execute-focus__task-btn"
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
      >
        {label}
      </button>
      {open ? (
        <div className="execute-focus__picker-menu">
          {blocks.map((block) => (
            <button
              key={block.id}
              className="execute-focus__picker-item"
              type="button"
              onClick={() => {
                onSelect(block);
                setOpen(false);
              }}
              disabled={disabled}
            >
              <span className="execute-focus__picker-time">{formatTimeLabel(block.startsAt)}</span>
              <span className="execute-focus__picker-title">{block.title || "Untitled block"}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function HealthChip({
  health,
}: {
  health: PlannerExecutionBlockModel["health"];
}) {
  return (
    <span className={`execute-focus__health execute-focus__health--${health}`}>
      {getHealthLabel(health)}
    </span>
  );
}

function MetricBar({
  label,
  value,
  progress,
  tone,
}: {
  label: string;
  value: string;
  progress: number;
  tone: "default" | "warning" | "positive";
}) {
  return (
    <div className="execute-focus__metric">
      <div className="execute-focus__metric-top">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="execute-focus__metric-bar">
        <div
          className={`execute-focus__metric-fill execute-focus__metric-fill--${tone}`}
          style={{ width: `${Math.max(Math.min(progress, 100), 0)}%` }}
        />
      </div>
    </div>
  );
}

function EmptyExecuteState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <section className="execute-focus__card execute-focus__card--empty">
      <div className="execute-focus__eyebrow">Execution state</div>
      <h3 className="execute-focus__card-title">{title}</h3>
      <div className="execute-focus__empty-note">{description}</div>
      <div>
        <button
          className="button button--primary button--small"
          type="button"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      </div>
    </section>
  );
}

function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onClose: () => void,
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) {
      return;
    }

    function handleMouseDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onCloseRef.current();
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [active, ref]);
}

const getCurrentBlockTimingCopy = (block: PlannerExecutionBlockModel) => {
  if (block.pendingCount === 0) {
    return "everything in this block is done";
  }

  if (block.remainingMinutes <= 0) {
    return "ending now";
  }

  return `${formatDurationMinutes(block.remainingMinutes)} left`;
};

const getUpNextTimingCopy = (block: PlannerExecutionBlockModel) => {
  if (block.startsInMinutes === null) {
    return "next handoff";
  }

  if (block.startsInMinutes <= 0) {
    return "starts now";
  }

  return `starts in ${formatDurationMinutes(block.startsInMinutes)}`;
};

const getHealthLabel = (health: PlannerExecutionBlockModel["health"]) => {
  switch (health) {
    case "complete":
      return "Complete";
    case "off_track":
      return "Off track";
    case "at_risk":
      return "At risk";
    default:
      return "On track";
  }
};
