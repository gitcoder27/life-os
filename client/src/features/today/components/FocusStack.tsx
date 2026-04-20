import { useMemo } from "react";
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
import { PriorityCard, type PriorityTaskOption } from "./PriorityCard";
import type { usePriorityDraft } from "../hooks/usePriorityDraft";
import type { DayPhase } from "../helpers/day-phase";
import type { TaskItem } from "../../../shared/lib/api";

type PriorityDraft = ReturnType<typeof usePriorityDraft>;

export function FocusStack({
  priorityDraft,
  activeGoals,
  tasks,
  plannedTaskIds,
  mustWinTaskId,
  phase,
}: {
  priorityDraft: PriorityDraft;
  activeGoals: Array<{ id: string; title: string; status: string }>;
  tasks: TaskItem[];
  plannedTaskIds: Set<string>;
  mustWinTaskId: string | null;
  phase: DayPhase;
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
  const taskOptions = useMemo<PriorityTaskOption[]>(
    () =>
      tasks
        .filter(
          (task) =>
            task.kind === "task" &&
            task.status === "pending" &&
            task.id !== mustWinTaskId,
        )
        .sort((left, right) => {
          const plannedDelta =
            Number(plannedTaskIds.has(right.id)) - Number(plannedTaskIds.has(left.id));
          if (plannedDelta !== 0) {
            return plannedDelta;
          }

          return left.title.localeCompare(right.title);
        })
        .map((task) => ({
          id: task.id,
          title: task.title,
          goalId: task.goalId,
          group: plannedTaskIds.has(task.id) ? "planned" : "unplanned",
        })),
    [mustWinTaskId, plannedTaskIds, tasks],
  );

  return (
    <section className="focus-stack">
      <div className="focus-stack__priorities">
        <div className="focus-stack__priorities-header">
          <h2 className="focus-stack__priorities-title">Support Priorities</h2>
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
                    onTitleBlur={priorityDraft.saveNow}
                    onGoalChange={(goalId) => priorityDraft.updateGoal(index, goalId)}
                    taskOptions={taskOptions}
                    onTaskFill={(taskFill) => priorityDraft.applyTaskFill(index, taskFill)}
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
                ? "Start the day by naming the two support priorities around the must-win."
                : "Add up to two support priorities around the must-win."}
            </p>
          </div>
        )}

        {priorityDraft.draft.length < 2 ? (
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

function SaveIndicator({ status }: { status: "idle" | "saving" | "saved" }) {
  if (status === "idle") return null;
  return (
    <span className={`focus-stack__save focus-stack__save--${status}`}>
      {status === "saving" ? "Saving…" : "Saved ✓"}
    </span>
  );
}
