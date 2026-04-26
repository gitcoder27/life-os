import type { GoalOverviewItem, WeekPlanResponse } from "../../shared/lib/api";
import type {
  PlanningDraft,
  PlanningItem,
  PlanningLane,
  PlanningReplaceState,
  PlanningSelection,
  PlanningSlot,
} from "./GoalsPlanTypes";
import { GoalsPlanPlanningEditor } from "./GoalsPlanPlanningEditor";
import { WeeklyCapacityCard } from "./WeeklyCapacityCard";

const planningSlots: PlanningSlot[] = [1, 2, 3];
const GOAL_DRAG_MIME = "application/x-life-os-goal-id";

const getLanePrefix = (lane: PlanningLane) => {
  if (lane === "month") return "M";
  if (lane === "week") return "W";
  return "T";
};

const getLaneTitle = (lane: PlanningLane) => {
  if (lane === "month") return "This month";
  if (lane === "week") return "This week";
  return "Today";
};

type DockItem = {
  id: string;
  slot: PlanningSlot;
  title: string;
  goalId: string | null;
};

type LaneDefinition = {
  lane: Exclude<PlanningLane, "today">;
  items: DockItem[];
};

type DockProps = {
  selectedGoal: GoalOverviewItem | null;
  activeGoals: GoalOverviewItem[];
  monthItems: DockItem[];
  weekItems: DockItem[];
  weekPlan: WeekPlanResponse | null;
  selectedPlanningSelection: PlanningSelection | null;
  selectedPlanningItem: PlanningItem | null;
  planningDraft: PlanningDraft | null;
  planningReplaceState: PlanningReplaceState | null;
  planningError: string | null;
  isOpen: boolean;
  onToggleOpen: () => void;
  onClose: () => void;
  onAddSelectedGoal: (lane: Exclude<PlanningLane, "today">) => void;
  onSelectSlot: (lane: Exclude<PlanningLane, "today">, slot: PlanningSlot) => void;
  onDropGoalToSlot: (lane: Exclude<PlanningLane, "today">, slot: PlanningSlot, goalId: string) => void;
  onPlanningDraftChange: (updates: Partial<PlanningDraft>) => void;
  onSavePlanningDraft: () => void;
  onCancelPlanningDraft: () => void;
  onPlanningReplaceAction: (action: "replace" | "move") => void;
  onCancelPlanningReplace: () => void;
  getDuplicateCount: (lane: Exclude<PlanningLane, "today">, goalId: string, excludeSlot?: PlanningSlot) => number;
  getAvailableSlots: (lane: Exclude<PlanningLane, "today">, currentSlot?: PlanningSlot) => PlanningSlot[];
  isLanePending: (lane: Exclude<PlanningLane, "today">) => boolean;
  getLaneErrorMessage: (lane: Exclude<PlanningLane, "today">) => string | null;
  onSaveSelectedItem: (updates: { title: string; goalId: string | null; slot: PlanningSlot }) => Promise<void> | void;
  onRemoveSelectedItem: () => Promise<void> | void;
  onJumpToGoal: (goalId: string) => void;
};

type SlotCardProps = {
  lane: Exclude<PlanningLane, "today">;
  slot: PlanningSlot;
  item: DockItem | null;
  activeGoals: GoalOverviewItem[];
  selectedGoal: GoalOverviewItem | null;
  selectedPlanningSelection: PlanningSelection | null;
  planningDraft: PlanningDraft | null;
  planningReplaceState: PlanningReplaceState | null;
  laneItems: DockItem[];
  onSelectSlot: (lane: Exclude<PlanningLane, "today">, slot: PlanningSlot) => void;
  onDropGoalToSlot: (lane: Exclude<PlanningLane, "today">, slot: PlanningSlot, goalId: string) => void;
  onPlanningDraftChange: (updates: Partial<PlanningDraft>) => void;
  onSavePlanningDraft: () => void;
  onCancelPlanningDraft: () => void;
  onPlanningReplaceAction: (action: "replace" | "move") => void;
  onCancelPlanningReplace: () => void;
};

