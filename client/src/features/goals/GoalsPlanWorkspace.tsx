import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import type {
  GoalDomainItem,
  GoalHorizonItem,
  GoalOverviewItem,
  GoalsWorkspaceTodayAlignment,
  MonthPlanResponse,
  WeekPlanResponse,
} from "../../shared/lib/api";
import {
  getMonthStartDate,
  getTodayDate,
  getWeekStartDate,
  useCreateGoalMutation,
  useGoalDetailQuery,
  useUpdateGoalMutation,
  useUpdateMonthFocusMutation,
  useUpdateWeekPrioritiesMutation,
} from "../../shared/lib/api";
import { InlineErrorState } from "../../shared/ui/PageState";
import { GoalInspectorMilestones } from "./GoalInspectorMilestones";
import {
  GoalFormDialog,
  suggestChildHorizon,
  type GoalFormData,
} from "./GoalFormDialog";
import {
  buildHierarchyTree,
  getRootGoalIds,
  HierarchyRail,
} from "./GoalsHierarchyRail";
import { GoalsPlanGraphView } from "./GoalsPlanGraphView";
import { GoalsPlanPlanningDock } from "./GoalsPlanPlanningDock";
import { useGoalTodayAction } from "./useGoalTodayAction";
import {
  buildDraftTitleForGoal,
  getLaneDuplicateCount,
  getPlanningItemAtSlot,
  getPlanningItems,
  planningSlots,
  type PlanningItem,
  type PlanningDraft,
  type PlanningLane,
  type PlanningReplaceState,
  type PlanningSelection,
  type PlanningSlot,
} from "./GoalsPlanTypes";

/* ── Helpers ── */

const domainEmojis: Record<string, string> = {
  unassigned: "◌",
  health: "♥",
  money: "💼",
  work_growth: "🧠",
  home_admin: "🏡",
  discipline: "🎯",
};

function getDomainEmoji(systemKey: string | null): string {
  if (!systemKey) return "✦";
  return domainEmojis[systemKey] ?? "✦";
}

const healthLabels: Record<string, string> = {
  on_track: "On Track",
  drifting: "Drifting",
  stalled: "Stalled",
  achieved: "Achieved",
};

function findFirstOpenSlot(occupiedSlots: PlanningSlot[]) {
  return planningSlots.find((slot) => !occupiedSlots.includes(slot)) ?? null;
}

function sortPlanningItemsBySlot<T extends { slot: PlanningSlot }>(items: T[]) {
  return [...items].sort((left, right) => left.slot - right.slot);
}

function areGoalIdSetsEqual(left: Set<string>, right: Set<string>) {
  if (left.size !== right.size) {
    return false;
  }

  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }

  return true;
}

function isGoalDescendant(
  goals: GoalOverviewItem[],
  ancestorGoalId: string,
  candidateGoalId: string,
) {
  const goalMap = new Map(goals.map((goal) => [goal.id, goal]));
  let current = goalMap.get(candidateGoalId) ?? null;

  while (current?.parentGoalId) {
    if (current.parentGoalId === ancestorGoalId) {
      return true;
    }
    current = goalMap.get(current.parentGoalId) ?? null;
  }

  return false;
}

/* ── Plan Inspector ── */

type PlanInspectorFocusGoal = Pick<GoalOverviewItem, "id" | "status" | "nextBestAction">;

function PlanInspectorFocusActions({
  goal,
  onOpenPlanning,
  onLinkedToToday,
}: {
  goal: PlanInspectorFocusGoal;
  onOpenPlanning: (goalId: string) => void;
  onLinkedToToday: () => Promise<unknown> | unknown;
}) {
  const todayAction = useGoalTodayAction({
    goalId: goal.id,
    goalStatus: goal.status,
    nextBestAction: goal.nextBestAction,
    onLinkedToToday,
  });

  return (
    <>
      <div className="ghq-inspector__focus-actions">
        <button
          className="button button--ghost button--small"
          type="button"
          onClick={() => onOpenPlanning(goal.id)}
        >
          Open focus board
        </button>
        {todayAction.isAvailable ? (
          <button
            className="button button--ghost button--small"
            type="button"
            onClick={() => void todayAction.addToToday()}
            disabled={!todayAction.canAddToToday || todayAction.updateDayPrioritiesMutation.isPending}
          >
            {todayAction.buttonLabel}
          </button>
        ) : null}
        <Link to="/today" className="button button--ghost button--small">
          Open Today
        </Link>
      </div>
      {todayAction.isAvailable ? (
        <p className="ghq-inspector__helper-copy">{todayAction.helperCopy}</p>
      ) : null}
    </>
  );
}

