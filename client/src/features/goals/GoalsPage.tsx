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

type WeekPriorityDraft = { id?: string; title: string; goalId: string };
type MonthOutcomeDraft = { id?: string; title: string; goalId: string };

export function GoalsPage() {
  const today = getTodayDate();
  const weekStart = getWeekStartDate(today);
  const monthStart = getMonthStartDate(today);

  // Filter state
  const [filterDomain, setFilterDomain] = useState<GoalDomain | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<GoalStatus | undefined>(undefined);

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
  const [weekDrafts, setWeekDrafts] = useState<WeekPriorityDraft[]>([
    { title: "", goalId: "" },
    { title: "", goalId: "" },
    { title: "", goalId: "" },
  ]);

  // Monthly focus editing
  const [editingMonth, setEditingMonth] = useState(false);
  const [monthTheme, setMonthTheme] = useState("");
  const [monthOutcomes, setMonthOutcomes] = useState<MonthOutcomeDraft[]>([
    { title: "", goalId: "" },
    { title: "", goalId: "" },
    { title: "", goalId: "" },
  ]);

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

  function openCreateGoal() {
    setEditingGoalId(null);
    setGoalForm(emptyGoalForm);
    setShowGoalForm(true);
  }

  function openEditGoal(goal: typeof allGoals[number]) {
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
  }

  function openEditWeek() {
    setWeekDrafts(
      [0, 1, 2].map((i) => {
        const existing = weeklyPriorities[i];
        return {
          id: existing?.id,
          title: existing?.title ?? "",
          goalId: existing?.goalId ?? "",
        };
      }),
    );
    setEditingWeek(true);
  }

  async function handleWeekSave() {
    const priorities = weekDrafts
      .filter((d) => d.title.trim())
      .map((d, i) => ({
        id: d.id,
        slot: ([1, 2, 3] as const)[i],
        title: d.title.trim(),
        goalId: d.goalId || null,
      }));
    await updateWeekPrioritiesMutation.mutateAsync({ priorities });
    setEditingWeek(false);
  }

  function openEditMonth() {
    setMonthTheme(monthPlan?.theme ?? "");
    setMonthOutcomes(
      [0, 1, 2].map((i) => {
        const existing = monthPlan?.topOutcomes[i];
        return {
          id: existing?.id,
          title: existing?.title ?? "",
          goalId: existing?.goalId ?? "",
        };
      }),
    );
    setEditingMonth(true);
  }

  async function handleMonthSave() {
    const topOutcomes = monthOutcomes
      .filter((o) => o.title.trim())
      .map((o, i) => ({
        id: o.id,
        slot: ([1, 2, 3] as const)[i],
        title: o.title.trim(),
        goalId: o.goalId || null,
      }));
    await updateMonthFocusMutation.mutateAsync({
      theme: monthTheme.trim() || undefined,
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
        description="Life-area outcomes, weekly priorities, and monthly focus. Intentionally lightweight."
      />

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
              <label className="field">
                <span>Theme</span>
                <input
                  type="text"
                  value={monthTheme}
                  placeholder="What is this month about?"
                  onChange={(e) => setMonthTheme(e.target.value)}
                />
              </label>
              {monthOutcomes.map((outcome, i) => (
                <div key={i} className="management-row">
                  <label className="field" style={{ flex: 1 }}>
                    <span>Outcome {i + 1}</span>
                    <input
                      type="text"
                      value={outcome.title}
                      placeholder="Key outcome"
                      onChange={(e) =>
                        setMonthOutcomes((prev) =>
                          prev.map((o, j) => (j === i ? { ...o, title: e.target.value } : o)),
                        )
                      }
                    />
                  </label>
                  <label className="field" style={{ width: "10rem" }}>
                    <span>Goal link</span>
                    <select
                      value={outcome.goalId}
                      onChange={(e) =>
                        setMonthOutcomes((prev) =>
                          prev.map((o, j) => (j === i ? { ...o, goalId: e.target.value } : o)),
                        )
                      }
                    >
                      <option value="">None</option>
                      {activeGoals.map((g) => (
                        <option key={g.id} value={g.id}>{g.title}</option>
                      ))}
                    </select>
                  </label>
                </div>
              ))}
              <div className="button-row">
                <button
                  className="button button--primary button--small"
                  type="button"
                  onClick={() => void handleMonthSave()}
                  disabled={updateMonthFocusMutation.isPending}
                >
                  {updateMonthFocusMutation.isPending ? "Saving…" : "Save"}
                </button>
                <button
                  className="button button--ghost button--small"
                  type="button"
                  onClick={() => setEditingMonth(false)}
                >
                  Cancel
                </button>
              </div>
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
              {weekDrafts.map((draft, i) => (
                <div key={i} className="management-row">
                  <label className="field" style={{ flex: 1 }}>
                    <span>Priority {i + 1}</span>
                    <input
                      type="text"
                      value={draft.title}
                      placeholder="Weekly priority"
                      onChange={(e) =>
                        setWeekDrafts((prev) =>
                          prev.map((d, j) => (j === i ? { ...d, title: e.target.value } : d)),
                        )
                      }
                    />
                  </label>
                  <label className="field" style={{ width: "10rem" }}>
                    <span>Goal link</span>
                    <select
                      value={draft.goalId}
                      onChange={(e) =>
                        setWeekDrafts((prev) =>
                          prev.map((d, j) => (j === i ? { ...d, goalId: e.target.value } : d)),
                        )
                      }
                    >
                      <option value="">None</option>
                      {activeGoals.map((g) => (
                        <option key={g.id} value={g.id}>{g.title}</option>
                      ))}
                    </select>
                  </label>
                </div>
              ))}
              <div className="button-row">
                <button
                  className="button button--primary button--small"
                  type="button"
                  onClick={() => void handleWeekSave()}
                  disabled={updateWeekPrioritiesMutation.isPending}
                >
                  {updateWeekPrioritiesMutation.isPending ? "Saving…" : "Save"}
                </button>
                <button
                  className="button button--ghost button--small"
                  type="button"
                  onClick={() => setEditingWeek(false)}
                >
                  Cancel
                </button>
              </div>
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

        {/* ── Life-area goals ── */}
        <SectionCard
          title="Life-area goals"
          subtitle={isFiltering
            ? `${filteredGoals.length} matching`
            : `${activeGoals.length} active`
          }
        >
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

          {showGoalForm ? (
            <div className="stack-form" ref={goalFormRef}>
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
          ) : (
            <>
              {displayActiveGoals.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {displayActiveGoals.map((goal) => (
                    <div key={goal.id} className="goal-card goal-card--interactive">
                      <div className="goal-card__domain">
                        <span className={`goal-chip__dot goal-chip__dot--${goal.domain}`} style={{ display: "inline-block", marginRight: "0.35rem", verticalAlign: "middle" }} />
                        {domainLabels[goal.domain] || goal.domain}
                      </div>
                      <div className="goal-card__title">{goal.title}</div>
                      {goal.notes && <div className="goal-card__notes">{goal.notes}</div>}
                      <div className="button-row button-row--tight" style={{ marginTop: "0.4rem" }}>
                        <button className="button button--ghost button--small" type="button" onClick={() => openEditGoal(goal)}>Edit</button>
                        <button className="button button--ghost button--small" type="button" onClick={() => void handleGoalStatusChange(goal.id, "paused")}>Pause</button>
                        <button className="button button--positive button--small" type="button" onClick={() => void handleGoalStatusChange(goal.id, "completed")}>Complete</button>
                        <button className="button button--ghost button--small" type="button" onClick={() => void handleGoalStatusChange(goal.id, "archived")}>Archive</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : displayOtherGoals.length === 0 ? (
                <EmptyState
                  title={isFiltering ? "No matching goals" : "No active goals"}
                  description={isFiltering ? "Try adjusting the filters above." : "Create your first goal to start planning with purpose."}
                />
              ) : null}

              {displayOtherGoals.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: displayActiveGoals.length > 0 ? "0.75rem" : undefined }}>
                  {displayOtherGoals.map((goal) => (
                    <div key={goal.id} className="goal-card">
                      <div className="goal-card__domain">
                        <span className={`goal-chip__dot goal-chip__dot--${goal.domain}`} style={{ display: "inline-block", marginRight: "0.35rem", verticalAlign: "middle" }} />
                        {domainLabels[goal.domain] || goal.domain}
                      </div>
                      <div className="goal-card__title">{goal.title}</div>
                      <div className="button-row button-row--tight" style={{ marginTop: "0.35rem" }}>
                        <span className={`tag ${goal.status === "completed" ? "tag--positive" : goal.status === "paused" ? "tag--warning" : "tag--neutral"}`}>
                          {statusLabels[goal.status] ?? goal.status}
                        </span>
                        {goal.status !== "active" && (
                          <button className="button button--ghost button--small" type="button" onClick={() => void handleGoalStatusChange(goal.id, "active")}>
                            Reactivate
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <button
                className="button button--primary button--small"
                type="button"
                onClick={openCreateGoal}
                style={{ marginTop: "0.6rem" }}
              >
                Add goal
              </button>
            </>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
