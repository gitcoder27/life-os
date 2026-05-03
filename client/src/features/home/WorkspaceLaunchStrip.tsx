import { Link } from "react-router-dom";

import {
  formatShortDate,
  getWeekStartDate,
  useAdaptiveTodayQuery,
  useDayPlanQuery,
  useMealPlanWeekQuery,
  type HomeOverviewResponse,
} from "../../shared/lib/api";
import {
  resolveHomeActionTarget,
  resolveHomeDestinationTarget,
  type HomeNavigationTarget,
} from "../../shared/lib/homeNavigation";
import { isQuickCaptureReferenceTask } from "../../shared/lib/quickCapture";

type Guidance = HomeOverviewResponse["guidance"];
type AdaptiveGuidance = ReturnType<typeof useAdaptiveTodayQuery>["data"];

type LaunchTone = "neutral" | "attention" | "ready";

type LaunchState = {
  tone: LaunchTone;
  title: string;
  detail: string;
};

type GuidanceCard = {
  tone: LaunchTone;
  kicker: string;
  title: string;
  detail: string;
  link: { target: HomeNavigationTarget; label: string };
};

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildPlannerState(today: string, dayPlan: ReturnType<typeof useDayPlanQuery>["data"]): LaunchState {
  if (!dayPlan) {
    return {
      tone: "neutral",
      title: "Plan your day",
      detail: "Pulling planner blocks and open tasks.",
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
      title: "Plan your day",
      detail:
        openTasks.length > 0
          ? `${pluralize(openTasks.length, "task")} waiting to be placed on the timeline.`
          : "The day is open and ready to shape.",
    };
  }

  if (unplannedCount > 0) {
    return {
      tone: "attention",
      title: "Plan your day",
      detail: `${pluralize(plannerBlocks.length, "block")} live with ${pluralize(unplannedCount, "task")} still outside the timeline.`,
    };
  }

  return {
    tone: "ready",
    title: "Plan your day",
    detail: `${pluralize(plannerBlocks.length, "block")} mapped across the day.`,
  };
}

function buildMealsState(weekStart: string, mealPlan: ReturnType<typeof useMealPlanWeekQuery>["data"]): LaunchState {
  if (!mealPlan) {
    return {
      tone: "neutral",
      title: "Prep your meals",
      detail: "Checking planned meals, prep, and groceries.",
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
      title: "Prep your meals",
      detail: `No meals mapped for ${formatShortDate(mealPlan.startDate)} – ${formatShortDate(mealPlan.endDate)}. Set the week once, reuse it daily.`,
    };
  }

  const loggedNote = loggedPlannedMeals > 0 ? ` · ${loggedPlannedMeals}/${totalPlannedMeals} logged` : "";

  return {
    tone: "ready",
    title: "Prep your meals",
    detail: `${pluralize(totalPlannedMeals, "meal")} planned, ${pluralize(prepSessionsCount, "prep session")}, ${pluralize(groceryItemCount, "grocery item")}${loggedNote}.`,
  };
}

function buildAdaptiveCard(adaptive: AdaptiveGuidance | undefined): GuidanceCard | null {
  const move = adaptive?.nextMove;
  if (!move || move.state === "empty" || move.state === "review_ready") {
    return null;
  }

  return {
    tone: move.severity === "urgent" || move.severity === "attention" ? "attention" : "ready",
    kicker: "Next move",
    title: move.title,
    detail: move.reason,
    link: {
      target: move.primaryAction.type === "shape_day" || move.primaryAction.type === "recover_drift"
        ? { to: "/planner" }
        : { to: "/today", state: { homeDestination: { kind: "today_execute" } } },
      label: move.primaryAction.label,
    },
  };
}

