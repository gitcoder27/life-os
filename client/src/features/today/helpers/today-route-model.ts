import {
  isUpcomingView,
  type UpcomingView,
} from "./upcoming-calendar";

export type PlannerView = "today" | "upcoming";

export type TodayRouteState = {
  rawPlannerDate: string | null;
  rawPlannerView: string | null;
  rawUpcomingView: string | null;
  plannerDate: string;
  plannerView: PlannerView;
  upcomingView: UpcomingView;
  isPastPlannerDate: boolean;
  isLivePlannerDate: boolean;
  isEditablePlannerDate: boolean;
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDateParam(value: string | null) {
  return Boolean(value && ISO_DATE_PATTERN.test(value));
}

export function toSearchString(params: URLSearchParams) {
  const search = params.toString();
  return search ? `?${search}` : "";
}

export function resolveTodayRouteState(
  searchParams: URLSearchParams,
  today: string,
): TodayRouteState {
  const rawPlannerDate = searchParams.get("planDate");
  const rawPlannerView = searchParams.get("view");
  const rawUpcomingView = searchParams.get("upcomingView");
  const plannerDate = isIsoDateParam(rawPlannerDate) ? rawPlannerDate as string : today;
  const plannerView: PlannerView = rawPlannerView === "upcoming" ? "upcoming" : "today";
  const upcomingView: UpcomingView = isUpcomingView(rawUpcomingView) ? rawUpcomingView : "week";

  return {
    rawPlannerDate,
    rawPlannerView,
    rawUpcomingView,
    plannerDate,
    plannerView,
    upcomingView,
    isPastPlannerDate: plannerDate < today,
    isLivePlannerDate: plannerDate === today,
    isEditablePlannerDate: plannerDate >= today,
  };
}

export function buildPlannerDateParams(
  current: URLSearchParams,
  today: string,
  nextDate: string,
) {
  const next = new URLSearchParams(current);
  if (nextDate === today) {
    next.delete("planDate");
  } else {
    next.set("planDate", nextDate);
  }
  next.delete("upcomingView");
  return next;
}

export function buildOpenPlannerDateParams(
  current: URLSearchParams,
  today: string,
  nextDate: string,
) {
  const next = new URLSearchParams(current);
  next.delete("view");
  next.delete("upcomingView");
  if (nextDate === today) {
    next.delete("planDate");
  } else {
    next.set("planDate", nextDate);
  }
  return next;
}

export function buildPlannerViewParams(
  current: URLSearchParams,
  today: string,
  nextView: PlannerView,
) {
  if (nextView === "today") {
    return buildOpenPlannerDateParams(current, today, today);
  }

  const next = new URLSearchParams(current);
  next.set("view", "upcoming");
  next.delete("planDate");
  if (!isUpcomingView(next.get("upcomingView"))) {
    next.set("upcomingView", "week");
  }
  return next;
}

export function buildUpcomingViewParams(
  current: URLSearchParams,
  nextView: UpcomingView,
) {
  const next = new URLSearchParams(current);
  next.set("view", "upcoming");
  next.delete("planDate");
  next.set("upcomingView", nextView);
  return next;
}
