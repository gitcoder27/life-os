import { describe, expect, it } from "vitest";

import {
  type GoalInsightMilestone,
  type GoalTreeNodeInput,
  buildGoalInsights,
  buildGoalTreeInsights,
} from "../../src/modules/planning/goal-insights.js";

const CONTEXT_DATE = new Date("2026-03-22T00:00:00.000Z");
const RECENT = new Date("2026-03-20T09:00:00.000Z");
const STALE = new Date("2026-03-01T09:00:00.000Z");

function goalNode(overrides: Partial<GoalTreeNodeInput> & { id: string }): GoalTreeNodeInput {
  return {
    parentGoalId: null,
    horizonSystemKey: null,
    horizonSpanMonths: null,
    goalStatus: "active",
    targetDate: null,
    milestones: [],
    pendingTasks: [],
    habits: [],
    completionDates: [],
    ...overrides,
  };
}

function milestones(...statuses: GoalInsightMilestone["status"][]): GoalInsightMilestone[] {
  return statuses.map((status, index) => ({
    title: `Milestone ${index + 1}`,
    status,
    targetDate: null,
    sortOrder: index + 1,
  }));
}

function pendingTask(title: string) {
  return {
    title,
    dueAt: null,
    scheduledForDate: null,
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
  };
}

function insightsFor(nodes: GoalTreeNodeInput[], id: string) {
  const insights = buildGoalTreeInsights(nodes, CONTEXT_DATE).get(id);

  if (!insights) {
    throw new Error(`Missing insights for ${id}`);
  }

  return insights;
}

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

