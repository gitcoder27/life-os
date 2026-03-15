import {
  getTodayDate,
  useHabitCheckinMutation,
  useHabitsQuery,
  useRoutineCheckinMutation,
  useWeeklyMomentumQuery,
} from "../../shared/lib/api";
import { PageHeader } from "../../shared/ui/PageHeader";
import { SectionCard } from "../../shared/ui/SectionCard";

export function HabitsPage() {
  const today = getTodayDate();
  const habitsQuery = useHabitsQuery();
  const weeklyMomentumQuery = useWeeklyMomentumQuery(today);
  const habitCheckinMutation = useHabitCheckinMutation(today);
  const routineCheckinMutation = useRoutineCheckinMutation(today);
  const dueHabits = habitsQuery.data?.dueHabits ?? [];
  const morningRoutine =
    habitsQuery.data?.routines.find((routine) => routine.period === "morning")?.items ?? [];
  const eveningRoutine =
    habitsQuery.data?.routines.find((routine) => routine.period === "evening")?.items ?? [];
  const consistencyBars = weeklyMomentumQuery.data?.dailyScores ?? [];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Consistency"
        title="Habits and routines"
        description="One-tap completion for due items. Streaks and routines visible at a glance."
      />

      <div className="dashboard-grid stagger">
        <SectionCard title="Due today" subtitle={`${dueHabits.filter((habit) => habit.completedToday).length} of ${dueHabits.length} complete`}>
          <div>
            {dueHabits.map((habit) => (
              <div key={habit.id} className="habit-item">
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
                  <div className="habit-item__title">{habit.title}</div>
                  <div className="habit-item__detail">{habit.category ?? "General"} • target {habit.targetPerDay}</div>
                </div>
                <span className="streak-badge">{habit.streakCount} streak</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Morning routine" subtitle={`${morningRoutine.filter((item) => item.completedToday).length} of ${morningRoutine.length}`}>
          <div>
            {morningRoutine.map((item) => (
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
        </SectionCard>

        <SectionCard title="Evening routine" subtitle={`${eveningRoutine.filter((item) => item.completedToday).length} of ${eveningRoutine.length}`}>
          <div>
            {eveningRoutine.map((item) => (
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
        </SectionCard>

        <SectionCard title="Consistency" subtitle="Last 7 days">
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
        </SectionCard>
      </div>
    </div>
  );
}
