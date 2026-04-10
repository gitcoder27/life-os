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
  const routinePercent =
    routines.totalItems > 0
      ? Math.round((routines.completedItems / routines.totalItems) * 100)
      : 0;
  const waterPercent =
    health.waterTargetMl > 0
      ? Math.min(Math.round((health.waterMl / health.waterTargetMl) * 100), 100)
      : 0;
  const financeTarget = resolveHomeActionTarget(finance.action);
  const financeNote = finance.focusBill
    ? `${finance.focusBill.title} · ${formatRelativeDate(finance.focusBill.dueOn)}`
    : finance.budgetLabel || "Tracking";

  return (
    <div className="essentials-band">
      <h3 className="section-label">Essentials</h3>

      <div className="essentials-band__grid">
        <Link to="/habits" className="essential">
          <span className="essential__label">Routines</span>
          <div className="essential__row">
            <span className="essential__value">
              {routines.completedItems}/{routines.totalItems}
            </span>
            <span className="essential__context">Today</span>
          </div>
          <div className="essential__bar">
            <div className="essential__bar-fill essential__bar-fill--routine" style={{ width: `${routinePercent}%` }} />
          </div>
          {habits.dueToday > 0 ? (
            <span className="essential__note">
              Habits: {habits.completedToday}/{habits.dueToday}
            </span>
          ) : null}
        </Link>

        <Link to="/health" className="essential">
          <span className="essential__label">Health</span>
          <div className="essential__row">
            <span className="essential__value">
              {(health.waterMl / 1000).toFixed(1)}L
            </span>
            <span className="essential__context">
              / {(health.waterTargetMl / 1000).toFixed(1)}L water
            </span>
          </div>
          <div className="essential__bar">
            <div className="essential__bar-fill essential__bar-fill--health" style={{ width: `${waterPercent}%` }} />
          </div>
          <span className="essential__note">
            {health.mealsLogged} meal{health.mealsLogged !== 1 ? "s" : ""}
            {" · "}
            {formatWorkoutStatus(health.workoutStatus)}
          </span>
        </Link>

        <Link to={financeTarget.to} state={financeTarget.state} className="essential essential--finance">
          <span className="essential__label">Money</span>
          <div className="essential__row">
            <span className="essential__value">
              {formatMinorCurrency(finance.spentThisMonthMinor, finance.currencyCode)}
            </span>
            <span className="essential__context">this month</span>
          </div>
          <span className="essential__note">
            {financeNote}
            {finance.upcomingBills > 0
              ? ` · ${finance.upcomingBills} open bill${finance.upcomingBills !== 1 ? "s" : ""} this month`
              : ""}
          </span>
        </Link>
      </div>
    </div>
  );
}
