import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import type {
  GoalDomainItem,
  GoalHorizonItem,
  GoalOverviewItem,
  GoalDetailItem,
  GoalHierarchySummary,
  MonthPlanResponse,
  WeekPlanResponse,
} from "../../shared/lib/api";
import {
  useGoalDetailQuery,
} from "../../shared/lib/api";
import { InlineErrorState } from "../../shared/ui/PageState";
import { GoalInspectorMilestones } from "./GoalInspectorMilestones";
import { useGoalTodayAction } from "./useGoalTodayAction";
import {
  GoalFormDialog,
  type GoalFormData,
} from "./GoalFormDialog";
import { GoalsPlanGraphView } from "./GoalsPlanGraphView";

/* ── Helpers ── */

const domainEmojis: Record<string, string> = {
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

type HierarchyNode = GoalOverviewItem & {
  childNodes: HierarchyNode[];
};

function buildHierarchyTree(goals: GoalOverviewItem[]): HierarchyNode[] {
  const nodeMap = new Map<string, HierarchyNode>();
  const roots: HierarchyNode[] = [];

  for (const goal of goals) {
    nodeMap.set(goal.id, { ...goal, childNodes: [] });
  }

  for (const goal of goals) {
    const node = nodeMap.get(goal.id)!;
    if (goal.parentGoalId && nodeMap.has(goal.parentGoalId)) {
      nodeMap.get(goal.parentGoalId)!.childNodes.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function sortByHorizon(goals: HierarchyNode[], horizons: GoalHorizonItem[]): HierarchyNode[] {
  const horizonOrder = new Map(horizons.map((h, i) => [h.id, i]));
  return [...goals].sort((a, b) => {
    const aOrder = a.horizonId ? (horizonOrder.get(a.horizonId) ?? 999) : 999;
    const bOrder = b.horizonId ? (horizonOrder.get(b.horizonId) ?? 999) : 999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.sortOrder - b.sortOrder;
  });
}

/* ── Hierarchy Rail ── */

function HierarchyRail({
  roots,
  horizons,
  selectedGoalId,
  onSelectGoal,
  depth = 0,
}: {
  roots: HierarchyNode[];
  horizons: GoalHorizonItem[];
  selectedGoalId: string | null;
  onSelectGoal: (goalId: string) => void;
  depth?: number;
}) {
  const sorted = sortByHorizon(roots, horizons);

  return (
    <div className={`ghq-tree${depth === 0 ? " ghq-tree--root" : ""}`}>
      {sorted.map((node) => (
        <HierarchyNodeRow
          key={node.id}
          node={node}
          horizons={horizons}
          selectedGoalId={selectedGoalId}
          onSelectGoal={onSelectGoal}
          depth={depth}
        />
      ))}
    </div>
  );
}

function HierarchyNodeRow({
  node,
  horizons,
  selectedGoalId,
  onSelectGoal,
  depth,
}: {
  node: HierarchyNode;
  horizons: GoalHorizonItem[];
  selectedGoalId: string | null;
  onSelectGoal: (goalId: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const isSelected = selectedGoalId === node.id;
  const hasChildren = node.childNodes.length > 0;
  const healthState = node.health ?? "on_track";

  return (
    <div className="ghq-tree-node">
      <div
        className={`ghq-tree-node__row${isSelected ? " ghq-tree-node__row--selected" : ""}`}
        style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
      >
        {hasChildren ? (
          <button
            className="ghq-tree-node__toggle"
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="ghq-tree-node__spacer" />
        )}
        <button
          className="ghq-tree-node__btn"
          type="button"
          onClick={() => onSelectGoal(node.id)}
        >
          <span className={`ghq-tree-node__health ghq-tree-node__health--${healthState}`} />
          <span className="ghq-tree-node__title">{node.title}</span>
          {node.horizonName && (
            <span className="ghq-tree-node__horizon">{node.horizonName}</span>
          )}
        </button>
      </div>
      {hasChildren && expanded && (
        <HierarchyRail
          roots={node.childNodes}
          horizons={horizons}
          selectedGoalId={selectedGoalId}
          onSelectGoal={onSelectGoal}
          depth={depth + 1}
        />
      )}
    </div>
  );
}

/* ── Plan Inspector ── */

function PlanInspector({
  goalId,
  goals,
  domains,
  horizons,
  weekPlan,
  monthPlan,
  onSelectGoal,
  onCreateChild,
}: {
  goalId: string;
  goals: GoalOverviewItem[];
  domains: GoalDomainItem[];
  horizons: GoalHorizonItem[];
  weekPlan: WeekPlanResponse | null;
  monthPlan: MonthPlanResponse | null;
  onSelectGoal: (goalId: string) => void;
  onCreateChild: (parentGoal: GoalOverviewItem) => void;
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

        {/* Next best action */}
        {goal.nextBestAction && (
          <div className="goal-nba">
            <span className="goal-nba__icon">→</span>
            <span>{goal.nextBestAction}</span>
          </div>
        )}

        {/* Milestones */}
        <div className="ghq-inspector__section">
          <h3 className="ghq-inspector__section-title">Milestones</h3>
          <GoalInspectorMilestones
            milestones={goal.milestones}
            goalId={goal.id}
            onSaved={() => void detailQuery.refetch()}
          />
        </div>

        {/* Children */}
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

        {/* Breakdown action */}
        <button
          className="button button--ghost button--small ghq-inspector__breakdown-btn"
          type="button"
          onClick={() => onCreateChild(goal)}
        >
          + Break down into sub-goal
        </button>

        {/* Weekly alignment */}
        <div className="ghq-inspector__section">
          <h3 className="ghq-inspector__section-title">This week</h3>
          {goal.currentWeekPriorities.length > 0 ? (
            <div className="linked-items">
              {goal.currentWeekPriorities.map((p) => (
                <div key={p.id} className="linked-item">
                  <span className={`linked-item__status linked-item__status--${p.status}`} />
                  <span className={`linked-item__title${p.status === "completed" ? " linked-item__title--done" : ""}`}>
                    {p.title}
                  </span>
                  <span className="linked-item__cycle-badge">W{p.slot}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="ghq-inspector__empty">Not represented in this week's priorities.</p>
          )}
        </div>

        {/* Monthly alignment */}
        <div className="ghq-inspector__section">
          <h3 className="ghq-inspector__section-title">This month</h3>
          {goal.currentMonthOutcomes.length > 0 ? (
            <div className="linked-items">
              {goal.currentMonthOutcomes.map((p) => (
                <div key={p.id} className="linked-item">
                  <span className={`linked-item__status linked-item__status--${p.status}`} />
                  <span className={`linked-item__title${p.status === "completed" ? " linked-item__title--done" : ""}`}>
                    {p.title}
                  </span>
                  <span className="linked-item__cycle-badge">M{p.slot}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="ghq-inspector__empty">Not represented in this month's outcomes.</p>
          )}
        </div>

        {/* Today alignment */}
        <div className="ghq-inspector__section">
          <h3 className="ghq-inspector__section-title">Today</h3>
          <TodayAlignmentSection goalId={goal.id} goalStatus={goal.status} nextBestAction={goal.nextBestAction} />
        </div>

        {/* Linked habits */}
        {goal.linkedHabits.length > 0 && (
          <div className="ghq-inspector__section">
            <h3 className="ghq-inspector__section-title">Support habits</h3>
            <div className="linked-items">
              {goal.linkedHabits.map((h) => (
                <div key={h.id} className="linked-item">
                  <span className={`linked-item__status linked-item__status--${h.status}`} />
                  <span className="linked-item__title">{h.title}</span>
                  {h.streakCount > 0 && <span className="linked-habit__streak">{h.streakCount}d</span>}
                  {h.completedToday && <span className="tag tag--positive">done</span>}
                  {h.dueToday && !h.completedToday && <span className="tag tag--warning">due</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
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

function TodayAlignmentSection({
  goalId,
  goalStatus,
  nextBestAction,
}: {
  goalId: string;
  goalStatus: GoalDetailItem["status"];
  nextBestAction: string | null;
}) {
  const {
    isAvailable,
    updateDayPrioritiesMutation,
    canAddToToday,
    buttonLabel,
    helperCopy,
    addToToday,
    goalAlreadyInToday,
  } = useGoalTodayAction({
    goalId,
    goalStatus,
    nextBestAction,
  });

  if (!isAvailable) {
    return <p className="ghq-inspector__empty">No recommended action for today.</p>;
  }

  return (
    <div className="ghq-today-alignment">
      {goalAlreadyInToday ? (
        <p className="ghq-inspector__empty ghq-inspector__empty--positive">Already represented in today's priorities.</p>
      ) : (
        <>
          <p className="ghq-inspector__empty">{helperCopy}</p>
          <button
            className="button button--primary button--small"
            type="button"
            onClick={() => void addToToday()}
            disabled={updateDayPrioritiesMutation.isPending || !canAddToToday}
          >
            {buttonLabel}
          </button>
        </>
      )}
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
  selectedGoalId,
  onSelectGoal,
  onOpenCreateGoal,
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
  selectedGoalId: string | null;
  onSelectGoal: (goalId: string) => void;
  onOpenCreateGoal: () => void;
  onStartCreateChild: (parentGoal: GoalOverviewItem) => void;
  showChildForm: boolean;
  childFormParent: GoalOverviewItem | null;
  childForm: GoalFormData;
  onChangeChildForm: (updater: (prev: GoalFormData) => GoalFormData) => void;
  onSubmitChildForm: () => void;
  onCancelChildForm: () => void;
  createIsPending: boolean;
}) {
  const [planView, setPlanView] = useState<PlanSubview>("outline");

  const activeGoals = goals.filter((g) => g.status === "active");
  const tree = useMemo(() => buildHierarchyTree(activeGoals), [activeGoals]);

  // Graph: trigger child creation for the selected goal
  const handleGraphAddChild = useCallback(() => {
    const goal = goals.find((g) => g.id === selectedGoalId);
    if (goal) onStartCreateChild(goal);
  }, [goals, selectedGoalId, onStartCreateChild]);

  // Shared inspector content
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
  ) : selectedGoalId ? (
    <PlanInspector
      goalId={selectedGoalId}
      goals={goals}
      domains={domains}
      horizons={horizons}
      weekPlan={weekPlan}
      monthPlan={monthPlan}
      onSelectGoal={onSelectGoal}
      onCreateChild={onStartCreateChild}
    />
  ) : (
    <div className="ghq-inspector ghq-inspector--empty">
      <div className="ghq-inspector__empty-state">
        <span className="ghq-inspector__empty-icon">◫</span>
        <h3>Select a goal</h3>
        <p>
          Choose a goal from the {planView === "graph" ? "graph" : "hierarchy"} to
          see its full context, milestones, and alignment with your weekly and
          monthly planning.
        </p>
      </div>
    </div>
  );

  return (
    <div className="ghq-plan-container">
      {/* Subview toggle */}
      <div className="ghq-plan-subview">
        <button
          className={`ghq-plan-subview__btn${planView === "outline" ? " ghq-plan-subview__btn--active" : ""}`}
          type="button"
          onClick={() => setPlanView("outline")}
        >
          Outline
        </button>
        <button
          className={`ghq-plan-subview__btn ghq-plan-subview__btn--graph${planView === "graph" ? " ghq-plan-subview__btn--active" : ""}`}
          type="button"
          onClick={() => setPlanView("graph")}
        >
          Graph
        </button>
      </div>

      <div className={`ghq-plan${planView === "graph" ? " ghq-plan--graph" : ""}`}>
        {/* Left: outline rail OR graph canvas */}
        {planView === "outline" ? (
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
                onSelectGoal={onSelectGoal}
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
        ) : (
          <div className="ghq-plan__graph">
            <GoalsPlanGraphView
              goals={goals}
              domains={domains}
              horizons={horizons}
              weekPlan={weekPlan}
              monthPlan={monthPlan}
              selectedGoalId={selectedGoalId}
              onSelectGoal={onSelectGoal}
              onAddChild={handleGraphAddChild}
            />
          </div>
        )}

        {/* Right: inspector (shared between outline and graph) */}
        <div className="ghq-plan__inspector">
          {inspectorContent}
        </div>
      </div>
    </div>
  );
}
