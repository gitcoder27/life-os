import {
  useHabitsQuery,
  useHabitCheckinMutation,
  useRoutineCheckinMutation,
  getTodayDate,
} from "../../../shared/lib/api";
import { CheckIcon } from "../helpers/icons";

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
  completedToday: boolean;
  streakCount: number;
  risk: {
    level: "none" | "at_risk" | "drifting";
    message: string | null;
  };
};

function getRiskColor(level: string) {
  if (level === "at_risk") return "var(--negative)";
  if (level === "drifting") return "var(--accent)";
  return "var(--text-tertiary)";
}

export function RoutinesHabits() {
  const today = getTodayDate();
  const habitsQuery = useHabitsQuery();
  const habitCheckin = useHabitCheckinMutation(today);
  const routineCheckin = useRoutineCheckinMutation(today);

  if (habitsQuery.isLoading && !habitsQuery.data) {
    return (
      <div className="today-routines-habits">
        <h3 className="today-context-title">Routines &amp; Habits</h3>
        <p className="today-routines-habits__empty">Loading…</p>
      </div>
    );
  }

  const data = habitsQuery.data;
  if (!data) return null;

  const routines = [...data.routines]
    .filter((r: Routine) => r.status === "active")
    .sort((left: Routine, right: Routine) => left.sortOrder - right.sortOrder);
  const dueHabits = data.dueHabits as DueHabit[];
  const hasContent = routines.length > 0 || dueHabits.length > 0;

  if (!hasContent) {
    return (
      <div className="today-routines-habits">
        <h3 className="today-context-title">Routines &amp; Habits</h3>
        <p className="today-routines-habits__empty">No routines or habits due today</p>
      </div>
    );
  }

  return (
    <div className="today-routines-habits">
      <h3 className="today-context-title">Routines &amp; Habits</h3>

      {routines.map((routine: Routine) => (
        <RoutineSection
          key={routine.id}
          routine={routine}
          onCheckin={(itemId: string) => routineCheckin.mutate(itemId)}
          isPending={routineCheckin.isPending}
        />
      ))}

      {dueHabits.length > 0 ? (
        <div className="today-rh__group">
          <div className="today-rh__group-header">
            <span className="today-rh__group-label">Habits</span>
            <span className="today-rh__group-count">
              {dueHabits.filter((h) => h.completedToday).length}/{dueHabits.length}
            </span>
          </div>
          <div className="today-rh__items">
            {dueHabits.map((habit) => (
              <HabitRow
                key={habit.id}
                habit={habit}
                onCheckin={() => habitCheckin.mutate(habit.id)}
                isPending={habitCheckin.isPending}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RoutineSection({
  routine,
  onCheckin,
  isPending,
}: {
  routine: Routine;
  onCheckin: (itemId: string) => void;
  isPending: boolean;
}) {
  const allDone = routine.completedItems === routine.totalItems && routine.totalItems > 0;

  return (
    <div className="today-rh__group">
      <div className="today-rh__group-header">
        <span className="today-rh__group-label">
          {routine.name}
        </span>
        <span className={`today-rh__group-count${allDone ? " today-rh__group-count--done" : ""}`}>
          {routine.completedItems}/{routine.totalItems}
        </span>
      </div>
      <div className="today-rh__items">
        {routine.items
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((item) => (
            <button
              key={item.id}
              type="button"
              className={`today-rh__item${item.completedToday ? " today-rh__item--done" : ""}`}
              onClick={() => !item.completedToday && onCheckin(item.id)}
              disabled={item.completedToday || isPending}
            >
              <span className={`today-rh__check${item.completedToday ? " today-rh__check--done" : ""}`}>
                {item.completedToday ? <CheckIcon /> : null}
              </span>
              <span className="today-rh__item-title">{item.title}</span>
            </button>
          ))}
      </div>
    </div>
  );
}

function HabitRow({
  habit,
  onCheckin,
  isPending,
}: {
  habit: DueHabit;
  onCheckin: () => void;
  isPending: boolean;
}) {
  return (
    <button
      type="button"
      className={`today-rh__item${habit.completedToday ? " today-rh__item--done" : ""}`}
      onClick={() => !habit.completedToday && onCheckin()}
      disabled={habit.completedToday || isPending}
    >
      <span className={`today-rh__check${habit.completedToday ? " today-rh__check--done" : ""}`}>
        {habit.completedToday ? <CheckIcon /> : null}
      </span>
      <span className="today-rh__item-title">{habit.title}</span>
      <span className="today-rh__item-meta">
        {habit.streakCount > 0 ? (
          <span className="today-rh__streak">🔥 {habit.streakCount}</span>
        ) : null}
        {habit.risk.level !== "none" ? (
          <span
            className="today-rh__risk"
            style={{ color: getRiskColor(habit.risk.level) }}
            title={habit.risk.message ?? undefined}
          >
            {habit.risk.level === "at_risk" ? "⚠" : "↓"}
          </span>
        ) : null}
      </span>
    </button>
  );
}
