import { Link } from "react-router-dom";
import {
  formatMinorCurrency,
  formatRelativeDate,
  formatWorkoutStatus,
  type HomeAction,
} from "../../shared/lib/api";
import { resolveHomeActionTarget } from "../../shared/lib/homeNavigation";

type EssentialsBandProps = {
  routines: {
    completedItems: number;
    totalItems: number;
    currentPeriod: "morning" | "evening" | "none";
  };
  habits: {
    completedToday: number;
    dueToday: number;
  };
  health: {
    waterMl: number;
    waterTargetMl: number;
    mealsLogged: number;
    workoutStatus: "completed" | "recovery_respected" | "fallback" | "missed" | "none";
  };
  finance: {
    spentThisMonthMinor: number;
    currencyCode: string;
    budgetLabel: string;
    upcomingBills: number;
    focusBill: {
      id: string;
      title: string;
      dueOn: string;
      amountMinor: number | null;
      status: "pending" | "rescheduled";
    } | null;
    action: HomeAction;
  };
};

export function EssentialsBand({
  routines,
  habits,
  health,
  finance,
}: EssentialsBandProps) {
  const financeTarget = resolveHomeActionTarget(finance.action);
  const waterL = (health.waterMl / 1000).toFixed(1);
  const waterTargetL = (health.waterTargetMl / 1000).toFixed(1);
  const financeNote = finance.focusBill
    ? `${finance.focusBill.title} · ${formatRelativeDate(finance.focusBill.dueOn)}`
    : finance.budgetLabel || "On track";

  return (
    <section className="essentials-row" aria-label="Essentials">
      <header className="essentials-row__head">
        <span className="essentials-row__label">Essentials</span>
      </header>

      <div className="essentials-row__grid">
        <Link to="/habits" className="essential-cell">
          <span className="essential-cell__label">Routines</span>
          <span className="essential-cell__value">
            {routines.completedItems}<span className="essential-cell__denom">/{routines.totalItems}</span>
          </span>
          <span className="essential-cell__note">
            {habits.dueToday > 0
              ? `Habits ${habits.completedToday}/${habits.dueToday}`
              : "No habits due"}
          </span>
        </Link>

        <Link to="/health" className="essential-cell">
          <span className="essential-cell__label">Hydration</span>
          <span className="essential-cell__value">
            {waterL}<span className="essential-cell__denom">/{waterTargetL}L</span>
          </span>
          <span className="essential-cell__note">
            {health.mealsLogged} meal{health.mealsLogged !== 1 ? "s" : ""} · {formatWorkoutStatus(health.workoutStatus)}
          </span>
        </Link>

        <Link
          to={financeTarget.to}
          state={financeTarget.state}
          className="essential-cell"
        >
          <span className="essential-cell__label">Money</span>
          <span className="essential-cell__value">
            {formatMinorCurrency(finance.spentThisMonthMinor, finance.currencyCode)}
          </span>
          <span className="essential-cell__note">
            {financeNote}
            {finance.upcomingBills > 0
              ? ` · ${finance.upcomingBills} bill${finance.upcomingBills !== 1 ? "s" : ""}`
              : ""}
          </span>
        </Link>
      </div>
    </section>
  );
}
