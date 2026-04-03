import type { GoalOverviewItem } from "../../shared/lib/api";
import type {
  PlanningDraft,
  PlanningLane,
  PlanningReplaceState,
  PlanningSelection,
  PlanningSlot,
} from "./GoalsPlanTypes";

const planningSlots: PlanningSlot[] = [1, 2, 3];

const getLanePrefix = (lane: PlanningLane) => {
  if (lane === "month") return "M";
  if (lane === "week") return "W";
  return "T";
};

const getLaneTitle = (lane: PlanningLane) => {
  if (lane === "month") return "Month";
  if (lane === "week") return "Week";
  return "Today";
};

type DockItem = {
  id: string;
  slot: PlanningSlot;
  title: string;
  goalId: string | null;
};

type DockProps = {
  selectedGoal: GoalOverviewItem;
  activeGoals: GoalOverviewItem[];
  monthItems: DockItem[];
  weekItems: DockItem[];
  todayItems: DockItem[];
  showTodayLane: boolean;
  selectedPlanningSelection: PlanningSelection | null;
  planningDraft: PlanningDraft | null;
  planningReplaceState: PlanningReplaceState | null;
  onSelectSlot: (lane: PlanningLane, slot: PlanningSlot) => void;
  onDropGoalOnSlot: (lane: PlanningLane, slot: PlanningSlot, goalId: string) => void;
  onPlanningDraftChange: (updates: Partial<PlanningDraft>) => void;
  onSavePlanningDraft: () => void;
  onCancelPlanningDraft: () => void;
  onPlanningReplaceAction: (action: "replace" | "move") => void;
  onCancelPlanningReplace: () => void;
  onToggleTodayLane: () => void;
  onShowInspector: () => void;
  onClearSelection: () => void;
};

type SlotCardProps = {
  lane: PlanningLane;
  slot: PlanningSlot;
  item: DockItem | null;
  activeGoals: GoalOverviewItem[];
  selectedPlanningSelection: PlanningSelection | null;
  planningDraft: PlanningDraft | null;
  planningReplaceState: PlanningReplaceState | null;
  laneItems: DockItem[];
  onSelectSlot: (lane: PlanningLane, slot: PlanningSlot) => void;
  onDropGoalOnSlot: (lane: PlanningLane, slot: PlanningSlot, goalId: string) => void;
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
  selectedPlanningSelection,
  planningDraft,
  planningReplaceState,
  laneItems,
  onSelectSlot,
  onDropGoalOnSlot,
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
          <strong>Slot already filled</strong>
          <p>Replace it with “{replaceGoal?.title ?? "Selected goal"}”?</p>
          <div className="ghq-plan-dock__slot-actions">
            <button className="button button--primary button--small" type="button" onClick={() => onPlanningReplaceAction("replace")}>
              Replace here
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
    <div
      className={`ghq-plan-dock__slot${item ? " ghq-plan-dock__slot--filled" : " ghq-plan-dock__slot--empty"}${isSelected ? " ghq-plan-dock__slot--selected" : ""}`}
      onClick={() => onSelectSlot(lane, slot)}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        const goalId = event.dataTransfer.getData("application/x-life-os-goal-id");
        if (goalId) {
          onDropGoalOnSlot(lane, slot, goalId);
        }
      }}
    >
      <span className="ghq-plan-dock__slot-badge">
        {prefix}
        {slot}
      </span>
      <div className="ghq-plan-dock__slot-content">
        <strong>{item?.title ?? "Click or drop a goal here"}</strong>
        <span>{item ? "Linked planning item" : "Directly plan this goal without leaving the canvas."}</span>
      </div>
    </div>
  );
};

export const GoalsPlanPlanningDock = ({
  selectedGoal,
  activeGoals,
  monthItems,
  weekItems,
  todayItems,
  showTodayLane,
  selectedPlanningSelection,
  planningDraft,
  planningReplaceState,
  onSelectSlot,
  onDropGoalOnSlot,
  onPlanningDraftChange,
  onSavePlanningDraft,
  onCancelPlanningDraft,
  onPlanningReplaceAction,
  onCancelPlanningReplace,
  onToggleTodayLane,
  onShowInspector,
  onClearSelection,
}: DockProps) => {
  const laneDefinitions: Array<{ lane: PlanningLane; items: DockItem[] }> = [
    { lane: "month", items: monthItems },
    { lane: "week", items: weekItems },
  ];

  if (showTodayLane) {
    laneDefinitions.push({ lane: "today", items: todayItems });
  }

  return (
    <div className="ghq-plan-dock">
      <div className="ghq-plan-dock__header">
        <div>
          <span className="ghq-plan-dock__eyebrow">Planning Dock</span>
          <h3>{selectedGoal.title}</h3>
          <p>Keep the map stable while you connect this goal to Month, Week, and Today.</p>
        </div>
        <div className="ghq-plan-dock__header-actions">
          <button className="button button--ghost button--small" type="button" onClick={onToggleTodayLane}>
            {showTodayLane ? "Hide Today" : "Show Today"}
          </button>
          <button className="button button--ghost button--small" type="button" onClick={onShowInspector}>
            Show details
          </button>
          <button className="button button--ghost button--small" type="button" onClick={onClearSelection}>
            Clear selection
          </button>
        </div>
      </div>

      <div className="ghq-plan-dock__lanes">
        {laneDefinitions.map(({ lane, items }) => (
          <section key={lane} className="ghq-plan-dock__lane">
            <div className="ghq-plan-dock__lane-header">
              <h4>{getLaneTitle(lane)}</h4>
              <span>{getLanePrefix(lane)}1-{getLanePrefix(lane)}3</span>
            </div>
            <div className="ghq-plan-dock__slots">
              {planningSlots.map((slot) => (
                <PlanningDockSlot
                  key={`${lane}-${slot}`}
                  lane={lane}
                  slot={slot}
                  item={items.find((item) => item.slot === slot) ?? null}
                  activeGoals={activeGoals}
                  selectedPlanningSelection={selectedPlanningSelection}
                  planningDraft={planningDraft}
                  planningReplaceState={planningReplaceState}
                  laneItems={items}
                  onSelectSlot={onSelectSlot}
                  onDropGoalOnSlot={onDropGoalOnSlot}
                  onPlanningDraftChange={onPlanningDraftChange}
                  onSavePlanningDraft={onSavePlanningDraft}
                  onCancelPlanningDraft={onCancelPlanningDraft}
                  onPlanningReplaceAction={onPlanningReplaceAction}
                  onCancelPlanningReplace={onCancelPlanningReplace}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};
