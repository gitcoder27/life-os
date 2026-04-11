import type {
  DueHabit,
  HabitItem,
  Routine,
} from "../types";
import {
  sortByTimingStatus,
  timingStatusLabel,
  timingStatusTagClass,
} from "../timing";

type DailyFocusSectionProps = {
  allHabits: HabitItem[];
  dueHabits: DueHabit[];
  activeRoutines: Routine[];
  isRescueMode: boolean;
  highlightedHabitId?: string | null;
  dueCompletedUnits: number;
  dueTargetUnits: number;
  isHabitCheckinPending: boolean;
  isRoutineCheckinPending: boolean;
  isPausePending: boolean;
  onCreateFirstHabit: () => void;
  onHabitCheckin: (habitId: string, level?: "minimum" | "standard" | "stretch") => void;
  onHabitUndo: (habitId: string) => void;
  onRoutineItemCheckin: (itemId: string) => void;
  onRoutineItemUndo: (itemId: string) => void;
  onRestDay: (habitId: string) => void;
};

export function DailyFocusSection({
  allHabits,
  dueHabits,
  activeRoutines,
  isRescueMode,
  highlightedHabitId = null,
  dueCompletedUnits,
  dueTargetUnits,
  isHabitCheckinPending,
  isRoutineCheckinPending,
  isPausePending,
  onCreateFirstHabit,
  onHabitCheckin,
  onHabitUndo,
  onRoutineItemCheckin,
  onRoutineItemUndo,
  onRestDay,
}: DailyFocusSectionProps) {
  const orderedRoutines = sortByTimingStatus(activeRoutines);

  return (
    <div className="habits-daily" id="habits-daily-focus">
      <DueHabitsGroup
        allHabits={allHabits}
        dueHabits={dueHabits}
        isRescueMode={isRescueMode}
        highlightedHabitId={highlightedHabitId}
        dueCompletedUnits={dueCompletedUnits}
        dueTargetUnits={dueTargetUnits}
        isHabitCheckinPending={isHabitCheckinPending}
        isPausePending={isPausePending}
        onCreateFirstHabit={onCreateFirstHabit}
        onHabitCheckin={onHabitCheckin}
        onHabitUndo={onHabitUndo}
        onRestDay={onRestDay}
      />
      {activeRoutines.length > 0 ? (
        orderedRoutines.map((routine) => (
          <RoutineGroup
            key={routine.id}
            routine={routine}
            isRoutineCheckinPending={isRoutineCheckinPending}
            onRoutineItemCheckin={onRoutineItemCheckin}
            onRoutineItemUndo={onRoutineItemUndo}
          />
        ))
      ) : (
        <div className="habits-group habits-group--routine">
          <div className="habits-group__header">
            <span className="habits-group__label">Routines</span>
          </div>
          <div className="habits-group__empty">
            <span className="habits-group__empty-text">No routines set up yet.</span>
          </div>
        </div>
      )}
    </div>
  );
}

type DueHabitsGroupProps = {
  allHabits: HabitItem[];
  dueHabits: DueHabit[];
  isRescueMode: boolean;
  highlightedHabitId?: string | null;
  dueCompletedUnits: number;
  dueTargetUnits: number;
  isHabitCheckinPending: boolean;
  isPausePending: boolean;
  onCreateFirstHabit: () => void;
  onHabitCheckin: (habitId: string, level?: "minimum" | "standard" | "stretch") => void;
  onHabitUndo: (habitId: string) => void;
  onRestDay: (habitId: string) => void;
};

