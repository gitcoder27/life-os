import { describe, expect, it } from "vitest";

import { buildHomeGuidance } from "../../src/modules/home/guidance.js";

describe("home guidance builder", () => {
  it("prioritizes challenge, streak protection, and priority work, then truncates to three", () => {
    const guidance = buildHomeGuidance({
      score: {
        label: "Solid Day",
        value: 72,
        topReasons: [{ label: "Review and Reset", missingPoints: 6 }],
      },
      momentum: {
        strongDayStreak: 3,
      },
      habits: [
        {
          id: "habit-1",
          title: "Hydrate",
          dueToday: true,
          completedToday: false,
          streakCount: 4,
          risk: {
            level: "at_risk",
            reason: "streak_at_risk",
            message: "4-day streak is on the line today.",
            dueCount7d: 7,
            completedCount7d: 4,
            completionRate7d: 57,
          },
        },
      ],
      priorities: [
        {
          id: "priority-1",
          title: "Protect gym slot",
          slot: 1,
          status: "pending",
        },
      ],
      tasks: [
        {
          id: "task-1",
          title: "Open task",
          status: "pending",
        },
      ],
      weeklyChallenge: {
        habitId: "habit-1",
        title: "Hydrate",
        streakCount: 4,
        completedToday: false,
        weekCompletions: 4,
        weekTarget: 7,
        status: "due_today",
        message: "Hydrate is due today. Keep the weekly focus alive.",
      },
      dayReviewCompleted: false,
      currentHour: 19,
      health: {
        waterMl: 600,
        waterTargetMl: 2500,
      },
    });

    expect(guidance.recommendations).toHaveLength(3);
    expect(guidance.recommendations.map((item) => item.id)).toEqual([
      "weekly-challenge:habit-1",
      "habit-risk:habit-1",
      "priority:priority-1",
    ]);
  });

  it("returns recovery framing when the day is off track", () => {
    const guidance = buildHomeGuidance({
      score: {
        label: "Off-Track Day",
        value: 44,
        topReasons: [{ label: "Health Basics", missingPoints: 8 }],
      },
      momentum: {
        strongDayStreak: 0,
      },
      habits: [],
      priorities: [],
      tasks: [],
      weeklyChallenge: null,
      dayReviewCompleted: true,
      currentHour: 14,
      health: {
        waterMl: 1200,
        waterTargetMl: 2500,
      },
    });

    expect(guidance.recovery).toEqual(
      expect.objectContaining({
        tone: "recovery",
        title: "Reset the day with one useful move",
      }),
    );
  });
});
