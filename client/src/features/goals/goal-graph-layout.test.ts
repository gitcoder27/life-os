import { describe, expect, it } from "vitest";

import type { GoalHorizonItem, GoalOverviewItem } from "../../shared/lib/api";
import {
  buildGoalGraphLayout,
  findLaneAtY,
  laneHorizonId,
  draftNodeId,
  getGoalAncestorIds,
  getGoalTreeOrder,
  NODE_W,
  UNASSIGNED_LANE_ID,
} from "./goal-graph-layout";

const horizon = (id: string, name: string, sortOrder: number, isArchived = false): GoalHorizonItem => ({
  id,
  systemKey: null,
  name,
  sortOrder,
  spanMonths: null,
  isArchived,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

let goalCounter = 0;
const goal = (id: string, overrides: Partial<GoalOverviewItem> = {}): GoalOverviewItem => {
  goalCounter += 1;
  return {
    id,
    title: id,
    domainId: "domain-work",
    domain: "Work",
    domainSystemKey: "work_growth",
    status: "active",
    engagementState: null,
    horizonId: null,
    horizonName: null,
    horizonSystemKey: null,
    horizonSpanMonths: null,
    parentGoalId: null,
    why: null,
    targetDate: null,
    notes: null,
    weeklyProofText: null,
    knownObstacle: null,
    parkingRule: null,
    sortOrder: goalCounter,
    createdAt: `2026-01-${String(goalCounter).padStart(2, "0")}T00:00:00.000Z`,
    updatedAt: "2026-01-01T00:00:00.000Z",
    progressPercent: 0,
    health: "on_track",
    nextBestAction: null,
    milestoneCounts: { total: 0, completed: 0, pending: 0, overdue: 0 },
    momentum: { trend: "steady", buckets: [] },
    linkedSummary: {
      currentDayPriorities: 0,
      currentWeekPriorities: 0,
      currentMonthPriorities: 0,
      pendingTasks: 0,
      activeHabits: 0,
      dueHabitsToday: 0,
    },
    lastActivityAt: null,
    ...overrides,
  };
};

const horizons = [horizon("h-5y", "5 years", 1), horizon("h-1y", "1 year", 2), horizon("h-q", "Quarter", 3)];

const itemById = (layout: ReturnType<typeof buildGoalGraphLayout>, id: string) => {
  const item = layout.items.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`missing ${id}`);
  return item;
};

describe("goal graph layout", () => {
  it("places goals in the lane of their horizon, not their tree depth", () => {
    const goals = [
      goal("life", { horizonId: "h-5y" }),
      goal("skip", { horizonId: "h-q", parentGoalId: "life" }),
      goal("year", { horizonId: "h-1y" }),
    ];

    const layout = buildGoalGraphLayout({
      goals,
      horizons,
      expandedGoalIds: new Set(["life"]),
      draft: null,
    });

    expect(layout.lanes.map((lane) => lane.label)).toEqual(["5 years", "1 year", "Quarter"]);
    const [fiveYear, oneYear, quarter] = layout.lanes;
    expect(itemById(layout, "life").y).toBeGreaterThanOrEqual(fiveYear.top);
    expect(itemById(layout, "life").y).toBeLessThan(fiveYear.top + fiveYear.height);
    expect(itemById(layout, "year").y).toBeGreaterThanOrEqual(oneYear.top);
    expect(itemById(layout, "skip").y).toBeGreaterThanOrEqual(quarter.top);
    expect(oneYear.goalCount).toBe(1);
  });

  it("keeps empty horizon lanes and adds an Unplaced lane only when needed", () => {
    const withHorizon = buildGoalGraphLayout({
      goals: [goal("a", { horizonId: "h-1y" })],
      horizons,
      expandedGoalIds: new Set(),
      draft: null,
    });
    expect(withHorizon.lanes.map((lane) => lane.id)).toEqual(["h-5y", "h-1y", "h-q"]);
    expect(withHorizon.lanes[0].goalCount).toBe(0);

    const withoutHorizon = buildGoalGraphLayout({
      goals: [goal("a", { horizonId: "h-1y" }), goal("b"), goal("c", { horizonId: "h-old" })],
      horizons: [...horizons, horizon("h-old", "Old", 9, true)],
      expandedGoalIds: new Set(),
      draft: null,
    });
    const unassigned = withoutHorizon.lanes.at(-1)!;
    expect(unassigned.id).toBe(UNASSIGNED_LANE_ID);
    expect(unassigned.label).toBe("Unplaced");
    expect(unassigned.goalCount).toBe(2);
  });

  it("never overlaps two goals in the same lane and keeps descendants below ancestors", () => {
    const goals = [
      goal("parent", { horizonId: "h-1y" }),
      goal("child-a", { horizonId: "h-1y", parentGoalId: "parent" }),
      goal("child-b", { horizonId: "h-1y", parentGoalId: "parent" }),
      goal("grandchild", { horizonId: "h-1y", parentGoalId: "child-a" }),
    ];

    const layout = buildGoalGraphLayout({
      goals,
      horizons,
      expandedGoalIds: new Set(["parent", "child-a"]),
      draft: null,
    });

    const placed = layout.items.filter((item) => item.laneId === "h-1y");
    for (const left of placed) {
      for (const right of placed) {
        if (left.id === right.id || left.y !== right.y) continue;
        const overlaps = left.x < right.x + NODE_W && right.x < left.x + NODE_W;
        expect(overlaps, `${left.id} overlaps ${right.id}`).toBe(false);
      }
    }
    expect(itemById(layout, "child-a").y).toBeGreaterThan(itemById(layout, "parent").y);
    expect(itemById(layout, "grandchild").y).toBeGreaterThan(itemById(layout, "child-a").y);
    expect(layout.lanes.find((lane) => lane.id === "h-1y")!.height).toBeGreaterThan(
      layout.lanes.find((lane) => lane.id === "h-q")!.height,
    );
  });

  it("hides collapsed branches and lists visible goals depth first", () => {
    const goals = [
      goal("root", { horizonId: "h-5y" }),
      goal("kid", { horizonId: "h-1y", parentGoalId: "root" }),
      goal("other", { horizonId: "h-5y" }),
    ];

    const collapsed = buildGoalGraphLayout({ goals, horizons, expandedGoalIds: new Set(), draft: null });
    expect(collapsed.visibleGoalIds).toEqual(["root", "other"]);
    expect(collapsed.edges).toHaveLength(0);

    const expanded = buildGoalGraphLayout({ goals, horizons, expandedGoalIds: new Set(["root"]), draft: null });
    expect(expanded.visibleGoalIds).toEqual(["root", "kid", "other"]);
    expect(expanded.edges.map((edge) => edge.id)).toEqual(["edge-root-kid"]);
  });

  it("places a sub-goal draft in its suggested lane with a dashed edge", () => {
    const layout = buildGoalGraphLayout({
      goals: [goal("root", { horizonId: "h-5y" })],
      horizons,
      expandedGoalIds: new Set(["root"]),
      draft: { parentGoalId: "root", horizonId: "h-1y" },
    });

    const draft = itemById(layout, draftNodeId("root"));
    expect(draft.kind).toBe("draft");
    expect(draft.laneId).toBe("h-1y");
    expect(layout.edges).toEqual([
      { id: `edge-root-${draftNodeId("root")}`, source: "root", target: draftNodeId("root"), kind: "draft" },
    ]);
  });

  it("falls back to depth rows when there are no active horizons", () => {
    const layout = buildGoalGraphLayout({
      goals: [goal("root"), goal("kid", { parentGoalId: "root" })],
      horizons: [horizon("h-old", "Old", 1, true)],
      expandedGoalIds: new Set(["root"]),
      draft: null,
    });

    expect(layout.lanes).toEqual([]);
    expect(itemById(layout, "kid").y).toBeGreaterThan(itemById(layout, "root").y);
  });

  it("orders the whole tree and finds ancestors", () => {
    const goals = [
      goal("a"),
      goal("a1", { parentGoalId: "a" }),
      goal("a1x", { parentGoalId: "a1" }),
      goal("b"),
    ];

    expect(getGoalTreeOrder(goals)).toEqual(["a", "a1", "a1x", "b"]);
    expect(getGoalAncestorIds(goals, "a1x")).toEqual(["a1", "a"]);
    expect(getGoalAncestorIds(goals, "b")).toEqual([]);
  });

  it("finds the lane under a y position and maps it to a horizon", () => {
    const layout = buildGoalGraphLayout({
      goals: [goal("a", { horizonId: "h-year" }), goal("b", { horizonId: null })],
      horizons: [horizon("h-five", "5 years", 1), horizon("h-year", "1 year", 2)],
      expandedGoalIds: new Set(),
      draft: null,
    });
    const [five, year, unplaced] = layout.lanes;

    expect(findLaneAtY(layout.lanes, -40)?.id).toBe(five.id);
    expect(findLaneAtY(layout.lanes, year.top + 1)?.id).toBe(year.id);
    expect(findLaneAtY(layout.lanes, unplaced.top + unplaced.height + 500)?.id).toBe(unplaced.id);
    expect(findLaneAtY([], 0)).toBeNull();
    expect(laneHorizonId(year)).toBe("h-year");
    expect(laneHorizonId(unplaced)).toBeNull();
  });

  it("starts top-level trees in lane order, so a life-vision goal sits at the left", () => {
    const goals = [
      goal("unplaced-root", { horizonId: null, sortOrder: 1 }),
      goal("year-root", { horizonId: "h-year", sortOrder: 2 }),
      goal("vision-root", { horizonId: "h-vision", sortOrder: 3 }),
      goal("year-kid", { horizonId: "h-year", parentGoalId: "unplaced-root", sortOrder: 4 }),
    ];
    const horizons = [horizon("h-vision", "Life vision", 1), horizon("h-year", "1 year", 2)];
    const layout = buildGoalGraphLayout({ goals, horizons, expandedGoalIds: new Set(["unplaced-root"]), draft: null });

    expect(itemById(layout, "vision-root").x).toBeLessThan(itemById(layout, "year-root").x);
    expect(itemById(layout, "year-root").x).toBeLessThan(itemById(layout, "unplaced-root").x);
    expect(layout.visibleGoalIds).toEqual(["vision-root", "year-root", "unplaced-root", "year-kid"]);
    expect(getGoalTreeOrder(goals, horizons)).toEqual(["vision-root", "year-root", "unplaced-root", "year-kid"]);
  });
});
