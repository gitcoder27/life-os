import { describe, expect, it } from "vitest";

import { buildHomeGuidance } from "../../src/modules/home/guidance.js";

describe("home guidance builder", () => {
  it("prioritizes planning gap, inbox cleanup, and overdue recovery before lower-salience guidance", () => {
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
      mustWinTask: null,
      planning: {
        date: "2026-03-14",
        hasPlannerBlocks: false,
        pendingPriorityCount: 1,
        openTaskCount: 1,
        launchComplete: false,
      },
      accountability: {
        staleInboxCount: 2,
        staleInboxTaskId: "task-stale-1",
        overdueTaskCount: 1,
        overdueTaskId: "task-overdue-1",
      },
      finance: {
        dueAdminItemId: "admin-1",
        dueTodayCount: 1,
        pendingCount: 2,
      },
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
      dailyReviewAvailable: false,
      dailyReviewRoute: null,
      currentHour: 19,
      health: {
        waterMl: 600,
        waterTargetMl: 2500,
      },
    });

    expect(guidance.recommendations).toHaveLength(3);
    expect(guidance.recommendations.map((item) => item.id)).toEqual([
      "launch:2026-03-14",
      "inbox-triage:task-stale-1",
      "overdue-recovery:task-overdue-1",
    ]);
    expect(guidance.recommendations.map((item) => item.action.type)).toEqual([
      "open_destination",
      "open_destination",
      "open_destination",
    ]);
    expect(guidance.recommendations[0]?.action).toEqual({
      type: "open_destination",
      destination: {
        kind: "today_execute",
      },
    });
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
      mustWinTask: null,
      planning: {
        date: "2026-03-14",
        hasPlannerBlocks: false,
        pendingPriorityCount: 0,
        openTaskCount: 0,
        launchComplete: false,
      },
      accountability: {
        staleInboxCount: 0,
        staleInboxTaskId: null,
        overdueTaskCount: 0,
        overdueTaskId: null,
      },
      finance: {
        dueAdminItemId: null,
        dueTodayCount: 0,
        pendingCount: 0,
      },
      weeklyChallenge: null,
      dailyReviewAvailable: false,
      dailyReviewRoute: null,
      currentHour: 14,
      health: {
        waterMl: 1200,
        waterTargetMl: 2500,
      },
    });

    expect(guidance.recovery).toEqual(
      expect.objectContaining({
        tone: "recovery",
        title: "One move to reset",
      }),
    );
  });

  it("targets the actual must-win instead of the first task in the list", () => {
    const guidance = buildHomeGuidance({
      score: {
        label: "Solid Day",
        value: 72,
        topReasons: [],
      },
      momentum: {
        strongDayStreak: 0,
      },
      habits: [],
      priorities: [],
      tasks: [
        {
          id: "support-task",
          title: "Support task",
          status: "pending",
          progressState: "not_started",
        },
        {
          id: "must-win-task",
          title: "Write the proposal",
          status: "pending",
          progressState: "not_started",
        },
      ],
      mustWinTask: {
        id: "must-win-task",
        title: "Write the proposal",
        status: "pending",
        progressState: "not_started",
      },
      planning: {
        date: "2026-03-14",
        hasPlannerBlocks: true,
        pendingPriorityCount: 0,
        openTaskCount: 2,
        launchComplete: true,
      },
      accountability: {
        staleInboxCount: 0,
        staleInboxTaskId: null,
        overdueTaskCount: 0,
        overdueTaskId: null,
      },
      weeklyChallenge: null,
      dailyReviewAvailable: false,
      dailyReviewRoute: null,
      currentHour: 15,
      health: {
        waterMl: 2500,
        waterTargetMl: 2500,
      },
    });

    expect(guidance.recommendations[0]).toEqual(
      expect.objectContaining({
        id: "must-win-start:must-win-task",
        title: "Start Write the proposal",
      }),
    );
  });

  it("maps daily review actions into semantic review destinations", () => {
    const guidance = buildHomeGuidance({
      score: {
        label: "Strong Day",
        value: 86,
        topReasons: [],
      },
      momentum: {
        strongDayStreak: 2,
      },
      habits: [],
      priorities: [],
      tasks: [],
      mustWinTask: null,
      planning: {
        date: "2026-03-14",
        hasPlannerBlocks: true,
        pendingPriorityCount: 0,
        openTaskCount: 0,
        launchComplete: true,
      },
      accountability: {
        staleInboxCount: 0,
        staleInboxTaskId: null,
        overdueTaskCount: 0,
        overdueTaskId: null,
      },
      finance: {
        dueAdminItemId: null,
        dueTodayCount: 0,
        pendingCount: 0,
      },
      weeklyChallenge: null,
      dailyReviewAvailable: true,
      dailyReviewRoute: "/reviews/daily?date=2026-03-14",
      currentHour: 21,
      health: {
        waterMl: 2500,
        waterTargetMl: 2500,
      },
    });

    expect(guidance.recommendations[0]?.action).toEqual({
      type: "open_destination",
      destination: {
        kind: "review",
        cadence: "daily",
        date: "2026-03-14",
      },
    });
  });

  it("surfaces a due-now timed habit as a guidance recommendation", () => {
    const guidance = buildHomeGuidance({
      score: {
        label: "Solid Day",
        value: 74,
        topReasons: [],
      },
      momentum: {
        strongDayStreak: 1,
      },
      habits: [
        {
          id: "habit-1",
          title: "Morning walk",
          dueToday: true,
          completedToday: false,
          timingStatusToday: "due_now",
          timingLabel: "7:00 AM - 8:00 AM",
          streakCount: 0,
          risk: {
            level: "none",
            reason: null,
            message: null,
            dueCount7d: 0,
            completedCount7d: 0,
            completionRate7d: 0,
          },
        },
      ],
      priorities: [],
      tasks: [],
      mustWinTask: null,
      planning: {
        date: "2026-03-14",
        hasPlannerBlocks: true,
        pendingPriorityCount: 0,
        openTaskCount: 0,
        launchComplete: true,
      },
      accountability: {
        staleInboxCount: 0,
        staleInboxTaskId: null,
        overdueTaskCount: 0,
        overdueTaskId: null,
      },
      weeklyChallenge: null,
      dailyReviewAvailable: false,
      dailyReviewRoute: null,
      currentHour: 7,
      health: {
        waterMl: 0,
        waterTargetMl: 2500,
      },
    });

    expect(guidance.recommendations[0]).toEqual(
      expect.objectContaining({
        id: "habit-timing:habit-1",
        title: "Do Morning walk",
        detail: "Due now · 7:00 AM - 8:00 AM",
      }),
    );
  });
});
