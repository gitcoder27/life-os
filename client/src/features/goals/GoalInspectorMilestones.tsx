import { useEffect, useMemo, useRef, useState } from "react";
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

import {
  useUpdateGoalMilestonesMutation,
  type GoalMilestoneItem,
} from "../../shared/lib/api";
import {
  formatGoalDate as formatDate,
  getGoalMilestoneDueLabel as getDueLabel,
  isGoalMilestoneOverdue as isOverdue,
} from "./goal-date-logic";

type MilestoneDraft = {
  draftKey: string;
  id?: string;
  title: string;
  targetDate: string;
  status: GoalMilestoneItem["status"];
};

const MAX_MILESTONES = 12;

const toDrafts = (milestones: GoalMilestoneItem[]): MilestoneDraft[] =>
  milestones.map((milestone) => ({
    draftKey: milestone.id,
    id: milestone.id,
    title: milestone.title,
    targetDate: milestone.targetDate ?? "",
    status: milestone.status,
  }));

const createDraft = (draftKey: string): MilestoneDraft => ({
  draftKey,
  title: "",
  targetDate: "",
  status: "pending",
});

const GripIcon = () => (
  <svg width="10" height="18" viewBox="0 0 10 18" fill="currentColor" aria-hidden="true">
    <circle cx="2.5" cy="2.5" r="1.2" />
    <circle cx="7.5" cy="2.5" r="1.2" />
    <circle cx="2.5" cy="9" r="1.2" />
    <circle cx="7.5" cy="9" r="1.2" />
    <circle cx="2.5" cy="15.5" r="1.2" />
    <circle cx="7.5" cy="15.5" r="1.2" />
  </svg>
);

const SortableMilestoneDraftRow = ({
  draft,
  index,
  disabled,
  setInputRef,
  onUpdate,
  onTitleSubmit,
  onRemove,
}: {
  draft: MilestoneDraft;
  index: number;
  disabled: boolean;
  setInputRef: (node: HTMLInputElement | null) => void;
  onUpdate: (partial: Partial<MilestoneDraft>) => void;
  onTitleSubmit: () => void;
  onRemove: () => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: draft.draftKey, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`ap-inspector-milestones__editor-row${isDragging ? " ap-inspector-milestones__editor-row--dragging" : ""}`}
    >
      <button
        className="ap-inspector-milestones__drag-handle"
        type="button"
        aria-label={`Drag milestone ${index + 1}`}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripIcon />
      </button>

      <button
        className={`ap-inspector-milestone__check${draft.status === "completed" ? " ap-inspector-milestone__check--done" : ""}`}
        type="button"
        onClick={() => onUpdate({
          status: draft.status === "completed" ? "pending" : "completed",
        })}
        aria-label={`Toggle ${draft.title || `milestone ${index + 1}`}`}
      >
        {draft.status === "completed" ? "✓" : ""}
      </button>

      <input
        ref={setInputRef}
        className="ap-inspector-milestones__input"
        type="text"
        value={draft.title}
        placeholder="Milestone title"
        onChange={(event) => onUpdate({ title: event.target.value })}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent.isComposing) return;

          event.preventDefault();
          onTitleSubmit();
        }}
      />

      <input
        className="ap-inspector-milestones__input ap-inspector-milestones__date"
        type="date"
        value={draft.targetDate}
        onChange={(event) => onUpdate({ targetDate: event.target.value })}
      />

      <button
        className="ap-inspector-milestones__icon-btn ap-inspector-milestones__icon-btn--danger"
        type="button"
        onClick={onRemove}
        aria-label="Remove milestone"
      >
        ×
      </button>
    </div>
  );
};

