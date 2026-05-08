import type { UpcomingView } from "../../helpers/upcoming-calendar";
import { upcomingViews } from "../../helpers/upcoming-calendar";

const labels: Record<UpcomingView, string> = {
  agenda: "Agenda",
  week: "Week",
  month: "Month",
};

type UpcomingViewSwitchProps = {
  value: UpcomingView;
  onChange: (view: UpcomingView) => void;
};

export function UpcomingViewSwitch({
  value,
  onChange,
}: UpcomingViewSwitchProps) {
  return (
    <div
      className="planner-upcoming-view-switch"
      role="tablist"
      aria-label="Upcoming views"
    >
      {upcomingViews.map((view) => (
        <button
          className={`planner-upcoming-view-switch__tab${value === view ? " planner-upcoming-view-switch__tab--active" : ""}`}
          type="button"
          role="tab"
          aria-selected={value === view}
          key={view}
          onClick={() => onChange(view)}
        >
          {labels[view]}
        </button>
      ))}
    </div>
  );
}

