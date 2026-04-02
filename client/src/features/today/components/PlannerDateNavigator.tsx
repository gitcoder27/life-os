import { formatLongDate, formatRelativeDate } from "../../../shared/lib/api";
import { SmartDatePicker } from "../../../shared/ui/SmartDatePicker";

export function PlannerDateNavigator({
  date,
  todayDate,
  onSelectDate,
  onStepDate,
}: {
  date: string;
  todayDate: string;
  onSelectDate: (isoDate: string) => void;
  onStepDate: (direction: -1 | 1) => void;
}) {
  const isToday = date === todayDate;
  const relativeLabel = formatRelativeDate(date);
  const subtitle = relativeLabel === formatLongDate(date) ? null : relativeLabel;

  return (
    <div className="planner-date-nav">
      <div className="planner-date-nav__controls">
        <button
          className="button button--ghost button--small planner-date-nav__step"
          type="button"
          onClick={() => onStepDate(-1)}
          aria-label="Show previous day"
        >
          Previous
        </button>
        <SmartDatePicker value={date} onChange={onSelectDate} />
        <button
          className="button button--ghost button--small planner-date-nav__step"
          type="button"
          onClick={() => onStepDate(1)}
          aria-label="Show next day"
        >
          Next
        </button>
        {!isToday ? (
          <button
            className="button button--primary button--small"
            type="button"
            onClick={() => onSelectDate(todayDate)}
          >
            Today
          </button>
        ) : null}
      </div>

      <div className="planner-date-nav__copy">
        <div className="planner-date-nav__title">{formatLongDate(date)}</div>
        {subtitle ? (
          <div className="planner-date-nav__subtitle">{subtitle}</div>
        ) : null}
      </div>
    </div>
  );
}
