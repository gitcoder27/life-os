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

type GoalSortMode = "domain" | "urgent" | "at_risk" | "recent_activity" | "target_date";

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

function getFirstLinkedGoalId(items: Array<{ goalId: string | null; goal?: { id: string } | null }>): string | undefined {
  for (const item of items) {
    if (item.goalId) return item.goalId;
    if (item.goal?.id) return item.goal.id;
  }

  return undefined;
}

function parseDateValue(value: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  return new Date(`${value}T12:00:00`).getTime();
}

function parseDateTimeValue(value: string | null) {
  if (!value) return Number.NEGATIVE_INFINITY;
  return new Date(value).getTime();
}

function getUrgencyScore(goal: GoalOverviewItem, today: string) {
  let score = 0;
  const todayTime = parseDateValue(today);
  const targetTime = parseDateValue(goal.targetDate);

  if (goal.health === "stalled") score += 240;
  else if (goal.health === "drifting") score += 140;

  if (Number.isFinite(targetTime)) {
    const daysUntilTarget = Math.floor((targetTime - todayTime) / 86_400_000);
    if (daysUntilTarget < 0) score += 220;
    else if (daysUntilTarget <= 7) score += 180;
    else if (daysUntilTarget <= 30) score += 110;
    else if (daysUntilTarget <= 90) score += 45;
  }

  score += Math.min(goal.milestoneCounts.overdue * 35, 140);
  score += Math.min(goal.linkedSummary.pendingTasks * 6, 48);

  if (goal.linkedSummary.currentWeekPriorities === 0) score += 26;
  if (!goal.lastActivityAt) score += 18;

  return score;
}

function compareGoals(left: GoalOverviewItem, right: GoalOverviewItem, sortMode: GoalSortMode, today: string) {
  if (sortMode === "urgent") {
    return (
      getUrgencyScore(right, today) - getUrgencyScore(left, today) ||
      parseDateValue(left.targetDate) - parseDateValue(right.targetDate) ||
      left.sortOrder - right.sortOrder
    );
  }

  if (sortMode === "at_risk") {
    const riskRank = (health: GoalOverviewItem["health"]) => {
      if (health === "stalled") return 0;
      if (health === "drifting") return 1;
      if (health === "on_track") return 2;
      if (health === "achieved") return 3;
      return 4;
    };

    return (
      riskRank(left.health) - riskRank(right.health) ||
      getUrgencyScore(right, today) - getUrgencyScore(left, today) ||
      left.sortOrder - right.sortOrder
    );
  }

  if (sortMode === "recent_activity") {
    return (
      parseDateTimeValue(right.lastActivityAt) - parseDateTimeValue(left.lastActivityAt) ||
      getUrgencyScore(right, today) - getUrgencyScore(left, today) ||
      left.sortOrder - right.sortOrder
    );
  }

  if (sortMode === "target_date") {
    return (
      parseDateValue(left.targetDate) - parseDateValue(right.targetDate) ||
      getUrgencyScore(right, today) - getUrgencyScore(left, today) ||
      left.sortOrder - right.sortOrder
    );
  }

  return left.sortOrder - right.sortOrder || left.createdAt.localeCompare(right.createdAt);
}

function getSortLabel(sortMode: GoalSortMode) {
  if (sortMode === "urgent") return "Most urgent";
  if (sortMode === "at_risk") return "Needs attention";
  if (sortMode === "recent_activity") return "Recent activity";
  if (sortMode === "target_date") return "Target date";
  return "Domain";
}

/* ── Overview Filters ── */