export const GoalInspectorMilestones = ({
  milestones,
  goalId,
  onSaved,
}: {
  milestones: GoalMilestoneItem[];
  goalId: string;
  onSaved?: () => void;
}) => {
  const mutation = useUpdateGoalMilestonesMutation(goalId);
  const [drafts, setDrafts] = useState<MilestoneDraft[]>(() => toDrafts(milestones));
  const [editing, setEditing] = useState(false);
  const draftInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const focusDraftIndexRef = useRef<number | null>(null);
  const nextDraftKeyRef = useRef(0);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const sortableItems = useMemo(() => drafts.map((draft) => draft.draftKey), [drafts]);

  useEffect(() => {
    if (!editing) {
      setDrafts(toDrafts(milestones));
    }
  }, [editing, milestones]);

  useEffect(() => {
    if (!editing || focusDraftIndexRef.current === null) return;

    const focusIndex = focusDraftIndexRef.current;
    focusDraftIndexRef.current = null;
    const timeoutId = window.setTimeout(() => draftInputRefs.current[focusIndex]?.focus(), 40);

    return () => window.clearTimeout(timeoutId);
  }, [drafts.length, editing]);

  const createLocalDraft = () => createDraft(`draft-${nextDraftKeyRef.current++}`);

  const openEditor = ({ addNewDraft = false }: { addNewDraft?: boolean } = {}) => {
    const nextDrafts = toDrafts(milestones);

    if (addNewDraft && nextDrafts.length < MAX_MILESTONES) {
      nextDrafts.push(createLocalDraft());
      focusDraftIndexRef.current = nextDrafts.length - 1;
    }

    setDrafts(nextDrafts);
    setEditing(true);
  };

  const addDraft = (index = drafts.length) => {
    if (drafts.length >= MAX_MILESTONES) return;

    setDrafts((currentDrafts) => {
      const nextDrafts = [...currentDrafts];
      nextDrafts.splice(index, 0, createLocalDraft());
      focusDraftIndexRef.current = index;
      return nextDrafts;
    });
  };

  const updateDraft = (index: number, partial: Partial<MilestoneDraft>) => {
    setDrafts((currentDrafts) =>
      currentDrafts.map((draft, currentIndex) => (
        currentIndex === index ? { ...draft, ...partial } : draft
      )),
    );
  };

  const removeDraft = (index: number) => {
    setDrafts((currentDrafts) => currentDrafts.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = drafts.findIndex((draft) => draft.draftKey === active.id);
    const newIndex = drafts.findIndex((draft) => draft.draftKey === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    setDrafts((currentDrafts) => arrayMove(currentDrafts, oldIndex, newIndex));
  };

  const focusDraft = (index: number) => {
    window.setTimeout(() => draftInputRefs.current[index]?.focus(), 0);
  };

  const handleTitleSubmit = (index: number) => {
    const draft = drafts[index];
    if (!draft || !draft.title.trim()) return;

    const nextDraft = drafts[index + 1];
    if (
      nextDraft
      && !nextDraft.id
      && !nextDraft.title.trim()
      && !nextDraft.targetDate
      && nextDraft.status === "pending"
    ) {
      focusDraft(index + 1);
      return;
    }

    addDraft(index + 1);
  };

  const toggleSavedMilestone = (index: number) => {
    const updatedMilestones = milestones.map((milestone, milestoneIndex) => ({
      id: milestone.id,
      title: milestone.title,
      targetDate: milestone.targetDate || null,
      status:
        milestoneIndex === index
          ? (milestone.status === "completed" ? "pending" : "completed")
          : milestone.status,
    }));

    mutation.mutate(
      { milestones: updatedMilestones },
      { onSuccess: () => onSaved?.() },
    );
  };

  const saveDrafts = async () => {
    const payload = drafts
      .filter((draft) => draft.title.trim())
      .map((draft) => ({
        id: draft.id,
        title: draft.title.trim(),
        targetDate: draft.targetDate || null,
        status: draft.status,
      }));

    await mutation.mutateAsync({ milestones: payload });
    setEditing(false);
    onSaved?.();
  };

  const completedCount = milestones.filter((milestone) => milestone.status === "completed").length;

  if (editing) {
    return (
      <div className="ap-inspector-milestones">
        <div className="ap-inspector-milestones__editor-meta">
          <span>{drafts.length}/{MAX_MILESTONES} milestones</span>
          <button
            className="ap-inspector-milestones__text-btn"
            type="button"
            onClick={() => {
              setEditing(false);
              setDrafts(toDrafts(milestones));
            }}
            disabled={mutation.isPending}
          >
            Cancel
          </button>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
            <div className="ap-inspector-milestones__editor">
              {drafts.map((draft, index) => (
                <SortableMilestoneDraftRow
                  key={draft.draftKey}
                  draft={draft}
                  index={index}
                  disabled={mutation.isPending}
                  setInputRef={(node) => {
                    draftInputRefs.current[index] = node;
                  }}
                  onUpdate={(partial) => updateDraft(index, partial)}
                  onTitleSubmit={() => handleTitleSubmit(index)}
                  onRemove={() => removeDraft(index)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="ap-inspector-milestones__editor-footer">
          <div className="ap-inspector-milestones__editor-actions">
            {drafts.length < MAX_MILESTONES ? (
              <button
                className="button button--ghost button--small"
                type="button"
                onClick={() => addDraft()}
                disabled={mutation.isPending}
              >
                + Add milestone
              </button>
            ) : (
              <span className="ap-inspector-milestones__limit">Limit reached</span>
            )}
          </div>

          <button
            className="button button--primary button--small"
            type="button"
            onClick={() => void saveDrafts()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Saving..." : "Save changes"}
          </button>
        </div>

        {mutation.error instanceof Error ? (
          <p className="ap-inspector-milestones__error">{mutation.error.message}</p>
        ) : null}
      </div>
    );
  }

  if (milestones.length === 0) {
    return (
      <div className="ap-inspector-milestones ap-inspector-milestones--empty">
        <p className="ap-inspector__empty-section">
          No milestones defined yet.
        </p>
        <button
          className="button button--ghost button--small"
          type="button"
          onClick={() => openEditor({ addNewDraft: true })}
        >
          Add first milestone
        </button>
      </div>
    );
  }

  return (
    <div className="ap-inspector-milestones">
      <div className="ap-inspector-milestones__summary">
        <span>{completedCount}/{milestones.length} complete</span>
        <button
          className="ap-inspector-milestones__text-btn"
          type="button"
          onClick={() => openEditor()}
        >
          Edit
        </button>
      </div>

      {milestones.map((milestone, index) => {
        const dueLabel = getDueLabel(milestone.targetDate);
        const overdue = isOverdue(milestone.targetDate) && milestone.status === "pending";

        return (
          <div key={milestone.id} className="ap-inspector-milestone">
            <span className={`ap-inspector-milestone__dot ap-inspector-milestone__dot--${milestone.status === "completed" ? "done" : overdue ? "overdue" : "pending"}`} />
            <div className="ap-inspector-milestone__body">
              <span className={`ap-inspector-milestone__title${milestone.status === "completed" ? " ap-inspector-milestone__title--done" : ""}`}>
                {milestone.title}
              </span>
              {dueLabel ? (
                <span className={`ap-inspector-milestone__due${overdue ? " ap-inspector-milestone__due--overdue" : milestone.status === "completed" ? " ap-inspector-milestone__due--done" : ""}`}>
                  {milestone.status === "completed" ? `Completed ${formatDate(milestone.completedAt)}` : dueLabel}
                </span>
              ) : null}
            </div>
            <button
              className={`ap-inspector-milestone__check${milestone.status === "completed" ? " ap-inspector-milestone__check--done" : ""}`}
              type="button"
              onClick={() => toggleSavedMilestone(index)}
              aria-label={`Toggle ${milestone.title}`}
              disabled={mutation.isPending}
            >
              {milestone.status === "completed" ? "✓" : ""}
            </button>
          </div>
        );
      })}
    </div>
  );
};