function DueHabitsGroup({
  allHabits,
  dueHabits,
  isRescueMode,
  highlightedHabitId = null,
  dueCompletedUnits,
  dueTargetUnits,
  isHabitCheckinPending,
  isPausePending,
  onCreateFirstHabit,
  onHabitCheckin,
  onHabitUndo,
  onRestDay,
}: DueHabitsGroupProps) {
  const orderedHabits = sortByTimingStatus(dueHabits);

  return (
    <div className="habits-group habits-group--habit">
      <div className="habits-group__header">
        <span className="habits-group__label">Due today</span>
        {dueHabits.length > 0 ? (
          <span
            className={`habits-group__count${dueCompletedUnits === dueTargetUnits && dueTargetUnits > 0 ? " habits-group__count--done" : ""}`}
          >
            {dueCompletedUnits}/{dueTargetUnits}
          </span>
        ) : null}
      </div>
      {dueHabits.length > 0 ? (
        <div className="habits-group__items">
          {orderedHabits.map((habit) => {
            const riskLevel = habit.risk?.level ?? "none";
            const timingTag = timingStatusLabel(habit.timingStatusToday);

            return (
              <div
                key={habit.id}
                id={`habits-focus-${habit.id}`}
                data-habit-id={habit.id}
                className={`habits-check-row habits-check-row--habit${riskLevel === "at_risk" ? " habits-check-row--at-risk" : riskLevel === "drifting" ? " habits-check-row--drifting" : ""}`}
                style={highlightedHabitId === habit.id
                  ? {
                      borderColor: "rgba(217, 153, 58, 0.4)",
                      boxShadow: "0 0 0 1px rgba(217, 153, 58, 0.25)",
                      background: "rgba(217, 153, 58, 0.06)",
                    }
                  : undefined}
              >
                <button
                  className={`habits-check-row__box${habit.completedToday ? " habits-check-row__box--done" : ""}`}
                  type="button"
                  onClick={() => {
                    if (habit.completedToday) {
                      onHabitUndo(habit.id);
                      return;
                    }

                    onHabitCheckin(habit.id, isRescueMode ? "minimum" : "standard");
                  }}
                  disabled={isHabitCheckinPending}
                  aria-label={`${habit.completedToday ? "Reopen" : "Log progress for"} ${habit.title}`}
                >
                  {habit.completedToday ? "\u2713" : isRescueMode ? "min" : ""}
                </button>
                <div className="habits-check-row__body">
                  <div className="habits-check-row__title">
                    {habit.title}
                    {timingTag ? (
                      <span className={timingStatusTagClass(habit.timingStatusToday)} style={{ marginLeft: "0.35rem", fontSize: "var(--fs-micro)" }}>
                        {timingTag}
                      </span>
                    ) : null}
                    {riskLevel !== "none" ? (
                      <span
                        className={`risk-badge risk-badge--${riskLevel === "at_risk" ? "at-risk" : "drifting"}`}
                      >
                        {riskLevel === "at_risk" ? "at risk" : "drifting"}
                      </span>
                    ) : null}
                  </div>
                  {habit.risk?.message || habit.risk?.dueCount7d ? (
                    <div className="habits-check-row__meta">
                      {habit.achievedLevelToday ? (
                        <span>{habit.achievedLevelToday} today</span>
                      ) : null}
                      {habit.timingLabel ? <span>{habit.timingLabel}</span> : null}
                      <span>
                        {Math.min(habit.completedCountToday, habit.targetPerDay)}/
                        {habit.targetPerDay} today
                      </span>
                      {habit.risk && habit.risk.dueCount7d > 0 ? (
                        <span>
                          {habit.risk.completedCount7d}/{habit.risk.dueCount7d} last 7 days
                        </span>
                      ) : null}
                      {habit.risk?.message ? <span>{habit.risk.message}</span> : null}
                    </div>
                  ) : null}
                </div>
                <div className="habits-check-row__actions">
                  {!habit.completedToday ? (
                    <>
                      {!isRescueMode ? (
                        <button
                          className="habits-rest-btn"
                          type="button"
                          onClick={() => onHabitCheckin(habit.id, "stretch")}
                          disabled={isHabitCheckinPending}
                          title="Log stretch completion"
                        >
                          stretch
                        </button>
                      ) : null}
                      <button
                        className="habits-rest-btn"
                        type="button"
                        onClick={() => onRestDay(habit.id)}
                        disabled={isPausePending}
                        title="Take a rest day"
                      >
                        rest
                      </button>
                    </>
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
              onClick={onCreateFirstHabit}
            >
              + Create your first habit
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

type RoutineGroupProps = {
  routine: Routine;
  isRoutineCheckinPending: boolean;
  onRoutineItemCheckin: (itemId: string) => void;
  onRoutineItemUndo: (itemId: string) => void;
};

function RoutineGroup({
  routine,
  isRoutineCheckinPending,
  onRoutineItemCheckin,
  onRoutineItemUndo,
}: RoutineGroupProps) {
  const items = [...routine.items].sort((left, right) => left.sortOrder - right.sortOrder);
  const allDone = routine.completedItems === items.length && items.length > 0;
  const timingTag = timingStatusLabel(routine.timingStatusToday);

  return (
    <div className={`habits-group habits-group--routine${allDone ? " habits-group--routine-done" : ""}`}>
      <div className="habits-group__header">
        <span className="habits-group__label">
          <span>{routine.name}</span>
          {routine.timingLabel ? (
            <span className="habits-group__timing">{routine.timingLabel}</span>
          ) : null}
          {timingTag ? (
            <span className={timingStatusTagClass(routine.timingStatusToday)} style={{ marginLeft: "0.4rem", fontSize: "var(--fs-micro)" }}>
              {timingTag}
            </span>
          ) : null}
        </span>
        <span className={`habits-group__count${allDone ? " habits-group__count--done" : ""}`}>
          {routine.completedItems}/{items.length}
        </span>
      </div>
      <div className="habits-group__items">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`habits-check-row habits-check-row--routine${item.completedToday ? " habits-check-row--done" : ""}`}
            onClick={() => {
              if (item.completedToday) {
                onRoutineItemUndo(item.id);
                return;
              }

              onRoutineItemCheckin(item.id);
            }}
            disabled={isRoutineCheckinPending}
          >
            <span
              className={`habits-check-row__box${item.completedToday ? " habits-check-row__box--done" : ""}`}
            >
              {item.completedToday ? "\u2713" : ""}
            </span>
            <span className="habits-check-row__title">{item.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
