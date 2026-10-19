import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  formatShortDate,
  getMonthStartDate,
  getTodayDate,
  getWeekStartDate,
  useCreateGoalMutation,
  useGoalDetailQuery,
  useUpdateGoalMutation,
  useUpdateMonthFocusMutation,
  useUpdateWeekPrioritiesMutation,
} from "../../shared/lib/api";
import { EmptyState, InlineErrorState } from "../../shared/ui/PageState";
import { getGoalAncestorIds } from "./goal-graph-layout";
import { GoalInspectorMilestones } from "./GoalInspectorMilestones";
import {
  GoalFormDialog,
  suggestChildHorizon,
  type GoalFormData,
} from "./GoalFormDialog";
import {
  buildHierarchyTree,
  HierarchyRail,
} from "./GoalsHierarchyRail";
import { GoalsPlanCommitmentsRail, type RailLane } from "./GoalsPlanCommitmentsRail";
import { GoalsPlanGraphView, type CenterRequest } from "./GoalsPlanGraphView";
import { useGoalTodayAction } from "./useGoalTodayAction";
import {
  buildDraftTitleForGoal,
  getLaneDuplicateCount,
  getPlanningItemAtSlot,
  getPlanningItems,
  planningSlots,
  type PlanningItem,
  type PlanningDraft,
  type PlanningReplaceState,
  type PlanningSelection,
  type PlanningSlot,
} from "./GoalsPlanTypes";

/* ── Helpers ── */

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

function buildSlotMap(items: PlanningItem[]) {
  const slotByGoalId = new Map<string, number>();
  for (const item of sortPlanningItemsBySlot(items)) {
    if (item.goalId && !slotByGoalId.has(item.goalId)) {
      slotByGoalId.set(item.goalId, item.slot);
    }
  }
  return slotByGoalId;
}

/* The map's stage moves between its place on the page and document.body when
   full screen toggles. The portal target stays the same element, so React keeps
   the map mounted (viewport, filters and drafts survive) while the element
   escapes the shell's stacking contexts. */
function useMovableHost(isDetached: boolean) {
  const [host] = useState(() => {
    const element = document.createElement("div");
    element.className = "ghq-stage-host";
    return element;
  });
  const slotRef = useRef<HTMLDivElement | null>(null);
  const isDetachedRef = useRef(isDetached);
  isDetachedRef.current = isDetached;

  const attachSlot = useCallback(
    (node: HTMLDivElement | null) => {
      slotRef.current = node;
      if (node && !isDetachedRef.current && host.parentNode !== node) {
        node.appendChild(host);
      }
    },
    [host],
  );

  useLayoutEffect(() => {
    const target = isDetached ? document.body : slotRef.current;
    if (target && host.parentNode !== target) {
      // Moving a subtree drops focus inside it; put it back for keyboard users.
      const active = document.activeElement;
      const focusToRestore = active instanceof HTMLElement && host.contains(active) ? active : null;
      target.appendChild(host);
      focusToRestore?.focus({ preventScroll: true });
    }
  });

  useEffect(() => () => host.remove(), [host]);

  return { host, attachSlot };
}

/* ── Plan Inspector ── */

type PlanInspectorFocusGoal = Pick<GoalOverviewItem, "id" | "status" | "nextBestAction">;

