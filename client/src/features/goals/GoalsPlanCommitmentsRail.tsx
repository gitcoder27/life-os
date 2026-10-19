import { useEffect, useMemo, useRef, useState } from "react";

import type { GoalOverviewItem, WeekPlanResponse } from "../../shared/lib/api";
import { taskTextAutocompleteProps } from "../../shared/ui/task-autocomplete";
import {
  planningSlots,
  type PlanningDraft,
  type PlanningItem,
  type PlanningReplaceState,
  type PlanningSelection,
  type PlanningSlot,
} from "./GoalsPlanTypes";
import { WeeklyCapacityLine } from "./WeeklyCapacityLine";

export const GOAL_DRAG_MIME = "application/x-life-os-goal-id";

export type RailLane = "month" | "week";

const lanePrefix = (lane: RailLane) => (lane === "month" ? "M" : "W");
const laneNoun = (lane: RailLane) => (lane === "month" ? "outcome" : "priority");

type RailProps = {
  selectedGoal: GoalOverviewItem | null;
  activeGoals: GoalOverviewItem[];
  monthLabel: string;
  weekLabel: string;
  monthItems: PlanningItem[];
  weekItems: PlanningItem[];
  weekPlan: WeekPlanResponse | null;
  selectedPlanningSelection: PlanningSelection | null;
  selectedPlanningItem: PlanningItem | null;
  planningDraft: PlanningDraft | null;
  planningReplaceState: PlanningReplaceState | null;
  planningError: string | null;
  onSelectSlot: (lane: RailLane, slot: PlanningSlot) => void;
  onDropGoalToSlot: (lane: RailLane, slot: PlanningSlot, goalId: string) => void;
  onPlanningDraftChange: (updates: Partial<PlanningDraft>) => void;
  onSavePlanningDraft: () => void;
  onCancelPlanningDraft: () => void;
  onPlanningReplaceAction: (action: "replace" | "move") => void;
  onCancelPlanningReplace: () => void;
  getAvailableSlots: (lane: RailLane, currentSlot: PlanningSlot) => PlanningSlot[];
  getDuplicateCount: (lane: RailLane, goalId: string, excludeSlot: PlanningSlot) => number;
  isLanePending: (lane: RailLane) => boolean;
  getLaneErrorMessage: (lane: RailLane) => string | null;
  onSaveSelectedItem: (updates: { title: string; goalId: string | null; slot: PlanningSlot }) => Promise<void> | void;
  onRemoveSelectedItem: () => Promise<void> | void;
  onCloseSelectedItem: () => void;
  onJumpToGoal: (goalId: string) => void;
};

/* ── Inline editors ── */

