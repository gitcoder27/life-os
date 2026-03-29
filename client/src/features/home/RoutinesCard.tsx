import { Link } from "react-router-dom";

type RoutinesCardProps = {
  completedItems: number;
  totalItems: number;
  currentPeriod: "morning" | "evening" | "none";
  habitsCompletedToday: number;
  habitsDueToday: number;
};

export function RoutinesCard({
  completedItems,
  totalItems,
  currentPeriod,
  habitsCompletedToday,
  habitsDueToday,
}: RoutinesCardProps) {
  const percent =
    totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const periodLabel =
    currentPeriod === "none"
      ? "Routines"
      : `${currentPeriod[0].toUpperCase()}${currentPeriod.slice(1)} routine`;

  return (
    <Link to="/habits" className="dash-card dash-card--link">
      <h3 className="dash-card__title">
        Routines
        <span className="dash-card__arrow">&rarr;</span>
      </h3>
      <div className="routines-status">
        <div className="routines-status__row">
          <span className="routines-status__label">{periodLabel}</span>
          <span className="routines-status__value">
            {completedItems}/{totalItems}
          </span>
        </div>
        {totalItems > 0 ? (
          <div className="routines-bar-track">
            <div
              className="routines-bar-fill"
              style={{ width: `${percent}%` }}
            />
          </div>
        ) : null}
      </div>
      {habitsDueToday > 0 ? (
        <div className="routines-habits">
          <span className="routines-habits__label">Habits due today</span>
          <span className="routines-habits__value">
            {habitsCompletedToday}/{habitsDueToday}
          </span>
        </div>
      ) : null}
    </Link>
  );
}