function PlanInspectorTodayActions({
  goal,
  onLinkedToToday,
}: {
  goal: PlanInspectorFocusGoal;
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
  activeGoals,
  onClose,
  onSelectGoal,
  onEditGoal,
  onCreateChild,
  onAddToLane,
  onReparent,
}: {
  goalId: string;
  domains: GoalDomainItem[];
  activeGoals: GoalOverviewItem[];
  onClose: () => void;
  onSelectGoal: (goalId: string) => void;
  onEditGoal: (goal: GoalOverviewItem) => void;
  onCreateChild: (parentGoal: GoalOverviewItem) => void;
  onAddToLane: (lane: RailLane, goalId: string) => void;
  onReparent: (goalId: string, parentGoalId: string | null) => void;
}) {
  const detailQuery = useGoalDetailQuery(goalId);
  const parentOptions = useMemo(
    () =>
      activeGoals
        .filter((candidate) => candidate.id !== goalId && !isGoalDescendant(activeGoals, goalId, candidate.id))
        .sort((left, right) => left.title.localeCompare(right.title)),
    [activeGoals, goalId],
  );

  const closeButton = (
    <button className="ghq-inspector__close" type="button" onClick={onClose} aria-label="Close details" title="Close (Esc)">
      ×
    </button>
  );

  if (detailQuery.isLoading) {
    return (
      <div className="ghq-inspector">
        <div className="ghq-inspector__loading">Loading goal details…</div>
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="ghq-inspector">
        <div className="ghq-inspector__header ghq-inspector__header--bare">{closeButton}</div>
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
      <div className="ghq-inspector__header">
        <div className="ghq-inspector__title-row">
          <div className="ghq-inspector__title-block">
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
          </div>
          {closeButton}
        </div>

        <div className="ghq-inspector__meta">
          {domain && (
            <span className="ghq-inspector__domain">
              <span className={`ghq-domain-dot ghq-domain-dot--${domain.systemKey ?? "other"}`} aria-hidden="true" />
              {domain.name}
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

        {goal.milestoneCounts.total > 0 && (
          <div className="goal-progress ghq-inspector__progress">
            <div className="goal-progress__bar">
              <div
                className={`goal-progress__fill goal-progress__fill--${healthState}`}
                style={{ width: `${Math.min(goal.progressPercent, 100)}%` }}
              />
            </div>
            <span className="goal-progress__label">{goal.progressPercent}%</span>
          </div>
        )}

        <div className="ghq-inspector__header-actions">
          <button className="button button--ghost button--small" type="button" onClick={() => onEditGoal(goal)}>
            Edit goal
          </button>
          <button className="button button--ghost button--small" type="button" onClick={() => onCreateChild(goal)}>
            Add sub-goal
          </button>
        </div>
      </div>

      <div className="ghq-inspector__body">
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
              {goal.currentMonthOutcomes.length > 0 ? (
                <strong className="ghq-inspector__slot">
                  {goal.currentMonthOutcomes.map((item) => `M${item.slot}`).join(", ")}
                </strong>
              ) : (
                <button className="ghq-rail__text-btn" type="button" onClick={() => onAddToLane("month", goal.id)}>
                  Add to month
                </button>
              )}
            </div>
            <div className="ghq-inspector__focus-row">
              <span>Week</span>
              {goal.currentWeekPriorities.length > 0 ? (
                <strong className="ghq-inspector__slot">
                  {goal.currentWeekPriorities.map((item) => `W${item.slot}`).join(", ")}
                </strong>
              ) : (
                <button className="ghq-rail__text-btn" type="button" onClick={() => onAddToLane("week", goal.id)}>
                  Add to week
                </button>
              )}
            </div>
            <div className="ghq-inspector__focus-row">
              <span>Today</span>
              <strong>
                {goal.linkedSummary.currentDayPriorities > 0 ? "In today's priorities" : "Not in today yet"}
              </strong>
            </div>
          </div>
          <PlanInspectorTodayActions goal={goal} onLinkedToToday={() => detailQuery.refetch()} />
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
            <h3 className="ghq-inspector__section-title">Sub-goals</h3>
            <div className="ghq-inspector__children">
              {goal.children.map((child) => (
                <button
                  key={child.id}
                  className="ghq-inspector__child-row"
                  type="button"
                  onClick={() => onSelectGoal(child.id)}
                >
                  <span>{child.title}</span>
                  {child.horizonName && (
                    <span className="ghq-tree-node__horizon">{child.horizonName}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="ghq-inspector__section">
          <span className="ghq-inspector__section-title">Part of</span>
          <select
            className="ghq-planning-form__select"
            value={goal.parentGoalId ?? ""}
            onChange={(event) => onReparent(goal.id, event.target.value || null)}
          >
            <option value="">Nothing (top-level goal)</option>
            {parentOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title}
              </option>
            ))}
          </select>
        </label>

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [inspectedGoalId, setInspectedGoalId] = useState<string | null>(null);
  const [expandedGoalIds, setExpandedGoalIds] = useState<Set<string>>(new Set());
  const expandInitializedRef = useRef(false);
  const [centerRequest, setCenterRequest] = useState<CenterRequest | null>(null);
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
  const { host: stageHost, attachSlot: attachStageSlot } = useMovableHost(isFullscreen && planView === "graph");

  const activeGoals = useMemo(
    () => goals.filter((goal) => goal.status === "active"),
    [goals],
  );
  const tree = useMemo(() => buildHierarchyTree(activeGoals), [activeGoals]);
  const selectedGoal = useMemo(
    () => (selectedGoalId ? goals.find((goal) => goal.id === selectedGoalId) ?? null : null),
    [goals, selectedGoalId],
  );
  const todayDate = todayAlignment.date || getTodayDate();
  const weekStart = weekPlan?.startDate ?? getWeekStartDate(todayDate);
  const monthStart = monthPlan?.startDate ?? getMonthStartDate(todayDate);
  const monthLabel = new Date(`${monthStart}T12:00:00`).toLocaleDateString(undefined, { month: "long" });
  const weekLabel = `Week of ${formatShortDate(weekStart)}`;

  const updateWeekMutation = useUpdateWeekPrioritiesMutation(weekStart);
  const updateMonthMutation = useUpdateMonthFocusMutation(monthStart);
  const updateGoalMutation = useUpdateGoalMutation();
  const createGoalMutation = useCreateGoalMutation();

  const monthItems = useMemo(
    () => getPlanningItems("month", weekPlan, monthPlan, todayAlignment),
    [monthPlan, todayAlignment, weekPlan],
  );
  const weekItems = useMemo(
    () => getPlanningItems("week", weekPlan, monthPlan, todayAlignment),
    [monthPlan, todayAlignment, weekPlan],
  );
  const monthSlotByGoalId = useMemo(() => buildSlotMap(monthItems), [monthItems]);
  const weekSlotByGoalId = useMemo(() => buildSlotMap(weekItems), [weekItems]);

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
      setIsFullscreen(false);
      setCenterRequest(null);
    }
  }, [planView]);

  // Open every branch the first time goals arrive, so each planning layer shows
  // what it holds; afterwards only drop ids that no longer exist.
  useEffect(() => {
    const validGoalIds = new Set(activeGoals.map((goal) => goal.id));
    if (inspectedGoalId && !validGoalIds.has(inspectedGoalId)) {
      setInspectedGoalId(null);
    }

    if (!expandInitializedRef.current && activeGoals.length > 0) {
      expandInitializedRef.current = true;
      setExpandedGoalIds(new Set(validGoalIds));
      return;
    }

    setExpandedGoalIds((current) => {
      const next = new Set([...current].filter((goalId) => validGoalIds.has(goalId)));
      return next.size === current.size ? current : next;
    });
  }, [activeGoals, inspectedGoalId]);

  useEffect(() => {
    setGraphChildDraft((current) => {
      if (!current) {
        return current;
      }
      return activeGoals.some((goal) => goal.id === current.parentGoalId) ? current : null;
    });
  }, [activeGoals]);

  useEffect(() => {
    if (selectedPlanningSelection && !selectedPlanningItem) {
      setSelectedPlanningSelection(null);
    }
  }, [selectedPlanningItem, selectedPlanningSelection]);

  useEffect(() => {
    if (!graphStructureMessage) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => setGraphStructureMessage(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [graphStructureMessage]);

  useEffect(() => {
    if (!isFullscreen) {
      return undefined;
    }

    document.body.classList.add("ghq-fullscreen-body");
    return () => {
      document.body.classList.remove("ghq-fullscreen-body");
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => undefined);
      }
    };
  }, [isFullscreen]);

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((current) => !current);
  }, []);

  const handleRequestCenter = useCallback((goalId: string) => {
    setCenterRequest({ goalId, nonce: Date.now() });
  }, []);

  const handleRevealGoal = useCallback(
    (goalId: string) => {
      const ancestorIds = getGoalAncestorIds(activeGoals, goalId);
      if (ancestorIds.length === 0) {
        return;
      }
      setExpandedGoalIds((current) => {
        if (ancestorIds.every((ancestorId) => current.has(ancestorId))) {
          return current;
        }
        return new Set([...current, ...ancestorIds]);
      });
    },
    [activeGoals],
  );

  const getLanePending = useCallback(
    (lane: RailLane) => (lane === "month" ? updateMonthMutation.isPending : updateWeekMutation.isPending),
    [updateMonthMutation.isPending, updateWeekMutation.isPending],
  );

  const getLaneErrorMessage = useCallback(
    (lane: RailLane) => {
      const error = lane === "month" ? updateMonthMutation.error : updateWeekMutation.error;
      return planningError ?? (error instanceof Error ? error.message : null);
    },
    [planningError, updateMonthMutation.error, updateWeekMutation.error],
  );

  const commitLaneItems = useCallback(
    async (
      lane: RailLane,
      items: Array<{
        id?: string;
        slot: PlanningSlot;
        title: string;
        goalId: string | null;
      }>,
    ) => {
      setPlanningError(null);
      const payload = sortPlanningItemsBySlot(items).map((item) => ({
        id: item.id,
        slot: item.slot,
        title: item.title.trim(),
        goalId: item.goalId,
      }));

      if (lane === "month") {
        await updateMonthMutation.mutateAsync({
          theme: monthPlan?.theme ?? null,
          topOutcomes: payload,
        });
        return;
      }

      await updateWeekMutation.mutateAsync({ priorities: payload });
    },
    [monthPlan?.theme, updateMonthMutation, updateWeekMutation],
  );

  const laneItems = useCallback(
    (lane: RailLane): PlanningItem[] => (lane === "month" ? monthItems : weekItems),
    [monthItems, weekItems],
  );

  const handleGraphSelectGoal = useCallback(
    (goalId: string) => {
      clearPlanningUi();
      setGraphStructureError(null);
      // An open details panel follows the selection.
      setInspectedGoalId((current) => (current ? goalId : current));
      if (goalId !== selectedGoalId) {
        onSelectGoal(goalId);
      }
    },
    [clearPlanningUi, onSelectGoal, selectedGoalId],
  );

  const handleInspectGoal = useCallback(
    (goalId: string) => {
      clearPlanningUi();
      setGraphStructureError(null);
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

  const handleSelectPlanningSlot = useCallback(
    (lane: RailLane, slot: PlanningSlot) => {
      setPlanningError(null);

      const items = laneItems(lane);
      const existingItem = items.find((item) => item.slot === slot) ?? null;

      if (existingItem) {
        setPlanningDraft(null);
        const selectedGoalAlreadyInLane = selectedGoal
          ? items.some((item) => item.goalId === selectedGoal.id)
          : false;
        const openSlot = findFirstOpenSlot(items.map((item) => item.slot));

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

      const goalForDraft = selectedGoal && !items.some((item) => item.goalId === selectedGoal.id)
        ? selectedGoal
        : null;

      setSelectedPlanningSelection(null);
      setPlanningReplaceState(null);
      setPlanningDraft({
        lane,
        slot,
        title: buildDraftTitleForGoal(lane, goalForDraft),
        goalId: goalForDraft?.id ?? "",
      });
    },
    [laneItems, selectedGoal],
  );

  const handleDropGoalToPlanningSlot = useCallback(
    (lane: RailLane, slot: PlanningSlot, goalId: string) => {
      const goal = activeGoals.find((item) => item.id === goalId);
      if (!goal) {
        return;
      }

      const items = laneItems(lane);
      const existingItem = items.find((item) => item.slot === slot) ?? null;
      const goalAlreadyInLane = items.find((item) => item.goalId === goal.id) ?? null;

      if (selectedGoalId !== goal.id) {
        onSelectGoal(goal.id);
      }

      setPlanningError(null);
      setPlanningDraft(null);
      setSelectedPlanningSelection(null);
      setPlanningReplaceState(null);

      if (goalAlreadyInLane) {
        setSelectedPlanningSelection({ lane, slot: goalAlreadyInLane.slot });
        return;
      }

      if (existingItem) {
        setPlanningReplaceState({ lane, slot, goalId: goal.id });
        return;
      }

      setPlanningDraft({
        lane,
        slot,
        title: buildDraftTitleForGoal(lane, goal),
        goalId: goal.id,
      });
    },
    [activeGoals, laneItems, onSelectGoal, selectedGoalId],
  );

  const handleAddGoalToLane = useCallback(
    (lane: RailLane, goalId: string) => {
      const goal = activeGoals.find((item) => item.id === goalId);
      if (!goal) {
        return;
      }

      // The rail shares the side column with details, so planning closes details.
      setInspectedGoalId(null);
      setPlanView("graph");
      setPlanningDraft(null);
      setPlanningReplaceState(null);
      setSelectedPlanningSelection(null);
      setPlanningError(null);

      if (selectedGoalId !== goal.id) {
        onSelectGoal(goal.id);
      }

      const items = laneItems(lane);
      const existingItem = items.find((item) => item.goalId === goal.id);
      if (existingItem) {
        setSelectedPlanningSelection({ lane, slot: existingItem.slot });
        return;
      }

      const openSlot = findFirstOpenSlot(items.map((item) => item.slot));
      if (!openSlot) {
        setPlanningError(`This ${lane} already has three. Pick one to replace with “${goal.title}”.`);
        return;
      }

      setPlanningDraft({
        lane,
        slot: openSlot,
        title: buildDraftTitleForGoal(lane, goal),
        goalId: goal.id,
      });
    },
    [activeGoals, laneItems, onSelectGoal, selectedGoalId],
  );

  const handlePlanningDraftChange = useCallback((updates: Partial<PlanningDraft>) => {
    setPlanningDraft((current) => (current ? { ...current, ...updates } : current));
  }, []);

  const handlePlanningDraftSave = useCallback(async () => {
    if (!planningDraft || !planningDraft.title.trim() || planningDraft.lane === "today") {
      return;
    }

    const lane = planningDraft.lane;

    try {
      await commitLaneItems(lane, [
        ...laneItems(lane).map((item) => ({
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

      setPlanningDraft(null);
    } catch (error) {
      setPlanningError(error instanceof Error ? error.message : "Planning item could not be saved.");
    }
  }, [commitLaneItems, laneItems, planningDraft]);

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
      if (!planningReplaceState || planningReplaceState.lane === "today") {
        return;
      }

      const lane = planningReplaceState.lane;
      const goal = activeGoals.find((item) => item.id === planningReplaceState.goalId);
      if (!goal) {
        return;
      }

      const currentItems = laneItems(lane);
      const targetItem = currentItems.find((item) => item.slot === planningReplaceState.slot) ?? null;
      const openSlot = findFirstOpenSlot(currentItems.map((item) => item.slot));
      const replacementTitle = buildDraftTitleForGoal(lane, goal);

      if (!targetItem) {
        setPlanningReplaceState(null);
        return;
      }

      try {
        if (action === "move" && openSlot) {
          await commitLaneItems(lane, [
            ...currentItems
              .filter((item) => item.slot !== planningReplaceState.slot)
              .map((item) => ({ id: item.id, slot: item.slot, title: item.title, goalId: item.goalId })),
            { id: targetItem.id, slot: openSlot, title: targetItem.title, goalId: targetItem.goalId },
            { slot: planningReplaceState.slot, title: replacementTitle, goalId: planningReplaceState.goalId },
          ]);
        } else {
          await commitLaneItems(
            lane,
            currentItems.map((item) => ({
              id: item.id,
              slot: item.slot,
              title: item.slot === planningReplaceState.slot ? replacementTitle : item.title,
              goalId: item.slot === planningReplaceState.slot ? planningReplaceState.goalId : item.goalId,
            })),
          );
        }

        setPlanningReplaceState(null);
      } catch (error) {
        setPlanningError(error instanceof Error ? error.message : "Planning item could not be replaced.");
      }
    },
    [activeGoals, commitLaneItems, laneItems, planningReplaceState],
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
  }, [activeGoals]);

  const handleCollapseAllGoals = useCallback(() => {
    setExpandedGoalIds(new Set());
  }, []);

  const handleOpenGraphChildDraft = useCallback(
    (parentGoalId: string) => {
      const parentGoal = activeGoals.find((goal) => goal.id === parentGoalId);
      if (!parentGoal) {
        return;
      }

      setGraphStructureError(null);
      setGraphChildDraft({
        parentGoalId,
        title: "",
        horizonId: suggestChildHorizon(parentGoal.horizonId, horizons) || null,
        domainId: parentGoal.domainId,
      });
      setExpandedGoalIds((current) => (current.has(parentGoalId) ? current : new Set(current).add(parentGoalId)));

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
      setGraphStructureError(error instanceof Error ? error.message : "Sub-goal could not be created.");
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
        setGraphStructureError("A goal can't move under one of its own sub-goals.");
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
        setGraphStructureMessage(`Moved “${draggedGoal.title}”.`);
        setExpandedGoalIds((current) => new Set(current).add(targetGoalId));
      } catch (error) {
        setGraphStructureError(error instanceof Error ? error.message : "Goal could not be moved.");
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
        setGraphStructureMessage(`“${goal.title}” is now top-level.`);
      } catch (error) {
        setGraphStructureError(error instanceof Error ? error.message : "Goal could not be detached.");
      }
    },
    [activeGoals, updateGoalMutation],
  );

  const handleReparentGoal = useCallback(
    (goalId: string, parentGoalId: string | null) => {
      const goal = activeGoals.find((item) => item.id === goalId);
      if (!goal || goal.parentGoalId === parentGoalId) {
        return;
      }

      if (!parentGoalId) {
        void handleDetachGoal(goalId);
        return;
      }

      void handleDropGoalOnGoal(parentGoalId, goalId);
    },
    [activeGoals, handleDetachGoal, handleDropGoalOnGoal],
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
        setGraphStructureMessage(`Duplicated “${goal.title}”.`);
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
        setGraphStructureMessage(`Archived “${goal.title}”.`);
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
      if (
        !selectedPlanningSelection
        || !selectedPlanningItem
        || !updates.title.trim()
        || selectedPlanningSelection.lane === "today"
      ) {
        return;
      }

      const lane = selectedPlanningSelection.lane;

      try {
        await commitLaneItems(lane, [
          ...laneItems(lane)
            .filter((item) => item.slot !== selectedPlanningItem.slot)
            .map((item) => ({ id: item.id, slot: item.slot, title: item.title, goalId: item.goalId })),
          {
            id: selectedPlanningItem.id,
            slot: updates.slot,
            title: updates.title.trim(),
            goalId: updates.goalId,
          },
        ]);

        setSelectedPlanningSelection(null);
      } catch (error) {
        setPlanningError(error instanceof Error ? error.message : "Planning item could not be updated.");
      }
    },
    [commitLaneItems, laneItems, selectedPlanningItem, selectedPlanningSelection],
  );

  const handlePlanningItemRemove = useCallback(async () => {
    if (!selectedPlanningSelection || !selectedPlanningItem || selectedPlanningSelection.lane === "today") {
      return;
    }

    const lane = selectedPlanningSelection.lane;

    try {
      await commitLaneItems(
        lane,
        laneItems(lane)
          .filter((item) => item.slot !== selectedPlanningItem.slot)
          .map((item) => ({ id: item.id, slot: item.slot, title: item.title, goalId: item.goalId })),
      );
      setSelectedPlanningSelection(null);
    } catch (error) {
      setPlanningError(error instanceof Error ? error.message : "Planning item could not be removed.");
    }
  }, [commitLaneItems, laneItems, selectedPlanningItem, selectedPlanningSelection]);

  const handleJumpToLinkedGoal = useCallback(
    (goalId: string) => {
      clearPlanningUi();
      setGraphStructureError(null);
      handleRevealGoal(goalId);
      handleRequestCenter(goalId);

      if (selectedGoalId !== goalId) {
        onSelectGoal(goalId);
      }
    },
    [clearPlanningUi, handleRequestCenter, handleRevealGoal, onSelectGoal, selectedGoalId],
  );

  const handleClearSelection = useCallback(() => {
    clearPlanningUi();
    setGraphChildDraft(null);
    setGraphStructureError(null);
    setInspectedGoalId(null);

    if (showChildForm) {
      onCancelChildForm();
    }

    onClearSelectedGoal();
  }, [clearPlanningUi, onCancelChildForm, onClearSelectedGoal, showChildForm]);

  const handleGraphPaneClear = useCallback(() => {
    setGraphStructureError(null);

    if (showChildForm) {
      onCancelChildForm();
      return;
    }

    if (
      selectedGoalId
      || inspectedGoalId
      || selectedPlanningSelection
      || planningDraft
      || planningReplaceState
      || graphChildDraft
    ) {
      handleClearSelection();
    }
  }, [
    graphChildDraft,
    handleClearSelection,
    inspectedGoalId,
    onCancelChildForm,
    planningDraft,
    planningReplaceState,
    selectedGoalId,
    selectedPlanningSelection,
    showChildForm,
  ]);

  // Esc peels one layer at a time: an open edit, then details, then the
  // selection, then full screen.
  const escapeRef = useRef<() => void>(() => undefined);
  escapeRef.current = () => {
    if (planningDraft || planningReplaceState || selectedPlanningSelection) {
      clearPlanningUi();
      return;
    }
    if (graphChildDraft) {
      setGraphChildDraft(null);
      return;
    }
    if (inspectedGoalId) {
      setInspectedGoalId(null);
      return;
    }
    if (selectedGoalId) {
      handleClearSelection();
      return;
    }
    if (isFullscreen) {
      setIsFullscreen(false);
    }
  };
  const handleEscape = useCallback(() => escapeRef.current(), []);

  const handleInspectorCreateChild = useCallback(
    (goal: GoalOverviewItem) => {
      if (planView === "graph") {
        handleOpenGraphChildDraft(goal.id);
        return;
      }
      onStartCreateChild(goal);
    },
    [handleOpenGraphChildDraft, onStartCreateChild, planView],
  );

  const renderInspector = (goalId: string, onClose: () => void) => (
    <PlanInspector
      goalId={goalId}
      domains={domains}
      activeGoals={activeGoals}
      onClose={onClose}
      onSelectGoal={handleInspectGoal}
      onEditGoal={onEditGoal}
      onCreateChild={handleInspectorCreateChild}
      onAddToLane={handleAddGoalToLane}
      onReparent={handleReparentGoal}
    />
  );

  const viewSwitch = (
    <div className="ghq-plan-subview" role="group" aria-label="Plan view">
      <button
        className={`ghq-plan-subview__btn${planView === "graph" ? " ghq-plan-subview__btn--active" : ""}`}
        type="button"
        aria-pressed={planView === "graph"}
        onClick={() => setPlanView("graph")}
      >
        Map
      </button>
      <button
        className={`ghq-plan-subview__btn${planView === "outline" ? " ghq-plan-subview__btn--active" : ""}`}
        type="button"
        aria-pressed={planView === "outline"}
        onClick={() => setPlanView("outline")}
      >
        Outline
      </button>
    </div>
  );

  if (planView === "outline") {
    // The outline always shows the selected goal; closing it clears the selection.
    const outlineGoalId = inspectedGoalId ?? selectedGoalId;
    const outlineInspector = showChildForm && childFormParent ? (
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
    ) : outlineGoalId ? (
      renderInspector(outlineGoalId, handleClearSelection)
    ) : (
      <div className="ghq-inspector ghq-inspector--empty">
        <EmptyState
          title="Select a goal"
          description="Choose a goal from the hierarchy to see its context, edit milestones, and decide whether it belongs in your month or week focus."
        />
      </div>
    );

    return (
      <div className="ghq-plan-container">
        {viewSwitch}
        <div className="ghq-plan">
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
            {outlineInspector}
          </div>
        </div>
      </div>
    );
  }

  const stage = (
    <div
      className={`ghq-stage${isFullscreen ? " ghq-stage--fullscreen" : ""}`}
      role="region"
      aria-label={isFullscreen ? "Goal map, full screen" : "Goal map"}
    >
      <GoalsPlanGraphView
        goals={goals}
        horizons={horizons}
        selectedGoalId={selectedGoalId}
        expandedGoalIds={expandedGoalIds}
        childDraft={graphChildDraft}
        childDraftIsPending={createGoalMutation.isPending}
        monthSlotByGoalId={monthSlotByGoalId}
        weekSlotByGoalId={weekSlotByGoalId}
        structureError={graphStructureError}
        structureMessage={graphStructureMessage}
        isFullscreen={isFullscreen}
        centerRequest={centerRequest}
        viewSwitch={viewSwitch}
        onSelectGoal={handleGraphSelectGoal}
        onToggleExpanded={handleToggleGoalExpanded}
        onExpandAll={handleExpandAllGoals}
        onCollapseAll={handleCollapseAllGoals}
        onOpenCreateGoal={onOpenCreateGoal}
        onOpenAddChild={handleOpenGraphChildDraft}
        onOpenDetails={handleInspectGoal}
        onEditGoal={onEditGoal}
        onDetachGoal={handleDetachGoal}
        onDuplicateGoal={handleDuplicateGoal}
        onArchiveGoal={handleArchiveGoal}
        onAddToLane={handleAddGoalToLane}
        onDropGoalOnGoal={handleDropGoalOnGoal}
        onSaveChildDraft={handleGraphChildDraftSave}
        onCancelChildDraft={handleGraphChildDraftCancel}
        onCanvasClear={handleGraphPaneClear}
        onRevealGoal={handleRevealGoal}
        onRequestCenter={handleRequestCenter}
        onEscape={handleEscape}
        onToggleFullscreen={handleToggleFullscreen}
      />
      <aside
        className="ghq-stage__side"
        aria-label={inspectedGoalId ? "Goal details" : "Month and week focus"}
      >
        {inspectedGoalId ? (
          renderInspector(inspectedGoalId, () => setInspectedGoalId(null))
        ) : (
          <GoalsPlanCommitmentsRail
            selectedGoal={selectedGoal}
            activeGoals={activeGoals}
            monthLabel={monthLabel}
            weekLabel={weekLabel}
            monthItems={monthItems}
            weekItems={weekItems}
            weekPlan={weekPlan}
            selectedPlanningSelection={selectedPlanningSelection}
            selectedPlanningItem={selectedPlanningItem}
            planningDraft={planningDraft}
            planningReplaceState={planningReplaceState}
            planningError={planningError}
            onSelectSlot={handleSelectPlanningSlot}
            onDropGoalToSlot={handleDropGoalToPlanningSlot}
            onPlanningDraftChange={handlePlanningDraftChange}
            onSavePlanningDraft={() => void handlePlanningDraftSave()}
            onCancelPlanningDraft={handlePlanningDraftCancel}
            onPlanningReplaceAction={(action) => void handlePlanningReplaceAction(action)}
            onCancelPlanningReplace={handlePlanningReplaceCancel}
            getAvailableSlots={(lane, currentSlot) =>
              planningSlots.filter((slot) => {
                const itemAtSlot = getPlanningItemAtSlot(lane, slot, weekPlan, monthPlan, todayAlignment);
                return !itemAtSlot || slot === currentSlot;
              })
            }
            getDuplicateCount={(lane, goalId, excludeSlot) =>
              getLaneDuplicateCount(lane, goalId, weekPlan, monthPlan, todayAlignment, excludeSlot)
            }
            isLanePending={getLanePending}
            getLaneErrorMessage={getLaneErrorMessage}
            onSaveSelectedItem={handlePlanningItemSave}
            onRemoveSelectedItem={handlePlanningItemRemove}
            onCloseSelectedItem={() => setSelectedPlanningSelection(null)}
            onJumpToGoal={handleJumpToLinkedGoal}
          />
        )}
      </aside>
    </div>
  );

  return (
    <div className="ghq-plan-container">
      <div className="ghq-stage-slot" ref={attachStageSlot} />
      {createPortal(stage, stageHost)}
    </div>
  );
}
