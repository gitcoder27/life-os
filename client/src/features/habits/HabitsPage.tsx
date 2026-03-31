import { type FormEvent, useState } from "react";

import {
  getTodayDate,
  useCreateHabitPauseWindowMutation,
  useCreateHabitMutation,
  useCreateRoutineMutation,
  useDeleteHabitPauseWindowMutation,
  useGoalsListQuery,
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
  InlineErrorState,
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";
import { RecurrenceEditor, buildRecurrenceInput } from "../../shared/ui/RecurrenceEditor";

/* ── Progress Ring (weekly challenge) ── */

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

/* ── Habit Form ── */

type HabitFormValues = {
  title: string;
  category: string;
  targetPerDay: string;
  recurrenceRule: RecurrenceRuleInput | null;
  goalId: string;
};

const emptyHabitForm: HabitFormValues = { title: "", category: "", targetPerDay: "1", recurrenceRule: null, goalId: "" };

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
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(initial.category || initial.goalId || Number(initial.targetPerDay) > 1)
  );
  const goalsQuery = useGoalsListQuery();
  const activeGoals = (goalsQuery.data?.goals ?? []).filter((g) => g.status === "active");

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
        <div className="manage-form__section">
          <span className="manage-form__section-label">Schedule</span>
          <RecurrenceEditor
            value={values.recurrenceRule}
            onChange={(rule) => setValues((v) => ({ ...v, recurrenceRule: rule }))}
            context="habit"
            startsOn={values.recurrenceRule?.startsOn ?? today}
          />
        </div>
        {!showAdvanced ? (
          <button
            className="habits-advanced-toggle"
            type="button"
            onClick={() => setShowAdvanced(true)}
          >
            More options
          </button>
        ) : (
          <>
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
            <label className="field">
              <span>Linked goal (optional)</span>
              <select
                value={values.goalId}
                onChange={(e) => setValues((v) => ({ ...v, goalId: e.target.value }))}
              >
                <option value="">None</option>
                {activeGoals.map((g) => (
                  <option key={g.id} value={g.id}>{g.title}</option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>
      <div className="button-row button-row--tight">
        <button className="button button--primary button--small" type="submit" disabled={isPending || !values.title.trim()}>
          {isPending ? "Saving..." : submitLabel}
        </button>
        <button className="button button--ghost button--small" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ── Routine Form ── */

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
          {isPending ? "Saving..." : submitLabel}
        </button>
        <button className="button button--ghost button--small" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ── Pause Window Helpers ── */

type HabitPauseFormValues = {
  startsOn: string;
  endsOn: string;
  note: string;
};

function formatPauseDate(isoDate: string) {
  try {
    return new Date(`${isoDate}T12:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return isoDate;
  }
}

function formatPauseWindowLabel(window: {
  kind: "rest_day" | "vacation";
  startsOn: string;
  endsOn: string;
  isActiveToday: boolean;
}) {
  const kindLabel = window.kind === "rest_day" ? "Rest day" : "Vacation";
  const dateLabel =
    window.startsOn === window.endsOn
      ? formatPauseDate(window.startsOn)
      : `${formatPauseDate(window.startsOn)} to ${formatPauseDate(window.endsOn)}`;

  return `${kindLabel}${window.isActiveToday ? " now" : ""} \u00b7 ${dateLabel}`;
}

function getPauseWindowActionLabel(window: {
  kind: "rest_day" | "vacation";
  isActiveToday: boolean;
}) {
  if (window.kind === "vacation") {
    return window.isActiveToday ? "End vacation" : "Remove vacation";
  }

  return window.isActiveToday ? "End rest day" : "Remove rest day";
}

/* ── Collapsible Section ── */

function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  trailing,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="habits-collapsible">
      <button
        type="button"
        className="habits-collapsible__toggle"
        onClick={() => setIsOpen((v) => !v)}
      >
        <div>
          <h2 className="habits-collapsible__title">{title}</h2>
          {subtitle ? <p className="habits-collapsible__subtitle">{subtitle}</p> : null}
        </div>
        <div className="habits-collapsible__right">
          {trailing && isOpen ? trailing : null}
          <span className={`habits-collapsible__chevron${isOpen ? " habits-collapsible__chevron--open" : ""}`}>
            &#x25B8;
          </span>
        </div>
      </button>
      {isOpen ? <div className="habits-collapsible__body">{children}</div> : null}
    </div>
  );
}

/* ── Main Page ── */

export function HabitsPage() {
  const today = getTodayDate();
  const habitsQuery = useHabitsQuery();
  const weeklyMomentumQuery = useWeeklyMomentumQuery(today);
  const habitCheckinMutation = useHabitCheckinMutation(today);
  const routineCheckinMutation = useRoutineCheckinMutation(today);
  const createHabitMutation = useCreateHabitMutation();
  const updateHabitMutation = useUpdateHabitMutation();
  const createHabitPauseWindowMutation = useCreateHabitPauseWindowMutation();
  const deleteHabitPauseWindowMutation = useDeleteHabitPauseWindowMutation();
  const createRoutineMutation = useCreateRoutineMutation();
  const updateRoutineMutation = useUpdateRoutineMutation();

  /* UI state */
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [vacationHabitId, setVacationHabitId] = useState<string | null>(null);
  const [vacationForm, setVacationForm] = useState<HabitPauseFormValues>({
    startsOn: today,
    endsOn: today,
    note: "",
  });
  const [showAddRoutine, setShowAddRoutine] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [inlineCreatePeriod, setInlineCreatePeriod] = useState<"morning" | "evening" | null>(null);

  /* Derived data */
  const dueHabits = habitsQuery.data?.dueHabits ?? [];
  const allHabits = habitsQuery.data?.habits ?? [];
  const weeklyChallenge = habitsQuery.data?.weeklyChallenge ?? null;
  const routines = habitsQuery.data?.routines ?? [];
  const activeRoutines = routines.filter((r) => r.status === "active");
  const morningRoutine = activeRoutines.find((r) => r.period === "morning");
  const eveningRoutine = activeRoutines.find((r) => r.period === "evening");
  const morningItems = morningRoutine?.items ?? [];
  const eveningItems = eveningRoutine?.items ?? [];
  const consistencyBars = weeklyMomentumQuery.data?.dailyScores ?? [];

  /* Time awareness */
  const currentHour = new Date().getHours();
  const isMorning = currentHour < 12;

  /* Completion counts */
  const dueCompleted = dueHabits.filter((h) => h.completedToday).length;
  const morningCompleted = morningItems.filter((i) => i.completedToday).length;
  const eveningCompleted = eveningItems.filter((i) => i.completedToday).length;

  /* Loading & error */
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

  /* ── Handlers ── */

  function handleCreateHabit(values: HabitFormValues) {
    createHabitMutation.mutate(
      {
        title: values.title.trim(),
        category: values.category.trim() || null,
        targetPerDay: Math.max(1, Number.parseInt(values.targetPerDay, 10) || 1),
        recurrence: values.recurrenceRule ? buildRecurrenceInput(values.recurrenceRule) : undefined,
        goalId: values.goalId || null,
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
        goalId: values.goalId || null,
      },
      { onSuccess: () => setEditingHabitId(null) },
    );
  }

  function handlePermanentHabitStatusChange(habitId: string, status: "active" | "paused" | "archived") {
    updateHabitMutation.mutate({ habitId, status });
  }

  function handleRestDay(habitId: string) {
    createHabitPauseWindowMutation.mutate({
      habitId,
      kind: "rest_day",
      startsOn: today,
      endsOn: today,
    });
  }

  function handleOpenVacation(habitId: string) {
    setVacationHabitId(habitId);
    setVacationForm({ startsOn: today, endsOn: today, note: "" });
    setEditingHabitId(null);
    setShowAddHabit(false);
  }

  function handleSaveVacation(habitId: string) {
    createHabitPauseWindowMutation.mutate(
      {
        habitId,
        kind: "vacation",
        startsOn: vacationForm.startsOn,
        endsOn: vacationForm.endsOn,
        note: vacationForm.note.trim() || null,
      },
      {
        onSuccess: () => {
          setVacationHabitId(null);
          setVacationForm({ startsOn: today, endsOn: today, note: "" });
        },
      },
    );
  }

  function handleDeletePauseWindow(habitId: string, pauseWindowId: string) {
    deleteHabitPauseWindowMutation.mutate({ habitId, pauseWindowId });
  }

  function handleArchiveHabit(habitId: string) {
    handlePermanentHabitStatusChange(habitId, "archived");
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
      {
        onSuccess: () => {
          setShowAddRoutine(false);
          setInlineCreatePeriod(null);
        },
      },
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

  /* ── Renderers ── */

  function renderRoutineGroup(
    period: "morning" | "evening",
    routine: typeof morningRoutine,
    items: typeof morningItems,
    completedCount: number,
  ) {
    const label = period === "morning" ? "Morning routine" : "Evening routine";
    const icon = period === "morning" ? "\u2600\uFE0F" : "\uD83C\uDF19";
    const isCreatingInline = inlineCreatePeriod === period;

    if (isCreatingInline) {
      return (
        <div className="habits-group">
          <div className="habits-group__header">
            <span className="habits-group__label">{icon} {label}</span>
          </div>
          <RoutineForm
            initial={{ name: label, period, itemsText: "" }}
            submitLabel="Create routine"
            isPending={createRoutineMutation.isPending}
            onSubmit={handleCreateRoutine}
            onCancel={() => setInlineCreatePeriod(null)}
            lockPeriod
          />
        </div>
      );
    }

    if (!routine || items.length === 0) {
      return (
        <div className="habits-group">
          <div className="habits-group__header">
            <span className="habits-group__label">{icon} {label}</span>
          </div>
          <div className="habits-group__empty">
            <span className="habits-group__empty-text">No {period} routine set up yet</span>
            <button
              className="button button--ghost button--small"
              type="button"
              onClick={() => {
                setInlineCreatePeriod(period);
                setShowAddRoutine(false);
              }}
            >
              + Create {period} routine
            </button>
          </div>
        </div>
      );
    }

    const allDone = completedCount === items.length;

    return (
      <div className="habits-group">
        <div className="habits-group__header">
          <span className="habits-group__label">{icon} {label}</span>
          <span className={`habits-group__count${allDone ? " habits-group__count--done" : ""}`}>
            {completedCount}/{items.length}
          </span>
        </div>
        <div className="habits-group__items">
          {items
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((item) => (
              <button
                key={item.id}
                type="button"
                className={`habits-check-row${item.completedToday ? " habits-check-row--done" : ""}`}
                onClick={() => { if (!item.completedToday) routineCheckinMutation.mutate(item.id); }}
                disabled={item.completedToday || routineCheckinMutation.isPending}
              >
                <span className={`habits-check-row__box${item.completedToday ? " habits-check-row__box--done" : ""}`}>
                  {item.completedToday ? "\u2713" : ""}
                </span>
                <span className="habits-check-row__title">{item.title}</span>
              </button>
            ))}
        </div>
      </div>
    );
  }

  function renderDueHabitsGroup() {
    return (
      <div className="habits-group">
        <div className="habits-group__header">
          <span className="habits-group__label">Due today</span>
          {dueHabits.length > 0 ? (
            <span className={`habits-group__count${dueCompleted === dueHabits.length && dueHabits.length > 0 ? " habits-group__count--done" : ""}`}>
              {dueCompleted}/{dueHabits.length}
            </span>
          ) : null}
        </div>
        {dueHabits.length > 0 ? (
          <div className="habits-group__items">
            {dueHabits.map((habit) => {
              const riskLevel = habit.risk?.level ?? "none";
              return (
                <div
                  key={habit.id}
                  className={`habits-check-row habits-check-row--habit${riskLevel === "at_risk" ? " habits-check-row--at-risk" : riskLevel === "drifting" ? " habits-check-row--drifting" : ""}`}
                >
                  <button
                    className={`habits-check-row__box${habit.completedToday ? " habits-check-row__box--done" : ""}`}
                    type="button"
                    onClick={() => { if (!habit.completedToday) habitCheckinMutation.mutate(habit.id); }}
                    disabled={habit.completedToday || habitCheckinMutation.isPending}
                    aria-label={`Mark ${habit.title} ${habit.completedToday ? "complete" : "incomplete"}`}
                  >
                    {habit.completedToday ? "\u2713" : ""}
                  </button>
                  <div className="habits-check-row__body">
                    <div className="habits-check-row__title">
                      {habit.title}
                      {riskLevel !== "none" ? (
                        <span className={`risk-badge risk-badge--${riskLevel === "at_risk" ? "at-risk" : "drifting"}`}>
                          {riskLevel === "at_risk" ? "at risk" : "drifting"}
                        </span>
                      ) : null}
                    </div>
                    {(habit.risk?.message || habit.risk?.dueCount7d) ? (
                      <div className="habits-check-row__meta">
                        {habit.risk && habit.risk.dueCount7d > 0 ? (
                          <span>{habit.risk.completedCount7d}/{habit.risk.dueCount7d} this week</span>
                        ) : null}
                        {habit.risk?.message ? <span>{habit.risk.message}</span> : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="habits-check-row__actions">
                    {!habit.completedToday ? (
                      <button
                        className="habits-rest-btn"
                        type="button"
                        onClick={() => handleRestDay(habit.id)}
                        disabled={createHabitPauseWindowMutation.isPending}
                        title="Take a rest day"
                      >
                        rest
                      </button>
                    ) : null}
                    {habit.streakCount > 0 ? (
                      <span className="streak-badge">{habit.streakCount} streak</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="habits-group__empty">
            <span className="habits-group__empty-text">
              {allHabits.length === 0
                ? "No habits configured yet."
                : "All done or nothing due today."}
            </span>
            {allHabits.length === 0 ? (
              <button
                className="button button--ghost button--small"
                type="button"
                onClick={() => setShowAddHabit(true)}
              >
                + Create your first habit
              </button>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  /* ── Render order (time-aware) ── */

  const firstRoutine = isMorning
    ? renderRoutineGroup("morning", morningRoutine, morningItems, morningCompleted)
    : renderRoutineGroup("evening", eveningRoutine, eveningItems, eveningCompleted);

  const secondRoutine = isMorning
    ? renderRoutineGroup("evening", eveningRoutine, eveningItems, eveningCompleted)
    : renderRoutineGroup("morning", morningRoutine, morningItems, morningCompleted);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Consistency"
        title="Habits and routines"
        description="Check in on what matters today, track your streaks, and keep the system working."
      />

      {/* ═══ Daily Focus ═══ */}
      <div className="habits-daily">
        {firstRoutine}
        {renderDueHabitsGroup()}
        {secondRoutine}
      </div>

      {/* ═══ Signals ═══ */}
      <div className="habits-signals">
        {weeklyChallenge ? (() => {
          const wc = weeklyChallenge;
          const isDueAndIncomplete = wc.status === "due_today" && !wc.completedToday;
          return (
            <div className={`challenge-card${wc.status === "behind" ? " challenge-card--behind" : ""}`} style={{ cursor: "default" }}>
              <ChallengeProgressRing completions={wc.weekCompletions} target={wc.weekTarget} />
              <div className="challenge-card__body">
                <div className="challenge-card__label">This week's commitment</div>
                <div className="challenge-card__title">{wc.title}</div>
                <div className="challenge-card__meta">
                  {wc.weekCompletions}/{wc.weekTarget} this week
                  {wc.streakCount > 0 ? ` \u00b7 ${wc.streakCount} day streak` : ""}
                  {isDueAndIncomplete ? " \u00b7 due today" : ""}
                </div>
                {wc.message ? (
                  <div className="challenge-card__meta" style={{ marginTop: "0.15rem", fontStyle: "italic" }}>
                    {wc.message}
                  </div>
                ) : null}
                <div className="challenge-card__hint">Set during your weekly review</div>
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
          );
        })() : null}

        {weeklyMomentumQuery.isError ? (
          <InlineErrorState
            message={weeklyMomentumQuery.error instanceof Error ? weeklyMomentumQuery.error.message : "Consistency data could not load."}
            onRetry={() => void weeklyMomentumQuery.refetch()}
          />
        ) : consistencyBars.length > 0 ? (
          <div className="habits-consistency">
            <div className="habits-consistency__header">
              <span className="habits-consistency__label">Daily score trend</span>
              <span className="habits-consistency__period">Last 7 days</span>
            </div>
            <div className="habits-consistency__bars">
              {consistencyBars.map((day) => (
                <div
                  key={day.date}
                  className="habits-consistency__bar"
                  style={{
                    height: `${day.value}%`,
                    background: day.value >= 70
                      ? "linear-gradient(180deg, var(--accent), rgba(217,153,58,0.3))"
                      : "rgba(255,255,255,0.06)",
                  }}
                />
              ))}
            </div>
            <div className="habits-consistency__axis">
              <span>Mon</span>
              <span>Sun</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* ═══ Manage Habits ═══ */}
      <CollapsibleSection
        title="Manage habits"
        subtitle={`${allHabits.filter((h) => h.status === "active").length} active`}
        defaultOpen={allHabits.length === 0}
        trailing={
          !showAddHabit ? (
            <button
              className="button button--ghost button--small"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowAddHabit(true);
                setEditingHabitId(null);
                setVacationHabitId(null);
              }}
            >
              + Add habit
            </button>
          ) : null
        }
      >
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
                      goalId: habit.goalId ?? "",
                    }}
                    submitLabel="Save changes"
                    isPending={updateHabitMutation.isPending}
                    onSubmit={(values) => handleUpdateHabit(habit.id, values)}
                    onCancel={() => setEditingHabitId(null)}
                  />
                ) : (
                  <div>
                    <div className="manage-list__row">
                      <div className="manage-list__info">
                        <div className="manage-list__name">
                          {habit.title}
                          <span className="tag tag--neutral" style={{ marginLeft: "0.4rem" }}>{habit.status}</span>
                          {habit.pauseWindows.some((w) => w.isActiveToday) ? (
                            <span className="tag tag--warning" style={{ marginLeft: "0.3rem" }}>paused today</span>
                          ) : null}
                        </div>
                        <div className="manage-list__meta">
                          {habit.category ?? "General"} \u00b7 {habit.streakCount} streak
                          {habit.goal ? ` \u00b7 ${habit.goal.title}` : ""}
                          {isRecurring(habit.recurrence) && (
                            <span className="manage-list__recurrence"> \u00b7 \u21BB {formatFullRecurrenceSummary(habit.recurrence!.rule)}</span>
                          )}
                        </div>
                        {habit.pauseWindows.length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.7rem" }}>
                            {habit.pauseWindows.map((window) => (
                              <div key={window.id} className="habits-pause-pill">
                                <span
                                  className={`habits-pause-pill__label${window.isActiveToday ? " habits-pause-pill__label--active" : ""}`}
                                  title={window.note ?? undefined}
                                >
                                  {formatPauseWindowLabel(window)}
                                </span>
                                <button
                                  className="habits-pause-pill__remove"
                                  type="button"
                                  onClick={() => handleDeletePauseWindow(habit.id, window.id)}
                                  disabled={deleteHabitPauseWindowMutation.isPending}
                                >
                                  {getPauseWindowActionLabel(window)}
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="habits-manage-actions">
                        <button
                          className="button button--ghost button--small"
                          type="button"
                          onClick={() => { setEditingHabitId(habit.id); setShowAddHabit(false); setVacationHabitId(null); }}
                        >
                          Edit
                        </button>
                        {habit.status === "active" ? (
                          <>
                            <button
                              className="button button--ghost button--small"
                              type="button"
                              onClick={() => handleRestDay(habit.id)}
                              disabled={createHabitPauseWindowMutation.isPending}
                            >
                              Rest day
                            </button>
                            <button
                              className="button button--ghost button--small"
                              type="button"
                              onClick={() => handleOpenVacation(habit.id)}
                            >
                              Vacation
                            </button>
                            <button
                              className="button button--ghost button--small"
                              type="button"
                              onClick={() => handlePermanentHabitStatusChange(habit.id, "paused")}
                              disabled={updateHabitMutation.isPending}
                            >
                              Pause
                            </button>
                          </>
                        ) : habit.status === "paused" ? (
                          <button
                            className="button button--ghost button--small"
                            type="button"
                            onClick={() => handlePermanentHabitStatusChange(habit.id, "active")}
                            disabled={updateHabitMutation.isPending}
                          >
                            Resume
                          </button>
                        ) : null}
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
                    {vacationHabitId === habit.id ? (
                      <form
                        className="manage-form"
                        style={{ marginTop: "0.85rem" }}
                        onSubmit={(event) => {
                          event.preventDefault();
                          handleSaveVacation(habit.id);
                        }}
                      >
                        <div className="manage-form__row">
                          <label className="field" style={{ flex: 1 }}>
                            <span>Start date</span>
                            <input
                              type="date"
                              value={vacationForm.startsOn}
                              onChange={(e) => setVacationForm((current) => {
                                const startsOn = e.target.value;
                                const endsOn = current.endsOn < startsOn ? startsOn : current.endsOn;
                                return { ...current, startsOn, endsOn };
                              })}
                              required
                            />
                          </label>
                          <label className="field" style={{ flex: 1 }}>
                            <span>End date</span>
                            <input
                              type="date"
                              value={vacationForm.endsOn}
                              min={vacationForm.startsOn}
                              onChange={(e) => setVacationForm((current) => ({ ...current, endsOn: e.target.value }))}
                              required
                            />
                          </label>
                        </div>
                        <label className="field">
                          <span>Note (optional)</span>
                          <input
                            type="text"
                            value={vacationForm.note}
                            placeholder="Out of town, sick day, recovery week..."
                            onChange={(e) => setVacationForm((current) => ({ ...current, note: e.target.value }))}
                          />
                        </label>
                        <div className="button-row button-row--tight">
                          <button className="button button--primary button--small" type="submit" disabled={createHabitPauseWindowMutation.isPending}>
                            {createHabitPauseWindowMutation.isPending ? "Saving..." : "Save vacation"}
                          </button>
                          <button
                            className="button button--ghost button--small"
                            type="button"
                            onClick={() => setVacationHabitId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : !showAddHabit ? (
          <div className="habits-group__empty">
            <span className="habits-group__empty-text">No habits yet. Add your first habit to start tracking consistency.</span>
            <button
              className="button button--ghost button--small"
              type="button"
              onClick={() => { setShowAddHabit(true); setVacationHabitId(null); }}
            >
              + Add your first habit
            </button>
          </div>
        ) : null}

        {updateHabitMutation.error ? (
          <div className="inline-state inline-state--error" style={{ marginTop: "0.5rem" }}>
            {updateHabitMutation.error instanceof Error ? updateHabitMutation.error.message : "Could not update habit."}
          </div>
        ) : null}
        {createHabitPauseWindowMutation.error ? (
          <div className="inline-state inline-state--error" style={{ marginTop: "0.5rem" }}>
            {createHabitPauseWindowMutation.error instanceof Error
              ? createHabitPauseWindowMutation.error.message
              : "Could not save the temporary pause."}
          </div>
        ) : null}
        {deleteHabitPauseWindowMutation.error ? (
          <div className="inline-state inline-state--error" style={{ marginTop: "0.5rem" }}>
            {deleteHabitPauseWindowMutation.error instanceof Error
              ? deleteHabitPauseWindowMutation.error.message
              : "Could not remove the temporary pause."}
          </div>
        ) : null}
      </CollapsibleSection>

      {/* ═══ Manage Routines ═══ */}
      <CollapsibleSection
        title="Manage routines"
        subtitle={`${activeRoutines.length} active`}
        defaultOpen={routines.length === 0}
        trailing={
          !showAddRoutine ? (
            <button
              className="button button--ghost button--small"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowAddRoutine(true);
                setEditingRoutineId(null);
              }}
            >
              + Add routine
            </button>
          ) : null
        }
      >
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
                        <span className="tag tag--neutral" style={{ marginLeft: "0.3rem" }}>{routine.status}</span>
                      </div>
                      <div className="manage-list__meta">
                        {routine.items.length} item{routine.items.length !== 1 ? "s" : ""} \u00b7 {routine.completedItems}/{routine.totalItems} today
                      </div>
                    </div>
                    <div className="habits-manage-actions">
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
          <div className="habits-group__empty">
            <span className="habits-group__empty-text">No routines yet. Add a morning or evening routine to build structure.</span>
            <button
              className="button button--ghost button--small"
              type="button"
              onClick={() => setShowAddRoutine(true)}
            >
              + Add your first routine
            </button>
          </div>
        ) : null}

        {updateRoutineMutation.error ? (
          <div className="inline-state inline-state--error" style={{ marginTop: "0.5rem" }}>
            {updateRoutineMutation.error instanceof Error ? updateRoutineMutation.error.message : "Could not update routine."}
          </div>
        ) : null}
      </CollapsibleSection>
    </div>
  );
}