function OverviewFilters({
  domains,
  horizons,
  activeDomainId,
  activeHorizonId,
  activeStatus,
  searchQuery,
  sortMode,
  resultCount,
  onChangeDomain,
  onChangeHorizon,
  onChangeStatus,
  onChangeSearch,
  onChangeSort,
}: {
  domains: GoalDomainItem[];
  horizons: GoalHorizonItem[];
  activeDomainId: string | undefined;
  activeHorizonId: string | undefined;
  activeStatus: GoalStatus | undefined;
  searchQuery: string;
  sortMode: GoalSortMode;
  resultCount: number;
  onChangeDomain: (id: string | undefined) => void;
  onChangeHorizon: (id: string | undefined) => void;
  onChangeStatus: (status: GoalStatus | undefined) => void;
  onChangeSearch: (value: string) => void;
  onChangeSort: (sortMode: GoalSortMode) => void;
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
        <div className="ghq-filter-search">
          <input
            className="ghq-filter-search__input"
            type="search"
            value={searchQuery}
            placeholder="Search goals, notes, domains, or horizons"
            onChange={(e) => onChangeSearch(e.target.value)}
          />
          {searchQuery ? (
            <button
              className="ghq-filter-search__clear"
              type="button"
              onClick={() => onChangeSearch("")}
              aria-label="Clear search"
            >
              Clear
            </button>
          ) : null}
        </div>
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
        <select
          className="ghq-filter-select"
          value={sortMode}
          onChange={(e) => onChangeSort(e.target.value as GoalSortMode)}
        >
          <option value="domain">Sort: Domain</option>
          <option value="urgent">Sort: Most urgent</option>
          <option value="at_risk">Sort: Needs attention</option>
          <option value="recent_activity">Sort: Recent activity</option>
          <option value="target_date">Sort: Target date</option>
        </select>
      </div>
      <div className="ghq-filters__row ghq-filters__row--summary">
        <span className="ghq-results-pill">
          {resultCount} {resultCount === 1 ? "goal" : "goals"}
        </span>
        {searchQuery ? (
          <span className="ghq-results-pill ghq-results-pill--subtle">Query: {searchQuery}</span>
        ) : null}
        <span className="ghq-results-pill ghq-results-pill--subtle">Order: {getSortLabel(sortMode)}</span>
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
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<GoalSortMode>("domain");
  const updateGoalMutation = useUpdateGoalMutation();

  // Filter goals
  const filteredGoals = useMemo(() => {
    let result = goals;
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (filterDomainId) result = result.filter((g) => g.domainId === filterDomainId);
    if (filterHorizonId) result = result.filter((g) => g.horizonId === filterHorizonId);
    if (filterStatus) {
      result = result.filter((g) => g.status === filterStatus);
    } else {
      result = result.filter((g) => g.status === "active");
    }
    if (normalizedQuery) {
      result = result.filter((goal) => {
        const haystack = [
          goal.title,
          goal.domain,
          goal.horizonName ?? "",
          goal.why ?? "",
          goal.notes ?? "",
          goal.nextBestAction ?? "",
        ].join(" ").toLowerCase();

        return haystack.includes(normalizedQuery);
      });
    }
    return result;
  }, [filterDomainId, filterHorizonId, filterStatus, goals, searchQuery]);

  const inactiveGoals = filterStatus ? [] : filteredGoals.filter((g) => g.status !== "active");
  const displayGoals = useMemo(
    () => [...filteredGoals].sort((left, right) => compareGoals(left, right, sortMode, today)),
    [filteredGoals, sortMode, today],
  );
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
        searchQuery={searchQuery}
        sortMode={sortMode}
        resultCount={displayGoals.length}
        onChangeDomain={setFilterDomainId}
        onChangeHorizon={setFilterHorizonId}
        onChangeStatus={setFilterStatus}
        onChangeSearch={setSearchQuery}
        onChangeSort={setSortMode}
      />

      <div className="ghq-overview-flowbar">
        <p className="ghq-overview-flowbar__copy">
          Overview is for review. Use Plan to edit hierarchy, month, and week alignment.
        </p>
        <button
          className="button button--primary button--small"
          type="button"
          onClick={() => onSwitchToPlan(selectedGoalId ?? weeklyPlanGoalId ?? monthlyPlanGoalId)}
        >
          Open Plan
        </button>
      </div>

      {/* Main layout */}
      <div className="ghq-overview__body">
        <div className="ghq-overview__list">
          {/* Domain-grouped goals */}
          {displayGoals.length > 0 && sortMode !== "domain" ? (
            <section className="ghq-domain-section">
              <div className="ghq-domain-section__header">
                <h2 className="ghq-domain-section__title">Ranked results</h2>
                <span className="ghq-domain-section__count">{getSortLabel(sortMode)}</span>
              </div>
              <div className="ghq-domain-section__cards">
                {displayGoals.map((goal) => (
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
          ) : domainGroups.length > 0 ? (
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
              title={filterDomainId || filterHorizonId || filterStatus || searchQuery ? "No matching goals" : "No active goals"}
              description={
                filterDomainId || filterHorizonId || filterStatus || searchQuery
                  ? "Try adjusting the search or filters above."
                  : "Create your first goal to start planning with purpose."
              }
              actionLabel={filterDomainId || filterHorizonId || filterStatus || searchQuery ? undefined : "+ Create your first goal"}
              onAction={filterDomainId || filterHorizonId || filterStatus || searchQuery ? undefined : onOpenCreateGoal}
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
