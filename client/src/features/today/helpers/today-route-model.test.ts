import { describe, expect, it } from "vitest";

import {
  buildOpenPlannerDateParams,
  buildPlannerDateParams,
  buildPlannerViewParams,
  buildUpcomingViewParams,
  resolveTodayRouteState,
  toSearchString,
} from "./today-route-model";

describe("today route model", () => {
  it("defaults invalid planner params to today's planner view", () => {
    const state = resolveTodayRouteState(
      new URLSearchParams("planDate=not-a-date&view=bad&upcomingView=bad"),
      "2026-05-19",
    );

    expect(state).toMatchObject({
      rawPlannerDate: "not-a-date",
      rawPlannerView: "bad",
      rawUpcomingView: "bad",
      plannerDate: "2026-05-19",
      plannerView: "today",
      upcomingView: "week",
      isPastPlannerDate: false,
      isLivePlannerDate: true,
      isEditablePlannerDate: true,
    });
  });

  it("resolves valid planner date and upcoming view state", () => {
    const state = resolveTodayRouteState(
      new URLSearchParams("planDate=2026-05-18&view=upcoming&upcomingView=month"),
      "2026-05-19",
    );

    expect(state).toMatchObject({
      plannerDate: "2026-05-18",
      plannerView: "upcoming",
      upcomingView: "month",
      isPastPlannerDate: true,
      isLivePlannerDate: false,
      isEditablePlannerDate: false,
    });
  });

  it("builds planner date params without carrying stale upcoming state", () => {
    const next = buildPlannerDateParams(
      new URLSearchParams("view=upcoming&upcomingView=month"),
      "2026-05-19",
      "2026-05-20",
    );

    expect(toSearchString(next)).toBe("?view=upcoming&planDate=2026-05-20");
  });

  it("opens a concrete planner date in the today planner view", () => {
    const next = buildOpenPlannerDateParams(
      new URLSearchParams("view=upcoming&upcomingView=agenda&planDate=2026-05-20"),
      "2026-05-19",
      "2026-05-19",
    );

    expect(toSearchString(next)).toBe("");
  });

  it("builds planner view params", () => {
    const upcoming = buildPlannerViewParams(
      new URLSearchParams("planDate=2026-05-20&upcomingView=bad"),
      "2026-05-19",
      "upcoming",
    );
    const today = buildPlannerViewParams(
      new URLSearchParams("view=upcoming&upcomingView=month"),
      "2026-05-19",
      "today",
    );

    expect(toSearchString(upcoming)).toBe("?upcomingView=week&view=upcoming");
    expect(toSearchString(today)).toBe("");
  });

  it("builds upcoming view params", () => {
    const next = buildUpcomingViewParams(
      new URLSearchParams("planDate=2026-05-20"),
      "agenda",
    );

    expect(toSearchString(next)).toBe("?view=upcoming&upcomingView=agenda");
  });
});
