import { useEffect, useMemo, useState } from "react";

import type { GoalOverviewItem } from "../../shared/lib/api";
import type {
  PlanningItem,
  PlanningLane,
  PlanningSlot,
} from "./GoalsPlanTypes";
import {
  getLaneLabel,
  planningSlots,
} from "./GoalsPlanTypes";

export function GoalsPlanPlanningEditor({
  lane,
  item,
  activeGoals,
  getDuplicateCount,
  availableSlots,
  isPending,
  errorMessage,
  onSave,
  onRemove,
  onJumpToGoal,
}: {
  lane: PlanningLane;
  item: PlanningItem;
  activeGoals: GoalOverviewItem[];
  getDuplicateCount: (goalId: string) => number;
  availableSlots: PlanningSlot[];
  isPending: boolean;
  errorMessage: string | null;
  onSave: (updates: { title: string; goalId: string | null; slot: PlanningSlot }) => Promise<void> | void;
  onRemove: () => Promise<void> | void;
  onJumpToGoal: (goalId: string) => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [goalId, setGoalId] = useState(item.goalId ?? "");
  const [slot, setSlot] = useState<PlanningSlot>(item.slot);

  useEffect(() => {
    setTitle(item.title);
    setGoalId(item.goalId ?? "");
    setSlot(item.slot);
  }, [item.goalId, item.slot, item.title]);

  const dirty = title.trim() !== item.title || goalId !== (item.goalId ?? "") || slot !== item.slot;
  const duplicateCount = goalId ? getDuplicateCount(goalId) : 0;
  const slotChoices = useMemo(
    () => planningSlots.filter((currentSlot) => currentSlot === item.slot || availableSlots.includes(currentSlot)),
    [availableSlots, item.slot],
  );

  return (
    <section className="ghq-plan-editor">
      <div className="ghq-plan-editor__header">
        <div>
          <span className="ghq-plan-editor__eyebrow">{getLaneLabel(lane)}</span>
          <h3 className="ghq-plan-editor__title">
            {lane === "month" ? "Monthly item" : lane === "week" ? "Weekly item" : "Today item"}
          </h3>
        </div>
        <span className="ghq-plan-editor__slot">
          {lane === "month" ? "M" : lane === "week" ? "W" : "T"}
          {item.slot}
        </span>
      </div>

      <div className="ghq-plan-editor__body">
        <label className="ghq-planning-form__field">
          <span>Title</span>
          <input
            className="ghq-planning-form__input"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={isPending}
          />
        </label>

        <label className="ghq-planning-form__field">
          <span>Linked goal</span>
          <select
            className="ghq-planning-form__select"
            value={goalId}
            onChange={(event) => setGoalId(event.target.value)}
            disabled={isPending}
          >
            <option value="">No goal</option>
            {activeGoals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title}
              </option>
            ))}
          </select>
        </label>

        <label className="ghq-planning-form__field">
          <span>Slot</span>
          <select
            className="ghq-planning-form__select"
            value={slot}
            onChange={(event) => setSlot(Number(event.target.value) as PlanningSlot)}
            disabled={isPending}
          >
            {slotChoices.map((slotChoice) => (
              <option key={slotChoice} value={slotChoice}>
                {lane === "month" ? "M" : lane === "week" ? "W" : "T"}
                {slotChoice}
              </option>
            ))}
          </select>
        </label>

        {duplicateCount > 0 && goalId ? (
          <p className="ghq-planning-form__warning">
            This goal already appears elsewhere in {lane === "month" ? "this month" : lane === "week" ? "this week" : "today"}.
          </p>
        ) : null}

        {item.goalId ? (
          <button
            className="button button--ghost button--small"
            type="button"
            onClick={() => onJumpToGoal(item.goalId!)}
          >
            Open linked goal
          </button>
        ) : null}

        {errorMessage ? (
          <div className="inline-state inline-state--error">{errorMessage}</div>
        ) : null}

        <div className="ghq-planning-form__actions">
          <button
            className="button button--primary button--small"
            type="button"
            onClick={() => void onSave({ title: title.trim(), goalId: goalId || null, slot })}
            disabled={isPending || !title.trim() || !dirty}
          >
            {isPending ? "Saving..." : "Save changes"}
          </button>
          <button
            className="button button--ghost button--small"
            type="button"
            onClick={() => void onRemove()}
            disabled={isPending}
          >
            Remove item
          </button>
        </div>
      </div>
    </section>
  );
}
