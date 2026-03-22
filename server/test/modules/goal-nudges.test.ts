import { describe, expect, it } from "vitest";

import { buildGoalNudges } from "../../src/modules/planning/goal-nudges.js";

describe("goal nudges", () => {
  it("filters represented goals, ranks by health and urgency, and derives priority titles", () => {
    const nudges = buildGoalNudges([
      {
        goal: {
          id: "goal-on-track",
          title: "Keep lifting",
          domain: "health",
          status: "active",
        },
        health: "on_track",
        progressPercent: 35,
        nextBestAction: "Complete habit: Upper body session",
        targetDate: new Date("2026-03-30T00:00:00.000Z"),
        lastActivityAt: "2026-03-20T09:00:00.000Z",
        todayPriorityCount: 0,
        todayTaskCount: 0,
      },
      {
        goal: {
          id: "goal-stalled",
          title: "Ship v1",
          domain: "work_growth",
          status: "active",
        },
        health: "stalled",
        progressPercent: 20,
        nextBestAction: "Complete milestone: Send beta invite",
        targetDate: new Date("2026-03-24T00:00:00.000Z"),
        lastActivityAt: "2026-03-10T09:00:00.000Z",
        todayPriorityCount: 0,
        todayTaskCount: 0,
      },
      {
        goal: {
          id: "goal-represented",
          title: "Budget cleanup",
          domain: "money",
          status: "active",
        },
        health: "drifting",
        progressPercent: 50,
        nextBestAction: "Finish task: Review subscriptions",
        targetDate: new Date("2026-03-25T00:00:00.000Z"),
        lastActivityAt: "2026-03-15T09:00:00.000Z",
        todayPriorityCount: 1,
        todayTaskCount: 0,
      },
    ]);

    expect(nudges).toEqual([
      expect.objectContaining({
        goal: expect.objectContaining({ id: "goal-stalled" }),
        nextBestAction: "Complete milestone: Send beta invite",
        suggestedPriorityTitle: "Send beta invite",
      }),
      expect.objectContaining({
        goal: expect.objectContaining({ id: "goal-on-track" }),
        nextBestAction: "Complete habit: Upper body session",
        suggestedPriorityTitle: "Upper body session",
      }),
    ]);
  });

  it("caps nudges at three items and keeps fallback actions intact", () => {
    const nudges = buildGoalNudges([
      {
        goal: { id: "a", title: "A", domain: "other", status: "active" },
        health: "stalled",
        progressPercent: 10,
        nextBestAction: "Define the next milestone",
        targetDate: null,
        lastActivityAt: "2026-03-10T09:00:00.000Z",
        todayPriorityCount: 0,
        todayTaskCount: 0,
      },
      {
        goal: { id: "b", title: "B", domain: "other", status: "active" },
        health: "drifting",
        progressPercent: 20,
        nextBestAction: "Finish task: Draft agenda",
        targetDate: null,
        lastActivityAt: "2026-03-11T09:00:00.000Z",
        todayPriorityCount: 0,
        todayTaskCount: 0,
      },
      {
        goal: { id: "c", title: "C", domain: "other", status: "active" },
        health: "drifting",
        progressPercent: 30,
        nextBestAction: "Complete milestone: Confirm venue",
        targetDate: null,
        lastActivityAt: "2026-03-12T09:00:00.000Z",
        todayPriorityCount: 0,
        todayTaskCount: 0,
      },
      {
        goal: { id: "d", title: "D", domain: "other", status: "active" },
        health: "on_track",
        progressPercent: 40,
        nextBestAction: "Complete habit: Daily sketch",
        targetDate: null,
        lastActivityAt: "2026-03-13T09:00:00.000Z",
        todayPriorityCount: 0,
        todayTaskCount: 0,
      },
    ]);

    expect(nudges).toHaveLength(3);
    expect(nudges[0]?.suggestedPriorityTitle).toBe("Define the next milestone");
    expect(nudges.map((nudge) => nudge.goal.id)).toEqual(["a", "b", "c"]);
  });
});
