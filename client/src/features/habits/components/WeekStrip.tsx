import type { HabitDayMark } from "../types";

const STATE_LABELS: Record<HabitDayMark["state"], string> = {
  done: "done",
  partial: "partly done",
  missed: "not logged",
  rest: "rest day",
  not_due: "not scheduled",
  open: "still open",
};

function formatDay(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? isoDate
    : date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function describeWeek(days: HabitDayMark[]) {
  const count = (state: HabitDayMark["state"]) => days.filter((day) => day.state === state).length;
  const parts = [
    [count("done"), "done"],
    [count("partial"), "partly done"],
    [count("missed"), "not logged"],
    [count("rest"), count("rest") === 1 ? "rest day" : "rest days"],
  ]
    .filter(([value]) => Number(value) > 0)
    .map(([value, label]) => `${value} ${label}`);

  return parts.length > 0 ? `Last 7 days: ${parts.join(", ")}` : "Last 7 days: nothing scheduled";
}

export function WeekStrip({ days }: { days: HabitDayMark[] }) {
  if (days.length === 0) return null;

  return (
    <span className="hb-week" role="img" aria-label={describeWeek(days)}>
      {days.map((day) => (
        <span
          key={day.date}
          className={`hb-week__day hb-week__day--${day.state.replace("_", "-")}`}
          title={`${formatDay(day.date)}: ${STATE_LABELS[day.state]}`}
        />
      ))}
    </span>
  );
}