function PlanInspector({
  goalId,
  domains,
  onSelectGoal,
  onEditGoal,
  onCreateChild,
  onOpenPlanning,
}: {
  goalId: string;
  domains: GoalDomainItem[];
  onSelectGoal: (goalId: string) => void;
  onEditGoal: (goal: GoalOverviewItem) => void;
  onCreateChild: (parentGoal: GoalOverviewItem) => void;
  onOpenPlanning: (goalId: string) => void;
}) {
  const detailQuery = useGoalDetailQuery(goalId);

  if (detailQuery.isLoading) {
    return (
      <div className="ghq-inspector">
        <div className="ghq-inspector__loading">Loading goal details...</div>
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="ghq-inspector">
        <InlineErrorState
          message={detailQuery.error instanceof Error ? detailQuery.error.message : "Could not load goal details."}
          onRetry={() => void detailQuery.refetch()}
        />
      </div>
    );
  }

  const goal = detailQuery.data.goal;
  const domain = domains.find((d) => d.id === goal.domainId);
  const healthState = goal.health ?? "on_track";

  return (
    <div className="ghq-inspector">
      {/* Header */}
      <div className="ghq-inspector__header">
        {/* Breadcrumb / ancestry */}
        {goal.ancestors.length > 0 && (
          <div className="ghq-inspector__breadcrumb">
            {goal.ancestors.map((ancestor, i) => (
              <span key={ancestor.id}>
                {i > 0 && <span className="ghq-inspector__breadcrumb-sep">/</span>}
                <button
                  className="ghq-inspector__breadcrumb-link"
                  type="button"
                  onClick={() => onSelectGoal(ancestor.id)}
                >
                  {ancestor.title}
                </button>
              </span>
            ))}
            <span className="ghq-inspector__breadcrumb-sep">/</span>
          </div>
        )}

        <h2 className="ghq-inspector__title">{goal.title}</h2>

        <div className="ghq-inspector__header-actions">
          <button
            className="button button--primary button--small"
            type="button"
            onClick={() => onOpenPlanning(goal.id)}
          >
            Plan goal
          </button>
          <button
            className="button button--ghost button--small"
            type="button"
            onClick={() => onEditGoal(goal)}
          >
            Edit goal
          </button>
        </div>

        <div className="ghq-inspector__meta">
          {domain && (
            <span className="ghq-inspector__domain">
              {getDomainEmoji(domain.systemKey)} {domain.name}
            </span>
          )}
          {goal.horizonName && (
            <span className="ghq-inspector__horizon-badge">{goal.horizonName}</span>
          )}
          <span className={`health-badge health-badge--${healthState}`}>
            <span className="health-badge__dot" />
            {healthLabels[healthState] ?? healthState}
          </span>
        </div>

        {/* Progress */}
        {goal.milestoneCounts.total > 0 && (
          <div className="goal-progress" style={{ marginTop: "0.75rem" }}>
            <div className="goal-progress__bar">
              <div
                className={`goal-progress__fill${healthState === "achieved" ? " goal-progress__fill--achieved" : ""}`}
                style={{ width: `${Math.min(goal.progressPercent, 100)}%` }}
              />
            </div>
            <span className="goal-progress__label">{goal.progressPercent}%</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="ghq-inspector__body">
        {/* Why */}
        {goal.why && (
          <div className="ghq-inspector__section">
            <h3 className="ghq-inspector__section-title">Why</h3>
            <p className="ghq-inspector__why">{goal.why}</p>
          </div>
        )}

        {goal.nextBestAction && (
          <div className="goal-nba">
            <span className="goal-nba__icon">→</span>
            <span>{goal.nextBestAction}</span>
          </div>
        )}

        <div className="ghq-inspector__section">
          <h3 className="ghq-inspector__section-title">Focus</h3>
          <div className="ghq-inspector__focus-status">
            <div className="ghq-inspector__focus-row">
              <span>Month</span>
              <strong>
                {goal.currentMonthOutcomes.length > 0
                  ? goal.currentMonthOutcomes.map((item) => `M${item.slot}`).join(", ")
                  : "Not in month focus"}
              </strong>
            </div>
            <div className="ghq-inspector__focus-row">
              <span>Week</span>
              <strong>
                {goal.currentWeekPriorities.length > 0
                  ? goal.currentWeekPriorities.map((item) => `W${item.slot}`).join(", ")
                  : "Not in week focus"}
              </strong>
            </div>
            <div className="ghq-inspector__focus-row">
              <span>Today</span>
              <strong>
                {goal.linkedSummary.currentDayPriorities > 0
                  ? "Already represented in Today"
                  : "Handled later in the Today workspace"}
              </strong>
            </div>
          </div>
          <PlanInspectorFocusActions
            goal={goal}
            onOpenPlanning={onOpenPlanning}
            onLinkedToToday={() => detailQuery.refetch()}
          />
        </div>

        <div className="ghq-inspector__section">
          <h3 className="ghq-inspector__section-title">Milestones</h3>
          <GoalInspectorMilestones
            milestones={goal.milestones}
            goalId={goal.id}
            onSaved={() => void detailQuery.refetch()}
          />
        </div>

        {goal.children.length > 0 && (
          <div className="ghq-inspector__section">
            <h3 className="ghq-inspector__section-title">Supporting goals</h3>
            <div className="ghq-inspector__children">
              {goal.children.map((child) => (
                <button
                  key={child.id}
                  className="ghq-inspector__child-row"
                  type="button"
                  onClick={() => onSelectGoal(child.id)}
                >
                  <span className="ghq-tree-node__health ghq-tree-node__health--on_track" />
                  <span>{child.title}</span>
                  {child.horizonName && (
                    <span className="ghq-tree-node__horizon">{child.horizonName}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          className="button button--ghost button--small ghq-inspector__breakdown-btn"
          type="button"
          onClick={() => onCreateChild(goal)}
        >
          + Add sub-goal
        </button>

        {goal.linkedHabits.length > 0 && (
          <div className="ghq-inspector__section">
            <h3 className="ghq-inspector__section-title">Support habits</h3>
            <div className="linked-items">
              {goal.linkedHabits.map((h) => (
                <div key={h.id} className="linked-item">
                  <span className={`linked-item__status linked-item__status--${h.status}`} />
                  <span className="linked-item__title">{h.title}</span>
                  {h.streakCount > 0 && <span className="linked-habit__streak">{h.streakCount}d</span>}
                  {!h.completedToday && h.dueToday && h.completedCountToday > 0 && (
                    <span className="tag tag--neutral">
                      {Math.min(h.completedCountToday, h.targetPerDay)}/{h.targetPerDay} today
                    </span>
                  )}
                  {h.completedToday && <span className="tag tag--positive">done</span>}
                  {h.dueToday && !h.completedToday && <span className="tag tag--warning">due</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {goal.notes && (
          <div className="ghq-inspector__section">
            <h3 className="ghq-inspector__section-title">Notes</h3>
            <p className="ghq-inspector__notes">{goal.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Horizon Roadmap ── */

function HorizonRoadmap({
  horizons,
  goals,
}: {
  horizons: GoalHorizonItem[];
  goals: GoalOverviewItem[];
}) {
  const activeHorizons = horizons.filter((h) => !h.isArchived);
  if (activeHorizons.length === 0) return null;

  const goalsByHorizon = new Map<string, number>();
  for (const goal of goals) {
    if (goal.horizonId && goal.status === "active") {
      goalsByHorizon.set(goal.horizonId, (goalsByHorizon.get(goal.horizonId) ?? 0) + 1);
    }
  }
  const unassigned = goals.filter((g) => !g.horizonId && g.status === "active").length;

  return (
    <div className="ghq-roadmap">
      {activeHorizons.map((h) => {
        const count = goalsByHorizon.get(h.id) ?? 0;
        return (
          <div key={h.id} className="ghq-roadmap__layer">
            <span className="ghq-roadmap__name">{h.name}</span>
            <span className="ghq-roadmap__count">{count}</span>
          </div>
        );
      })}
      {unassigned > 0 && (
        <div className="ghq-roadmap__layer ghq-roadmap__layer--unassigned">
          <span className="ghq-roadmap__name">Unassigned</span>
          <span className="ghq-roadmap__count">{unassigned}</span>
        </div>
      )}
    </div>
  );
}

/* ── Subview type ── */

type PlanSubview = "outline" | "graph";

/* ── Main Plan Workspace ── */

export function GoalsPlanWorkspace({
  goals,
  domains,
  horizons,
  weekPlan,
  monthPlan,
  todayAlignment,
  selectedGoalId,
  onSelectGoal,
  onClearSelectedGoal,
  onOpenCreateGoal,
  onEditGoal,
  onStartCreateChild,
  showChildForm,
  childFormParent,
  childForm,
  onChangeChildForm,
  onSubmitChildForm,
  onCancelChildForm,
  createIsPending,
}: {
  goals: GoalOverviewItem[];
  domains: GoalDomainItem[];
  horizons: GoalHorizonItem[];
  weekPlan: WeekPlanResponse | null;
  monthPlan: MonthPlanResponse | null;
  todayAlignment: GoalsWorkspaceTodayAlignment;
  selectedGoalId: string | null;
  onSelectGoal: (goalId: string) => void;
  onClearSelectedGoal: () => void;
  onOpenCreateGoal: () => void;
  onEditGoal: (goal: GoalOverviewItem) => void;
  onStartCreateChild: (parentGoal: GoalOverviewItem) => void;
  showChildForm: boolean;
  childFormParent: GoalOverviewItem | null;
  childForm: GoalFormData;
  onChangeChildForm: (updater: (prev: GoalFormData) => GoalFormData) => void;
  onSubmitChildForm: () => void;
  onCancelChildForm: () => void;
  createIsPending: boolean;
}) {
  const [planView, setPlanView] = useState<PlanSubview>("graph");
  const [isGraphExpanded, setIsGraphExpanded] = useState(false);
  const [isGraphFocusMode, setIsGraphFocusMode] = useState(false);
  const [isFocusBoardOpen, setIsFocusBoardOpen] = useState(false);
  const [focusBoardScrollRequest, setFocusBoardScrollRequest] = useState(0);
  const [inspectedGoalId, setInspectedGoalId] = useState<string | null>(null);
  const [expandedGoalIds, setExpandedGoalIds] = useState<Set<string>>(new Set());
  const [selectedPlanningSelection, setSelectedPlanningSelection] = useState<PlanningSelection | null>(null);
  const [planningDraft, setPlanningDraft] = useState<PlanningDraft | null>(null);
  const [planningReplaceState, setPlanningReplaceState] = useState<PlanningReplaceState | null>(null);
  const [planningError, setPlanningError] = useState<string | null>(null);
  const [graphStructureError, setGraphStructureError] = useState<string | null>(null);
  const [graphStructureMessage, setGraphStructureMessage] = useState<string | null>(null);
  const [graphChildDraft, setGraphChildDraft] = useState<{
    parentGoalId: string;
    title: string;
    horizonId: string | null;
    domainId: string;
  } | null>(null);
  const focusBoardRef = useRef<HTMLDivElement | null>(null);

  const activeGoals = useMemo(
    () => goals.filter((goal) => goal.status === "active"),
    [goals],
  );
  const rootGoalIds = useMemo(() => getRootGoalIds(activeGoals), [activeGoals]);
  const tree = useMemo(() => buildHierarchyTree(activeGoals), [activeGoals]);
  const selectedGoal = useMemo(
    () => (selectedGoalId ? goals.find((goal) => goal.id === selectedGoalId) ?? null : null),
    [goals, selectedGoalId],
  );
  const inspectedGoal = useMemo(
    () => (inspectedGoalId ? goals.find((goal) => goal.id === inspectedGoalId) ?? null : null),
    [goals, inspectedGoalId],
  );
  const todayDate = todayAlignment.date || getTodayDate();
  const weekStart = weekPlan?.startDate ?? getWeekStartDate(todayDate);
  const monthStart = monthPlan?.startDate ?? getMonthStartDate(todayDate);

  const updateWeekMutation = useUpdateWeekPrioritiesMutation(weekStart);
  const updateMonthMutation = useUpdateMonthFocusMutation(monthStart);
  const updateGoalMutation = useUpdateGoalMutation();
  const createGoalMutation = useCreateGoalMutation();

  const clearPlanningUi = useCallback(() => {
    setSelectedPlanningSelection(null);
    setPlanningDraft(null);
    setPlanningReplaceState(null);
    setPlanningError(null);
  }, []);

  const selectedPlanningItem = selectedPlanningSelection
    ? getPlanningItemAtSlot(
        selectedPlanningSelection.lane,
        selectedPlanningSelection.slot,
        weekPlan,
        monthPlan,
        todayAlignment,
      )
    : null;

  useEffect(() => {
    if (planView !== "graph") {
      setIsGraphExpanded(false);
      setIsGraphFocusMode(false);
    }
  }, [planView]);

  useEffect(() => {
    const validGoalIds = new Set(activeGoals.map((goal) => goal.id));
    if (inspectedGoalId && !validGoalIds.has(inspectedGoalId)) {
      setInspectedGoalId(null);
    }

    setExpandedGoalIds((current) => {
      const next = new Set([...current].filter((goalId) => validGoalIds.has(goalId)));
      if (next.size === 0) {
        for (const rootGoalId of rootGoalIds) {
          next.add(rootGoalId);
        }
      }
      return areGoalIdSetsEqual(current, next) ? current : next;
    });
  }, [activeGoals, inspectedGoalId, rootGoalIds]);

  useEffect(() => {
    clearPlanningUi();
  }, [selectedGoalId, clearPlanningUi]);

  useEffect(() => {
    setGraphStructureError(null);
    setGraphStructureMessage(null);
    setGraphChildDraft((current) => {
      if (!current) {
        return current;
      }

      const parentStillExists = activeGoals.some((goal) => goal.id === current.parentGoalId);
      return parentStillExists ? current : null;
    });
  }, [activeGoals, selectedGoalId]);

  useEffect(() => {
    if (selectedPlanningSelection && !selectedPlanningItem) {
      setSelectedPlanningSelection(null);
    }
  }, [selectedPlanningItem, selectedPlanningSelection]);

  useEffect(() => {
    if (selectedPlanningSelection || planningDraft || planningReplaceState) {
      setIsFocusBoardOpen(true);
    }
  }, [planningDraft, planningReplaceState, selectedPlanningSelection]);

  useEffect(() => {
    if (!focusBoardScrollRequest || !isFocusBoardOpen || isGraphExpanded) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      focusBoardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);

    return () => window.clearTimeout(timeoutId);
  }, [focusBoardScrollRequest, isFocusBoardOpen, isGraphExpanded]);

  useEffect(() => {
    if (!isGraphExpanded) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsGraphExpanded(false);
      }
    };

    document.body.classList.add("ghq-graph-expanded-body");
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.classList.remove("ghq-graph-expanded-body");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isGraphExpanded]);

  const getLanePending = useCallback(
    (lane: PlanningLane) => {
      if (lane === "month") return updateMonthMutation.isPending;
      return updateWeekMutation.isPending;
    },
    [updateMonthMutation.isPending, updateWeekMutation.isPending],
  );

  const getLaneErrorMessage = useCallback(
    (lane: PlanningLane) => {
      const error =
        lane === "month"
          ? updateMonthMutation.error
          : updateWeekMutation.error;

      return error instanceof Error ? error.message : null;
    },
    [updateMonthMutation.error, updateWeekMutation.error],
  );

  const commitLaneItems = useCallback(
    async (
      lane: PlanningLane,
      items: Array<{
        id?: string;
        slot: PlanningSlot;
        title: string;
        goalId: string | null;
      }>,
    ) => {
      setPlanningError(null);

      if (lane === "month") {
        await updateMonthMutation.mutateAsync({
          theme: monthPlan?.theme ?? null,
          topOutcomes: sortPlanningItemsBySlot(items).map((item) => ({
            id: item.id,
            slot: item.slot,
            title: item.title.trim(),
            goalId: item.goalId,
          })),
        });
        return;
      }

      if (lane === "week") {
        await updateWeekMutation.mutateAsync({
          priorities: sortPlanningItemsBySlot(items).map((item) => ({
            id: item.id,
            slot: item.slot,
            title: item.title.trim(),
            goalId: item.goalId,
          })),
        });
        return;
      }
    },
    [monthPlan?.theme, updateMonthMutation, updateWeekMutation],
  );

  const handleGraphSelectGoal = useCallback(
    (goalId: string) => {
      clearPlanningUi();
      setGraphStructureError(null);
      setGraphStructureMessage(null);
      onSelectGoal(goalId);
    },
    [clearPlanningUi, onSelectGoal],
  );

  const handleInspectGoal = useCallback(
    (goalId: string) => {
      clearPlanningUi();
      setGraphStructureError(null);
      setGraphStructureMessage(null);
      setInspectedGoalId(goalId);

      if (selectedGoalId !== goalId) {
        onSelectGoal(goalId);
      }
    },
    [clearPlanningUi, onSelectGoal, selectedGoalId],
  );

  const handleOutlineSelectGoal = useCallback(
    (goalId: string) => {
      onSelectGoal(goalId);
      setInspectedGoalId(goalId);
    },
    [onSelectGoal],
  );

  const handleOpenPlanningBoard = useCallback(
    (goalId?: string) => {
      clearPlanningUi();
      if (goalId && goalId !== selectedGoalId) {
        onSelectGoal(goalId);
      }
      setIsFocusBoardOpen(true);
      setFocusBoardScrollRequest((current) => current + 1);
      setGraphStructureError(null);
      setGraphStructureMessage(null);
    },
    [clearPlanningUi, onSelectGoal, selectedGoalId],
  );

  const handleSelectPlanningSlot = useCallback(
    (lane: PlanningLane, slot: PlanningSlot) => {
      setPlanningError(null);

      const laneItems = getPlanningItems(lane, weekPlan, monthPlan, todayAlignment);
      const existingItem = laneItems.find((item) => item.slot === slot) ?? null;

      if (existingItem) {
        setPlanningDraft(null);
        const selectedGoalAlreadyInLane = selectedGoal
          ? laneItems.some((item) => item.goalId === selectedGoal.id)
          : false;
        const openSlot = findFirstOpenSlot(laneItems.map((item) => item.slot as PlanningSlot));

        if (
          selectedGoal
          && existingItem.goalId !== selectedGoal.id
          && !selectedGoalAlreadyInLane
          && !openSlot
        ) {
          setSelectedPlanningSelection(null);
          setPlanningReplaceState({ lane, slot, goalId: selectedGoal.id });
          return;
        }

        setPlanningReplaceState(null);
        setSelectedPlanningSelection({ lane, slot });
        return;
      }

      if (!selectedGoal) {
        return;
      }

      setSelectedPlanningSelection(null);
      setPlanningDraft({
        lane,
        slot,
        title: buildDraftTitleForGoal(lane, selectedGoal),
        goalId: selectedGoal.id,
      });
    },
    [monthPlan, selectedGoal, todayAlignment, weekPlan],
  );

  const handleDropGoalToPlanningSlot = useCallback(
    (lane: "month" | "week", slot: PlanningSlot, goalId: string) => {
      const goal = activeGoals.find((item) => item.id === goalId);
      if (!goal) {
        return;
      }

      const laneItems = getPlanningItems(lane, weekPlan, monthPlan, todayAlignment);
      const existingItem = laneItems.find((item) => item.slot === slot) ?? null;
      const goalAlreadyInLane = laneItems.find((item) => item.goalId === goal.id) ?? null;

      if (selectedGoalId !== goal.id) {
        onSelectGoal(goal.id);
      }

      setIsFocusBoardOpen(true);
      setPlanningError(null);
      setPlanningDraft(null);
      setSelectedPlanningSelection(null);

      if (goalAlreadyInLane) {
        setPlanningReplaceState(null);
        setSelectedPlanningSelection({ lane, slot: goalAlreadyInLane.slot });
        return;
      }

      if (existingItem) {
        setPlanningReplaceState({ lane, slot, goalId: goal.id });
        return;
      }

      setPlanningReplaceState(null);
      setPlanningDraft({
        lane,
        slot,
        title: buildDraftTitleForGoal(lane, goal),
        goalId: goal.id,
      });
    },
    [activeGoals, monthPlan, onSelectGoal, selectedGoalId, todayAlignment, weekPlan],
  );

  const handleAddGoalToLane = useCallback(
    (lane: "month" | "week", goal: GoalOverviewItem | null) => {
      if (!goal) {
        return;
      }

      const items = getPlanningItems(lane, weekPlan, monthPlan, todayAlignment);
      const existingItem = items.find((item) => item.goalId === goal.id);
      if (existingItem) {
        setPlanningDraft(null);
        setPlanningReplaceState(null);
        setSelectedPlanningSelection({ lane, slot: existingItem.slot });
        setIsFocusBoardOpen(true);
        return;
      }

      const openSlot = findFirstOpenSlot(items.map((item) => item.slot as PlanningSlot));
      if (!openSlot) {
        setPlanningError(`All ${lane} slots are full. Select a slot to replace.`);
        setIsFocusBoardOpen(true);
        return;
      }

      if (selectedGoalId !== goal.id) {
        onSelectGoal(goal.id);
      }

      setSelectedPlanningSelection(null);
      setPlanningReplaceState(null);
      setPlanningDraft({
        lane,
        slot: openSlot,
        title: buildDraftTitleForGoal(lane, goal),
        goalId: goal.id,
      });
      setIsFocusBoardOpen(true);
      setFocusBoardScrollRequest((current) => current + 1);
    },
    [monthPlan, onSelectGoal, selectedGoalId, todayAlignment, weekPlan],
  );

  const handleAddSelectedGoalToLane = useCallback(
    (lane: "month" | "week") => {
      handleAddGoalToLane(lane, selectedGoal);
    },
    [handleAddGoalToLane, selectedGoal],
  );

  const handleAddGoalIdToLane = useCallback(
    (lane: "month" | "week", goalId: string) => {
      const goal = activeGoals.find((item) => item.id === goalId) ?? null;
      handleAddGoalToLane(lane, goal);
    },
    [activeGoals, handleAddGoalToLane],
  );

  const handlePlanningDraftChange = useCallback((updates: Partial<PlanningDraft>) => {
    setPlanningDraft((current) => (current ? { ...current, ...updates } : current));
  }, []);

  const handlePlanningDraftSave = useCallback(async () => {
    if (!planningDraft || !planningDraft.title.trim()) {
      return;
    }

    const currentItems: PlanningItem[] =
      planningDraft.lane === "month"
        ? monthPlan?.topOutcomes ?? []
        : weekPlan?.priorities ?? [];

    try {
      await commitLaneItems(planningDraft.lane, [
        ...currentItems.map((item) => ({
          id: item.id,
          slot: item.slot,
          title: item.title,
          goalId: item.goalId,
        })),
        {
          slot: planningDraft.slot,
          title: planningDraft.title.trim(),
          goalId: planningDraft.goalId || null,
        },
      ]);

      setSelectedPlanningSelection({
        lane: planningDraft.lane,
        slot: planningDraft.slot,
      });
      setPlanningDraft(null);
    } catch (error) {
      setPlanningError(error instanceof Error ? error.message : "Planning item could not be saved.");
    }
  }, [commitLaneItems, monthPlan?.topOutcomes, planningDraft, weekPlan?.priorities]);

  const handlePlanningDraftCancel = useCallback(() => {
    setPlanningDraft(null);
    setPlanningError(null);
  }, []);

  const handlePlanningReplaceCancel = useCallback(() => {
    setPlanningReplaceState(null);
    setPlanningError(null);
  }, []);

  const handlePlanningReplaceAction = useCallback(
    async (action: "replace" | "move") => {
      if (!planningReplaceState) {
        return;
      }

      const goal = activeGoals.find((item) => item.id === planningReplaceState.goalId);
      if (!goal) {
        return;
      }

      const currentItems: PlanningItem[] =
        planningReplaceState.lane === "month"
          ? monthPlan?.topOutcomes ?? []
          : weekPlan?.priorities ?? [];
      const targetItem = currentItems.find((item) => item.slot === planningReplaceState.slot) ?? null;
      const openSlot = findFirstOpenSlot(currentItems.map((item) => item.slot as PlanningSlot));
      const replacementTitle = buildDraftTitleForGoal(planningReplaceState.lane, goal);

      if (!targetItem) {
        setPlanningReplaceState(null);
        return;
      }

      try {
        if (action === "move" && openSlot) {
          await commitLaneItems(
            planningReplaceState.lane,
            sortPlanningItemsBySlot([
              ...currentItems
                .filter((item) => item.slot !== planningReplaceState.slot)
                .map((item) => ({
                  id: item.id,
                  slot: item.slot,
                  title: item.title,
                  goalId: item.goalId,
                })),
              {
                id: targetItem.id,
                slot: openSlot,
                title: targetItem.title,
                goalId: targetItem.goalId,
              },
              {
                slot: planningReplaceState.slot,
                title: replacementTitle,
                goalId: planningReplaceState.goalId,
              },
            ]),
          );
        } else {
          await commitLaneItems(
            planningReplaceState.lane,
            currentItems.map((item) => ({
              id: item.id,
              slot: item.slot,
              title: item.slot === planningReplaceState.slot ? replacementTitle : item.title,
              goalId: item.slot === planningReplaceState.slot ? planningReplaceState.goalId : item.goalId,
            })),
          );
        }

        setSelectedPlanningSelection({
          lane: planningReplaceState.lane,
          slot: planningReplaceState.slot,
        });
        setPlanningReplaceState(null);
      } catch (error) {
        setPlanningError(error instanceof Error ? error.message : "Planning item could not be replaced.");
      }
    },
    [activeGoals, commitLaneItems, monthPlan?.topOutcomes, planningReplaceState, weekPlan?.priorities],
  );

  const handleToggleGoalExpanded = useCallback((goalId: string) => {
    setExpandedGoalIds((current) => {
      const next = new Set(current);
      if (next.has(goalId)) {
        next.delete(goalId);
      } else {
        next.add(goalId);
      }
      return next;
    });
  }, []);

  const handleExpandAllGoals = useCallback(() => {
    setExpandedGoalIds(new Set(activeGoals.map((goal) => goal.id)));
    setGraphStructureError(null);
    setGraphStructureMessage("All branches expanded.");
  }, [activeGoals]);

  const handleCollapseAllGoals = useCallback(() => {
    setExpandedGoalIds(new Set(rootGoalIds));
    setGraphStructureError(null);
    setGraphStructureMessage("Showing top-level goals only.");
    setIsGraphFocusMode(false);
  }, [rootGoalIds]);

  const handleOpenGraphChildDraft = useCallback(
    (parentGoalId: string) => {
      const parentGoal = activeGoals.find((goal) => goal.id === parentGoalId);
      if (!parentGoal) {
        return;
      }

      setGraphStructureError(null);
      setGraphStructureMessage(null);
      setGraphChildDraft({
        parentGoalId,
        title: "",
        horizonId: suggestChildHorizon(parentGoal.horizonId, horizons) || null,
        domainId: parentGoal.domainId,
      });
      setExpandedGoalIds((current) => new Set(current).add(parentGoalId));
      window.setTimeout(() => {
        const input = document.querySelector<HTMLInputElement>(".graph-child-draft__input");
        input?.focus();
        input?.select();
      }, 60);

      if (selectedGoalId !== parentGoalId) {
        onSelectGoal(parentGoalId);
      }
    },
    [activeGoals, horizons, onSelectGoal, selectedGoalId],
  );

  const handleGraphChildDraftCancel = useCallback(() => {
    setGraphChildDraft(null);
    setGraphStructureError(null);
  }, []);

  const handleGraphChildDraftSave = useCallback(async (title: string) => {
    const trimmedTitle = title.trim();
    if (!graphChildDraft || !trimmedTitle) {
      return;
    }

    try {
      await createGoalMutation.mutateAsync({
        title: trimmedTitle,
        domainId: graphChildDraft.domainId,
        horizonId: graphChildDraft.horizonId || null,
        parentGoalId: graphChildDraft.parentGoalId,
      });
      setGraphChildDraft(null);
      setGraphStructureError(null);
      setGraphStructureMessage("Sub-goal created.");
      setExpandedGoalIds((current) => new Set(current).add(graphChildDraft.parentGoalId));
    } catch (error) {
      setGraphStructureError(error instanceof Error ? error.message : "Supporting goal could not be created.");
    }
  }, [createGoalMutation, graphChildDraft]);

  const handleDropGoalOnGoal = useCallback(
    async (targetGoalId: string, draggedGoalId: string) => {
      if (targetGoalId === draggedGoalId) {
        return;
      }

      const draggedGoal = activeGoals.find((goal) => goal.id === draggedGoalId);
      if (!draggedGoal) {
        return;
      }

      if (isGoalDescendant(activeGoals, draggedGoalId, targetGoalId)) {
        setGraphStructureError("A goal cannot be moved under one of its own descendants.");
        return;
      }

      if (draggedGoal.parentGoalId === targetGoalId) {
        return;
      }

      try {
        await updateGoalMutation.mutateAsync({
          goalId: draggedGoalId,
          parentGoalId: targetGoalId,
        });
        setGraphStructureError(null);
        setGraphStructureMessage(`Moved "${draggedGoal.title}" under this goal.`);
        setExpandedGoalIds((current) => new Set(current).add(targetGoalId));
      } catch (error) {
        setGraphStructureError(error instanceof Error ? error.message : "Goal hierarchy could not be updated.");
      }
    },
    [activeGoals, updateGoalMutation],
  );

  const handleDetachGoal = useCallback(
    async (goalId: string) => {
      const goal = activeGoals.find((item) => item.id === goalId);
      if (!goal || !goal.parentGoalId) {
        return;
      }

      try {
        await updateGoalMutation.mutateAsync({
          goalId,
          parentGoalId: null,
        });
        setGraphStructureError(null);
        setGraphStructureMessage(`"${goal.title}" is now top-level.`);
        setExpandedGoalIds((current) => new Set(current).add(goalId));
      } catch (error) {
        setGraphStructureError(error instanceof Error ? error.message : "Goal could not be detached.");
      }
    },
    [activeGoals, updateGoalMutation],
  );

  const handleDuplicateGoal = useCallback(
    async (goal: GoalOverviewItem) => {
      try {
        await createGoalMutation.mutateAsync({
          title: `${goal.title} copy`,
          domainId: goal.domainId,
          horizonId: goal.horizonId,
          parentGoalId: goal.parentGoalId,
          why: goal.why,
          targetDate: goal.targetDate,
          notes: goal.notes,
          engagementState: goal.engagementState,
          weeklyProofText: goal.weeklyProofText,
          knownObstacle: goal.knownObstacle,
          parkingRule: goal.parkingRule,
        });
        setGraphStructureError(null);
        setGraphStructureMessage(`Duplicated "${goal.title}".`);
        if (goal.parentGoalId) {
          setExpandedGoalIds((current) => new Set(current).add(goal.parentGoalId!));
        }
      } catch (error) {
        setGraphStructureError(error instanceof Error ? error.message : "Goal could not be duplicated.");
      }
    },
    [createGoalMutation],
  );

  const handleArchiveGoal = useCallback(
    async (goal: GoalOverviewItem) => {
      try {
        await updateGoalMutation.mutateAsync({
          goalId: goal.id,
          status: "archived",
        });
        setGraphStructureError(null);
        setGraphStructureMessage(`Archived "${goal.title}".`);
        if (selectedGoalId === goal.id) {
          onClearSelectedGoal();
        }
        if (inspectedGoalId === goal.id) {
          setInspectedGoalId(null);
        }
      } catch (error) {
        setGraphStructureError(error instanceof Error ? error.message : "Goal could not be archived.");
      }
    },
    [inspectedGoalId, onClearSelectedGoal, selectedGoalId, updateGoalMutation],
  );

  const handlePlanningItemSave = useCallback(
    async (updates: { title: string; goalId: string | null; slot: PlanningSlot }) => {
      if (!selectedPlanningSelection || !selectedPlanningItem || !updates.title.trim()) {
        return;
      }

      const currentItems: PlanningItem[] =
        selectedPlanningSelection.lane === "month"
          ? monthPlan?.topOutcomes ?? []
          : weekPlan?.priorities ?? [];

      try {
        await commitLaneItems(
          selectedPlanningSelection.lane,
          sortPlanningItemsBySlot([
            ...currentItems
              .filter((item) => item.slot !== selectedPlanningItem.slot)
              .map((item) => ({
                id: item.id,
                slot: item.slot,
                title: item.title,
                goalId: item.goalId,
              })),
            {
              id: selectedPlanningItem.id,
              slot: updates.slot,
              title: updates.title.trim(),
              goalId: updates.goalId,
            },
          ]),
        );

        setSelectedPlanningSelection({
          lane: selectedPlanningSelection.lane,
          slot: updates.slot,
        });
      } catch (error) {
        setPlanningError(error instanceof Error ? error.message : "Planning item could not be updated.");
      }
    },
    [commitLaneItems, monthPlan?.topOutcomes, selectedPlanningItem, selectedPlanningSelection, weekPlan?.priorities],
  );

  const handlePlanningItemRemove = useCallback(async () => {
    if (!selectedPlanningSelection || !selectedPlanningItem) {
      return;
    }

    const currentItems: PlanningItem[] =
      selectedPlanningSelection.lane === "month"
        ? monthPlan?.topOutcomes ?? []
        : weekPlan?.priorities ?? [];

    try {
      await commitLaneItems(
        selectedPlanningSelection.lane,
        currentItems
          .filter((item) => item.slot !== selectedPlanningItem.slot)
          .map((item) => ({
            id: item.id,
            slot: item.slot,
            title: item.title,
            goalId: item.goalId,
          })),
      );
      setSelectedPlanningSelection(null);
    } catch (error) {
      setPlanningError(error instanceof Error ? error.message : "Planning item could not be removed.");
    }
  }, [commitLaneItems, monthPlan?.topOutcomes, selectedPlanningItem, selectedPlanningSelection, weekPlan?.priorities]);

  const handleJumpToLinkedGoal = useCallback(
    (goalId: string) => {
      setSelectedPlanningSelection(null);
      setPlanningDraft(null);
      setPlanningReplaceState(null);
      setPlanningError(null);
      setGraphStructureError(null);

      if (selectedGoalId !== goalId) {
        onSelectGoal(goalId);
      }
    },
    [onSelectGoal, selectedGoalId],
  );

  const handleEnterGraphFocusMode = useCallback(() => {
    if (!selectedGoalId) {
      return;
    }
    setIsGraphFocusMode(true);
  }, [selectedGoalId]);

  const handleExitGraphFocusMode = useCallback(() => {
    setIsGraphFocusMode(false);
  }, []);

  const handleClearGraphSelection = useCallback(() => {
    clearPlanningUi();
    setGraphChildDraft(null);
    setGraphStructureError(null);
    setGraphStructureMessage(null);
    setInspectedGoalId(null);
    setIsGraphFocusMode(false);

    if (showChildForm) {
      onCancelChildForm();
    }

    onClearSelectedGoal();
  }, [clearPlanningUi, onCancelChildForm, onClearSelectedGoal, showChildForm]);

  const handleGraphPaneClear = useCallback(() => {
    setGraphStructureError(null);
    setGraphStructureMessage(null);

    if (showChildForm) {
      onCancelChildForm();
      return;
    }

    if (
      selectedGoalId ||
      inspectedGoalId ||
      selectedPlanningSelection ||
      planningDraft ||
      planningReplaceState ||
      graphChildDraft
    ) {
      clearPlanningUi();
      setGraphChildDraft(null);
      setInspectedGoalId(null);
      setIsGraphFocusMode(false);
      onClearSelectedGoal();
    }
  }, [
    clearPlanningUi,
    graphChildDraft,
    inspectedGoalId,
    onCancelChildForm,
    onClearSelectedGoal,
    planningDraft,
    planningReplaceState,
    selectedGoalId,
    selectedPlanningSelection,
    showChildForm,
  ]);

  const inspectorContent = showChildForm && childFormParent ? (
    <div className="ghq-inspector">
      <div className="ghq-inspector__header">
        <h2 className="ghq-inspector__title">Create sub-goal</h2>
      </div>
      <div className="ghq-inspector__body">
        <GoalFormDialog
          form={childForm}
          editing={false}
          isPending={createIsPending}
          domains={domains}
          horizons={horizons}
          parentGoal={childFormParent}
          onChangeForm={onChangeChildForm}
          onSubmit={onSubmitChildForm}
          onCancel={onCancelChildForm}
        />
      </div>
    </div>
  ) : inspectedGoalId ? (
    <PlanInspector
      goalId={inspectedGoalId}
      domains={domains}
      onSelectGoal={handleInspectGoal}
      onEditGoal={onEditGoal}
      onCreateChild={(goal) => {
        if (planView === "graph") {
          handleOpenGraphChildDraft(goal.id);
          return;
        }
        onStartCreateChild(goal);
      }}
      onOpenPlanning={handleOpenPlanningBoard}
    />
  ) : planView === "outline" ? (
    <div className="ghq-inspector ghq-inspector--empty">
      <div className="ghq-inspector__empty-state">
        <span className="ghq-inspector__empty-icon">◫</span>
        <h3>Select a goal</h3>
        <p>
          Choose a goal from the hierarchy to inspect its context, edit milestones, and decide whether it belongs in your month or week focus.
        </p>
      </div>
    </div>
  ) : null;

  const monthDockItems = getPlanningItems("month", weekPlan, monthPlan, todayAlignment).map((item) => ({
    id: item.id,
    slot: item.slot,
    title: item.title,
    goalId: item.goalId,
  }));
  const weekDockItems = getPlanningItems("week", weekPlan, monthPlan, todayAlignment).map((item) => ({
    id: item.id,
    slot: item.slot,
    title: item.title,
    goalId: item.goalId,
  }));
  const monthFocusGoalIds = useMemo(
    () => new Set(monthDockItems.flatMap((item) => (item.goalId ? [item.goalId] : []))),
    [monthDockItems],
  );
  const weekFocusGoalIds = useMemo(
    () => new Set(weekDockItems.flatMap((item) => (item.goalId ? [item.goalId] : []))),
    [weekDockItems],
  );

  return (
    <div className={`ghq-plan-container${isGraphExpanded ? " ghq-plan-container--graph-expanded" : ""}`}>
      <div className="ghq-plan-subview">
        <button
          className={`ghq-plan-subview__btn ghq-plan-subview__btn--graph${planView === "graph" ? " ghq-plan-subview__btn--active" : ""}`}
          type="button"
          onClick={() => setPlanView("graph")}
        >
          Graph
        </button>
        <button
          className={`ghq-plan-subview__btn${planView === "outline" ? " ghq-plan-subview__btn--active" : ""}`}
          type="button"
          onClick={() => {
            setPlanView("outline");
            setIsGraphExpanded(false);
          }}
        >
          Outline
        </button>
      </div>

      <div className={`ghq-plan${planView === "graph" ? " ghq-plan--graph" : ""}${isGraphExpanded ? " ghq-plan--graph-expanded" : ""}`}>
        {planView === "outline" ? (
          <>
            <div className="ghq-plan__rail">
              <div className="ghq-plan__rail-header">
                <h2 className="ghq-plan__rail-title">Goal hierarchy</h2>
                <button
                  className="button button--ghost button--small"
                  type="button"
                  onClick={onOpenCreateGoal}
                >
                  + New
                </button>
              </div>

              <HorizonRoadmap horizons={horizons} goals={goals} />

              {tree.length > 0 ? (
                <HierarchyRail
                  roots={tree}
                  horizons={horizons}
                  selectedGoalId={selectedGoalId}
                  onSelectGoal={handleOutlineSelectGoal}
                />
              ) : (
                <div className="ghq-plan__empty-tree">
                  <p>No active goals yet.</p>
                  <button
                    className="button button--primary button--small"
                    type="button"
                    onClick={onOpenCreateGoal}
                  >
                    Create your first goal
                  </button>
                </div>
              )}

              <div className="ghq-plan__rail-footer">
                <Link to="/settings#goal-domains" className="ghq-plan__settings-link">
                  Manage domains
                </Link>
                <Link to="/settings#planning-layers" className="ghq-plan__settings-link">
                  Manage planning layers
                </Link>
              </div>
            </div>

            <div className="ghq-plan__inspector">
              {inspectorContent}
            </div>
          </>
        ) : (
          <div className="ghq-plan__graph-layout">
            <div className={`ghq-plan__graph-stage${inspectedGoal && !isGraphExpanded ? " ghq-plan__graph-stage--with-inspector" : ""}`}>
              <div className={`ghq-plan__graph${isGraphExpanded ? " ghq-plan__graph--expanded" : ""}`}>
                <GoalsPlanGraphView
                  goals={goals}
                  horizons={horizons}
                  selectedGoalId={selectedGoalId}
                  expandedGoalIds={expandedGoalIds}
                  isFocusMode={isGraphFocusMode}
                  childDraft={graphChildDraft}
                  childDraftIsPending={createGoalMutation.isPending}
                  monthFocusGoalIds={monthFocusGoalIds}
                  weekFocusGoalIds={weekFocusGoalIds}
                  structureError={graphStructureError}
                  structureMessage={graphStructureMessage}
                  onSelectGoal={handleGraphSelectGoal}
                  onToggleExpanded={handleToggleGoalExpanded}
                  onExpandAll={handleExpandAllGoals}
                  onCollapseAll={handleCollapseAllGoals}
                  onOpenCreateGoal={onOpenCreateGoal}
                  onOpenAddChild={handleOpenGraphChildDraft}
                  onOpenDetails={handleInspectGoal}
                  onOpenPlanning={handleOpenPlanningBoard}
                  onEditGoal={onEditGoal}
                  onDetachGoal={handleDetachGoal}
                  onDuplicateGoal={(goal) => void handleDuplicateGoal(goal)}
                  onArchiveGoal={(goal) => void handleArchiveGoal(goal)}
                  onAddToLane={handleAddGoalIdToLane}
                  onDropGoalOnGoal={handleDropGoalOnGoal}
                  onSaveChildDraft={handleGraphChildDraftSave}
                  onCancelChildDraft={handleGraphChildDraftCancel}
                  onCanvasClear={handleGraphPaneClear}
                  isExpanded={isGraphExpanded}
                  onEnterFocusMode={handleEnterGraphFocusMode}
                  onExitFocusMode={handleExitGraphFocusMode}
                  onClearSelection={handleClearGraphSelection}
                  onToggleExpandedCanvas={() => setIsGraphExpanded((current) => !current)}
                />
              </div>

              {inspectedGoal && !isGraphExpanded ? (
                <aside
                  className="ghq-plan__inspector ghq-plan__inspector--graph"
                  aria-label="Goal details"
                >
                  {inspectorContent}
                </aside>
              ) : null}
            </div>

            {!isGraphExpanded ? (
              <div ref={focusBoardRef}>
                <GoalsPlanPlanningDock
                  selectedGoal={selectedGoal}
                  activeGoals={activeGoals}
                  monthItems={monthDockItems}
                  weekItems={weekDockItems}
                  weekPlan={weekPlan}
                  selectedPlanningSelection={selectedPlanningSelection}
                  selectedPlanningItem={selectedPlanningItem}
                  planningDraft={planningDraft}
                  planningReplaceState={planningReplaceState}
                  planningError={planningError}
                  isOpen={isFocusBoardOpen}
                  onToggleOpen={() => {
                    setIsFocusBoardOpen((current) => {
                      const next = !current;
                      if (next) {
                        setFocusBoardScrollRequest((request) => request + 1);
                      }
                      return next;
                    });
                  }}
                  onClose={() => {
                    setIsFocusBoardOpen(false);
                    clearPlanningUi();
                  }}
                  onAddSelectedGoal={handleAddSelectedGoalToLane}
                  onSelectSlot={handleSelectPlanningSlot}
                  onDropGoalToSlot={handleDropGoalToPlanningSlot}
                  onPlanningDraftChange={handlePlanningDraftChange}
                  onSavePlanningDraft={handlePlanningDraftSave}
                  onCancelPlanningDraft={handlePlanningDraftCancel}
                  onPlanningReplaceAction={handlePlanningReplaceAction}
                  onCancelPlanningReplace={handlePlanningReplaceCancel}
                  getDuplicateCount={(lane, goalId, excludeSlot) =>
                    getLaneDuplicateCount(lane, goalId, weekPlan, monthPlan, todayAlignment, excludeSlot)
                  }
                  getAvailableSlots={(lane, currentSlot) =>
                    planningSlots.filter((slot) => {
                      const itemAtSlot = getPlanningItemAtSlot(lane, slot, weekPlan, monthPlan, todayAlignment);
                      return !itemAtSlot || slot === currentSlot;
                    })
                  }
                  isLanePending={(lane) => getLanePending(lane)}
                  getLaneErrorMessage={(lane) => planningError ?? getLaneErrorMessage(lane)}
                  onSaveSelectedItem={handlePlanningItemSave}
                  onRemoveSelectedItem={handlePlanningItemRemove}
                  onJumpToGoal={handleJumpToLinkedGoal}
                />
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
