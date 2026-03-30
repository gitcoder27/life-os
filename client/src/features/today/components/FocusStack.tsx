import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { formatTimeLabel } from "../../../shared/lib/api";
import { PriorityCard } from "./PriorityCard";
import { formatDurationMinutes } from "../helpers/planner-blocks";
import type { PlannerExecutionModel } from "../helpers/planner-execution";
import type { usePriorityDraft } from "../hooks/usePriorityDraft";
import type { DayPhase } from "../helpers/day-phase";

type PriorityDraft = ReturnType<typeof usePriorityDraft>;

export function FocusStack({
  priorityDraft,
  activeGoals,
  execution,
  phase,
  onSwitchToPlanner,
}: {
  priorityDraft: PriorityDraft;
  activeGoals: Array<{ id: string; title: string; status: string }>;
  execution: PlannerExecutionModel;
  phase: DayPhase;
  onSwitchToPlanner: () => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = priorityDraft.draft.findIndex((p) => p.sortKey === active.id);
    const newIdx = priorityDraft.draft.findIndex((p) => p.sortKey === over.id);
    if (oldIdx >= 0 && newIdx >= 0) priorityDraft.reorder(oldIdx, newIdx);
  }

  const hasPriorities = priorityDraft.draft.length > 0;
  const topPriority = priorityDraft.draft.find((p) => p.status === "pending");
  const currentBlock = execution.currentBlock;
  const nextBlock = execution.nextBlock;

  return (
    <section className="focus-stack">
      {/* Execution state badge — what's happening right now */}
      <ExecutionStateBadge
        execution={execution}
        phase={phase}
        topPriorityTitle={topPriority?.title}
        onSwitchToPlanner={onSwitchToPlanner}
      />

      {/* Priority list */}
      <div className="focus-stack__priorities">
        <div className="focus-stack__priorities-header">
          <h2 className="focus-stack__priorities-title">Top Priorities</h2>
          <SaveIndicator status={priorityDraft.saveStatus} />
        </div>

        {hasPriorities ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={priorityDraft.draft.map((p) => p.sortKey)}
              strategy={verticalListSortingStrategy}
            >
              <ol className="focus-stack__priority-list">
                {priorityDraft.draft.map((item, index) => (
                  <PriorityCard
                    key={item.sortKey}
                    item={item}
                    index={index}
                    isMutating={priorityDraft.isMutating}
                    activeGoals={activeGoals}
                    onTitleChange={(title) => priorityDraft.updateTitle(index, title)}
                    onTitleBlur={() => priorityDraft.scheduleSave()}
                    onGoalChange={(goalId) => priorityDraft.updateGoal(index, goalId)}
                    onRemove={() => priorityDraft.removePriority(index)}
                    onStatusChange={(status) => {
                      if (item.id) priorityDraft.changeStatus(item.id, status);
                    }}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="focus-stack__empty">
            <p className="focus-stack__empty-text">
              {phase === "morning"
                ? "Start the day by naming your top 3 outcomes."
                : "Add up to three priorities to define today's focus."}
            </p>
          </div>
        )}

        {priorityDraft.draft.length < 3 ? (
          <button
            className="focus-stack__add-priority"
            type="button"
            onClick={priorityDraft.addPriority}
            disabled={priorityDraft.isMutating}
          >
            + Add priority
          </button>
        ) : null}
      </div>
    </section>
  );
}

function ExecutionStateBadge({
  execution,
  phase,
  topPriorityTitle,
  onSwitchToPlanner,
}: {
  execution: PlannerExecutionModel;
  phase: DayPhase;
  topPriorityTitle: string | undefined;
  onSwitchToPlanner: () => void;
}) {
  const currentBlock = execution.currentBlock;
  const nextBlock = execution.nextBlock;
  const slippedCount = execution.slippedTaskCount;

  // Current block active
  if (currentBlock && currentBlock.health !== "complete") {
    const healthClass = `focus-state--${currentBlock.health}`;
    return (
      <div className={`focus-state ${healthClass}`}>
        <div className="focus-state__row">
          <span className="focus-state__label">Now</span>
          <span className="focus-state__block-name">
            {currentBlock.block.title || "Current block"}
          </span>
          <span className="focus-state__time">
            {formatTimeLabel(currentBlock.block.startsAt)} – {formatTimeLabel(currentBlock.block.endsAt)}
          </span>
        </div>
        <div className="focus-state__row">
          <span className="focus-state__progress">
            {currentBlock.completedCount}/{currentBlock.totalCount} done
          </span>
          <span className="focus-state__remaining">
            {formatDurationMinutes(currentBlock.remainingMinutes)} left
          </span>
          {currentBlock.health === "at_risk" ? (
            <span className="focus-state__risk-badge">Running tight</span>
          ) : null}
        </div>
        <div className="focus-state__bar">
          <div
            className={`focus-state__bar-fill focus-state__bar-fill--${currentBlock.health}`}
            style={{ width: `${Math.min(currentBlock.timeProgressPercent, 100)}%` }}
          />
        </div>
      </div>
    );
  }

  // Slipped blocks exist
  if (slippedCount > 0) {
    return (
      <div className="focus-state focus-state--off_track">
        <div className="focus-state__row">
          <span className="focus-state__label">Off track</span>
          <span className="focus-state__detail">
            {slippedCount} task{slippedCount === 1 ? "" : "s"} slipped from past blocks
          </span>
        </div>
        <button
          className="focus-state__action"
          type="button"
          onClick={onSwitchToPlanner}
        >
          Replan
        </button>
      </div>
    );
  }

  // Gap before next block
  if (execution.focusState === "gap_before_next" && nextBlock) {
    return (
      <div className="focus-state focus-state--gap">
        <div className="focus-state__row">
          <span className="focus-state__label">Gap</span>
          <span className="focus-state__detail">
            {nextBlock.startsInMinutes != null && nextBlock.startsInMinutes > 0
              ? `${formatDurationMinutes(nextBlock.startsInMinutes)} until ${nextBlock.block.title || "next block"}`
              : `${nextBlock.block.title || "Next block"} starting now`}
          </span>
        </div>
      </div>
    );
  }

  // No plan
  if (execution.focusState === "no_plan") {
    return (
      <div className="focus-state focus-state--no-plan">
        <div className="focus-state__row">
          <span className="focus-state__label">No plan</span>
          <span className="focus-state__detail">
            {topPriorityTitle
              ? `Focus: ${topPriorityTitle}`
              : "Shape the day with time blocks"}
          </span>
        </div>
        <button
          className="focus-state__action"
          type="button"
          onClick={onSwitchToPlanner}
        >
          Plan day
        </button>
      </div>
    );
  }

  // Plan complete
  if (execution.focusState === "plan_complete") {
    const hasUnplanned = execution.unplannedTaskCount > 0;
    return (
      <div className="focus-state focus-state--complete">
        <div className="focus-state__row">
          <span className="focus-state__label">Plan complete</span>
          <span className="focus-state__detail">
            {hasUnplanned
              ? `${execution.unplannedTaskCount} unplanned task${execution.unplannedTaskCount === 1 ? "" : "s"} remain`
              : "All planned blocks are done"}
          </span>
        </div>
      </div>
    );
  }

  return null;
}

function SaveIndicator({ status }: { status: "idle" | "saving" | "saved" }) {
  if (status === "idle") return null;
  return (
    <span className={`focus-stack__save focus-stack__save--${status}`}>
      {status === "saving" ? "Saving…" : "Saved ✓"}
    </span>
  );
}
