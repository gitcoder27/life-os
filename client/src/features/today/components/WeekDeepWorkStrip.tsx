import type { WeekPlanResponse } from "../../../shared/lib/api";

type WeekDeepWorkStripProps = {
  weekPlan: WeekPlanResponse | null;
};

const statusLabels: Record<WeekPlanResponse["capacityProgress"]["status"], string> = {
  within_budget: "In budget",
  at_budget: "At budget",
  over_budget: "Over budget",
};

export function WeekDeepWorkStrip({ weekPlan }: WeekDeepWorkStripProps) {
  if (!weekPlan) {
    return null;
  }

  const { capacityProfile, capacityProgress } = weekPlan;

  return (
    <section className={`week-deep-work-strip week-deep-work-strip--${capacityProgress.status}`}>
      <div className="week-deep-work-strip__copy">
        <span className="week-deep-work-strip__eyebrow">Week deep work</span>
        <strong className="week-deep-work-strip__summary">
          {capacityProgress.completedDeepBlocks}/{capacityProfile.deepWorkBlockTarget} used
        </strong>
        <span className="week-deep-work-strip__message">{capacityProgress.message}</span>
      </div>

      <div className="week-deep-work-strip__meta">
        <span className={`week-deep-work-strip__badge week-deep-work-strip__badge--${capacityProgress.status}`}>
          {statusLabels[capacityProgress.status]}
        </span>
        <span className="week-deep-work-strip__mode">
          {capacityProfile.capacityMode} week
        </span>
      </div>
    </section>
  );
}
