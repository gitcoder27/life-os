import { Link } from "react-router-dom";

import {
  formatShortDate,
  getWeekStartDate,
  useDayPlanQuery,
  useMealPlanWeekQuery,
} from "../../shared/lib/api";
import { isQuickCaptureReferenceTask } from "../../shared/lib/quickCapture";

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildPlannerState(today: string, dayPlan: ReturnType<typeof useDayPlanQuery>["data"]) {
  if (!dayPlan) {
    return {
      tone: "neutral",
      title: "Loading today's timeline",
      detail: "Pulling planner blocks and open tasks.",
      meta: formatShortDate(today),
    };
  }

  const plannerBlocks = dayPlan.plannerBlocks;
  const openTasks = dayPlan.tasks.filter(
    (task) => task.status === "pending" && !isQuickCaptureReferenceTask(task) && task.kind === "task",
  );
  const plannedTaskIds = new Set<string>();
  for (const block of plannerBlocks) {
    for (const blockTask of block.tasks) {
      plannedTaskIds.add(blockTask.taskId);
    }
  }
  const unplannedCount = openTasks.filter((task) => !plannedTaskIds.has(task.id)).length;

  if (plannerBlocks.length === 0) {
    return {
      tone: "attention",
      title: "Build today's timeline",
      detail:
        openTasks.length > 0
          ? `${pluralize(openTasks.length, "task")} waiting to be placed.`
          : "The day is open and ready to shape.",
      meta: "Planner",
    };
  }

  if (unplannedCount > 0) {
    return {
      tone: "attention",
      title: "Resume and tighten the plan",
      detail: `${pluralize(plannerBlocks.length, "block")} live with ${pluralize(unplannedCount, "task")} still outside the timeline.`,
      meta: "Planner",
    };
  }

  return {
    tone: "ready",
    title: "Return to the timeline",
    detail: `${pluralize(plannerBlocks.length, "block")} mapped across the day.`,
    meta: "Planner",
  };
}

function buildMealsState(weekStart: string, mealPlan: ReturnType<typeof useMealPlanWeekQuery>["data"]) {
  if (!mealPlan) {
    return {
      tone: "neutral",
      title: "Loading this week's meals",
      detail: "Checking planned meals, prep, and groceries.",
      meta: formatShortDate(weekStart),
    };
  }

  const {
    totalPlannedMeals,
    loggedPlannedMeals,
    prepSessionsCount,
    groceryItemCount,
  } = mealPlan.summary;

  if (totalPlannedMeals === 0) {
    return {
      tone: "attention",
      title: "Plan meals for the week",
      detail: "No meals mapped yet. Set the week once and reuse it every day.",
      meta: `${formatShortDate(mealPlan.startDate)} - ${formatShortDate(mealPlan.endDate)}`,
    };
  }

  return {
    tone: "ready",
    title: "Keep this week's meals close",
    detail: `${pluralize(totalPlannedMeals, "meal")} planned, ${pluralize(prepSessionsCount, "prep session")}, ${pluralize(groceryItemCount, "grocery item")}.`,
    meta: loggedPlannedMeals > 0 ? `${loggedPlannedMeals}/${totalPlannedMeals} logged` : "Weekly plan",
  };
}

export function WorkspaceLaunchStrip({ today }: { today: string }) {
  const weekStart = getWeekStartDate(today);
  const dayPlanQuery = useDayPlanQuery(today);
  const mealPlanQuery = useMealPlanWeekQuery(weekStart);
  const plannerState = buildPlannerState(today, dayPlanQuery.data);
  const mealsState = buildMealsState(weekStart, mealPlanQuery.data);

  return (
    <section className="workspace-launches" aria-label="Frequent workspaces">
      <div className="workspace-launches__head">
        <span className="workspace-launches__label">Frequent workspaces</span>
      </div>

      <div className="workspace-launches__grid">
        <Link
          to="/planner"
          className={`workspace-launch workspace-launch--${plannerState.tone}`}
        >
          <div className="workspace-launch__meta">
            <span>{plannerState.meta}</span>
            <span className="workspace-launch__action">Open planner</span>
          </div>
          <h3 className="workspace-launch__title">{plannerState.title}</h3>
          <p className="workspace-launch__detail">{plannerState.detail}</p>
        </Link>

        <Link
          to="/meals"
          className={`workspace-launch workspace-launch--${mealsState.tone}`}
        >
          <div className="workspace-launch__meta">
            <span>{mealsState.meta}</span>
            <span className="workspace-launch__action">Open meals</span>
          </div>
          <h3 className="workspace-launch__title">{mealsState.title}</h3>
          <p className="workspace-launch__detail">{mealsState.detail}</p>
        </Link>
      </div>
    </section>
  );
}
