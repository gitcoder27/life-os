import { describe, expect, it, vi } from "vitest";

import { buildRescueSuggestion, detectMissedDayPattern } from "../../../src/modules/planning/day-mode.js";

describe("day mode helpers", () => {
  it("returns recovery suggestion when missed-day pattern is active", () => {
    const suggestion = buildRescueSuggestion({
      launch: null,
      mustWinTask: {
        title: "Write report",
        nextAction: "Open the draft",
      },
      pendingTaskCount: 2,
      overdueTaskCount: 0,
      hasMissedDayPattern: true,
    });

    expect(suggestion).toEqual(
      expect.objectContaining({
        mode: "recovery",
        reason: "missed_day",
      }),
    );
  });

  it("detects a missed-day pattern when yesterday was missed and backlog already exists", async () => {
    const planningCycle = {
      findMany: vi.fn().mockResolvedValue([
        {
          cycleStartDate: new Date("2026-03-13T00:00:00.000Z"),
          dailyLaunch: {
            completedAt: null,
            mustWinTask: null,
          },
          dailyReview: null,
        },
      ]),
    };

    const result = await detectMissedDayPattern(
      { planningCycle } as never,
      {
        userId: "user-1",
        targetDate: new Date("2026-03-14T00:00:00.000Z"),
        overdueTaskCount: 1,
      },
    );

    expect(result).toBe(true);
  });

  it("detects a missed-day pattern after two consecutive missed days even without backlog", async () => {
    const planningCycle = {
      findMany: vi.fn().mockResolvedValue([
        {
          cycleStartDate: new Date("2026-03-13T00:00:00.000Z"),
          dailyLaunch: {
            completedAt: null,
            mustWinTask: null,
          },
          dailyReview: null,
        },
        {
          cycleStartDate: new Date("2026-03-12T00:00:00.000Z"),
          dailyLaunch: {
            completedAt: null,
            mustWinTask: null,
          },
          dailyReview: null,
        },
      ]),
    };

    const result = await detectMissedDayPattern(
      { planningCycle } as never,
      {
        userId: "user-1",
        targetDate: new Date("2026-03-14T00:00:00.000Z"),
        overdueTaskCount: 0,
      },
    );

    expect(result).toBe(true);
  });

  it("does not flag a missed-day pattern when the previous day launched and the must-win moved", async () => {
    const planningCycle = {
      findMany: vi.fn().mockResolvedValue([
        {
          cycleStartDate: new Date("2026-03-13T00:00:00.000Z"),
          dailyLaunch: {
            completedAt: new Date("2026-03-13T07:00:00.000Z"),
            mustWinTask: {
              status: "PENDING",
              progressState: "STARTED",
            },
          },
          dailyReview: {
            frictionTag: "distraction",
          },
        },
      ]),
    };

    const result = await detectMissedDayPattern(
      { planningCycle } as never,
      {
        userId: "user-1",
        targetDate: new Date("2026-03-14T00:00:00.000Z"),
        overdueTaskCount: 0,
      },
    );

    expect(result).toBe(false);
  });
});
