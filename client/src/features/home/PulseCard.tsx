import { Link } from "react-router-dom";
import { formatWorkoutStatus } from "../../shared/lib/api";

type PulseCardProps = {
  waterMl: number;
  waterTargetMl: number;
  mealsLogged: number;
  workoutStatus: "completed" | "recovery_respected" | "fallback" | "missed" | "none";
};

export function PulseCard({
  waterMl,
  waterTargetMl,
  mealsLogged,
  workoutStatus,
}: PulseCardProps) {
  const waterPercent = waterTargetMl > 0
    ? Math.min(Math.round((waterMl / waterTargetMl) * 100), 100)
    : 0;
  const waterLabel = `${(waterMl / 1000).toFixed(1)}L / ${(waterTargetMl / 1000).toFixed(1)}L`;

  return (
    <Link to="/health" className="dash-card dash-card--link">
      <h3 className="dash-card__title">
        Pulse
        <span className="dash-card__arrow">&rarr;</span>
      </h3>
      <div className="pulse-metrics">
        <div className="pulse-metric">
          <span className="pulse-metric__label">Water</span>
          <div className="pulse-metric__bar-track">
            <div
              className="pulse-metric__bar-fill"
              style={{ width: `${waterPercent}%` }}
            />
          </div>
          <span className="pulse-metric__value">{waterLabel}</span>
        </div>
        <div className="pulse-metric">
          <span className="pulse-metric__label">Meals</span>
          <span className="pulse-metric__value pulse-metric__value--large">
            {mealsLogged}
          </span>
        </div>
        <div className="pulse-metric">
          <span className="pulse-metric__label">Workout</span>
          <span className="pulse-metric__value">
            {formatWorkoutStatus(workoutStatus)}
          </span>
        </div>
      </div>
    </Link>
  );
}
