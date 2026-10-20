import { useId, useState } from "react";

import { formatClock, habitStartMinutes } from "../dayGroups";
import type { DueHabit, HabitCheckinLevel } from "../types";
import { CheckMark } from "./CheckMark";
import { WeekStrip } from "./WeekStrip";

type HabitRowProps = {
  habit: DueHabit;
  isNext: boolean;
  isHighlighted: boolean;
  isPending: boolean;
  isRescueMode: boolean;
  isPausePending: boolean;
  showDriftNudge: boolean;
  onCheckin: (habitId: string, level: HabitCheckinLevel) => void;
  onUndo: (habitId: string) => void;
  onRestDay: (habitId: string) => void;
  onEdit: (habitId: string) => void;
};

type MetaItem = { text: string; tone?: "accent" };

function buildMeta(habit: DueHabit, isRescueMode: boolean, showDriftNudge: boolean): MetaItem[] {
  const done = habit.completedToday;
  const when =
    habit.timingMode === "anchor"
      ? habit.anchorText
      : habit.timingMode === "time_window"
        ? habit.timingLabel
        : null;

  let status: MetaItem | null = null;
  if (done && habit.achievedLevelToday === "minimum") {
    status = { text: "Minimum logged" };
  } else if (done && habit.achievedLevelToday === "stretch") {
    status = { text: "Stretch logged" };
  } else if (!done && habit.targetPerDay > 1) {
    status = { text: `${Math.min(habit.completedCountToday, habit.targetPerDay)} of ${habit.targetPerDay} today` };
  } else if (!done && isRescueMode && habit.minimumVersion) {
    status = { text: `Minimum: ${habit.minimumVersion}` };
  } else if (!done && habit.risk.reason === "streak_at_risk" && habit.streakCount >= 2) {
    status = { text: `Keep your streak of ${habit.streakCount} going`, tone: "accent" };
  } else if (!done && showDriftNudge && habit.minimumVersion) {
    status = { text: `Restart small: ${habit.minimumVersion}` };
  } else if (habit.streakCount > 0) {
    status = { text: `${habit.streakCount} in a row` };
  }

  return [
    when ? { text: when } : null,
    status,
    { text: `${habit.durationMinutes} min` },
  ]
    .filter((item): item is MetaItem => item !== null)
    .slice(0, 2);
}

function describeRecentWeek(habit: DueHabit) {
  const days = habit.recentDays ?? [];
  if (days.length === 0) return null;

  const scheduled = days.filter((day) => ["done", "partial", "missed"].includes(day.state)).length;
  const done = days.filter((day) => day.state === "done").length;
  const rest = days.filter((day) => day.state === "rest").length;
  const restText = rest > 0 ? ` ${rest} rest ${rest === 1 ? "day" : "days"}.` : "";

  if (scheduled === 0) return `Nothing scheduled in the past week.${restText}`;
  return `Done on ${done} of ${scheduled} scheduled ${scheduled === 1 ? "day" : "days"} this past week.${restText}`;
}

export function HabitRow({
  habit,
  isNext,
  isHighlighted,
  isPending,
  isRescueMode,
  isPausePending,
  showDriftNudge,
  onCheckin,
  onUndo,
  onRestDay,
  onEdit,
}: HabitRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const done = habit.completedToday;
  const startMinutes = habitStartMinutes(habit);
  const clock = startMinutes === null ? null : formatClock(startMinutes);
  const meta = buildMeta(habit, isRescueMode, showDriftNudge);
  const versions = [
    ["Minimum", habit.minimumVersion],
    ["Standard", habit.standardVersion],
    ["Stretch", habit.stretchVersion],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  const weekSummary = describeRecentWeek(habit);
  const encouragement =
    habit.risk.level === "drifting" && !done
      ? habit.minimumVersion
        ? `A small version still counts: ${habit.minimumVersion}.`
        : "Any version today counts."
      : null;
  const checkLabel = `Check in ${habit.title}${isRescueMode ? " (minimum)" : ""}${
    habit.targetPerDay > 1
      ? `, ${Math.min(habit.completedCountToday, habit.targetPerDay)} of ${habit.targetPerDay} today`
      : ""
  }`;

  function handleCheck() {
    if (isPending) return;
    if (done) {
      onUndo(habit.id);
      return;
    }
    onCheckin(habit.id, isRescueMode ? "minimum" : "standard");
  }

  return (
    <li
      id={`habits-focus-${habit.id}`}
      data-habit-id={habit.id}
      className={`hb-row${done ? " is-done" : ""}${isNext ? " is-next" : ""}${isHighlighted ? " is-highlighted" : ""}${isOpen ? " is-open" : ""}`}
    >
      <div className="hb-row__main">
        <span className="hb-row__time">
          {isNext ? <span className="sr-only">Next up: </span> : null}
          {clock ? (
            <>
              {clock.time}
              <span className="hb-row__period">{clock.period}</span>
            </>
          ) : null}
        </span>
        <div className="hb-row__body">
          <span className="hb-row__title">{habit.title}</span>
          {meta.length > 0 ? (
            <span className="hb-row__meta">
              {meta.map((item, index) => (
                <span
                  key={index}
                  className={`hb-row__meta-item${item.tone === "accent" ? " hb-row__meta-item--accent" : ""}`}
                >
                  {item.text}
                </span>
              ))}
            </span>
          ) : null}
        </div>
        <span className="hb-row__week">
          <WeekStrip days={habit.recentDays ?? []} />
        </span>
        <button
          type="button"
          className="hb-row__check"
          aria-pressed={done}
          aria-label={checkLabel}
          aria-disabled={isPending || undefined}
          onClick={handleCheck}
        >
          <CheckMark
            done={done}
            count={habit.completedCountToday}
            target={habit.targetPerDay}
          />
        </button>
        <button
          type="button"
          className="hb-row__more"
          aria-expanded={isOpen}
          aria-controls={panelId}
          aria-label={`${isOpen ? "Hide" : "Show"} details for ${habit.title}`}
          onClick={() => setIsOpen((current) => !current)}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <circle cx="4.5" cy="10" r="1.6" />
            <circle cx="10" cy="10" r="1.6" />
            <circle cx="15.5" cy="10" r="1.6" />
          </svg>
        </button>
      </div>

      {isOpen ? (
        <div className="hb-details" id={panelId}>
          {weekSummary || encouragement ? (
            <p className="hb-details__summary">
              {weekSummary}
              {encouragement ? <span className="hb-details__nudge"> {encouragement}</span> : null}
            </p>
          ) : null}
          {versions.length > 0 ? (
            <dl className="hb-details__versions">
              {versions.map(([label, value]) => (
                <div key={label} className="hb-details__version">
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {habit.repairRule ? (
            <p className="hb-details__note">
              <span className="hb-details__note-label">If you miss a day</span>
              {habit.repairRule}
            </p>
          ) : null}
          <div className="hb-details__actions">
            {!done && !isRescueMode ? (
              <button
                className="button button--ghost button--small"
                type="button"
                onClick={() => onCheckin(habit.id, "stretch")}
                aria-disabled={isPending || undefined}
              >
                Log stretch
              </button>
            ) : null}
            {!done ? (
              <button
                className="button button--ghost button--small"
                type="button"
                onClick={() => onRestDay(habit.id)}
                disabled={isPausePending}
              >
                Rest day today
              </button>
            ) : null}
            <button
              className="button button--ghost button--small"
              type="button"
              onClick={() => onEdit(habit.id)}
            >
              Edit habit
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