function buildGuidanceCard(guidance: Guidance, adaptive: AdaptiveGuidance | undefined): GuidanceCard | null {
  const adaptiveCard = buildAdaptiveCard(adaptive);
  if (adaptiveCard) {
    return adaptiveCard;
  }

  if (guidance.recovery) {
    return {
      tone: "attention",
      kicker: guidance.recovery.tone === "recovery" ? "Recovery note" : "Steady note",
      title: guidance.recovery.title,
      detail: guidance.recovery.detail || "Stay with the lighter rhythm today.",
      link: { target: { to: "/reviews" }, label: "Open Review" },
    };
  }

  const recommendation = guidance.recommendations[0];
  if (recommendation) {
    return {
      tone: "attention",
      kicker: "One move to reset",
      title: recommendation.title,
      detail: recommendation.detail || "A small reset opens the rest of the day.",
      link: {
        target: resolveHomeActionTarget(recommendation.action),
        label: recommendation.impactLabel || "Open",
      },
    };
  }

  const challenge = guidance.weeklyChallenge;
  if (challenge) {
    const target = resolveHomeDestinationTarget({
      kind: "habit_focus",
      habitId: challenge.habitId,
      surface: "weekly_challenge",
    });
    return {
      tone: "ready",
      kicker: "Weekly focus",
      title: challenge.title,
      detail: `${challenge.weekCompletions}/${challenge.weekTarget} completions this week.`,
      link: { target, label: "Open habit" },
    };
  }

  return {
    tone: "neutral",
    kicker: "Review",
    title: "Reflect on the week",
    detail: "Open the review hub whenever you want a pulse-check.",
    link: { target: { to: "/reviews" }, label: "Open Review" },
  };
}

export function WorkspaceLaunchStrip({
  today,
  guidance,
}: {
  today: string;
  guidance: Guidance;
}) {
  const weekStart = getWeekStartDate(today);
  const dayPlanQuery = useDayPlanQuery(today);
  const adaptiveQuery = useAdaptiveTodayQuery(today);
  const mealPlanQuery = useMealPlanWeekQuery(weekStart);
  const plannerState = buildPlannerState(today, dayPlanQuery.data);
  const mealsState = buildMealsState(weekStart, mealPlanQuery.data);
  const guidanceCard = buildGuidanceCard(guidance, adaptiveQuery.data);

  return (
    <section className="workspace-launches" aria-label="Frequent workspaces">
      <div className="workspace-launches__rail">
        <Link to="/planner" className={`workspace-launch workspace-launch--${plannerState.tone}`}>
          <span className="workspace-launch__kicker">Planner</span>
          <h3 className="workspace-launch__title">{plannerState.title}</h3>
          <p className="workspace-launch__summary workspace-launch__summary--clamp">{plannerState.detail}</p>
          <span className="workspace-launch__spacer" aria-hidden="true" />
          <span className="workspace-launch__action">Open Planner →</span>
        </Link>

        <Link to="/meals" className={`workspace-launch workspace-launch--${mealsState.tone}`}>
          <span className="workspace-launch__kicker">Meals</span>
          <h3 className="workspace-launch__title">{mealsState.title}</h3>
          <p className="workspace-launch__summary workspace-launch__summary--clamp">{mealsState.detail}</p>
          <span className="workspace-launch__spacer" aria-hidden="true" />
          <span className="workspace-launch__action">Open Meals →</span>
        </Link>

        {guidanceCard ? (
          <Link
            to={guidanceCard.link.target.to}
            state={guidanceCard.link.target.state}
            className={`workspace-launch workspace-launch--${guidanceCard.tone}`}
          >
            <span className="workspace-launch__kicker">{guidanceCard.kicker}</span>
            <h3 className="workspace-launch__title">{guidanceCard.title}</h3>
            <p className="workspace-launch__summary workspace-launch__summary--clamp">{guidanceCard.detail}</p>
            <span className="workspace-launch__spacer" aria-hidden="true" />
            <span className="workspace-launch__action">{guidanceCard.link.label} →</span>
          </Link>
        ) : null}
      </div>
    </section>
  );
}