function DraftRow({
  lane,
  draft,
  activeGoals,
  isPending,
  onChange,
  onSave,
  onCancel,
}: {
  lane: RailLane;
  draft: PlanningDraft;
  activeGoals: GoalOverviewItem[];
  isPending: boolean;
  onChange: (updates: Partial<PlanningDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [draft.lane, draft.slot]);

  return (
    <div className="ghq-rail__row ghq-rail__row--editing">
      <span className="ghq-rail__slot">{lanePrefix(lane)}{draft.slot}</span>
      <div className="ghq-rail__editor">
        <input
          ref={inputRef}
          className="ghq-planning-form__input"
          type="text"
          {...taskTextAutocompleteProps}
          value={draft.title}
          placeholder={lane === "month" ? "Ship the backtest engine" : "Finish the data loader"}
          aria-label={`${lane === "month" ? "Month outcome" : "Week priority"} title`}
          onChange={(event) => onChange({ title: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing && draft.title.trim()) {
              event.preventDefault();
              onSave();
            } else if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              onCancel();
            }
          }}
        />
        <select
          className="ghq-planning-form__select"
          value={draft.goalId}
          aria-label="Linked goal"
          onChange={(event) => onChange({ goalId: event.target.value })}
        >
          <option value="">No linked goal</option>
          {activeGoals.map((goal) => (
            <option key={goal.id} value={goal.id}>
              {goal.title}
            </option>
          ))}
        </select>
        <div className="ghq-rail__actions">
          <button
            className="button button--primary button--small"
            type="button"
            onClick={onSave}
            disabled={isPending || !draft.title.trim()}
          >
            {isPending ? "Saving…" : "Save"}
          </button>
          <button className="button button--ghost button--small" type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ItemEditorRow({
  lane,
  item,
  activeGoals,
  availableSlots,
  getDuplicateCount,
  isPending,
  errorMessage,
  onSave,
  onRemove,
  onClose,
  onJumpToGoal,
}: {
  lane: RailLane;
  item: PlanningItem;
  activeGoals: GoalOverviewItem[];
  availableSlots: PlanningSlot[];
  getDuplicateCount: (goalId: string) => number;
  isPending: boolean;
  errorMessage: string | null;
  onSave: (updates: { title: string; goalId: string | null; slot: PlanningSlot }) => Promise<void> | void;
  onRemove: () => Promise<void> | void;
  onClose: () => void;
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
  const slotChoices = planningSlots.filter((choice) => choice === item.slot || availableSlots.includes(choice));
  const prefix = lanePrefix(lane);

  const save = () => {
    if (!isPending && title.trim() && dirty) {
      void onSave({ title: title.trim(), goalId: goalId || null, slot });
    }
  };

  return (
    <div className="ghq-rail__row ghq-rail__row--editing">
      <span className="ghq-rail__slot">{prefix}{item.slot}</span>
      <div className="ghq-rail__editor">
        <input
          className="ghq-planning-form__input"
          type="text"
          {...taskTextAutocompleteProps}
          value={title}
          aria-label="Title"
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              save();
            } else if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              onClose();
            }
          }}
          disabled={isPending}
        />
        <select
          className="ghq-planning-form__select"
          value={goalId}
          aria-label="Linked goal"
          onChange={(event) => setGoalId(event.target.value)}
          disabled={isPending}
        >
          <option value="">No linked goal</option>
          {activeGoals.map((goal) => (
            <option key={goal.id} value={goal.id}>
              {goal.title}
            </option>
          ))}
        </select>
        {slotChoices.length > 1 ? (
          <select
            className="ghq-planning-form__select"
            value={slot}
            aria-label="Slot"
            onChange={(event) => setSlot(Number(event.target.value) as PlanningSlot)}
            disabled={isPending}
          >
            {slotChoices.map((choice) => (
              <option key={choice} value={choice}>
                Slot {prefix}{choice}
              </option>
            ))}
          </select>
        ) : null}
        {duplicateCount > 0 ? (
          <p className="ghq-rail__warning">
            This goal is already in {lane === "month" ? "this month" : "this week"}.
          </p>
        ) : null}
        {errorMessage ? <p className="ghq-rail__error">{errorMessage}</p> : null}
        <div className="ghq-rail__actions">
          <button
            className="button button--primary button--small"
            type="button"
            onClick={save}
            disabled={isPending || !title.trim() || !dirty}
          >
            {isPending ? "Saving…" : "Save"}
          </button>
          <button className="button button--ghost button--small" type="button" onClick={onClose}>
            Close
          </button>
          <button
            className="ghq-rail__text-btn ghq-rail__text-btn--danger"
            type="button"
            onClick={() => void onRemove()}
            disabled={isPending}
          >
            Remove
          </button>
        </div>
        {item.goalId ? (
          <button className="ghq-rail__text-btn" type="button" onClick={() => onJumpToGoal(item.goalId!)}>
            Show goal on map
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ── Rail ── */

export function GoalsPlanCommitmentsRail({
  selectedGoal,
  activeGoals,
  monthLabel,
  weekLabel,
  monthItems,
  weekItems,
  weekPlan,
  selectedPlanningSelection,
  selectedPlanningItem,
  planningDraft,
  planningReplaceState,
  planningError,
  onSelectSlot,
  onDropGoalToSlot,
  onPlanningDraftChange,
  onSavePlanningDraft,
  onCancelPlanningDraft,
  onPlanningReplaceAction,
  onCancelPlanningReplace,
  getAvailableSlots,
  getDuplicateCount,
  isLanePending,
  getLaneErrorMessage,
  onSaveSelectedItem,
  onRemoveSelectedItem,
  onCloseSelectedItem,
  onJumpToGoal,
}: RailProps) {
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const goalTitleById = useMemo(
    () => new Map(activeGoals.map((goal) => [goal.id, goal.title])),
    [activeGoals],
  );

  const lanes: Array<{ lane: RailLane; label: string; items: PlanningItem[] }> = [
    { lane: "month", label: monthLabel, items: monthItems },
    { lane: "week", label: weekLabel, items: weekItems },
  ];

  const renderSlot = (lane: RailLane, slot: PlanningSlot, items: PlanningItem[]) => {
    const item = items.find((candidate) => candidate.slot === slot) ?? null;
    const prefix = lanePrefix(lane);
    const key = `${lane}-${slot}`;

    if (planningReplaceState?.lane === lane && planningReplaceState.slot === slot && item) {
      const incoming = goalTitleById.get(planningReplaceState.goalId) ?? "the selected goal";
      const openSlot = planningSlots.find((candidate) => !items.some((other) => other.slot === candidate)) ?? null;
      return (
        <div key={key} className="ghq-rail__row ghq-rail__row--editing">
          <span className="ghq-rail__slot">{prefix}{slot}</span>
          <div className="ghq-rail__editor">
            <p className="ghq-rail__prompt">
              Replace “{item.title}” with “{incoming}”?
            </p>
            <div className="ghq-rail__actions">
              <button
                className="button button--primary button--small"
                type="button"
                onClick={() => onPlanningReplaceAction("replace")}
                disabled={isLanePending(lane)}
              >
                Replace
              </button>
              {openSlot ? (
                <button
                  className="button button--ghost button--small"
                  type="button"
                  onClick={() => onPlanningReplaceAction("move")}
                  disabled={isLanePending(lane)}
                >
                  Move current to {prefix}{openSlot}
                </button>
              ) : null}
              <button className="button button--ghost button--small" type="button" onClick={onCancelPlanningReplace}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (planningDraft?.lane === lane && planningDraft.slot === slot) {
      return (
        <DraftRow
          key={key}
          lane={lane}
          draft={planningDraft}
          activeGoals={activeGoals}
          isPending={isLanePending(lane)}
          onChange={onPlanningDraftChange}
          onSave={onSavePlanningDraft}
          onCancel={onCancelPlanningDraft}
        />
      );
    }

    if (
      item
      && selectedPlanningItem
      && selectedPlanningSelection?.lane === lane
      && selectedPlanningSelection.slot === slot
    ) {
      return (
        <ItemEditorRow
          key={key}
          lane={lane}
          item={selectedPlanningItem}
          activeGoals={activeGoals}
          availableSlots={getAvailableSlots(lane, slot)}
          getDuplicateCount={(goalId) => getDuplicateCount(lane, goalId, slot)}
          isPending={isLanePending(lane)}
          errorMessage={getLaneErrorMessage(lane)}
          onSave={onSaveSelectedItem}
          onRemove={onRemoveSelectedItem}
          onClose={onCloseSelectedItem}
          onJumpToGoal={onJumpToGoal}
        />
      );
    }

    const linkedTitle = item?.goalId ? goalTitleById.get(item.goalId) ?? null : null;
    const isLinkedToSelected = Boolean(item && selectedGoal && item.goalId === selectedGoal.id);
    const selectedAlreadyInLane = Boolean(selectedGoal && items.some((other) => other.goalId === selectedGoal.id));
    const emptyLabel = selectedGoal && !selectedAlreadyInLane
      ? `Add “${selectedGoal.title}”`
      : `Add ${laneNoun(lane)}`;

    return (
      <button
        key={key}
        className={[
          "ghq-rail__row",
          item ? "ghq-rail__row--filled" : "ghq-rail__row--empty",
          item?.status === "completed" ? "ghq-rail__row--done" : "",
          isLinkedToSelected ? "ghq-rail__row--linked" : "",
          dragOverKey === key ? "ghq-rail__row--drop" : "",
        ].filter(Boolean).join(" ")}
        type="button"
        onClick={() => onSelectSlot(lane, slot)}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes(GOAL_DRAG_MIME)) {
            event.preventDefault();
            setDragOverKey(key);
          }
        }}
        onDragLeave={() => setDragOverKey((current) => (current === key ? null : current))}
        onDrop={(event) => {
          setDragOverKey(null);
          const goalId = event.dataTransfer.getData(GOAL_DRAG_MIME);
          if (!goalId) {
            return;
          }
          event.preventDefault();
          onDropGoalToSlot(lane, slot, goalId);
        }}
      >
        <span className="ghq-rail__slot">{prefix}{slot}</span>
        {item ? (
          <span className="ghq-rail__content">
            <span className="ghq-rail__title">{item.title}</span>
            {linkedTitle && linkedTitle !== item.title ? (
              <span className="ghq-rail__goal">{linkedTitle}</span>
            ) : null}
          </span>
        ) : (
          <span className="ghq-rail__content">
            <span className="ghq-rail__placeholder">
              {dragOverKey === key ? `Drop to add to ${prefix}${slot}` : emptyLabel}
            </span>
          </span>
        )}
        {item?.status === "completed" ? <span className="ghq-rail__state">Done</span> : null}
      </button>
    );
  };

  return (
    <div className="ghq-rail">
      {lanes.map(({ lane, label, items }) => (
        <section key={lane} className="ghq-rail__lane">
          <header className="ghq-rail__lane-header">
            <h3>{label}</h3>
            <span className="ghq-rail__count">{items.length}/3</span>
          </header>
          <div className="ghq-rail__rows">
            {planningSlots.map((slot) => renderSlot(lane, slot, items))}
          </div>
          {lane === "week" && weekPlan ? (
            <WeeklyCapacityLine
              weekStartDate={weekPlan.startDate}
              capacityProfile={weekPlan.capacityProfile}
              capacityAssessment={weekPlan.capacityAssessment}
              capacityProgress={weekPlan.capacityProgress}
            />
          ) : null}
        </section>
      ))}

      {planningError && !selectedPlanningItem ? <p className="ghq-rail__error">{planningError}</p> : null}

      <p className="ghq-rail__hint">
        Drag a goal onto a slot, or select it and press <kbd>M</kbd> or <kbd>W</kbd>.
      </p>
    </div>
  );
}
