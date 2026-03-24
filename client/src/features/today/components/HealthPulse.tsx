import { formatWorkoutStatus } from "../../../shared/lib/api";
import { DropletIcon, UtensilsIcon, DumbbellIcon } from "../helpers/icons";

type WorkoutStatus = "completed" | "recovery_respected" | "fallback" | "missed" | "none" | null;

type HealthDay = {
  waterMl: number;
  waterTargetMl: number;
  mealCount: number;
  workoutDay: { actualStatus: string } | null;
};

function getMeterColor(pct: number) {
  if (pct >= 80) return "var(--positive)";
  if (pct >= 40) return "var(--accent)";
  return "var(--text-tertiary)";
}

export function HealthPulse({ currentDay }: { currentDay: HealthDay | undefined }) {
  if (!currentDay) {
    return (
      <div className="today-health-pulse">
        <p className="today-health-pulse__empty">Health data loading…</p>
      </div>
    );
  }

  const waterPct = currentDay.waterTargetMl > 0
    ? Math.min((currentDay.waterMl / currentDay.waterTargetMl) * 100, 100)
    : 0;
  const waterLabel = `${(currentDay.waterMl / 1000).toFixed(1)}L / ${(currentDay.waterTargetMl / 1000).toFixed(1)}L`;
  const mealPct = Math.min((currentDay.mealCount / 3) * 100, 100);
  const workoutStatus = formatWorkoutStatus(currentDay.workoutDay?.actualStatus as WorkoutStatus);
  const workoutDone = workoutStatus.toLowerCase().includes("complete") ||
    workoutStatus.toLowerCase().includes("rest") ||
    workoutStatus.toLowerCase().includes("respected");
  const workoutPct = workoutDone ? 100 : 0;

  return (
    <div className="today-health-pulse">
      <h3 className="today-context-title">Health Pulse</h3>
      <div className="today-health-meters">
        <HealthMeter
          icon={<DropletIcon />}
          label="Water"
          detail={waterLabel}
          percent={waterPct}
        />
        <HealthMeter
          icon={<UtensilsIcon />}
          label="Meals"
          detail={`${currentDay.mealCount} logged`}
          percent={mealPct}
        />
        <HealthMeter
          icon={<DumbbellIcon />}
          label="Workout"
          detail={workoutStatus}
          percent={workoutPct}
        />
      </div>
    </div>
  );
}

function HealthMeter({
  icon,
  label,
  detail,
  percent,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
  percent: number;
}) {
  const color = getMeterColor(percent);
  const size = 44;
  const strokeWidth = 3.5;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="today-health-meter">
      <div className="today-health-meter__ring" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <span className="today-health-meter__icon">{icon}</span>
      </div>
      <div className="today-health-meter__info">
        <span className="today-health-meter__label">{label}</span>
        <span className="today-health-meter__detail">{detail}</span>
      </div>
    </div>
  );
}
