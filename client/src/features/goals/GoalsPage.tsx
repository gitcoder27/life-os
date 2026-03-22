import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import {
  formatMonthLabel,
  getMonthStartDate,
  getTodayDate,
  getWeekStartDate,
  useCreateGoalMutation,
  useFilteredGoalsQuery,
  useGoalsDataQuery,
  useUpdateGoalMutation,
  useUpdateMonthFocusMutation,
  useUpdateWeekPrioritiesMutation,
  type GoalDomain,
  type GoalOverviewItem,
  type GoalStatus,
  type LinkedGoal,
} from "../../shared/lib/api";
import { PageHeader } from "../../shared/ui/PageHeader";
import {
  EmptyState,
  InlineErrorState,
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";
import { SectionCard } from "../../shared/ui/SectionCard";
import {
  GoalDetailPanel,
  GoalProgressBar,
  HealthBadge,
  MomentumSpark,
} from "./GoalDetailPanel";
import {
  SortablePlanningEditor,
  type RankedPlanningDraft,
} from "./SortablePlanningEditor";

const domainLabels: Record<string, string> = {
  health: "Health",
  money: "Money",
  work_growth: "Work & Growth",
  home_admin: "Home admin",
  discipline: "Discipline",
  other: "Other",
};

const domainOptions = Object.entries(domainLabels).map(([value, label]) => ({
  value: value as GoalDomain,
  label,
}));

const statusLabels: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  archived: "Archived",
};

const statusOptions = Object.entries(statusLabels).map(([value, label]) => ({
  value: value as GoalStatus,
  label,
}));

function GoalChip({ goal }: { goal: LinkedGoal }) {
  return (
    <Link to="/goals" className="goal-chip">
      <span className={`goal-chip__dot goal-chip__dot--${goal.domain}`} />
      <span>{goal.title}</span>
    </Link>
  );
}

type GoalFormData = {
  title: string;
  domain: GoalDomain;
  targetDate: string;
  notes: string;
};

const emptyGoalForm: GoalFormData = {
  title: "",
  domain: "other",
  targetDate: "",
  notes: "",
};

const planningSlots: Array<1 | 2 | 3> = [1, 2, 3];

let planningDraftKeyCounter = 0;

function nextPlanningDraftKey() {
  planningDraftKeyCounter += 1;
  return `planning-draft-${planningDraftKeyCounter}`;
}

function createPlanningDraft(): RankedPlanningDraft {
  return {
    sortKey: nextPlanningDraftKey(),
    title: "",
    goalId: "",
  };
}

function toRankedPlanningDrafts<T extends { id: string; slot: 1 | 2 | 3; title: string; goalId: string | null }>(
  items: T[],
): RankedPlanningDraft[] {
  return [...items]
    .sort((left, right) => left.slot - right.slot)
    .map((item) => ({
      id: item.id,
      sortKey: item.id,
      title: item.title,
      goalId: item.goalId ?? "",
    }));
}

function buildPlanningSnapshot(drafts: RankedPlanningDraft[]) {
  return drafts.map((draft) => ({
    id: draft.id,
    title: draft.title.trim(),
    goalId: draft.goalId || null,
  }));
}

