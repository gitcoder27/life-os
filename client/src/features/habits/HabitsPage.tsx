import { type FormEvent, useState } from "react";

import {
  getTodayDate,
  useCreateHabitMutation,
  useCreateRoutineMutation,
  useHabitCheckinMutation,
  useHabitsQuery,
  useRoutineCheckinMutation,
  useUpdateHabitMutation,
  useUpdateRoutineMutation,
  useWeeklyMomentumQuery,
} from "../../shared/lib/api";
import {
  type RecurrenceRuleInput,
  formatFullRecurrenceSummary,
  isRecurring,
} from "../../shared/lib/recurrence";
import { PageHeader } from "../../shared/ui/PageHeader";
import {
  EmptyState,
  InlineErrorState,
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";
import { RecurrenceEditor, buildRecurrenceInput } from "../../shared/ui/RecurrenceEditor";
import { SectionCard } from "../../shared/ui/SectionCard";

function ChallengeProgressRing({ completions, target }: { completions: number; target: number }) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const progress = target > 0 ? Math.min(completions / target, 1) : 0;
  const offset = circumference * (1 - progress);

  return (
    <svg className="challenge-card__progress-ring" viewBox="0 0 40 40">
      <circle className="ring-bg" cx="20" cy="20" r={radius} />
      <circle
        className="ring-fill"
        cx="20"
        cy="20"
        r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 20 20)"
      />
    </svg>
  );
}

type HabitFormValues = {
  title: string;
  category: string;
  targetPerDay: string;
  recurrenceRule: RecurrenceRuleInput | null;
};

const emptyHabitForm: HabitFormValues = { title: "", category: "", targetPerDay: "1", recurrenceRule: null };

