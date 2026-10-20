import { useId } from "react";

import { buildDayGroups, DAY_PART_LABELS, findNextUpId, type DayGroup } from "../dayGroups";
import type { DueHabit, HabitCheckinLevel, Routine } from "../types";
import { HabitRow } from "./HabitRow";
import { RoutineCard } from "./RoutineCard";

type DayTimelineProps = {
  hasAnyHabits: boolean;
  hasAnyRoutines: boolean;
  dueHabits: DueHabit[];
  activeRoutines: Routine[];
  isRescueMode: boolean;
  highlightedHabitId?: string | null;
  pendingHabitIds: Set<string>;
  pendingStepIds: Set<string>;
  isPausePending: boolean;
  onAddHabit: () => void;
  onAddRoutine: () => void;
  onHabitCheckin: (habitId: string, level: HabitCheckinLevel) => void;
  onHabitUndo: (habitId: string) => void;
  onToggleRoutineStep: (itemId: string, completed: boolean) => void;
  onRestDay: (habitId: string) => void;
  onEditHabit: (habitId: string) => void;
};

export function DayTimeline({
  hasAnyHabits,
  hasAnyRoutines,
  dueHabits,
  activeRoutines,
  isRescueMode,
  highlightedHabitId = null,
  pendingHabitIds,
  pendingStepIds,
  isPausePending,
  onAddHabit,
  onAddRoutine,
  onHabitCheckin,
  onHabitUndo,
  onToggleRoutineStep,
  onRestDay,
  onEditHabit,
}: DayTimelineProps) {
  const groups = buildDayGroups(dueHabits, activeRoutines);
  const nextUpId = findNextUpId(groups);
  const showGroupHeaders = groups.length > 1;
  // Drift only earns a row-level nudge when it singles a habit out.
  const driftingCount = dueHabits.filter((habit) => habit.risk.level === "drifting").length;
  const driftIsDistinctive = driftingCount > 0 && driftingCount * 2 < dueHabits.length;

  if (!hasAnyHabits && !hasAnyRoutines) {
    return (
      <section className="hb-empty" id="habits-daily-focus">
        <h2 className="hb-empty__title">Start with one habit.</h2>
        <p className="hb-empty__copy">
          Pick something small you can do today. You can give it a time, a minimum
          version, or fold it into a routine later.
        </p>
        <div className="hb-empty__actions">
          <button className="button button--primary" type="button" onClick={onAddHabit}>
            Add a habit
          </button>
          <button className="button button--ghost" type="button" onClick={onAddRoutine}>
            Add a routine
          </button>
        </div>
      </section>
    );
  }

  if (groups.length === 0) {
    return null;
  }

  return (
    <section className="hb-day" id="habits-daily-focus" aria-label="Today's habits and routines">
      {isRescueMode ? (
        <p className="hb-day__note">Rescue day: checking in logs your minimum version.</p>
      ) : null}
      {groups.map((group) => (
        <TimelineGroup
          key={group.part}
          group={group}
          showHeader={showGroupHeaders}
          nextUpId={nextUpId}
          isRescueMode={isRescueMode}
          highlightedHabitId={highlightedHabitId}
          pendingHabitIds={pendingHabitIds}
          pendingStepIds={pendingStepIds}
          isPausePending={isPausePending}
          driftIsDistinctive={driftIsDistinctive}
          onHabitCheckin={onHabitCheckin}
          onHabitUndo={onHabitUndo}
          onToggleRoutineStep={onToggleRoutineStep}
          onRestDay={onRestDay}
          onEditHabit={onEditHabit}
        />
      ))}
    </section>
  );
}

type TimelineGroupProps = {
  group: DayGroup;
  showHeader: boolean;
  nextUpId: string | null;
  isRescueMode: boolean;
  highlightedHabitId: string | null;
  pendingHabitIds: Set<string>;
  pendingStepIds: Set<string>;
  isPausePending: boolean;
  driftIsDistinctive: boolean;
  onHabitCheckin: (habitId: string, level: HabitCheckinLevel) => void;
  onHabitUndo: (habitId: string) => void;
  onToggleRoutineStep: (itemId: string, completed: boolean) => void;
  onRestDay: (habitId: string) => void;
  onEditHabit: (habitId: string) => void;
};

function TimelineGroup({
  group,
  showHeader,
  nextUpId,
  isRescueMode,
  highlightedHabitId,
  pendingHabitIds,
  pendingStepIds,
  isPausePending,
  driftIsDistinctive,
  onHabitCheckin,
  onHabitUndo,
  onToggleRoutineStep,
  onRestDay,
  onEditHabit,
}: TimelineGroupProps) {
  const headingId = useId();
  const complete = group.doneCount === group.entries.length;

  return (
    <section
      className={`hb-group${complete ? " is-complete" : ""}`}
      aria-labelledby={showHeader ? headingId : undefined}
      aria-label={showHeader ? undefined : DAY_PART_LABELS[group.part]}
    >
      {showHeader ? (
        <header className="hb-group__header">
          <h2 className="hb-group__title" id={headingId}>
            {DAY_PART_LABELS[group.part]}
          </h2>
          <span className="hb-group__count">
            {group.doneCount} of {group.entries.length}
          </span>
        </header>
      ) : null}
      <ul className="hb-group__list">
        {group.entries.map((entry) =>
          entry.kind === "habit" ? (
            <HabitRow
              key={entry.id}
              habit={entry.habit}
              isNext={entry.id === nextUpId}
              isHighlighted={entry.id === highlightedHabitId}
              isPending={pendingHabitIds.has(entry.id)}
              isRescueMode={isRescueMode}
              isPausePending={isPausePending}
              showDriftNudge={driftIsDistinctive && entry.habit.risk.level === "drifting"}
              onCheckin={onHabitCheckin}
              onUndo={onHabitUndo}
              onRestDay={onRestDay}
              onEdit={onEditHabit}
            />
          ) : (
            <RoutineCard
              key={entry.id}
              routine={entry.routine}
              isNext={entry.id === nextUpId}
              pendingStepIds={pendingStepIds}
              onToggleStep={onToggleRoutineStep}
            />
          ),
        )}
      </ul>
    </section>
  );
}