/* ── Active Goal Overview Card ── */

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ActiveGoalCard({
  goal,
  selected,
  onSelect,
}: {
  goal: GoalOverviewItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const ls = goal.linkedSummary;
  const linkedTotal = ls.currentDayPriorities + ls.currentWeekPriorities + ls.currentMonthPriorities + ls.pendingTasks + ls.activeHabits;

  return (
    <div
      className={`goal-overview-card${selected ? " goal-overview-card--selected" : ""}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
    >
      <div className="goal-overview-card__top">
        <div className="goal-overview-card__identity">
          <div className="goal-overview-card__domain">
            <span className={`goal-chip__dot goal-chip__dot--${goal.domain}`} />
            {domainLabels[goal.domain] ?? goal.domain}
          </div>
          <div className="goal-overview-card__title">{goal.title}</div>
          {goal.targetDate && (
            <div className="goal-overview-card__target">Target: {formatDate(goal.targetDate)}</div>
          )}
        </div>
        <HealthBadge health={goal.health} />
      </div>

      <GoalProgressBar percent={goal.progressPercent} achieved={goal.health === "achieved"} />

      <div className="goal-metrics">
        <span className="goal-metric">
          <span className="goal-metric__value">{goal.milestoneCounts.completed}/{goal.milestoneCounts.total}</span>
          milestones
        </span>
        {goal.milestoneCounts.overdue > 0 && (
          <span className="goal-metric" style={{ color: "var(--negative)" }}>
            <span className="goal-metric__value" style={{ color: "var(--negative)" }}>{goal.milestoneCounts.overdue}</span>
            overdue
          </span>
        )}
        {linkedTotal > 0 && (
          <span className="goal-metric goal-metric--accent">
            <span className="goal-metric__value">{linkedTotal}</span>
            linked items
          </span>
        )}
        {ls.dueHabitsToday > 0 && (
          <span className="goal-metric">
            <span className="goal-metric__value">{ls.dueHabitsToday}</span>
            habits due
          </span>
        )}
        <MomentumSpark momentum={goal.momentum} />
      </div>

      {goal.nextBestAction && (
        <div className="goal-nba">
          <span className="goal-nba__icon">→</span>
          <span>{goal.nextBestAction}</span>
        </div>
      )}
    </div>
  );
}

/* ── Main Page ── */

export function GoalsPage() {
  const today = getTodayDate();
  const weekStart = getWeekStartDate(today);
  const monthStart = getMonthStartDate(today);

  // Filter state
  const [filterDomain, setFilterDomain] = useState<GoalDomain | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<GoalStatus | undefined>(undefined);

  // Detail panel
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  const goalsQuery = useGoalsDataQuery(today);
  const filteredGoalsQuery = useFilteredGoalsQuery(
    filterDomain || filterStatus ? { domain: filterDomain, status: filterStatus } : undefined,
  );
  const createGoalMutation = useCreateGoalMutation();
  const updateGoalMutation = useUpdateGoalMutation();
  const updateWeekPrioritiesMutation = useUpdateWeekPrioritiesMutation(weekStart);
  const updateMonthFocusMutation = useUpdateMonthFocusMutation(monthStart);

  // Goal form
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalForm, setGoalForm] = useState<GoalFormData>(emptyGoalForm);
  const goalFormRef = useRef<HTMLDivElement>(null);
  const goalTitleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showGoalForm && goalFormRef.current) {
      goalFormRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      goalTitleRef.current?.focus();
    }
  }, [showGoalForm]);

  // Weekly priorities editing
  const [editingWeek, setEditingWeek] = useState(false);
  const [weekDrafts, setWeekDrafts] = useState<RankedPlanningDraft[]>([]);

  // Monthly focus editing
  const [editingMonth, setEditingMonth] = useState(false);
  const [monthTheme, setMonthTheme] = useState("");
  const [monthOutcomes, setMonthOutcomes] = useState<RankedPlanningDraft[]>([]);

  if (goalsQuery.isLoading && !goalsQuery.data) {
    return (
      <PageLoadingState
        title="Loading goals"
        description="Pulling together life-area goals, weekly priorities, and monthly focus."
      />
    );
  }

  if (goalsQuery.isError || !goalsQuery.data) {
    return (
      <PageErrorState
        title="Goals could not load"
        message={goalsQuery.error instanceof Error ? goalsQuery.error.message : undefined}
        onRetry={() => void goalsQuery.refetch()}
      />
    );
  }

  const isFiltering = filterDomain !== undefined || filterStatus !== undefined;
  const allGoals = goalsQuery.data.goals.goals ?? [];
  const filteredGoals = isFiltering
    ? (filteredGoalsQuery.data?.goals ?? allGoals)
    : allGoals;

  const activeGoals = allGoals.filter((g) => g.status === "active");
  const weeklyPriorities = goalsQuery.data.weekPlan?.priorities ?? [];
  const monthPlan = goalsQuery.data.monthPlan;
  const savedWeekSnapshot = buildPlanningSnapshot(toRankedPlanningDrafts(weeklyPriorities));
  const weekDraftSnapshot = buildPlanningSnapshot(weekDrafts);
  const savedMonthOutcomeSnapshot = buildPlanningSnapshot(
    toRankedPlanningDrafts(monthPlan?.topOutcomes ?? []),
  );
  const monthDraftSnapshot = buildPlanningSnapshot(monthOutcomes);
  const savedMonthTheme = monthPlan?.theme ?? "";
  const weekDraftsHaveBlankTitle = weekDrafts.some((draft) => !draft.title.trim());
  const monthOutcomesHaveBlankTitle = monthOutcomes.some((outcome) => !outcome.title.trim());
  const isWeekDirty = JSON.stringify(weekDraftSnapshot) !== JSON.stringify(savedWeekSnapshot);
  const isMonthDirty =
    monthTheme.trim() !== savedMonthTheme.trim()
    || JSON.stringify(monthDraftSnapshot) !== JSON.stringify(savedMonthOutcomeSnapshot);

  function openCreateGoal() {
    setEditingGoalId(null);
    setGoalForm(emptyGoalForm);
    setShowGoalForm(true);
  }

  function openEditGoal(goal: GoalOverviewItem) {
    setEditingGoalId(goal.id);
    setGoalForm({
      title: goal.title,
      domain: goal.domain,
      targetDate: goal.targetDate ?? "",
      notes: goal.notes ?? "",
    });
    setShowGoalForm(true);
  }

  async function handleGoalSubmit() {
    if (!goalForm.title.trim()) return;

    if (editingGoalId) {
      await updateGoalMutation.mutateAsync({
        goalId: editingGoalId,
        title: goalForm.title.trim(),
        domain: goalForm.domain,
        targetDate: goalForm.targetDate || null,
        notes: goalForm.notes.trim() || null,
      });
    } else {
      await createGoalMutation.mutateAsync({
        title: goalForm.title.trim(),
        domain: goalForm.domain,
        targetDate: goalForm.targetDate || null,
        notes: goalForm.notes.trim() || null,
      });
    }
    setShowGoalForm(false);
    setEditingGoalId(null);
    setGoalForm(emptyGoalForm);
  }

  async function handleGoalStatusChange(goalId: string, status: GoalStatus) {
    await updateGoalMutation.mutateAsync({ goalId, status });
    if (selectedGoalId === goalId && (status === "archived" || status === "completed" || status === "paused")) {
      setSelectedGoalId(null);
    }
  }

  function openEditWeek() {
    setWeekDrafts(toRankedPlanningDrafts(weeklyPriorities));
    setEditingWeek(true);
  }

  function cancelEditWeek() {
    setWeekDrafts(toRankedPlanningDrafts(weeklyPriorities));
    setEditingWeek(false);
  }

  async function handleWeekSave() {
    const priorities = weekDrafts
      .filter((d) => d.title.trim())
      .map((d, i) => ({
        id: d.id,
        slot: planningSlots[i],
        title: d.title.trim(),
        goalId: d.goalId || null,
      }));
    await updateWeekPrioritiesMutation.mutateAsync({ priorities });
    setEditingWeek(false);
  }

  function openEditMonth() {
    setMonthTheme(monthPlan?.theme ?? "");
    setMonthOutcomes(toRankedPlanningDrafts(monthPlan?.topOutcomes ?? []));
    setEditingMonth(true);
  }

  function cancelEditMonth() {
    setMonthTheme(monthPlan?.theme ?? "");
    setMonthOutcomes(toRankedPlanningDrafts(monthPlan?.topOutcomes ?? []));
    setEditingMonth(false);
  }

  async function handleMonthSave() {
    const topOutcomes = monthOutcomes
      .filter((o) => o.title.trim())
      .map((o, i) => ({
        id: o.id,
        slot: planningSlots[i],
        title: o.title.trim(),
        goalId: o.goalId || null,
      }));
    await updateMonthFocusMutation.mutateAsync({
      theme: monthTheme.trim() || null,
      topOutcomes,
    });
    setEditingMonth(false);
  }

  // Split filtered goals for display
  const displayActiveGoals = filteredGoals.filter((g) => g.status === "active");
  const displayOtherGoals = filteredGoals.filter((g) => g.status !== "active");

  return (
    <div className="page">
      <PageHeader
        eyebrow="Direction"
        title="Goals and planning"
        description="Life-area goals with health tracking, milestones, and linked work — your operational planning surface."
      />

      {/* ── Planning Context ── */}
      <div className="dashboard-grid stagger">
        {/* ── Monthly focus ── */}
        <SectionCard
          title="Monthly focus"
          subtitle={formatMonthLabel(monthPlan?.startDate.slice(0, 7) ?? today.slice(0, 7))}
        >
          {goalsQuery.data.sectionErrors.monthPlan ? (
            <InlineErrorState
              message={goalsQuery.data.sectionErrors.monthPlan.message}
              onRetry={() => void goalsQuery.refetch()}
            />
          ) : editingMonth ? (
            <div className="stack-form">
              <div className="goals-planning-editor__toolbar">
                <p className="goals-planning-editor__hint">
                  Drag to reorder outcomes and keep the most important work at the top.
                </p>
                <button
                  className="button button--ghost button--small"
                  type="button"
                  onClick={cancelEditMonth}
                  disabled={updateMonthFocusMutation.isPending}
                >
                  Cancel
                </button>
              </div>
              <label className="field">
                <span>Theme</span>
                <input
                  type="text"
                  value={monthTheme}
                  placeholder="What is this month about?"
                  onChange={(e) => setMonthTheme(e.target.value)}
                  disabled={updateMonthFocusMutation.isPending}
                />
              </label>
              <SortablePlanningEditor
                drafts={monthOutcomes}
                onChangeDrafts={setMonthOutcomes}
                createDraft={createPlanningDraft}
                activeGoals={activeGoals}
                slotPrefix="M"
                itemLabel="outcome"
                titlePlaceholder="Key outcome"
                addLabel="+ Add outcome"
                emptyMessage="No monthly outcomes added yet."
                disabled={updateMonthFocusMutation.isPending}
              />
              {updateMonthFocusMutation.error instanceof Error ? (
                <InlineErrorState
                  message={updateMonthFocusMutation.error.message}
                  onRetry={() => void handleMonthSave()}
                />
              ) : null}
              {isMonthDirty ? (
                <div className="priority-stack__save-bar">
                  <span className="priority-stack__save-hint">
                    {monthOutcomesHaveBlankTitle
                      ? "Fill every outcome title before saving"
                      : "Unsaved changes"}
                  </span>
                  <button
                    className="button button--primary button--small"
                    type="button"
                    onClick={() => void handleMonthSave()}
                    disabled={updateMonthFocusMutation.isPending || monthOutcomesHaveBlankTitle}
                  >
                    {updateMonthFocusMutation.isPending ? "Saving…" : "Save"}
                  </button>
                </div>
              ) : (
                <button
                  className="button button--ghost button--small"
                  type="button"
                  onClick={cancelEditMonth}
                  disabled={updateMonthFocusMutation.isPending}
                  style={{ alignSelf: "flex-start" }}
                >
                  Done editing
                </button>
              )}
            </div>
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
                        {outcome.goal ? <GoalChip goal={outcome.goal} /> : null}
                      </span>
                      <span className={outcome.status === "completed" ? "tag tag--positive" : "tag tag--warning"}>
                        {outcome.status === "completed" ? "achieved" : "tracking"}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="support-copy">No monthly outcomes defined yet.</p>
              )}
              <button
                className="button button--ghost button--small"
                type="button"
                onClick={openEditMonth}
                style={{ alignSelf: "flex-start" }}
              >
                Edit monthly focus
              </button>
            </div>
          )}
        </SectionCard>

        {/* ── Weekly priorities ── */}
        <SectionCard title="Weekly priorities" subtitle="This week">
          {goalsQuery.data.sectionErrors.weekPlan ? (
            <InlineErrorState
              message={goalsQuery.data.sectionErrors.weekPlan.message}
              onRetry={() => void goalsQuery.refetch()}
            />
          ) : editingWeek ? (
            <div className="stack-form">
              <div className="goals-planning-editor__toolbar">
                <p className="goals-planning-editor__hint">
                  Reorder the week visually before you lock in what matters most.
                </p>
                <button
                  className="button button--ghost button--small"
                  type="button"
                  onClick={cancelEditWeek}
                  disabled={updateWeekPrioritiesMutation.isPending}
                >
                  Cancel
                </button>
              </div>
              <SortablePlanningEditor
                drafts={weekDrafts}
                onChangeDrafts={setWeekDrafts}
                createDraft={createPlanningDraft}
                activeGoals={activeGoals}
                slotPrefix="W"
                itemLabel="priority"
                titlePlaceholder="Weekly priority"
                addLabel="+ Add priority"
                emptyMessage="No weekly priorities added yet."
                disabled={updateWeekPrioritiesMutation.isPending}
              />
              {updateWeekPrioritiesMutation.error instanceof Error ? (
                <InlineErrorState
                  message={updateWeekPrioritiesMutation.error.message}
                  onRetry={() => void handleWeekSave()}
                />
              ) : null}
              {isWeekDirty ? (
                <div className="priority-stack__save-bar">
                  <span className="priority-stack__save-hint">
                    {weekDraftsHaveBlankTitle
                      ? "Fill every priority title before saving"
                      : "Unsaved changes"}
                  </span>
                  <button
                    className="button button--primary button--small"
                    type="button"
                    onClick={() => void handleWeekSave()}
                    disabled={updateWeekPrioritiesMutation.isPending || weekDraftsHaveBlankTitle}
                  >
                    {updateWeekPrioritiesMutation.isPending ? "Saving…" : "Save"}
                  </button>
                </div>
              ) : (
                <button
                  className="button button--ghost button--small"
                  type="button"
                  onClick={cancelEditWeek}
                  disabled={updateWeekPrioritiesMutation.isPending}
                  style={{ alignSelf: "flex-start" }}
                >
                  Done editing
                </button>
              )}
            </div>
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
                        {item.goal ? <GoalChip goal={item.goal} /> : null}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState
                  title="No weekly priorities"
                  description="This week has not been seeded with priorities yet."
                />
              )}
              <button
                className="button button--ghost button--small"
                type="button"
                onClick={openEditWeek}
                style={{ marginTop: "0.5rem" }}
              >
                Edit weekly priorities
              </button>
            </>
          )}
        </SectionCard>
      </div>

      {/* ── Goals Workspace ── */}
      <div className="goals-workspace" style={{ marginTop: "1.5rem" }}>
        {/* Filter bar */}
        <div className="filter-bar">
          <div className="filter-bar__group">
            <span className="filter-bar__label">Domain</span>
            <button
              className={`filter-chip ${filterDomain === undefined ? "filter-chip--active" : ""}`}
              type="button"
              onClick={() => setFilterDomain(undefined)}
            >
              All
            </button>
            {domainOptions.map((opt) => (
              <button
                key={opt.value}
                className={`filter-chip ${filterDomain === opt.value ? "filter-chip--active" : ""}`}
                type="button"
                onClick={() => setFilterDomain(filterDomain === opt.value ? undefined : opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="filter-bar__group">
            <span className="filter-bar__label">Status</span>
            <button
              className={`filter-chip ${filterStatus === undefined ? "filter-chip--active" : ""}`}
              type="button"
              onClick={() => setFilterStatus(undefined)}
            >
              All
            </button>
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                className={`filter-chip ${filterStatus === opt.value ? "filter-chip--active" : ""}`}
                type="button"
                onClick={() => setFilterStatus(filterStatus === opt.value ? undefined : opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {filteredGoalsQuery.isFetching && isFiltering ? (
          <p className="support-copy">Filtering…</p>
        ) : null}

        <div className="goals-workspace__main">
          {/* ── Goal List ── */}
          <div className="goals-workspace__list">
            {/* Goal form */}
            {showGoalForm ? (
              <div className="stack-form" ref={goalFormRef} style={{ padding: "1rem", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", background: "var(--panel)" }}>
                <label className="field">
                  <span>Title</span>
                  <input
                    ref={goalTitleRef}
                    type="text"
                    value={goalForm.title}
                    placeholder="What do you want to achieve?"
                    onChange={(e) => setGoalForm((p) => ({ ...p, title: e.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>Domain</span>
                  <select
                    value={goalForm.domain}
                    onChange={(e) => setGoalForm((p) => ({ ...p, domain: e.target.value as GoalFormData["domain"] }))}
                  >
                    {domainOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Target date (optional)</span>
                  <input
                    type="date"
                    value={goalForm.targetDate}
                    onChange={(e) => setGoalForm((p) => ({ ...p, targetDate: e.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>Notes (optional)</span>
                  <textarea
                    rows={2}
                    value={goalForm.notes}
                    placeholder="Context or motivation"
                    onChange={(e) => setGoalForm((p) => ({ ...p, notes: e.target.value }))}
                  />
                </label>
                <div className="button-row">
                  <button
                    className="button button--primary button--small"
                    type="button"
                    onClick={() => void handleGoalSubmit()}
                    disabled={createGoalMutation.isPending || updateGoalMutation.isPending}
                  >
                    {editingGoalId ? "Update" : "Create"}
                  </button>
                  <button
                    className="button button--ghost button--small"
                    type="button"
                    onClick={() => {
                      setShowGoalForm(false);
                      setEditingGoalId(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {/* Active goals */}
            {displayActiveGoals.length > 0 ? (
              <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {displayActiveGoals.map((goal) => (
                  <ActiveGoalCard
                    key={goal.id}
                    goal={goal}
                    selected={selectedGoalId === goal.id}
                    onSelect={() => setSelectedGoalId(selectedGoalId === goal.id ? null : goal.id)}
                  />
                ))}
              </div>
            ) : displayOtherGoals.length === 0 && !showGoalForm ? (
              <EmptyState
                title={isFiltering ? "No matching goals" : "No active goals"}
                description={isFiltering ? "Try adjusting the filters above." : "Create your first goal to start planning with purpose."}
                actionLabel={isFiltering ? undefined : "+ Add your first goal"}
                onAction={isFiltering ? undefined : openCreateGoal}
              />
            ) : null}

            {/* Inactive goals */}
            {displayOtherGoals.length > 0 && (
              <SectionCard
                title="Inactive goals"
                subtitle={`${displayOtherGoals.length} ${displayOtherGoals.length === 1 ? "goal" : "goals"}`}
              >
                <div className="inactive-goals">
                  {displayOtherGoals.map((goal) => (
                    <div key={goal.id} className="inactive-goal-row">
                      <span className={`goal-chip__dot goal-chip__dot--${goal.domain}`} />
                      <span className="inactive-goal-row__title">{goal.title}</span>
                      <span className={`tag ${goal.status === "completed" ? "tag--positive" : goal.status === "paused" ? "tag--warning" : "tag--neutral"}`}>
                        {statusLabels[goal.status] ?? goal.status}
                      </span>
                      <div className="inactive-goal-row__actions">
                        <button className="button button--ghost button--small" type="button" onClick={() => void handleGoalStatusChange(goal.id, "active")}>
                          Reactivate
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Add goal button */}
            {!showGoalForm && (
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  className="button button--primary button--small"
                  type="button"
                  onClick={openCreateGoal}
                >
                  + Add goal
                </button>
                {selectedGoalId && (
                  <button
                    className="button button--ghost button--small"
                    type="button"
                    onClick={() => {
                      const goal = allGoals.find((g) => g.id === selectedGoalId);
                      if (goal) openEditGoal(goal);
                    }}
                  >
                    Edit selected goal
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Detail Panel ── */}
          {selectedGoalId && (
            <>
              <div className="detail-backdrop" onClick={() => setSelectedGoalId(null)} />
              <div className="goals-workspace__detail">
                <GoalDetailPanel
                  goalId={selectedGoalId}
                  onClose={() => setSelectedGoalId(null)}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
