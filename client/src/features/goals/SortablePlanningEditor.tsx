import { useMemo } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
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

type ActiveGoalOption = {
  id: string;
  title: string;
};

export type RankedPlanningDraft = {
  id?: string;
  sortKey: string;
  title: string;
  goalId: string;
};

function GripIcon() {
  return (
    <svg width="10" height="18" viewBox="0 0 10 18" fill="currentColor" aria-hidden="true">
      <circle cx="2.5" cy="2.5" r="1.2" />
      <circle cx="7.5" cy="2.5" r="1.2" />
      <circle cx="2.5" cy="9" r="1.2" />
      <circle cx="7.5" cy="9" r="1.2" />
      <circle cx="2.5" cy="15.5" r="1.2" />
      <circle cx="7.5" cy="15.5" r="1.2" />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M2.5 2.5l7 7" />
      <path d="M9.5 2.5l-7 7" />
    </svg>
  );
}

function SortablePlanningCard({
  draft,
  index,
  slotPrefix,
  itemLabel,
  titlePlaceholder,
  activeGoals,
  disabled,
  onChange,
  onRemove,
}: {
  draft: RankedPlanningDraft;
  index: number;
  slotPrefix: string;
  itemLabel: string;
  titlePlaceholder: string;
  activeGoals: ActiveGoalOption[];
  disabled: boolean;
  onChange: (partial: Partial<RankedPlanningDraft>) => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: draft.sortKey, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`priority-card${isDragging ? " priority-card--dragging" : ""}`}
    >
      <button
        className="priority-card__handle"
        type="button"
        aria-label={`Drag to reorder ${itemLabel} ${index + 1}`}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripIcon />
      </button>

      <span className="priority-card__slot">{slotPrefix}{index + 1}</span>
      <span className="priority-card__check priority-card__check--new" aria-hidden="true" />

      <input
        className="priority-card__input"
        type="text"
        value={draft.title}
        placeholder={titlePlaceholder}
        onChange={(event) => onChange({ title: event.target.value })}
        disabled={disabled}
        aria-label={`${itemLabel} ${index + 1} title`}
      />

      {activeGoals.length > 0 ? (
        <select
          className="priority-card__goal"
          value={draft.goalId}
          onChange={(event) => onChange({ goalId: event.target.value })}
          disabled={disabled}
          aria-label={`Goal for ${itemLabel} ${index + 1}`}
        >
          <option value="">No goal</option>
          {activeGoals.map((goal) => (
            <option key={goal.id} value={goal.id}>{goal.title}</option>
          ))}
        </select>
      ) : null}

      <div className="priority-card__actions priority-card__actions--visible">
        <button
          className="priority-card__more priority-card__remove"
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Remove ${itemLabel} ${index + 1}`}
        >
          <RemoveIcon />
        </button>
      </div>
    </li>
  );
}

export function SortablePlanningEditor({
  drafts,
  onChangeDrafts,
  createDraft,
  activeGoals,
  slotPrefix,
  itemLabel,
  titlePlaceholder,
  addLabel,
  emptyMessage,
  disabled = false,
}: {
  drafts: RankedPlanningDraft[];
  onChangeDrafts: (drafts: RankedPlanningDraft[]) => void;
  createDraft: () => RankedPlanningDraft;
  activeGoals: ActiveGoalOption[];
  slotPrefix: string;
  itemLabel: string;
  titlePlaceholder: string;
  addLabel: string;
  emptyMessage: string;
  disabled?: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const items = useMemo(() => drafts.map((draft) => draft.sortKey), [drafts]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = drafts.findIndex((draft) => draft.sortKey === active.id);
    const newIndex = drafts.findIndex((draft) => draft.sortKey === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    onChangeDrafts(arrayMove(drafts, oldIndex, newIndex));
  }

  return (
    <div className="stack-form">
      {drafts.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items} strategy={verticalListSortingStrategy}>
            <ol className="priority-stack">
              {drafts.map((draft, index) => (
                <SortablePlanningCard
                  key={draft.sortKey}
                  draft={draft}
                  index={index}
                  slotPrefix={slotPrefix}
                  itemLabel={itemLabel}
                  titlePlaceholder={titlePlaceholder}
                  activeGoals={activeGoals}
                  disabled={disabled}
                  onChange={(partial) =>
                    onChangeDrafts(
                      drafts.map((item, currentIndex) =>
                        currentIndex === index ? { ...item, ...partial } : item,
                      ),
                    )
                  }
                  onRemove={() =>
                    onChangeDrafts(drafts.filter((_, currentIndex) => currentIndex !== index))
                  }
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      ) : (
        <p className="support-copy">{emptyMessage}</p>
      )}

      {drafts.length < 3 ? (
        <button
          className="priority-stack__add"
          type="button"
          onClick={() => onChangeDrafts([...drafts, createDraft()])}
          disabled={disabled}
        >
          {addLabel}
        </button>
      ) : null}
    </div>
  );
}