const PlanningDockSlot = ({
  lane,
  slot,
  item,
  activeGoals,
  selectedGoal,
  selectedPlanningSelection,
  planningDraft,
  planningReplaceState,
  laneItems,
  onSelectSlot,
  onDropGoalToSlot,
  onPlanningDraftChange,
  onSavePlanningDraft,
  onCancelPlanningDraft,
  onPlanningReplaceAction,
  onCancelPlanningReplace,
}: SlotCardProps) => {
  const draft = planningDraft?.lane === lane && planningDraft.slot === slot ? planningDraft : null;
  const replaceState =
    planningReplaceState?.lane === lane && planningReplaceState.slot === slot
      ? planningReplaceState
      : null;
  const openSlot = planningSlots.find(
    (candidate) => !laneItems.some((laneItem) => laneItem.slot === candidate),
  ) ?? null;
  const replaceGoal = replaceState
    ? activeGoals.find((goal) => goal.id === replaceState.goalId) ?? null
    : null;
  const prefix = getLanePrefix(lane);
  const isSelected =
    selectedPlanningSelection?.lane === lane && selectedPlanningSelection.slot === slot;

  if (replaceState) {
    return (
      <div className="ghq-plan-dock__slot ghq-plan-dock__slot--replace">
        <span className="ghq-plan-dock__slot-badge">
          {prefix}
          {slot}
        </span>
        <div className="ghq-plan-dock__slot-content">
          <strong>Replace current focus</strong>
          <p>Put “{replaceGoal?.title ?? "Selected goal"}” here instead.</p>
          <div className="ghq-plan-dock__slot-actions">
            <button className="button button--primary button--small" type="button" onClick={() => onPlanningReplaceAction("replace")}>
              Replace
            </button>
            {openSlot ? (
              <button className="button button--ghost button--small" type="button" onClick={() => onPlanningReplaceAction("move")}>
                Move current to {prefix}
                {openSlot}
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

  if (draft) {
    return (
      <div className="ghq-plan-dock__slot ghq-plan-dock__slot--draft">
        <span className="ghq-plan-dock__slot-badge">
          {prefix}
          {slot}
        </span>
        <div className="ghq-plan-dock__slot-content">
          <input
            className="ghq-plan-dock__input"
            type="text"
            value={draft.title}
            placeholder="Planning item title"
            onChange={(event) => onPlanningDraftChange({ title: event.target.value })}
          />
          <select
            className="ghq-plan-dock__select"
            value={draft.goalId}
            onChange={(event) => onPlanningDraftChange({ goalId: event.target.value })}
          >
            {activeGoals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title}
              </option>
            ))}
          </select>
          <div className="ghq-plan-dock__slot-actions">
            <button className="button button--primary button--small" type="button" onClick={onSavePlanningDraft} disabled={!draft.title.trim()}>
              Save
            </button>
            <button className="button button--ghost button--small" type="button" onClick={onCancelPlanningDraft}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      className={`ghq-plan-dock__slot${item ? " ghq-plan-dock__slot--filled" : " ghq-plan-dock__slot--empty"}${isSelected ? " ghq-plan-dock__slot--selected" : ""}`}
      type="button"
      onClick={() => onSelectSlot(lane, slot)}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes(GOAL_DRAG_MIME)) {
          event.preventDefault();
        }
      }}
      onDrop={(event) => {
        const goalId = event.dataTransfer.getData(GOAL_DRAG_MIME);
        if (!goalId) {
          return;
        }

        event.preventDefault();
        onDropGoalToSlot(lane, slot, goalId);
      }}
    >
      <span className="ghq-plan-dock__slot-badge">
        {prefix}
        {slot}
      </span>
      <div className="ghq-plan-dock__slot-content">
        <strong>{item?.title ?? (selectedGoal ? "Add selected goal" : "Empty slot")}</strong>
        <span>
          {item
            ? "Focus item"
            : selectedGoal
              ? `Use ${selectedGoal.title} here`
              : "Select a goal to plan it"}
        </span>
      </div>
    </button>
  );
};

