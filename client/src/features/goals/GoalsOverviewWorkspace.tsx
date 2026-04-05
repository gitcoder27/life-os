import { useMemo, useState } from "react";

import type {
  GoalDomainItem,
  GoalHorizonItem,
  GoalOverviewItem,
  GoalStatus,
  MonthPlanResponse,
  WeekPlanResponse,
} from "../../shared/lib/api";
import {
  formatMonthLabel,
  useUpdateGoalMutation,
} from "../../shared/lib/api";
import {
  EmptyState,
  InlineErrorState,
} from "../../shared/ui/PageState";
import { SectionCard } from "../../shared/ui/SectionCard";
import { GoalCard } from "./GoalCard";
import { GoalInspectorPanel } from "./GoalInspectorPanel";

/* ── Helpers ── */

const statusLabels: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  archived: "Archived",
};

type DomainGroup = {
  domain: GoalDomainItem;
  goals: GoalOverviewItem[];
};

function groupGoalsByDomain(
  goals: GoalOverviewItem[],
  domains: GoalDomainItem[],
): DomainGroup[] {
  const groups: DomainGroup[] = [];
  const domainMap = new Map<string, GoalOverviewItem[]>();

  for (const goal of goals) {
    const key = goal.domainId;
    if (!domainMap.has(key)) domainMap.set(key, []);
    domainMap.get(key)!.push(goal);
  }

  for (const domain of domains) {
    const domainGoals = domainMap.get(domain.id);
    if (domainGoals && domainGoals.length > 0) {
      groups.push({ domain, goals: domainGoals });
    }
  }

  // Catch goals whose domain wasn't in the list
  for (const [domainId, domainGoals] of domainMap) {
    if (!domains.some((d) => d.id === domainId)) {
      groups.push({
        domain: { id: domainId, systemKey: null, name: "Other", sortOrder: 999, isArchived: false, createdAt: "", updatedAt: "" },
        goals: domainGoals,
      });
    }
  }

  return groups;
}

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

function getFirstLinkedGoalId(items: Array<{ goalId: string | null; goal?: { id: string } | null }>): string | undefined {
  for (const item of items) {
    if (item.goalId) return item.goalId;
    if (item.goal?.id) return item.goal.id;
  }

  return undefined;
}

/* ── Overview Filters ── */

