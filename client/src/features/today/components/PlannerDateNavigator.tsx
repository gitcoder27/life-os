import { formatLongDate, formatRelativeDate } from "../../../shared/lib/api";
import { SmartDatePicker } from "../../../shared/ui/SmartDatePicker";

function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10 3L5.5 8L10 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 3L10.5 8L6 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
          className="planner-date-nav__step"
          type="button"
          onClick={() => onStepDate(-1)}
          aria-label="Show previous day"
        >
          <ChevronLeft />
        </button>
        <SmartDatePicker value={date} onChange={onSelectDate} />
        <button
          className="planner-date-nav__step"
          type="button"
          onClick={() => onStepDate(1)}
          aria-label="Show next day"
        >
          <ChevronRight />
        </button>
      </div>

      <div className="planner-date-nav__copy">
        <div className="planner-date-nav__title">{formatLongDate(date)}</div>
        {subtitle ? (
          <div className="planner-date-nav__subtitle">{subtitle}</div>
        ) : null}
        {!isToday ? (
          <button
            className="planner-date-nav__today-btn"
            type="button"
            onClick={() => onSelectDate(todayDate)}
          >
            Return to today
          </button>
        ) : null}
      </div>
    </div>
  );
}
