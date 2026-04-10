import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useHabitsQuery,
  useHabitCheckinMutation,
  useRoutineCheckinMutation,
  useFinanceDataQuery,
  getTodayDate,
  formatRelativeDate,
  formatWorkoutStatus,
} from "../../../shared/lib/api";
import { buildFinanceBillRoute, buildFinanceRoute } from "../../finance/finance-navigation";
import { useQuickMarkBillPaid } from "../../finance/useQuickMarkBillPaid";
import { CheckIcon } from "../helpers/icons";
import type { DayPhase } from "../helpers/day-phase";

type WorkoutStatus = "completed" | "recovery_respected" | "fallback" | "missed" | "none" | null;

type HealthDay = {
  waterMl: number;
  waterTargetMl: number;
  mealCount: number;
  workoutDay: { actualStatus: string } | null;
};

type RoutineItem = {
  id: string;
  title: string;
  sortOrder: number;
  isRequired: boolean;
  completedToday: boolean;
};

type Routine = {
  id: string;
  name: string;
  sortOrder: number;
  status: "active" | "archived";
  completedItems: number;
  totalItems: number;
  items: RoutineItem[];
};

type DueHabit = {
  id: string;
  title: string;
  targetPerDay: number;
  completedToday: boolean;
  completedCountToday: number;
  streakCount: number;
  risk: { level: "none" | "at_risk" | "drifting"; message: string | null };
};