function HabitForm({
  initial = emptyHabitForm,
  submitLabel,
  isPending,
  onSubmit,
  onCancel,
}: {
  initial?: HabitFormValues;
  submitLabel: string;
  isPending: boolean;
  onSubmit: (values: HabitFormValues) => void;
  onCancel: () => void;
}) {
  const today = getTodayDate();
  const [values, setValues] = useState<HabitFormValues>(initial);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!values.title.trim()) return;
    onSubmit(values);
  }

  return (
    <form className="manage-form" onSubmit={handleSubmit}>
      <div className="manage-form__fields">
        <label className="field">
          <span>Title</span>
          <input
            type="text"
            placeholder="e.g. Morning workout"
            value={values.title}
            onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
            autoFocus
          />
        </label>
        <div className="manage-form__row">
          <label className="field" style={{ flex: 1 }}>
            <span>Category</span>
            <input
              type="text"
              placeholder="General"
              value={values.category}
              onChange={(e) => setValues((v) => ({ ...v, category: e.target.value }))}
            />
          </label>
          <label className="field" style={{ width: "6rem" }}>
            <span>Target / day</span>
            <input
              type="number"
              min="1"
              max="10"
              value={values.targetPerDay}
              onChange={(e) => setValues((v) => ({ ...v, targetPerDay: e.target.value }))}
            />
          </label>
        </div>
        <div className="manage-form__section">
          <span className="manage-form__section-label">Schedule</span>
          <RecurrenceEditor
            value={values.recurrenceRule}
            onChange={(rule) => setValues((v) => ({ ...v, recurrenceRule: rule }))}
            context="habit"
            startsOn={values.recurrenceRule?.startsOn ?? today}
          />
        </div>
      </div>
      <div className="button-row button-row--tight">
        <button className="button button--primary button--small" type="submit" disabled={isPending || !values.title.trim()}>
          {isPending ? "Saving…" : submitLabel}
        </button>
        <button className="button button--ghost button--small" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

type RoutineFormValues = {
  name: string;
  period: "morning" | "evening";
  itemsText: string;
};

const emptyRoutineForm: RoutineFormValues = { name: "", period: "morning", itemsText: "" };

function RoutineForm({
  initial = emptyRoutineForm,
  submitLabel,
  isPending,
  onSubmit,
  onCancel,
  lockPeriod = false,
}: {
  initial?: RoutineFormValues;
  submitLabel: string;
  isPending: boolean;
  onSubmit: (values: RoutineFormValues) => void;
  onCancel: () => void;
  lockPeriod?: boolean;
}) {
  const [values, setValues] = useState<RoutineFormValues>(initial);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!values.name.trim()) return;
    onSubmit(values);
  }

  return (
    <form className="manage-form" onSubmit={handleSubmit}>
      <div className="manage-form__fields">
        <div className="manage-form__row">
          <label className="field" style={{ flex: 1 }}>
            <span>Name</span>
            <input
              type="text"
              placeholder="e.g. Morning routine"
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              autoFocus
            />
          </label>
          <label className="field" style={{ width: "9rem" }}>
            <span>Period</span>
            <select
              value={values.period}
              onChange={(e) => setValues((v) => ({ ...v, period: e.target.value as "morning" | "evening" }))}
              disabled={lockPeriod}
            >
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
            </select>
          </label>
        </div>
        <label className="field">
          <span>Items (one per line)</span>
          <textarea
            rows={4}
            placeholder={"Drink water\nReview priorities\nCheck calendar"}
            value={values.itemsText}
            onChange={(e) => setValues((v) => ({ ...v, itemsText: e.target.value }))}
          />
        </label>
      </div>
      <div className="button-row button-row--tight">
        <button className="button button--primary button--small" type="submit" disabled={isPending || !values.name.trim()}>
          {isPending ? "Saving…" : submitLabel}
        </button>
        <button className="button button--ghost button--small" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function HabitsPage() {
  const today = getTodayDate();
  const habitsQuery = useHabitsQuery();
  const weeklyMomentumQuery = useWeeklyMomentumQuery(today);
  const habitCheckinMutation = useHabitCheckinMutation(today);
  const routineCheckinMutation = useRoutineCheckinMutation(today);
  const createHabitMutation = useCreateHabitMutation();
  const updateHabitMutation = useUpdateHabitMutation();
  const createRoutineMutation = useCreateRoutineMutation();
  const updateRoutineMutation = useUpdateRoutineMutation();

  const [showAddHabit, setShowAddHabit] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [showAddRoutine, setShowAddRoutine] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);

  const dueHabits = habitsQuery.data?.dueHabits ?? [];
  const allHabits = habitsQuery.data?.habits ?? [];
  const weeklyChallenge = habitsQuery.data?.weeklyChallenge ?? null;
  const routines = habitsQuery.data?.routines ?? [];
  const morningRoutine = routines.find((routine) => routine.period === "morning");
  const eveningRoutine = routines.find((routine) => routine.period === "evening");
  const morningItems = morningRoutine?.items ?? [];
  const eveningItems = eveningRoutine?.items ?? [];
  const consistencyBars = weeklyMomentumQuery.data?.dailyScores ?? [];

  if (habitsQuery.isLoading && !habitsQuery.data) {
    return (
      <PageLoadingState
        title="Loading habits"
        description="Checking due habits, routines, and consistency signals."
      />
    );
  }

  if (habitsQuery.isError || !habitsQuery.data) {
    return (
      <PageErrorState
        title="Habits could not load"
        message={habitsQuery.error instanceof Error ? habitsQuery.error.message : undefined}
        onRetry={() => void habitsQuery.refetch()}
      />
    );
  }

  function handleCreateHabit(values: HabitFormValues) {
    createHabitMutation.mutate(
      {
        title: values.title.trim(),
        category: values.category.trim() || null,
        targetPerDay: Math.max(1, Number.parseInt(values.targetPerDay, 10) || 1),
        recurrence: values.recurrenceRule ? buildRecurrenceInput(values.recurrenceRule) : undefined,
      },
      { onSuccess: () => setShowAddHabit(false) },
    );
  }

  function handleUpdateHabit(habitId: string, values: HabitFormValues) {
    updateHabitMutation.mutate(
      {
        habitId,
        title: values.title.trim(),
        category: values.category.trim() || null,
        targetPerDay: Math.max(1, Number.parseInt(values.targetPerDay, 10) || 1),
        recurrence: values.recurrenceRule ? buildRecurrenceInput(values.recurrenceRule) : undefined,
      },
      { onSuccess: () => setEditingHabitId(null) },
    );
  }

  function handleArchiveHabit(habitId: string) {
    updateHabitMutation.mutate({ habitId, status: "archived" });
  }

  function handleCreateRoutine(values: RoutineFormValues) {
    const items = values.itemsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((title, index) => ({ title, sortOrder: index }));
    if (!items.length) return;
    createRoutineMutation.mutate(
      { name: values.name.trim(), period: values.period, items },
      { onSuccess: () => setShowAddRoutine(false) },
    );
  }

  function handleUpdateRoutine(routineId: string, values: RoutineFormValues) {
    const items = values.itemsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((title, index) => ({ title, sortOrder: index }));
    updateRoutineMutation.mutate(
      { routineId, name: values.name.trim(), items: items.length ? items : undefined },
      { onSuccess: () => setEditingRoutineId(null) },
    );
  }

  function handleArchiveRoutine(routineId: string) {
    updateRoutineMutation.mutate({ routineId, status: "archived" });
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Consistency"
        title="Habits and routines"
        description="One-tap completion for due items. Streaks and routines visible at a glance."
      />

      {weeklyChallenge ? (() => {
        const wc = weeklyChallenge;
        const isDueAndIncomplete = wc.status === "due_today" && !wc.completedToday;
        return (
          <div className="guidance-rail">
            <div className={`challenge-card${wc.status === "behind" ? " challenge-card--behind" : ""}`} style={{ cursor: "default" }}>
              <ChallengeProgressRing completions={wc.weekCompletions} target={wc.weekTarget} />
              <div className="challenge-card__body">
                <div className="challenge-card__label">This week's commitment</div>
                <div className="challenge-card__title">{wc.title}</div>
                <div className="challenge-card__meta">
                  {wc.weekCompletions}/{wc.weekTarget} this week
                  {wc.streakCount > 0 ? ` · ${wc.streakCount} day streak` : ""}
                  {isDueAndIncomplete ? " · due today" : ""}
                </div>
                {wc.message ? (
                  <div className="challenge-card__meta" style={{ marginTop: "0.15rem", fontStyle: "italic" }}>
                    {wc.message}
                  </div>
                ) : null}
              </div>
              <span className="challenge-card__status">
                {wc.completedToday ? (
                  <span className="tag tag--positive">done today</span>
                ) : (
                  <span className={`tag ${wc.status === "on_track" ? "tag--positive" : wc.status === "due_today" ? "tag--warning" : "tag--negative"}`}>
                    {wc.status === "on_track" ? "on track" : wc.status === "due_today" ? "due today" : "behind"}
                  </span>
                )}
              </span>
            </div>
          </div>
        );
      })() : null}

      <div className="dashboard-grid stagger">
        {/* ── Due today (check-in) ── */}
        <SectionCard title="Due today" subtitle={`${dueHabits.filter((habit) => habit.completedToday).length} of ${dueHabits.length} complete`}>
          {dueHabits.length > 0 ? (
            <div>
              {dueHabits.map((habit) => {
                const riskLevel = habit.risk?.level ?? "none";
                const riskClass = riskLevel === "at_risk" ? " habit-item--at-risk" : riskLevel === "drifting" ? " habit-item--drifting" : "";
                return (
                  <div key={habit.id} className={`habit-item${riskClass}`}>
                    <button
                      className={`habit-item__check${habit.completedToday ? " habit-item__check--done" : ""}`}
                      type="button"
                      onClick={() => {
                        if (!habit.completedToday) {
                          habitCheckinMutation.mutate(habit.id);
                        }
                      }}
                      aria-label={`Mark ${habit.title} ${habit.completedToday ? "complete" : "incomplete"}`}
                    >
                      {habit.completedToday ? "\u2713" : ""}
                    </button>
                    <div className="habit-item__info">
                      <div className="habit-item__title">
                        {habit.title}
                        {riskLevel !== "none" ? (
                          <span className={`risk-badge risk-badge--${riskLevel === "at_risk" ? "at-risk" : "drifting"}`} style={{ marginLeft: "0.4rem" }}>
                            {riskLevel === "at_risk" ? "at risk" : "drifting"}
                          </span>
                        ) : null}
                      </div>
                      <div className="habit-item__detail">
                        {habit.category ?? "General"} · target {habit.targetPerDay}
                        {isRecurring(habit.recurrence) && (
                          <span className="habit-item__recurrence"> · {formatFullRecurrenceSummary(habit.recurrence!.rule)}</span>
                        )}
                        {habit.risk && habit.risk.dueCount7d > 0 ? (
                          <span className="habit-item__stats"> · {habit.risk.completedCount7d}/{habit.risk.dueCount7d} this week</span>
                        ) : null}
                      </div>
                      {habit.risk?.message ? (
                        <div className="habit-item__risk-msg">{habit.risk.message}</div>
                      ) : null}
                    </div>
                    <span className="streak-badge">{habit.streakCount} streak</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="Nothing due today"
              description={allHabits.length === 0
                ? "No habits configured yet. Add your first habit below."
                : "Scheduled habits are either complete or not due on this day."}
            />
          )}
        </SectionCard>

        {/* ── Morning routine (check-in) ── */}
        <SectionCard title="Morning routine" subtitle={`${morningItems.filter((item) => item.completedToday).length} of ${morningItems.length}`}>
          {morningItems.length > 0 ? (
            <div>
              {morningItems.map((item) => (
                <div key={item.id} className="habit-item">
                  <button
                    className={`habit-item__check${item.completedToday ? " habit-item__check--done" : ""}`}
                    type="button"
                    onClick={() => {
                      if (!item.completedToday) {
                        routineCheckinMutation.mutate(item.id);
                      }
                    }}
                    aria-label={`Mark ${item.title}`}
                  >
                    {item.completedToday ? "\u2713" : ""}
                  </button>
                  <div className="habit-item__info">
                    <div className="habit-item__title">{item.title}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No morning routine"
              description="Add a morning routine in the manage section below to track it here."
            />
          )}
        </SectionCard>

        {/* ── Evening routine (check-in) ── */}
        <SectionCard title="Evening routine" subtitle={`${eveningItems.filter((item) => item.completedToday).length} of ${eveningItems.length}`}>
          {eveningItems.length > 0 ? (
            <div>
              {eveningItems.map((item) => (
                <div key={item.id} className="habit-item">
                  <button
                    className={`habit-item__check${item.completedToday ? " habit-item__check--done" : ""}`}
                    type="button"
                    onClick={() => {
                      if (!item.completedToday) {
                        routineCheckinMutation.mutate(item.id);
                      }
                    }}
                    aria-label={`Mark ${item.title}`}
                  >
                    {item.completedToday ? "\u2713" : ""}
                  </button>
                  <div className="habit-item__info">
                    <div className="habit-item__title">{item.title}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No evening routine"
              description="Add an evening routine in the manage section below to track it here."
            />
          )}
        </SectionCard>

        {/* ── Consistency ── */}
        <SectionCard title="Consistency" subtitle="Last 7 days">
          {weeklyMomentumQuery.isError ? (
            <InlineErrorState
              message={weeklyMomentumQuery.error instanceof Error ? weeklyMomentumQuery.error.message : "Consistency data could not load."}
              onRetry={() => void weeklyMomentumQuery.refetch()}
            />
          ) : consistencyBars.length > 0 ? (
            <>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "end", height: "3rem" }}>
                {consistencyBars.map((day) => (
                  <div
                    key={day.date}
                    style={{
                      flex: 1,
                      height: `${day.value}%`,
                      borderRadius: "var(--r-xs)",
                      background: day.value >= 70
                        ? "linear-gradient(180deg, var(--accent), rgba(217,153,58,0.3))"
                        : "rgba(255,255,255,0.06)",
                      transition: "height 0.6s var(--ease)",
                    }}
                  />
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.4rem" }}>
                <span className="list__subtle">Mon</span>
                <span className="list__subtle">Sun</span>
              </div>
            </>
          ) : (
            <EmptyState
              title="No consistency history yet"
              description="Finalize a few days and this trend view will start to carry signal."
            />
          )}
        </SectionCard>
      </div>

      {/* ── Manage habits ── */}
      <div className="manage-section">
        <div className="manage-section__header">
          <div>
            <h2 className="manage-section__title">Manage habits</h2>
            <p className="manage-section__subtitle">Create, edit, or archive your tracked habits</p>
          </div>
          {!showAddHabit ? (
            <button
              className="button button--ghost button--small"
              type="button"
              onClick={() => { setShowAddHabit(true); setEditingHabitId(null); }}
            >
              + Add habit
            </button>
          ) : null}
        </div>

        {showAddHabit ? (
          <HabitForm
            submitLabel="Create habit"
            isPending={createHabitMutation.isPending}
            onSubmit={handleCreateHabit}
            onCancel={() => setShowAddHabit(false)}
          />
        ) : null}

        {createHabitMutation.error ? (
          <div className="inline-state inline-state--error" style={{ marginTop: "0.5rem" }}>
            {createHabitMutation.error instanceof Error ? createHabitMutation.error.message : "Could not create habit."}
          </div>
        ) : null}

        {allHabits.length > 0 ? (
          <div className="manage-list">
            {allHabits.map((habit) => (
              <div key={habit.id} className="manage-list__item">
                {editingHabitId === habit.id ? (
                  <HabitForm
                    initial={{
                      title: habit.title,
                      category: habit.category ?? "",
                      targetPerDay: String(habit.targetPerDay),
                      recurrenceRule: habit.recurrence?.rule ?? null,
                    }}
                    submitLabel="Save changes"
                    isPending={updateHabitMutation.isPending}
                    onSubmit={(values) => handleUpdateHabit(habit.id, values)}
                    onCancel={() => setEditingHabitId(null)}
                  />
                ) : (
                  <div className="manage-list__row">
                    <div className="manage-list__info">
                      <div className="manage-list__name">
                        {habit.title}
                        <span className={`tag tag--neutral`} style={{ marginLeft: "0.4rem" }}>{habit.status}</span>
                      </div>
                      <div className="manage-list__meta">
                        {habit.category ?? "General"} · target {habit.targetPerDay}/day · {habit.streakCount} streak
                        {isRecurring(habit.recurrence) && (
                          <span className="manage-list__recurrence"> · ↻ {formatFullRecurrenceSummary(habit.recurrence!.rule)}</span>
                        )}
                      </div>
                    </div>
                    <div className="button-row button-row--tight">
                      <button
                        className="button button--ghost button--small"
                        type="button"
                        onClick={() => { setEditingHabitId(habit.id); setShowAddHabit(false); }}
                      >
                        Edit
                      </button>
                      {habit.status !== "archived" ? (
                        <button
                          className="button button--ghost button--small"
                          type="button"
                          style={{ color: "var(--negative)" }}
                          onClick={() => handleArchiveHabit(habit.id)}
                          disabled={updateHabitMutation.isPending}
                        >
                          Archive
                        </button>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : !showAddHabit ? (
          <EmptyState
            title="No habits yet"
            description="Add your first habit to start tracking daily consistency."
            actionLabel="+ Add your first habit"
            onAction={() => setShowAddHabit(true)}
          />
        ) : null}

        {updateHabitMutation.error ? (
          <div className="inline-state inline-state--error" style={{ marginTop: "0.5rem" }}>
            {updateHabitMutation.error instanceof Error ? updateHabitMutation.error.message : "Could not update habit."}
          </div>
        ) : null}
      </div>

      {/* ── Manage routines ── */}
      <div className="manage-section">
        <div className="manage-section__header">
          <div>
            <h2 className="manage-section__title">Manage routines</h2>
            <p className="manage-section__subtitle">Create, edit, or archive morning and evening routines</p>
          </div>
          {!showAddRoutine ? (
            <button
              className="button button--ghost button--small"
              type="button"
              onClick={() => { setShowAddRoutine(true); setEditingRoutineId(null); }}
            >
              + Add routine
            </button>
          ) : null}
        </div>

        {showAddRoutine ? (
          <RoutineForm
            submitLabel="Create routine"
            isPending={createRoutineMutation.isPending}
            onSubmit={handleCreateRoutine}
            onCancel={() => setShowAddRoutine(false)}
          />
        ) : null}

        {createRoutineMutation.error ? (
          <div className="inline-state inline-state--error" style={{ marginTop: "0.5rem" }}>
            {createRoutineMutation.error instanceof Error ? createRoutineMutation.error.message : "Could not create routine."}
          </div>
        ) : null}

        {routines.length > 0 ? (
          <div className="manage-list">
            {routines.map((routine) => (
              <div key={routine.id} className="manage-list__item">
                {editingRoutineId === routine.id ? (
                  <RoutineForm
                    initial={{
                      name: routine.name,
                      period: routine.period,
                      itemsText: routine.items
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((item) => item.title)
                        .join("\n"),
                    }}
                    submitLabel="Save changes"
                    isPending={updateRoutineMutation.isPending}
                    onSubmit={(values) => handleUpdateRoutine(routine.id, values)}
                    onCancel={() => setEditingRoutineId(null)}
                    lockPeriod
                  />
                ) : (
                  <div className="manage-list__row">
                    <div className="manage-list__info">
                      <div className="manage-list__name">
                        {routine.name}
                        <span className="tag tag--neutral" style={{ marginLeft: "0.4rem" }}>{routine.period}</span>
                        <span className={`tag tag--neutral`} style={{ marginLeft: "0.3rem" }}>{routine.status}</span>
                      </div>
                      <div className="manage-list__meta">
                        {routine.items.length} item{routine.items.length !== 1 ? "s" : ""} · {routine.completedItems}/{routine.totalItems} today
                      </div>
                    </div>
                    <div className="button-row button-row--tight">
                      <button
                        className="button button--ghost button--small"
                        type="button"
                        onClick={() => { setEditingRoutineId(routine.id); setShowAddRoutine(false); }}
                      >
                        Edit
                      </button>
                      {routine.status !== "archived" ? (
                        <button
                          className="button button--ghost button--small"
                          type="button"
                          style={{ color: "var(--negative)" }}
                          onClick={() => handleArchiveRoutine(routine.id)}
                          disabled={updateRoutineMutation.isPending}
                        >
                          Archive
                        </button>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : !showAddRoutine ? (
          <EmptyState
            title="No routines yet"
            description="Add a morning or evening routine to build structured daily habits."
            actionLabel="+ Add your first routine"
            onAction={() => setShowAddRoutine(true)}
          />
        ) : null}

        {updateRoutineMutation.error ? (
          <div className="inline-state inline-state--error" style={{ marginTop: "0.5rem" }}>
            {updateRoutineMutation.error instanceof Error ? updateRoutineMutation.error.message : "Could not update routine."}
          </div>
        ) : null}
      </div>
    </div>
  );
}
