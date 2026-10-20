import type { GoalHorizonItem, GoalOverviewItem } from "../../shared/lib/api";

/* Layout for the goal map. Pure: no React, no React Flow.

   Horizontally, each goal sits centred over its visible subtree, as in a tidy
   tree. Vertically, a goal sits in the lane of its planning layer (horizon),
   so "5 years" goals line up above "1 year" goals regardless of tree depth.
   When a lane would put two goals on top of each other, the later one drops
   into another row inside the same lane. With no active horizons, rows fall
   back to tree depth. */

export const NODE_W = 208;
export const NODE_H = 72;
export const ROW_GAP = 28;
export const ROW_H = NODE_H + ROW_GAP;
export const SIBLING_GAP = 24;
export const ROOT_GAP = 48;
export const CONTENT_X = 32;
export const CONTENT_Y = 0;
export const LANE_PAD_Y = 20;
/* Empty lanes stay short: they are drop targets, not content. */
export const EMPTY_LANE_H = 48;

export const UNASSIGNED_LANE_ID = "unassigned";

export type GoalGraphLane = {
  id: string;
  label: string;
  top: number;
  height: number;
  goalCount: number;
  isUnassigned: boolean;
};

export type GoalGraphPlacedItem =
  | { kind: "goal"; id: string; goal: GoalOverviewItem; depth: number; x: number; y: number; laneId: string | null }
  | { kind: "draft"; id: string; parentGoalId: string; depth: number; x: number; y: number; laneId: string | null };

export type GoalGraphEdge = {
  id: string;
  source: string;
  target: string;
  kind: "goal" | "draft";
};

export type GoalGraphLayoutInput = {
  goals: GoalOverviewItem[];
  horizons: GoalHorizonItem[];
  expandedGoalIds: Set<string>;
  draft: { parentGoalId: string; horizonId: string | null } | null;
};

export type GoalGraphLayout = {
  items: GoalGraphPlacedItem[];
  edges: GoalGraphEdge[];
  lanes: GoalGraphLane[];
  /** Visible goals in depth-first order, for keyboard navigation. */
  visibleGoalIds: string[];
  childrenByParent: Map<string, GoalOverviewItem[]>;
  goalMap: Map<string, GoalOverviewItem>;
};

export const draftNodeId = (parentGoalId: string) => `child-draft-${parentGoalId}`;

export const sortGoals = (left: GoalOverviewItem, right: GoalOverviewItem) => {
  if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
  return left.createdAt.localeCompare(right.createdAt);
};

export const buildGoalTree = (goals: GoalOverviewItem[]) => {
  const goalMap = new Map(goals.map((goal) => [goal.id, goal]));
  const childrenByParent = new Map<string, GoalOverviewItem[]>();

  for (const goal of goals) {
    if (!goal.parentGoalId || !goalMap.has(goal.parentGoalId)) {
      continue;
    }

    const children = childrenByParent.get(goal.parentGoalId) ?? [];
    children.push(goal);
    childrenByParent.set(goal.parentGoalId, children);
  }

  for (const children of childrenByParent.values()) {
    children.sort(sortGoals);
  }

  const roots = goals
    .filter((goal) => !goal.parentGoalId || !goalMap.has(goal.parentGoalId))
    .sort(sortGoals);

  return { goalMap, childrenByParent, roots };
};

/** Top-level goals in lane order (longest horizon first), so a life-vision
    tree starts at the left and unplaced goals come last. Siblings below a
    goal keep their own order. */
export const orderRootsByHorizon = (roots: GoalOverviewItem[], horizons: GoalHorizonItem[]) => {
  const rankById = new Map(
    horizons
      .filter((horizon) => !horizon.isArchived)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((horizon, index) => [horizon.id, index]),
  );
  const rank = (goal: GoalOverviewItem) =>
    (goal.horizonId ? rankById.get(goal.horizonId) : undefined) ?? Number.MAX_SAFE_INTEGER;
  return [...roots].sort((left, right) => rank(left) - rank(right) || sortGoals(left, right));
};

/** Every goal in the map's left-to-right, depth-first order, ignoring
    collapsed branches. */
export const getGoalTreeOrder = (goals: GoalOverviewItem[], horizons: GoalHorizonItem[] = []) => {
  const { childrenByParent, roots: treeRoots } = buildGoalTree(goals);
  const roots = orderRootsByHorizon(treeRoots, horizons);
  const order: string[] = [];
  const visit = (goal: GoalOverviewItem) => {
    order.push(goal.id);
    for (const child of childrenByParent.get(goal.id) ?? []) {
      visit(child);
    }
  };
  roots.forEach(visit);
  return order;
};