describe("goal tree insights", () => {
  it("rolls descendant activity up into parent health, momentum and last activity", () => {
    const nodes = [
      goalNode({ id: "year", horizonSystemKey: "one_year" }),
      goalNode({
        id: "quarter",
        parentGoalId: "year",
        horizonSystemKey: "quarter",
        completionDates: [RECENT],
      }),
      goalNode({
        id: "month",
        parentGoalId: "quarter",
        horizonSystemKey: "month",
        completionDates: [new Date("2026-03-21T09:00:00.000Z")],
      }),
    ];

    const year = insightsFor(nodes, "year");

    expect(year.health).toBe("on_track");
    expect(year.lastActivityAt).toBe("2026-03-21T09:00:00.000Z");
    expect(year.momentum.buckets[3]?.completedCount).toBe(2);
    expect(year.milestoneCounts.total).toBe(0);
    expect(insightsFor(nodes, "quarter").health).toBe("on_track");
  });

  it("ignores paused and archived branches, including everything beneath them", () => {
    const nodes = [
      goalNode({ id: "year", horizonSystemKey: "one_year" }),
      goalNode({ id: "paused", parentGoalId: "year", goalStatus: "paused", completionDates: [RECENT] }),
      goalNode({ id: "under-paused", parentGoalId: "paused", completionDates: [RECENT] }),
      goalNode({
        id: "archived",
        parentGoalId: "year",
        goalStatus: "archived",
        milestones: milestones("completed"),
        completionDates: [RECENT],
      }),
    ];

    const year = insightsFor(nodes, "year");

    expect(year.health).toBe("drifting");
    expect(year.progressPercent).toBe(0);
    expect(year.lastActivityAt).toBeNull();
    expect(insightsFor(nodes, "paused").health).toBeNull();
  });

  it("blends the parent's own milestones with each counted child's progress", () => {
    const nodes = [
      goalNode({ id: "parent", milestones: milestones("completed", "pending") }),
      goalNode({ id: "done", parentGoalId: "parent", goalStatus: "completed", milestones: milestones("completed", "pending") }),
      goalNode({ id: "quarter", parentGoalId: "parent", milestones: milestones("completed", "pending", "pending", "pending") }),
      goalNode({ id: "empty", parentGoalId: "parent" }),
      goalNode({ id: "archived", parentGoalId: "parent", goalStatus: "archived", milestones: milestones("completed") }),
    ];

    const parent = insightsFor(nodes, "parent");

    // (own 0.5 + done 1 + quarter 0.25 + empty 0) / 4
    expect(parent.progressPercent).toBe(44);
    expect(parent.milestoneCounts).toEqual({ total: 2, completed: 1, pending: 1, overdue: 0 });
    expect(insightsFor(nodes, "done").progressPercent).toBe(100);
    expect(insightsFor(nodes, "quarter").progressPercent).toBe(25);
  });

  it("rolls progress through nested levels without compounding rounding", () => {
    const nodes = [
      goalNode({ id: "year" }),
      goalNode({ id: "q1", parentGoalId: "year", milestones: milestones("completed") }),
      goalNode({ id: "q2", parentGoalId: "year" }),
      goalNode({ id: "month", parentGoalId: "q1", milestones: milestones("completed", "pending", "pending") }),
    ];

    expect(insightsFor(nodes, "month").progressPercent).toBe(33);
    expect(insightsFor(nodes, "q1").progressPercent).toBe(67);
    // (q1 0.667 + q2 0) / 2 = 0.333, not (67 + 0) / 2 = 33.5
    expect(insightsFor(nodes, "year").progressPercent).toBe(33);
  });

  it("only treats a parent as achieved once its children are done too", () => {
    const nodes = [
      goalNode({ id: "open-parent", milestones: milestones("completed"), completionDates: [RECENT] }),
      goalNode({
        id: "open-child",
        parentGoalId: "open-parent",
        milestones: [{ title: "Book venue", status: "pending", targetDate: null, sortOrder: 1 }],
        completionDates: [RECENT],
      }),
      goalNode({ id: "done-parent" }),
      goalNode({ id: "done-a", parentGoalId: "done-parent", goalStatus: "completed" }),
      goalNode({ id: "done-b", parentGoalId: "done-parent", goalStatus: "completed" }),
    ];

    const openParent = insightsFor(nodes, "open-parent");
    const doneParent = insightsFor(nodes, "done-parent");

    expect(openParent.health).toBe("on_track");
    expect(openParent.progressPercent).toBe(50);
    expect(openParent.nextBestAction).toBe("Complete milestone: Book venue");
    expect(doneParent.health).toBe("achieved");
    expect(doneParent.progressPercent).toBe(100);
    expect(doneParent.nextBestAction).toBeNull();
  });

  it("drifts when the target is close and children still have open work", () => {
    const nodes = [
      goalNode({
        id: "parent",
        targetDate: new Date("2026-03-30T00:00:00.000Z"),
        milestones: milestones("completed"),
        completionDates: [RECENT],
      }),
      goalNode({ id: "child", parentGoalId: "parent", milestones: milestones("pending"), completionDates: [RECENT] }),
    ];

    expect(insightsFor(nodes, "parent").health).toBe("drifting");
  });

  it("gives long-horizon goals the best health among their active children instead of pace-based health", () => {
    const nodes = [
      goalNode({ id: "vision", horizonSystemKey: "life_vision" }),
      goalNode({ id: "five-a", parentGoalId: "vision", horizonSystemKey: "five_year" }),
      goalNode({ id: "five-b", parentGoalId: "vision", horizonSystemKey: "five_year", completionDates: [RECENT] }),
      goalNode({ id: "year-drifting", parentGoalId: "five-a", horizonSystemKey: "one_year" }),
      goalNode({ id: "year-on-track", parentGoalId: "five-a", horizonSystemKey: "one_year", completionDates: [RECENT] }),
      goalNode({ id: "vision-2", horizonSystemKey: "life_vision" }),
      goalNode({
        id: "year-stalled",
        parentGoalId: "vision-2",
        horizonSystemKey: "one_year",
        targetDate: new Date("2026-03-10T00:00:00.000Z"),
        completionDates: [STALE],
      }),
    ];

    expect(insightsFor(nodes, "year-drifting").health).toBe("drifting");
    expect(insightsFor(nodes, "five-a").health).toBe("on_track");
    // No active children: no pace signal, even with recent completions of its own.
    expect(insightsFor(nodes, "five-b").health).toBeNull();
    expect(insightsFor(nodes, "five-b").nextBestAction).toBeNull();
    expect(insightsFor(nodes, "vision").health).toBe("on_track");
    expect(insightsFor(nodes, "year-stalled").health).toBe("stalled");
    expect(insightsFor(nodes, "vision-2").health).toBe("stalled");
  });

  it("treats custom horizons of 36 months or more as long-horizon", () => {
    const nodes = [
      goalNode({ id: "decade", horizonSpanMonths: 48 }),
      goalNode({ id: "two-year", horizonSpanMonths: 24 }),
    ];

    expect(insightsFor(nodes, "decade").health).toBeNull();
    expect(insightsFor(nodes, "decade").nextBestAction).toBeNull();
    expect(insightsFor(nodes, "two-year").health).toBe("drifting");
    expect(insightsFor(nodes, "two-year").nextBestAction).toBe("Define the next milestone");
  });

  it("borrows the next action from the child that most needs attention", () => {
    const nodes = [
      goalNode({ id: "parent" }),
      goalNode({
        id: "calm",
        parentGoalId: "parent",
        milestones: [{ title: "Book venue", status: "pending", targetDate: null, sortOrder: 1 }],
        completionDates: [RECENT],
      }),
      goalNode({
        id: "stalled",
        parentGoalId: "parent",
        targetDate: new Date("2026-03-10T00:00:00.000Z"),
        pendingTasks: [pendingTask("Call caterer")],
        completionDates: [STALE],
      }),
      goalNode({ id: "with-own", pendingTasks: [pendingTask("Draft plan")] }),
      goalNode({ id: "with-own-child", parentGoalId: "with-own", pendingTasks: [pendingTask("Call caterer")] }),
      goalNode({ id: "tie", horizonSystemKey: "one_year" }),
      goalNode({
        id: "tie-later",
        parentGoalId: "tie",
        targetDate: new Date("2026-04-30T00:00:00.000Z"),
        pendingTasks: [pendingTask("Later task")],
      }),
      goalNode({
        id: "tie-sooner",
        parentGoalId: "tie",
        targetDate: new Date("2026-04-10T00:00:00.000Z"),
        pendingTasks: [pendingTask("Sooner task")],
      }),
    ];

    expect(insightsFor(nodes, "stalled").health).toBe("stalled");
    expect(insightsFor(nodes, "parent").nextBestAction).toBe("Finish task: Call caterer");
    expect(insightsFor(nodes, "with-own").nextBestAction).toBe("Finish task: Draft plan");
    expect(insightsFor(nodes, "tie").nextBestAction).toBe("Finish task: Sooner task");
  });

  it("does not borrow a child's generic fallback action", () => {
    const nodes = [
      goalNode({ id: "vision", horizonSystemKey: "life_vision" }),
      goalNode({ id: "year", parentGoalId: "vision", horizonSystemKey: "one_year" }),
    ];

    expect(insightsFor(nodes, "year").nextBestAction).toBe("Define the next milestone");
    expect(insightsFor(nodes, "vision").nextBestAction).toBeNull();
  });

  it("reports completed goals as fully done even with open milestones", () => {
    const insights = insightsFor(
      [goalNode({ id: "goal", goalStatus: "completed", milestones: milestones("completed", "pending") })],
      "goal",
    );

    expect(insights.progressPercent).toBe(100);
    expect(insights.health).toBe("achieved");
  });

  it("survives a cycle in the parent links", () => {
    const nodes = [
      goalNode({ id: "a", parentGoalId: "b", completionDates: [RECENT] }),
      goalNode({ id: "b", parentGoalId: "a" }),
    ];

    const insights = buildGoalTreeInsights(nodes, CONTEXT_DATE);

    expect(insights.size).toBe(2);
    expect(insights.get("a")?.health).toBe("on_track");
  });
});