function OverviewFilters({
  domains,
  horizons,
  activeDomainId,
  activeHorizonId,
  activeStatus,
  onChangeDomain,
  onChangeHorizon,
  onChangeStatus,
}: {
  domains: GoalDomainItem[];
  horizons: GoalHorizonItem[];
  activeDomainId: string | undefined;
  activeHorizonId: string | undefined;
  activeStatus: GoalStatus | undefined;
  onChangeDomain: (id: string | undefined) => void;
  onChangeHorizon: (id: string | undefined) => void;
  onChangeStatus: (status: GoalStatus | undefined) => void;
}) {
  return (
    <div className="ghq-filters">
      <div className="ghq-filters__row">
        <button
          className={`ghq-filter-pill${!activeDomainId ? " ghq-filter-pill--active" : ""}`}
          type="button"
          onClick={() => onChangeDomain(undefined)}
        >
          All domains
        </button>
        {domains.filter((d) => !d.isArchived).map((d) => (
          <button
            key={d.id}
            className={`ghq-filter-pill${activeDomainId === d.id ? " ghq-filter-pill--active" : ""}`}
            type="button"
            onClick={() => onChangeDomain(activeDomainId === d.id ? undefined : d.id)}
          >
            <span className="ghq-filter-pill__icon">{getDomainEmoji(d.systemKey)}</span>
            {d.name}
          </button>
        ))}
      </div>
      <div className="ghq-filters__row ghq-filters__row--secondary">
        <select
          className="ghq-filter-select"
          value={activeHorizonId ?? ""}
          onChange={(e) => onChangeHorizon(e.target.value || undefined)}
        >
          <option value="">All horizons</option>
          {horizons.filter((h) => !h.isArchived).map((h) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>
        <select
          className="ghq-filter-select"
          value={activeStatus ?? ""}
          onChange={(e) => onChangeStatus((e.target.value || undefined) as GoalStatus | undefined)}
        >
          <option value="">Active goals</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
      </div>
    </div>
  );
}

/* ── Main Component ── */

export function GoalsOverviewWorkspace({
  goals,
  domains,
  horizons,
  weekPlan,
  monthPlan,
  today,
  selectedGoalId,
  onSelectGoal,
  onSwitchToPlan,
  onOpenCreateGoal,
  onEditGoal,
  showGoalForm,
  onCloseSelectedGoal,
  onRefetch,
  sectionErrors,
}: {
  goals: GoalOverviewItem[];
  domains: GoalDomainItem[];
  horizons: GoalHorizonItem[];
  weekPlan: WeekPlanResponse | null;
  monthPlan: MonthPlanResponse | null;
  today: string;
  selectedGoalId: string | null;
  onSelectGoal: (goalId: string) => void;
  onSwitchToPlan: (goalId?: string) => void;
  onOpenCreateGoal: () => void;
  onEditGoal: (goal: GoalOverviewItem) => void;
  showGoalForm: boolean;
  onCloseSelectedGoal: () => void;
  onRefetch: () => void;
  sectionErrors: { weekPlan: { message: string } | null; monthPlan: { message: string } | null };
}) {
  const [filterDomainId, setFilterDomainId] = useState<string | undefined>();
  const [filterHorizonId, setFilterHorizonId] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<GoalStatus | undefined>();
  const updateGoalMutation = useUpdateGoalMutation();

  // Filter goals
  const filteredGoals = useMemo(() => {
    let result = goals;
    if (filterDomainId) result = result.filter((g) => g.domainId === filterDomainId);
    if (filterHorizonId) result = result.filter((g) => g.horizonId === filterHorizonId);
    if (filterStatus) {
      result = result.filter((g) => g.status === filterStatus);
    } else {
      result = result.filter((g) => g.status === "active");
    }
    return result;
  }, [goals, filterDomainId, filterHorizonId, filterStatus]);

  const inactiveGoals = filteredGoals.filter((g) => g.status !== "active");
  const displayGoals = filterStatus ? filteredGoals : filteredGoals.filter((g) => g.status === "active");
  const domainGroups = groupGoalsByDomain(displayGoals, domains);

  const weeklyPriorities = weekPlan?.priorities ?? [];
  const weeklyPlanGoalId = getFirstLinkedGoalId(weeklyPriorities);
  const monthlyPlanGoalId = getFirstLinkedGoalId(monthPlan?.topOutcomes ?? []);

  async function handleGoalStatusChange(goalId: string, status: GoalStatus) {
    await updateGoalMutation.mutateAsync({ goalId, status });
  }

  return (
    <div className="ghq-overview">
      {/* Filters */}
      <OverviewFilters
        domains={domains}
        horizons={horizons}
        activeDomainId={filterDomainId}
        activeHorizonId={filterHorizonId}
        activeStatus={filterStatus}
        onChangeDomain={setFilterDomainId}
        onChangeHorizon={setFilterHorizonId}
        onChangeStatus={setFilterStatus}
      />

      <SectionCard
        title="Planning flow"
        subtitle="Overview is for review. Plan is where editing happens."
      >
        <div className="ghq-overview-note">
          <p>
            Scan your goals and current direction here. Use Plan to edit hierarchy,
            connect goals to Month and Week, and shape supporting goals in one place.
          </p>
          <button
            className="button button--primary button--small"
            type="button"
            onClick={() => onSwitchToPlan(selectedGoalId ?? weeklyPlanGoalId ?? monthlyPlanGoalId)}
          >
            Open Plan workspace
          </button>
        </div>
      </SectionCard>

      {/* Main layout */}
      <div className="ghq-overview__body">
        <div className="ghq-overview__list">
          {/* Domain-grouped goals */}
          {domainGroups.length > 0 ? (
            <div className="ghq-domain-sections stagger">
              {domainGroups.map((group) => (
                <section key={group.domain.id} className="ghq-domain-section">
                  <div className="ghq-domain-section__header">
                    <h2 className="ghq-domain-section__title">
                      <span className="ghq-domain-section__emoji">
                        {getDomainEmoji(group.domain.systemKey)}
                      </span>
                      {group.domain.name}
                    </h2>
                    <span className="ghq-domain-section__count">
                      {group.goals.length} {group.goals.length === 1 ? "goal" : "goals"}
                    </span>
                  </div>
                  <div className="ghq-domain-section__cards">
                    {group.goals.map((goal) => (
                      <GoalCard
                        key={goal.id}
                        goal={goal}
                        selected={selectedGoalId === goal.id}
                        onSelect={() => onSelectGoal(goal.id)}
                        onEditGoal={() => onEditGoal(goal)}
                        onOpenInPlan={() => onSwitchToPlan(goal.id)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : !showGoalForm ? (
            <EmptyState
              title={filterDomainId || filterHorizonId || filterStatus ? "No matching goals" : "No active goals"}
              description={
                filterDomainId || filterHorizonId || filterStatus
                  ? "Try adjusting the filters above."
                  : "Create your first goal to start planning with purpose."
              }
              actionLabel={filterDomainId || filterHorizonId || filterStatus ? undefined : "+ Create your first goal"}
              onAction={filterDomainId || filterHorizonId || filterStatus ? undefined : onOpenCreateGoal}
            />
          ) : null}

          {/* Inactive goals */}
          {inactiveGoals.length > 0 && filterStatus && (
            <SectionCard
              title="Results"
              subtitle={`${inactiveGoals.length} ${inactiveGoals.length === 1 ? "goal" : "goals"}`}
            >
              <div className="inactive-goals">
                {inactiveGoals.map((goal) => (
                  <div key={goal.id} className="inactive-goal-row">
                    <span className="ghq-domain-dot" />
                    <span className="inactive-goal-row__title">{goal.title}</span>
                    <span className={`tag ${goal.status === "completed" ? "tag--positive" : goal.status === "paused" ? "tag--warning" : "tag--neutral"}`}>
                      {statusLabels[goal.status] ?? goal.status}
                    </span>
                    {goal.status !== "active" && (
                      <div className="inactive-goal-row__actions">
                        <button
                          className="button button--ghost button--small"
                          type="button"
                          onClick={() => void handleGoalStatusChange(goal.id, "active")}
                        >
                          Reactivate
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Add goal button */}
          {!showGoalForm && (
            <div className="ghq-actions-row">
              <button
                className="button button--primary button--small"
                type="button"
                onClick={onOpenCreateGoal}
              >
                + Add goal
              </button>
              <button
                className="button button--ghost button--small"
                type="button"
                onClick={() => onSwitchToPlan(selectedGoalId ?? weeklyPlanGoalId ?? monthlyPlanGoalId)}
              >
                Open Plan workspace
              </button>
            </div>
          )}

          {/* Weekly & Monthly Planning */}
          <div className="ghq-planning-grid">
            {/* Weekly priorities */}
            <SectionCard title="Weekly priorities" subtitle="This week">
              {sectionErrors.weekPlan ? (
                <InlineErrorState message={sectionErrors.weekPlan.message} onRetry={onRefetch} />
              ) : (
                <>
                  {weeklyPriorities.length > 0 ? (
                    <ol className="priority-list">
                      {weeklyPriorities.map((item, index) => (
                        <li key={item.id} className="priority-list__item">
                          <span style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                            <span>
                              <span className="tag tag--neutral" style={{ marginRight: "0.5rem" }}>W{index + 1}</span>
                              {item.title}
                            </span>
                            {item.goal ? (
                              <button
                                className="ghq-goal-chip ghq-goal-chip--button"
                                type="button"
                                onClick={() => onSwitchToPlan(item.goal!.id)}
                              >
                                <span className="ghq-goal-chip__dot" />
                                {item.goal.title}
                              </button>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <EmptyState title="No weekly priorities" description="Use Plan to connect this week's work to your goals." />
                  )}
                  <div className="ghq-planning-actions">
                    <p className="support-copy">Weekly planning is edited in Plan so hierarchy and priorities stay together.</p>
                    <button
                      className="button button--ghost button--small"
                      type="button"
                      onClick={() => onSwitchToPlan(weeklyPlanGoalId ?? selectedGoalId ?? undefined)}
                    >
                      Plan this week in Plan
                    </button>
                  </div>
                </>
              )}
            </SectionCard>

            {/* Monthly focus */}
            <SectionCard
              title="Monthly focus"
              subtitle={formatMonthLabel(monthPlan?.startDate.slice(0, 7) ?? today.slice(0, 7))}
            >
              {sectionErrors.monthPlan ? (
                <InlineErrorState message={sectionErrors.monthPlan.message} onRetry={onRefetch} />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", fontWeight: 500 }}>
                    {monthPlan?.theme ?? "No theme set"}
                  </div>
                  {monthPlan?.topOutcomes.length ? (
                    <ol className="priority-list">
                      {monthPlan.topOutcomes.map((outcome) => (
                        <li key={outcome.id} className="priority-list__item">
                          <span style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                            <span>{outcome.title}</span>
                            {outcome.goal ? (
                              <button
                                className="ghq-goal-chip ghq-goal-chip--button"
                                type="button"
                                onClick={() => onSwitchToPlan(outcome.goal!.id)}
                              >
                                <span className="ghq-goal-chip__dot" />
                                {outcome.goal.title}
                              </button>
                            ) : null}
                          </span>
                          <span className={outcome.status === "completed" ? "tag tag--positive" : "tag tag--warning"}>
                            {outcome.status === "completed" ? "achieved" : "tracking"}
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="support-copy">Use Plan to shape this month around your active goals.</p>
                  )}
                  <div className="ghq-planning-actions">
                    <p className="support-copy">Monthly planning is edited in Plan so outcomes stay tied to the goal map.</p>
                    <button
                      className="button button--ghost button--small"
                      type="button"
                      onClick={() => onSwitchToPlan(monthlyPlanGoalId ?? selectedGoalId ?? undefined)}
                      style={{ alignSelf: "flex-start" }}
                    >
                      Plan this month in Plan
                    </button>
                  </div>
                </div>
              )}
            </SectionCard>
          </div>
        </div>

        {selectedGoalId && (
          <div className="goals-workspace__detail">
            <GoalInspectorPanel
              goalId={selectedGoalId}
              onEditGoal={onEditGoal}
              onOpenInPlan={onSwitchToPlan}
              onClose={onCloseSelectedGoal}
            />
          </div>
        )}
      </div>

      {selectedGoalId && (
        <div className="detail-backdrop" onClick={onCloseSelectedGoal} />
      )}
    </div>
  );
}
