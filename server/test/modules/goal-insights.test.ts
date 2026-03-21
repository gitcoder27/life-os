import { describe, expect, it } from "vitest";

import { buildGoalInsights } from "../../src/modules/planning/goal-insights.js";

describe("goal insights", () => {
  it("marks completed goals as achieved with no next action", () => {
    const insights = buildGoalInsights({
      goalStatus: "completed",
      targetDate: new Date("2026-03-31T00:00:00.000Z"),
      milestones: [
        {
          title: "Ship v1",
          status: "completed",
          targetDate: new Date("2026-03-20T00:00:00.000Z"),
          sortOrder: 1,
        },
      ],
      pendingTasks: [],
      habits: [],
      completionDates: [new Date("2026-03-18T09:00:00.000Z")],
      contextDate: new Date("2026-03-22T00:00:00.000Z"),
    });

    expect(insights.progressPercent).toBe(100);
    expect(insights.health).toBe("achieved");
    expect(insights.nextBestAction).toBeNull();
  });

  it("marks active goals as stalled when overdue and inactive for 14 days", () => {
    const insights = buildGoalInsights({
      goalStatus: "active",
      targetDate: new Date("2026-03-10T00:00:00.000Z"),
      milestones: [
        {
          title: "Book coach",
          status: "pending",
          targetDate: new Date("2026-03-12T00:00:00.000Z"),
          sortOrder: 1,
        },
      ],
      pendingTasks: [],
      habits: [],
      completionDates: [new Date("2026-03-01T09:00:00.000Z")],
      contextDate: new Date("2026-03-22T00:00:00.000Z"),
    });

    expect(insights.health).toBe("stalled");
    expect(insights.nextBestAction).toBe("Complete milestone: Book coach");
    expect(insights.milestoneCounts.overdue).toBe(1);
  });

  it("marks active goals as drifting when the target is close and work remains", () => {
    const insights = buildGoalInsights({
      goalStatus: "active",
      targetDate: new Date("2026-03-30T00:00:00.000Z"),
      milestones: [
        {
          title: "Draft outline",
          status: "pending",
          targetDate: new Date("2026-03-28T00:00:00.000Z"),
          sortOrder: 1,
        },
      ],
      pendingTasks: [],
      habits: [],
      completionDates: [new Date("2026-03-20T09:00:00.000Z")],
      contextDate: new Date("2026-03-22T00:00:00.000Z"),
    });

    expect(insights.health).toBe("drifting");
    expect(insights.nextBestAction).toBe("Complete milestone: Draft outline");
  });

  it("falls through next-best-action from milestones to tasks to habits to fallback", () => {
    const taskOnly = buildGoalInsights({
      goalStatus: "active",
      targetDate: null,
      milestones: [],
      pendingTasks: [
        {
          title: "Write first draft",
          dueAt: new Date("2026-03-23T12:00:00.000Z"),
          scheduledForDate: new Date("2026-03-23T00:00:00.000Z"),
          createdAt: new Date("2026-03-18T00:00:00.000Z"),
        },
      ],
      habits: [],
      completionDates: [new Date("2026-03-21T09:00:00.000Z")],
      contextDate: new Date("2026-03-22T00:00:00.000Z"),
    });
    const habitOnly = buildGoalInsights({
      goalStatus: "active",
      targetDate: null,
      milestones: [],
      pendingTasks: [],
      habits: [
        {
          title: "Practice scales",
          dueToday: true,
          completedToday: false,
        },
      ],
      completionDates: [new Date("2026-03-21T09:00:00.000Z")],
      contextDate: new Date("2026-03-22T00:00:00.000Z"),
    });
    const fallback = buildGoalInsights({
      goalStatus: "active",
      targetDate: null,
      milestones: [],
      pendingTasks: [],
      habits: [],
      completionDates: [new Date("2026-03-21T09:00:00.000Z")],
      contextDate: new Date("2026-03-22T00:00:00.000Z"),
    });

    expect(taskOnly.nextBestAction).toBe("Finish task: Write first draft");
    expect(habitOnly.nextBestAction).toBe("Complete habit: Practice scales");
    expect(fallback.nextBestAction).toBe("Define the next milestone");
  });

  it("builds four weekly momentum buckets and an up trend", () => {
    const insights = buildGoalInsights({
      goalStatus: "active",
      targetDate: null,
      milestones: [],
      pendingTasks: [],
      habits: [],
      completionDates: [
        new Date("2026-02-28T09:00:00.000Z"),
        new Date("2026-03-08T09:00:00.000Z"),
        new Date("2026-03-09T09:00:00.000Z"),
        new Date("2026-03-17T09:00:00.000Z"),
        new Date("2026-03-18T09:00:00.000Z"),
        new Date("2026-03-21T09:00:00.000Z"),
        new Date("2026-03-22T09:00:00.000Z"),
      ],
      contextDate: new Date("2026-03-22T00:00:00.000Z"),
    });

    expect(insights.momentum.trend).toBe("up");
    expect(insights.momentum.buckets).toEqual([
      expect.objectContaining({ startDate: "2026-02-23", endDate: "2026-03-01", completedCount: 1 }),
      expect.objectContaining({ startDate: "2026-03-02", endDate: "2026-03-08", completedCount: 1 }),
      expect.objectContaining({ startDate: "2026-03-09", endDate: "2026-03-15", completedCount: 1 }),
      expect.objectContaining({ startDate: "2026-03-16", endDate: "2026-03-22", completedCount: 4 }),
    ]);
  });
});
