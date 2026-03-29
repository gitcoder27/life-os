import { useEffect, useRef, useState } from "react";

import {
  useUpdateGoalMilestonesMutation,
  type GoalMilestoneItem,
} from "../../shared/lib/api";

type MilestoneDraft = {
  id?: string;
  title: string;
  targetDate: string;
  status: GoalMilestoneItem["status"];
};

const MAX_MILESTONES = 12;

const formatDate = (iso: string | null) => {
  if (!iso) return "";

  const date = new Date(`${iso}T12:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const isOverdue = (targetDate: string | null) => {
  if (!targetDate) return false;

  const today = new Date().toISOString().slice(0, 10);
  return targetDate < today;
};

const getDueLabel = (targetDate: string | null) => {
  if (!targetDate) return null;

  const now = new Date();
  const target = new Date(`${targetDate}T12:00:00`);
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  return `Due in ${diffDays} days`;
};

const toDrafts = (milestones: GoalMilestoneItem[]): MilestoneDraft[] =>
  milestones.map((milestone) => ({
    id: milestone.id,
    title: milestone.title,
    targetDate: milestone.targetDate ?? "",
    status: milestone.status,
  }));

const createDraft = (): MilestoneDraft => ({
  title: "",
  targetDate: "",
  status: "pending",
});

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
  const addInputRef = useRef<HTMLInputElement | null>(null);
  const shouldFocusAddedDraftRef = useRef(false);

  useEffect(() => {
    if (!editing) {
      setDrafts(toDrafts(milestones));
    }
  }, [editing, milestones]);

  useEffect(() => {
    if (!editing || !shouldFocusAddedDraftRef.current) return;

    shouldFocusAddedDraftRef.current = false;
    const timeoutId = window.setTimeout(() => addInputRef.current?.focus(), 40);

    return () => window.clearTimeout(timeoutId);
  }, [drafts.length, editing]);

  const openEditor = ({ addNewDraft = false }: { addNewDraft?: boolean } = {}) => {
    const nextDrafts = toDrafts(milestones);

    if (addNewDraft && nextDrafts.length < MAX_MILESTONES) {
      nextDrafts.push(createDraft());
      shouldFocusAddedDraftRef.current = true;
    }

    setDrafts(nextDrafts);
    setEditing(true);
  };

  const addDraft = () => {
    if (drafts.length >= MAX_MILESTONES) return;

    shouldFocusAddedDraftRef.current = true;
    setDrafts((currentDrafts) => [...currentDrafts, createDraft()]);
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

  const moveDraft = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= drafts.length) return;

    setDrafts((currentDrafts) => {
      const reorderedDrafts = [...currentDrafts];
      [reorderedDrafts[index], reorderedDrafts[nextIndex]] = [reorderedDrafts[nextIndex], reorderedDrafts[index]];
      return reorderedDrafts;
    });
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

        <div className="ap-inspector-milestones__editor">
          {drafts.map((draft, index) => (
            <div key={draft.id ?? `draft-${index}`} className="ap-inspector-milestones__editor-row">
              <button
                className={`ap-inspector-milestone__check${draft.status === "completed" ? " ap-inspector-milestone__check--done" : ""}`}
                type="button"
                onClick={() => updateDraft(index, {
                  status: draft.status === "completed" ? "pending" : "completed",
                })}
                aria-label={`Toggle ${draft.title || `milestone ${index + 1}`}`}
              >
                {draft.status === "completed" ? "✓" : ""}
              </button>

              <input
                ref={index === drafts.length - 1 ? addInputRef : undefined}
                className="ap-inspector-milestones__input"
                type="text"
                value={draft.title}
                placeholder="Milestone title"
                onChange={(event) => updateDraft(index, { title: event.target.value })}
              />

              <input
                className="ap-inspector-milestones__input ap-inspector-milestones__date"
                type="date"
                value={draft.targetDate}
                onChange={(event) => updateDraft(index, { targetDate: event.target.value })}
              />

              <div className="ap-inspector-milestones__reorder">
                <button
                  className="ap-inspector-milestones__icon-btn"
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveDraft(index, -1)}
                  aria-label="Move milestone up"
                >
                  ▲
                </button>
                <button
                  className="ap-inspector-milestones__icon-btn"
                  type="button"
                  disabled={index === drafts.length - 1}
                  onClick={() => moveDraft(index, 1)}
                  aria-label="Move milestone down"
                >
                  ▼
                </button>
              </div>

              <button
                className="ap-inspector-milestones__icon-btn ap-inspector-milestones__icon-btn--danger"
                type="button"
                onClick={() => removeDraft(index)}
                aria-label="Remove milestone"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="ap-inspector-milestones__editor-footer">
          <div className="ap-inspector-milestones__editor-actions">
            {drafts.length < MAX_MILESTONES ? (
              <button
                className="button button--ghost button--small"
                type="button"
                onClick={addDraft}
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
