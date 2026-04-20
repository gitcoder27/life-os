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
import { EmptyState } from "../../../shared/ui/PageState";
import { PriorityCard } from "./PriorityCard";
import type { usePriorityDraft } from "../hooks/usePriorityDraft";

type PriorityDraft = ReturnType<typeof usePriorityDraft>;

export function PriorityStack({
  priorityDraft,
  activeGoals,
}: {
  priorityDraft: PriorityDraft;
  activeGoals: Array<{ id: string; title: string; status: string }>;
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

  return (
    <section className="today-priority-hero">
      <div className="today-priority-hero__header">
        <div>
          <h2 className="today-priority-hero__title">Top Priorities</h2>
          <p className="today-priority-hero__subtitle">Your three most important outcomes for today</p>
        </div>
        <SaveIndicator status={priorityDraft.saveStatus} />
      </div>

      {priorityDraft.draft.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={priorityDraft.draft.map((p) => p.sortKey)}
            strategy={verticalListSortingStrategy}
          >
            <ol className="today-priority-stack">
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
                  taskOptions={[]}
                  onTaskFill={() => undefined}
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
        <EmptyState
          title="No ranked priorities"
          description="Add up to three priorities to define today's focus."
        />
      )}

      {priorityDraft.draft.length < 3 ? (
        <button
          className="today-priority-stack__add"
          type="button"
          onClick={priorityDraft.addPriority}
          disabled={priorityDraft.isMutating}
        >
          + Add priority
        </button>
      ) : null}
    </section>
  );
}

function SaveIndicator({ status }: { status: "idle" | "saving" | "saved" }) {
  if (status === "idle") return null;
  return (
    <span className={`today-save-indicator today-save-indicator--${status}`}>
      {status === "saving" ? "Saving…" : "Saved ✓"}
    </span>
  );
}
