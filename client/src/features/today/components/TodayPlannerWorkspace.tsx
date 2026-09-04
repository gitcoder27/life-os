import type { ComponentProps } from "react";

import { DayPlanner } from "./DayPlanner";
import { PlannerUpcoming } from "./PlannerUpcoming";

type TodayPlannerWorkspaceProps = {
  dayPlannerProps: ComponentProps<typeof DayPlanner>;
  plannerUpcomingProps: ComponentProps<typeof PlannerUpcoming>;
  plannerView: "today" | "upcoming";
};

export function TodayPlannerWorkspace({
  dayPlannerProps,
  plannerUpcomingProps,
  plannerView,
}: TodayPlannerWorkspaceProps) {
  return (
    <div className="planner-shell">
      {plannerView === "upcoming" ? (
        <PlannerUpcoming {...plannerUpcomingProps} />
      ) : (
        <DayPlanner {...dayPlannerProps} />
      )}
    </div>
  );
}
