import { Link } from "react-router-dom";

import {
  getTodayDate,
  useHabitCheckinMutation,
  useHabitsQuery,
  useRoutineCheckinMutation,
  useWeeklyMomentumQuery,
} from "../../shared/lib/api";
import { PageHeader } from "../../shared/ui/PageHeader";
import {
  EmptyState,
  InlineErrorState,
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";
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

export function HabitsPage() {
  const today = getTodayDate();
  const habitsQuery = useHabitsQuery();
  const weeklyMomentumQuery = useWeeklyMomentumQuery(today);
  const habitCheckinMutation = useHabitCheckinMutation(today);
  const routineCheckinMutation = useRoutineCheckinMutation(today);
  const dueHabits = habitsQuery.data?.dueHabits ?? [];
  const weeklyChallenge = habitsQuery.data?.weeklyChallenge ?? null;
  const morningRoutine =
    habitsQuery.data?.routines.find((routine) => routine.period === "morning")?.items ?? [];
  const eveningRoutine =
    habitsQuery.data?.routines.find((routine) => routine.period === "evening")?.items ?? [];
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
              description="Scheduled habits are either complete or not due on this day."
            />
          )}
        </SectionCard>

        <SectionCard title="Morning routine" subtitle={`${morningRoutine.filter((item) => item.completedToday).length} of ${morningRoutine.length}`}>
          {morningRoutine.length > 0 ? (
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
          ) : (
            <EmptyState
              title="No morning routine"
              description="Create or activate a morning routine to make this section operational."
            />
          )}
        </SectionCard>

        <SectionCard title="Evening routine" subtitle={`${eveningRoutine.filter((item) => item.completedToday).length} of ${eveningRoutine.length}`}>
          {eveningRoutine.length > 0 ? (
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
          ) : (
            <EmptyState
              title="No evening routine"
              description="This space stays empty until an evening routine is active."
            />
          )}
        </SectionCard>

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
    </div>
  );
}