export function DailyEssentials({
  currentDay,
  phase,
}: {
  currentDay: HealthDay | undefined;
  phase: DayPhase;
}) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  function toggle(section: string) {
    setExpandedSection((current) => (current === section ? null : section));
  }

  return (
    <aside className="daily-essentials">
      <h2 className="daily-essentials__title">Daily Essentials</h2>
      <div className="daily-essentials__rows">
        <RoutinesRow
          expanded={expandedSection === "routines"}
          onToggle={() => toggle("routines")}
        />
        <HealthRow
          currentDay={currentDay}
          expanded={expandedSection === "health"}
          onToggle={() => toggle("health")}
        />
        <FinanceRow
          expanded={expandedSection === "finance"}
          onToggle={() => toggle("finance")}
        />
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Routines & Habits Row                                               */
/* ------------------------------------------------------------------ */

function RoutinesRow({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  const today = getTodayDate();
  const habitsQuery = useHabitsQuery();
  const habitCheckin = useHabitCheckinMutation(today);
  const routineCheckin = useRoutineCheckinMutation(today);

  const data = habitsQuery.data;
  if (!data) {
    return (
      <EssentialRow
        label="Routines"
        value="Loading…"
        tone="neutral"
        expanded={false}
        onToggle={onToggle}
      />
    );
  }

  const routines: Routine[] = [...data.routines]
    .filter((r: Routine) => r.status === "active")
    .sort((left: Routine, right: Routine) => left.sortOrder - right.sortOrder);
  const dueHabits: DueHabit[] = data.dueHabits;

  const totalRoutineItems = routines.reduce((sum, r) => sum + r.totalItems, 0);
  const completedRoutineItems = routines.reduce((sum, r) => sum + r.completedItems, 0);
  const completedHabitUnits = dueHabits.reduce(
    (sum, habit) => sum + Math.min(habit.completedCountToday, habit.targetPerDay),
    0,
  );
  const totalHabitUnits = dueHabits.reduce((sum, habit) => sum + habit.targetPerDay, 0);

  const allDone =
    completedRoutineItems === totalRoutineItems &&
    completedHabitUnits === totalHabitUnits &&
    totalRoutineItems + totalHabitUnits > 0;
  const atRiskHabits = dueHabits.filter((h) => h.risk.level !== "none" && !h.completedToday);

  let summary: string;
  if (allDone) {
    summary = "All complete";
  } else {
    const parts: string[] = [];
    if (totalRoutineItems > 0) parts.push(`${completedRoutineItems}/${totalRoutineItems} routine`);
    if (totalHabitUnits > 0) parts.push(`${completedHabitUnits}/${totalHabitUnits} habits`);
    summary = parts.join(", ");
  }

  const tone = allDone ? "good" : atRiskHabits.length > 0 ? "warn" : "neutral";

  return (
    <div className="daily-essentials__section">
      <EssentialRow
        label="Routines & Habits"
        value={summary}
        tone={tone}
        expanded={expanded}
        onToggle={onToggle}
      />
      {expanded ? (
        <div className="daily-essentials__detail">
          {routines.map((routine) => (
            <div key={routine.id} className="de-routine">
              <div className="de-routine__header">
                <span>{routine.name}</span>
                <span className="de-routine__count">{routine.completedItems}/{routine.totalItems}</span>
              </div>
              <div className="de-routine__items">
                {routine.items
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`de-check-item${item.completedToday ? " de-check-item--done" : ""}`}
                      onClick={() => !item.completedToday && routineCheckin.mutate(item.id)}
                      disabled={item.completedToday || routineCheckin.isPending}
                    >
                      <span className={`de-check-item__box${item.completedToday ? " de-check-item__box--done" : ""}`}>
                        {item.completedToday ? <CheckIcon /> : null}
                      </span>
                      {item.title}
                    </button>
                  ))}
              </div>
            </div>
          ))}
          {dueHabits.length > 0 ? (
            <div className="de-routine">
              <div className="de-routine__header">
                <span>Habits</span>
                <span className="de-routine__count">{completedHabitUnits}/{totalHabitUnits}</span>
              </div>
              <div className="de-routine__items">
                {dueHabits.map((habit) => (
                  <button
                    key={habit.id}
                    type="button"
                    className={`de-check-item${habit.completedToday ? " de-check-item--done" : ""}`}
                    onClick={() => !habit.completedToday && habitCheckin.mutate(habit.id)}
                    disabled={habit.completedToday || habitCheckin.isPending}
                  >
                    <span className={`de-check-item__box${habit.completedToday ? " de-check-item__box--done" : ""}`}>
                      {habit.completedToday ? <CheckIcon /> : null}
                    </span>
                      <span className="de-check-item__title">{habit.title}</span>
                      <span>{Math.min(habit.completedCountToday, habit.targetPerDay)}/{habit.targetPerDay}</span>
                    {habit.streakCount > 0 ? (
                      <span className="de-check-item__streak">🔥{habit.streakCount}</span>
                    ) : null}
                    {habit.risk.level !== "none" && !habit.completedToday ? (
                      <span className={`de-check-item__risk de-check-item__risk--${habit.risk.level}`}>
                        {habit.risk.level === "at_risk" ? "⚠" : "↓"}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Health Row                                                          */
/* ------------------------------------------------------------------ */

function HealthRow({
  currentDay,
  expanded,
  onToggle,
}: {
  currentDay: HealthDay | undefined;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (!currentDay) {
    return (
      <EssentialRow
        label="Health"
        value="Loading…"
        tone="neutral"
        expanded={false}
        onToggle={onToggle}
      />
    );
  }

  const waterPct = currentDay.waterTargetMl > 0
    ? (currentDay.waterMl / currentDay.waterTargetMl) * 100
    : 0;
  const workoutStatus = formatWorkoutStatus(currentDay.workoutDay?.actualStatus as WorkoutStatus);
  const workoutDone = workoutStatus.toLowerCase().includes("complete") ||
    workoutStatus.toLowerCase().includes("rest") ||
    workoutStatus.toLowerCase().includes("respected");

  const issues: string[] = [];
  if (waterPct < 40) issues.push("water low");
  if (currentDay.mealCount === 0) issues.push("no meals");
  if (!workoutDone) issues.push("no workout");

  const summary = issues.length === 0
    ? "On track"
    : issues.join(", ");

  const tone = issues.length === 0 ? "good" : issues.length >= 2 ? "warn" : "neutral";

  return (
    <div className="daily-essentials__section">
      <EssentialRow
        label="Health"
        value={summary}
        tone={tone}
        expanded={expanded}
        onToggle={onToggle}
      />
      {expanded ? (
        <div className="daily-essentials__detail">
          <div className="de-health-row">
            <span>💧 Water</span>
            <span>{(currentDay.waterMl / 1000).toFixed(1)} / {(currentDay.waterTargetMl / 1000).toFixed(1)}L</span>
            <div className="de-health-bar">
              <div className="de-health-bar__fill" style={{ width: `${Math.min(waterPct, 100)}%` }} />
            </div>
          </div>
          <div className="de-health-row">
            <span>🍽 Meals</span>
            <span>{currentDay.mealCount} logged</span>
            <div className="de-health-bar">
              <div className="de-health-bar__fill" style={{ width: `${Math.min((currentDay.mealCount / 3) * 100, 100)}%` }} />
            </div>
          </div>
          <div className="de-health-row">
            <span>💪 Workout</span>
            <span>{workoutStatus}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Finance Row                                                         */
/* ------------------------------------------------------------------ */

function FinanceRow({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  const today = getTodayDate();
  const currentMonth = today.slice(0, 7);
  const financeQuery = useFinanceDataQuery(today, {
    includeRecurringExpenses: false,
    includeCategories: false,
    includeMonthPlan: false,
    includeInsights: false,
  });
  const { isPending, markPaid, pendingBillId } = useQuickMarkBillPaid(today);
  const data = financeQuery.data;

  if (!data) {
    return (
      <EssentialRow
        label="Finance"
        value="Loading…"
        tone="neutral"
        expanded={false}
        onToggle={onToggle}
      />
    );
  }

  const { summary, expenses } = data;
  const todayExpenses = expenses?.expenses?.filter((e) => e.spentOn === today) ?? [];
  const hasLoggedToday = todayExpenses.length > 0;
  const todayTotal = todayExpenses.reduce((sum, e) => sum + e.amountMinor, 0);
  const pendingBills = summary?.upcomingBills?.filter((b) => b.status === "pending" || b.status === "rescheduled") ?? [];
  const overdueBills = pendingBills.filter((b) => b.dueOn <= today);
  const actionableBills = pendingBills.slice(0, 2);
  const currencyCode = summary?.currencyCode ?? "USD";

  const issues: string[] = [];
  if (!hasLoggedToday) issues.push("no expense logged");
  if (overdueBills.length > 0) issues.push(`${overdueBills.length} bill${overdueBills.length === 1 ? "" : "s"} overdue`);

  const summaryText = issues.length === 0
    ? `${formatMinor(todayTotal, currencyCode)} logged`
    : issues.join(", ");
  const tone = overdueBills.length > 0 ? "warn" : issues.length > 0 ? "neutral" : "good";

  return (
    <div className="daily-essentials__section">
      <EssentialRow
        label="Finance"
        value={summaryText}
        tone={tone}
        expanded={expanded}
        onToggle={onToggle}
      />
      {expanded ? (
        <div className="daily-essentials__detail">
          <div className="de-finance-row">
            <span className={hasLoggedToday ? "de-finance-row--done" : ""}>
              {hasLoggedToday ? "✓" : "○"} Expenses: {hasLoggedToday ? formatMinor(todayTotal, currencyCode) : "none logged"}
            </span>
            <div className="de-finance-actions">
              <Link to={buildFinanceRoute({ month: currentMonth })} className="de-finance-link">
                {hasLoggedToday ? "Open" : "Log"}
              </Link>
            </div>
          </div>
          {actionableBills.map((bill) => (
            <div
              key={bill.id}
              className={`de-finance-row${bill.dueOn <= today ? " de-finance-row--alert" : ""}`}
            >
              <span>
                {bill.dueOn <= today ? "!" : "•"} {bill.title} {bill.dueOn <= today ? "— overdue" : `— ${formatRelativeDate(bill.dueOn).toLowerCase()}`}
              </span>
              <div className="de-finance-actions">
                <Link
                  to={buildFinanceBillRoute(bill, {
                    intent: bill.dueOn <= today ? "pay" : "view",
                    section: bill.dueOn <= today ? "due_now" : "pending_bills",
                  })}
                  className="de-finance-link"
                >
                  {bill.dueOn <= today ? "Pay" : "Open"}
                </Link>
                {bill.dueOn <= today ? (
                  <button
                    className="de-finance-button"
                    type="button"
                    disabled={isPending}
                    onClick={() => void markPaid(bill.id)}
                  >
                    {pendingBillId === bill.id ? "Saving..." : "Mark paid"}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {summary ? (
            <div className="de-finance-row de-finance-row--summary">
              Month: {formatMinor(summary.totalSpentMinor, currencyCode)}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared Row                                                          */
/* ------------------------------------------------------------------ */

function EssentialRow({
  label,
  value,
  tone,
  expanded,
  onToggle,
}: {
  label: string;
  value: string;
  tone: "good" | "warn" | "neutral";
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className={`de-row de-row--${tone}`}
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
    >
      <span className="de-row__label">{label}</span>
      <span className="de-row__value">{value}</span>
      <span className={`de-row__chevron${expanded ? " de-row__chevron--open" : ""}`}>▸</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Utilities                                                           */
/* ------------------------------------------------------------------ */

function formatMinor(amountMinor: number, currencyCode: string): string {
  const value = amountMinor / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currencyCode} ${value.toFixed(2)}`;
  }
}
