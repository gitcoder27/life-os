import type {
  GoalOverviewItem,
  GoalsWorkspaceTodayAlignment,
  MonthPlanResponse,
  WeekPlanResponse,
  LinkedGoal,
} from "../../shared/lib/api";
import { toSuggestedPriorityTitle } from "./useGoalTodayAction";

export type PlanningLane = "month" | "week" | "today";
export type PlanningSlot = 1 | 2 | 3;

export type PlanningDraft = {
  lane: PlanningLane;
  slot: PlanningSlot;
  title: string;
  goalId: string;
};

export type PlanningReplaceState = {
  lane: PlanningLane;
  slot: PlanningSlot;
  goalId: string;
};

export type PlanningSelection = {
  lane: PlanningLane;
  slot: PlanningSlot;
};

export type PlanningItem = {
  id: string;
  slot: PlanningSlot;
  title: string;
  goalId: string | null;
  goal: LinkedGoal | null;
  status: "pending" | "completed" | "dropped";
  completedAt: string | null;
};

export const planningSlots: PlanningSlot[] = [1, 2, 3];

export const getPlanningItems = (
  lane: PlanningLane,
  weekPlan: WeekPlanResponse | null,
  monthPlan: MonthPlanResponse | null,
  todayAlignment: GoalsWorkspaceTodayAlignment,
): PlanningItem[] => {
  if (lane === "month") {
    return [...(monthPlan?.topOutcomes ?? [])].sort((left, right) => left.slot - right.slot);
  }

  if (lane === "week") {
    return [...(weekPlan?.priorities ?? [])].sort((left, right) => left.slot - right.slot);
  }

  return [...todayAlignment.priorities].sort((left, right) => left.slot - right.slot);
};

export const getPlanningItemAtSlot = (
  lane: PlanningLane,
  slot: PlanningSlot,
  weekPlan: WeekPlanResponse | null,
  monthPlan: MonthPlanResponse | null,
  todayAlignment: GoalsWorkspaceTodayAlignment,
) =>
  getPlanningItems(lane, weekPlan, monthPlan, todayAlignment).find((item) => item.slot === slot) ?? null;

export const buildDraftTitleForGoal = (
  lane: PlanningLane,
  goal: GoalOverviewItem | null | undefined,
) => {
  if (!goal) {
    return "";
  }

  if (lane === "week") {
    return goal.nextBestAction ? toSuggestedPriorityTitle(goal.nextBestAction) : goal.title;
  }

  return goal.title;
};

export const getLaneLabel = (lane: PlanningLane) => {
  if (lane === "month") return "Month Focus";
  if (lane === "week") return "Week Priorities";
  return "Today Priorities";
};

export const getLaneDuplicateCount = (
  lane: PlanningLane,
  goalId: string,
  weekPlan: WeekPlanResponse | null,
  monthPlan: MonthPlanResponse | null,
  todayAlignment: GoalsWorkspaceTodayAlignment,
  excludeSlot?: PlanningSlot,
) =>
  getPlanningItems(lane, weekPlan, monthPlan, todayAlignment).filter(
    (item) => item.goalId === goalId && item.slot !== excludeSlot,
  ).length;