export const GoalsPlanPlanningDock = ({
  selectedGoal,
  activeGoals,
  monthItems,
  weekItems,
  weekPlan,
  selectedPlanningSelection,
  selectedPlanningItem,
  planningDraft,
  planningReplaceState,
  planningError,
  isOpen,
  onToggleOpen,
  onClose,
  onAddSelectedGoal,
  onSelectSlot,
  onDropGoalToSlot,
  onPlanningDraftChange,
  onSavePlanningDraft,
  onCancelPlanningDraft,
  onPlanningReplaceAction,
  onCancelPlanningReplace,
  getDuplicateCount,
  getAvailableSlots,
  isLanePending,
  getLaneErrorMessage,
  onSaveSelectedItem,
  onRemoveSelectedItem,
  onJumpToGoal,
}: DockProps) => {
  const laneDefinitions: LaneDefinition[] = [
    { lane: "month", items: monthItems },
    { lane: "week", items: weekItems },
  ];

  return (
    <section className={`ghq-plan-dock${isOpen ? " ghq-plan-dock--open" : ""}`}>
      <div className="ghq-plan-dock__summary">
        <div className="ghq-plan-dock__summary-copy">
          <span className="ghq-plan-dock__eyebrow">Focus board</span>
          <strong>
            Month {monthItems.length}/3 · Week {weekItems.length}/3
          </strong>
          <span>
            {selectedGoal
              ? `${selectedGoal.title} is selected for planning.`
              : "Build the tree first, then choose what deserves month or week focus."}
          </span>
        </div>
        <div className="ghq-plan-dock__summary-actions">
          <button className="button button--ghost button--small" type="button" onClick={onToggleOpen}>
            {isOpen ? "Hide focus board" : "Open focus board"}
          </button>
          {isOpen ? (
            <button className="button button--ghost button--small" type="button" onClick={onClose}>
              Close
            </button>
          ) : null}
        </div>
      </div>

      {isOpen ? (
        <div className="ghq-plan-dock__body">
          {weekPlan ? (
            <WeeklyCapacityCard
              weekStartDate={weekPlan.startDate}
              capacityProfile={weekPlan.capacityProfile}
              capacityAssessment={weekPlan.capacityAssessment}
              capacityProgress={weekPlan.capacityProgress}
            />
          ) : null}

          {selectedGoal ? (
            <>
              <div className="ghq-plan-dock__header">
                <div>
                  <h3>{selectedGoal.title}</h3>
                  <p>Choose whether this goal belongs in this month or this week. Keep the list small and intentional.</p>
                </div>
              </div>

              <div className="ghq-plan-dock__lanes">
                {laneDefinitions.map(({ lane, items }) => {
                  const existingSlot = items.find((item) => item.goalId === selectedGoal.id)?.slot ?? null;

                  return (
                    <section key={lane} className="ghq-plan-dock__lane">
                      <div className="ghq-plan-dock__lane-header">
                        <div>
                          <h4>{getLaneTitle(lane)}</h4>
                          <span>{getLanePrefix(lane)}1-{getLanePrefix(lane)}3</span>
                        </div>
                        <button
                          className="button button--ghost button--small"
                          type="button"
                          onClick={() => onAddSelectedGoal(lane)}
                        >
                          {existingSlot ? `Open ${getLanePrefix(lane)}${existingSlot}` : `Add to ${lane}`}
                        </button>
                      </div>
                      <div className="ghq-plan-dock__slots">
                        {planningSlots.map((slot) => (
                          <PlanningDockSlot
                            key={`${lane}-${slot}`}
                            lane={lane}
                            slot={slot}
                            item={items.find((item) => item.slot === slot) ?? null}
                            activeGoals={activeGoals}
                            selectedGoal={selectedGoal}
                            selectedPlanningSelection={selectedPlanningSelection}
                            planningDraft={planningDraft}
                            planningReplaceState={planningReplaceState}
                            laneItems={items}
                            onSelectSlot={onSelectSlot}
                            onDropGoalToSlot={onDropGoalToSlot}
                            onPlanningDraftChange={onPlanningDraftChange}
                            onSavePlanningDraft={onSavePlanningDraft}
                            onCancelPlanningDraft={onCancelPlanningDraft}
                            onPlanningReplaceAction={onPlanningReplaceAction}
                            onCancelPlanningReplace={onCancelPlanningReplace}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>

              {planningError ? (
                <div className="inline-state inline-state--error">{planningError}</div>
              ) : null}

              {selectedPlanningSelection && selectedPlanningItem ? (
                <GoalsPlanPlanningEditor
                  lane={selectedPlanningSelection.lane}
                  item={selectedPlanningItem}
                  activeGoals={activeGoals}
                  getDuplicateCount={(goalId) => getDuplicateCount(selectedPlanningSelection.lane as Exclude<PlanningLane, "today">, goalId, selectedPlanningItem.slot)}
                  availableSlots={getAvailableSlots(selectedPlanningSelection.lane as Exclude<PlanningLane, "today">, selectedPlanningItem.slot)}
                  isPending={isLanePending(selectedPlanningSelection.lane as Exclude<PlanningLane, "today">)}
                  errorMessage={getLaneErrorMessage(selectedPlanningSelection.lane as Exclude<PlanningLane, "today">)}
                  onSave={onSaveSelectedItem}
                  onRemove={onRemoveSelectedItem}
                  onJumpToGoal={onJumpToGoal}
                />
              ) : null}
            </>
          ) : (
            <div className="ghq-plan-dock__empty">
              <p>Select a goal from the graph to decide whether it belongs in this month or this week.</p>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
};