export const getGoalAncestorIds = (goals: GoalOverviewItem[], goalId: string) => {
  const goalMap = new Map(goals.map((goal) => [goal.id, goal]));
  const ancestorIds: string[] = [];
  let current = goalMap.get(goalId)?.parentGoalId ?? null;

  while (current && goalMap.has(current) && !ancestorIds.includes(current)) {
    ancestorIds.push(current);
    current = goalMap.get(current)?.parentGoalId ?? null;
  }

  return ancestorIds;
};

type TreeChildItem =
  | { type: "goal"; goal: GoalOverviewItem }
  | { type: "draft"; parentGoalId: string };

export const buildGoalGraphLayout = ({
  goals,
  horizons,
  expandedGoalIds,
  draft,
}: GoalGraphLayoutInput): GoalGraphLayout => {
  const { goalMap, childrenByParent, roots: treeRoots } = buildGoalTree(goals);
  const roots = orderRootsByHorizon(treeRoots, horizons);

  /* ── Visible tree ── */

  const visibleGoalIds: string[] = [];
  const markVisible = (goal: GoalOverviewItem) => {
    visibleGoalIds.push(goal.id);
    if (!expandedGoalIds.has(goal.id)) {
      return;
    }
    for (const child of childrenByParent.get(goal.id) ?? []) {
      markVisible(child);
    }
  };
  roots.forEach(markVisible);
  const visibleIds = new Set(visibleGoalIds);

  const childItemsForGoal = (goal: GoalOverviewItem): TreeChildItem[] => {
    const items: TreeChildItem[] = [];

    if (expandedGoalIds.has(goal.id)) {
      for (const child of childrenByParent.get(goal.id) ?? []) {
        if (visibleIds.has(child.id)) {
          items.push({ type: "goal", goal: child });
        }
      }
    }

    if (draft?.parentGoalId === goal.id) {
      items.push({ type: "draft", parentGoalId: goal.id });
    }

    return items;
  };

  /* ── Horizontal positions (tidy tree by subtree width) ── */

  const widthCache = new Map<string, number>();

  const measureItemWidth = (item: TreeChildItem): number =>
    item.type === "goal" ? measureGoalWidth(item.goal) : NODE_W;

  const measureGoalWidth = (goal: GoalOverviewItem): number => {
    const cached = widthCache.get(goal.id);
    if (cached !== undefined) {
      return cached;
    }

    const childItems = childItemsForGoal(goal);
    const childrenWidth = childItems.reduce(
      (total, item, index) => total + measureItemWidth(item) + (index > 0 ? SIBLING_GAP : 0),
      0,
    );
    const width = Math.max(NODE_W, childrenWidth);
    widthCache.set(goal.id, width);
    return width;
  };

  type PendingItem = {
    item: GoalGraphPlacedItem;
    parentId: string | null;
  };

  const pending: PendingItem[] = [];
  const edges: GoalGraphEdge[] = [];

  const placeGoal = (goal: GoalOverviewItem, leftX: number, depth: number, parentId: string | null) => {
    const goalWidth = measureGoalWidth(goal);
    pending.push({
      item: {
        kind: "goal",
        id: goal.id,
        goal,
        depth,
        x: leftX + (goalWidth - NODE_W) / 2,
        y: 0,
        laneId: null,
      },
      parentId,
    });

    const childItems = childItemsForGoal(goal);
    const childrenWidth = childItems.reduce(
      (total, item, index) => total + measureItemWidth(item) + (index > 0 ? SIBLING_GAP : 0),
      0,
    );
    let currentLeft = leftX + (goalWidth - childrenWidth) / 2;

    for (const child of childItems) {
      const childWidth = measureItemWidth(child);

      if (child.type === "goal") {
        placeGoal(child.goal, currentLeft, depth + 1, goal.id);
        edges.push({
          id: `edge-${goal.id}-${child.goal.id}`,
          source: goal.id,
          target: child.goal.id,
          kind: "goal",
        });
      } else {
        const id = draftNodeId(child.parentGoalId);
        pending.push({
          item: {
            kind: "draft",
            id,
            parentGoalId: child.parentGoalId,
            depth: depth + 1,
            x: currentLeft + (childWidth - NODE_W) / 2,
            y: 0,
            laneId: null,
          },
          parentId: goal.id,
        });
        edges.push({ id: `edge-${goal.id}-${id}`, source: goal.id, target: id, kind: "draft" });
      }

      currentLeft += childWidth + SIBLING_GAP;
    }
  };

  let rootLeft = CONTENT_X;
  for (const root of roots) {
    placeGoal(root, rootLeft, 0, null);
    rootLeft += measureGoalWidth(root) + ROOT_GAP;
  }

  /* ── Vertical positions ── */

  const activeHorizons = horizons
    .filter((horizon) => !horizon.isArchived)
    .sort((left, right) => left.sortOrder - right.sortOrder);

  if (activeHorizons.length === 0) {
    const items = pending.map(({ item }) => ({ ...item, y: CONTENT_Y + LANE_PAD_Y + item.depth * ROW_H }));
    return { items, edges, lanes: [], visibleGoalIds, childrenByParent, goalMap };
  }

  const activeHorizonIds = new Set(activeHorizons.map((horizon) => horizon.id));
  const laneIdFor = (horizonId: string | null) =>
    horizonId && activeHorizonIds.has(horizonId) ? horizonId : UNASSIGNED_LANE_ID;

  for (const { item } of pending) {
    item.laneId = item.kind === "goal" ? laneIdFor(item.goal.horizonId) : laneIdFor(draft?.horizonId ?? null);
  }

  // Ancestors are placed before descendants, so a goal never lands above an
  // ancestor that shares its lane.
  const ordered = [...pending].sort((left, right) => left.item.depth - right.item.depth || left.item.x - right.item.x);
  const byId = new Map(pending.map((entry) => [entry.item.id, entry]));
  const rowById = new Map<string, number>();
  const rowsByLane = new Map<string, Array<Array<[number, number]>>>();

  for (const { item, parentId } of ordered) {
    const laneId = item.laneId!;
    let minRow = 0;
    let ancestorId = parentId;
    while (ancestorId) {
      const ancestor = byId.get(ancestorId);
      if (!ancestor) break;
      if (ancestor.item.laneId === laneId) {
        minRow = Math.max(minRow, (rowById.get(ancestorId) ?? 0) + 1);
      }
      ancestorId = ancestor.parentId;
    }

    const rows = rowsByLane.get(laneId) ?? [];
    const start = item.x - SIBLING_GAP / 2;
    const end = item.x + NODE_W + SIBLING_GAP / 2;
    let row = minRow;
    while ((rows[row] ?? []).some(([otherStart, otherEnd]) => start < otherEnd && otherStart < end)) {
      row += 1;
    }
    rows[row] = [...(rows[row] ?? []), [start, end]];
    rowsByLane.set(laneId, rows);
    rowById.set(item.id, row);
  }

  const laneDefinitions = [
    ...activeHorizons.map((horizon) => ({ id: horizon.id, label: horizon.name, isUnassigned: false })),
    ...(rowsByLane.has(UNASSIGNED_LANE_ID)
      ? [{ id: UNASSIGNED_LANE_ID, label: "Unplaced", isUnassigned: true }]
      : []),
  ];

  const lanes: GoalGraphLane[] = [];
  const laneTopById = new Map<string, number>();
  let laneTop = CONTENT_Y;

  for (const definition of laneDefinitions) {
    const rowCount = rowsByLane.get(definition.id)?.length ?? 0;
    const height = rowCount > 0 ? LANE_PAD_Y * 2 + rowCount * ROW_H - ROW_GAP : EMPTY_LANE_H;
    lanes.push({
      ...definition,
      top: laneTop,
      height,
      goalCount: pending.filter(({ item }) => item.kind === "goal" && item.laneId === definition.id).length,
    });
    laneTopById.set(definition.id, laneTop);
    laneTop += height;
  }

  const items = pending.map(({ item }) => ({
    ...item,
    y: (laneTopById.get(item.laneId!) ?? 0) + LANE_PAD_Y + (rowById.get(item.id) ?? 0) * ROW_H,
  }));

  return { items, edges, lanes, visibleGoalIds, childrenByParent, goalMap };
};

/** The lane under a flow-space y. Above the first lane counts as the first;
    below the last counts as the last, since the last band runs to the bottom. */
export const findLaneAtY = (lanes: GoalGraphLane[], y: number): GoalGraphLane | null => {
  if (lanes.length === 0) {
    return null;
  }
  return lanes.find((lane) => y < lane.top + lane.height) ?? lanes[lanes.length - 1];
};

/** The horizon a lane stands for; the unplaced lane clears the horizon. */
export const laneHorizonId = (lane: GoalGraphLane) => (lane.isUnassigned ? null : lane.id);
