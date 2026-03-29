import { formatWorkoutStatus } from "../../../shared/lib/api";
import { DropletIcon, UtensilsIcon, DumbbellIcon } from "../helpers/icons";

type WorkoutStatus = "completed" | "recovery_respected" | "fallback" | "missed" | "none" | null;

type HealthDay = {
  waterMl: number;
  waterTargetMl: number;
  mealCount: number;
  workoutDay: { actualStatus: string } | null;
};

function getStatusClass(pct: number) {
  if (pct >= 80) return "today-health-stat--good";
  if (pct >= 40) return "today-health-stat--mid";
  return "";
}

export function HealthPulse({ currentDay }: { currentDay: HealthDay | undefined }) {
  if (!currentDay) {
    return (
      <div className="today-health-pulse">
        <h3 className="today-context-title">Health Pulse</h3>
        <p className="today-health-pulse__empty">Health data loading…</p>
      </div>
    );
  }

  const waterPct = currentDay.waterTargetMl > 0
    ? Math.min((currentDay.waterMl / currentDay.waterTargetMl) * 100, 100)
    : 0;
  const waterLabel = `${(currentDay.waterMl / 1000).toFixed(1)}/${(currentDay.waterTargetMl / 1000).toFixed(1)}L`;
  const mealPct = Math.min((currentDay.mealCount / 3) * 100, 100);
  const workoutStatus = formatWorkoutStatus(currentDay.workoutDay?.actualStatus as WorkoutStatus);
  const workoutDone = workoutStatus.toLowerCase().includes("complete") ||
    workoutStatus.toLowerCase().includes("rest") ||
    workoutStatus.toLowerCase().includes("respected");
  const workoutPct = workoutDone ? 100 : 0;

  return (
    <div className="today-health-pulse">
      <h3 className="today-context-title">Health Pulse</h3>
      <div className="today-health-stats">
        <div className={`today-health-stat ${getStatusClass(waterPct)}`}>
          <span className="today-health-stat__icon"><DropletIcon /></span>
          <span className="today-health-stat__label">Water</span>
          <span className="today-health-stat__value">{waterLabel}</span>
        </div>
        <div className={`today-health-stat ${getStatusClass(mealPct)}`}>
          <span className="today-health-stat__icon"><UtensilsIcon /></span>
          <span className="today-health-stat__label">Meals</span>
          <span className="today-health-stat__value">{currentDay.mealCount} logged</span>
        </div>
        <div className={`today-health-stat ${getStatusClass(workoutPct)}`}>
          <span className="today-health-stat__icon"><DumbbellIcon /></span>
          <span className="today-health-stat__label">Workout</span>
          <span className="today-health-stat__value">{workoutStatus}</span>
        </div>
      </div>
    </div>
  );
}
