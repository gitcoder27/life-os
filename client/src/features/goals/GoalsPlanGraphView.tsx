import { useMemo, useCallback, useEffect, useRef, memo } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Handle,
  Position,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Node, Edge, NodeProps, NodeMouseHandler } from "@xyflow/react";

import type {
  GoalOverviewItem,
  GoalDomainItem,
  GoalHorizonItem,
  WeekPlanResponse,
  MonthPlanResponse,
} from "../../shared/lib/api";

/* ── Layout Constants ── */

const LANE_GAP = 150;
const NODE_W = 244;
const NODE_H = 72;
const X_GAP = 28;
const CONTENT_X = 160;

/* ── Helpers ── */

const domainEmojis: Record<string, string> = {
  health: "♥",
  money: "💼",
  work_growth: "🧠",
  home_admin: "🏡",
  discipline: "🎯",
};

function domainEmoji(key: string | null): string {
  if (!key) return "✦";
  return domainEmojis[key] ?? "✦";
}

/* ── Node Data Types ── */

type GoalNodeData = {
  goal: GoalOverviewItem;
  isSelected: boolean;
  isDimmed: boolean;
  onSelect: (id: string) => void;
};

type PlanSlotData = {
  slotNumber: number;
  title: string;
  type: "month" | "week";
  isEmpty: boolean;
  isLinked: boolean;
};

type GhostData = {
  onAdd: () => void;
};

type LaneLabelData = {
  label: string;
  type: "horizon" | "planning";
};

/* ── Custom Node: Goal ── */

const GoalGraphNode = memo(function GoalGraphNode({ data }: NodeProps) {
  const d = data as unknown as GoalNodeData;
  const { goal, isSelected, isDimmed, onSelect } = d;
  const health = goal.health ?? "on_track";

  return (
    <div
      className={`graph-goal-node nopan${isSelected ? " graph-goal-node--selected" : ""}${isDimmed ? " graph-goal-node--dimmed" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(goal.id);
      }}
    >
      <Handle type="target" position={Position.Top} className="graph-handle--hidden" />
      <div className="graph-goal-node__row">
        <span className={`graph-goal-node__dot graph-goal-node__dot--${health}`} />
        <span className="graph-goal-node__title">{goal.title}</span>
      </div>
      <div className="graph-goal-node__meta">
        <span className="graph-goal-node__domain">
          {domainEmoji(goal.domainSystemKey)} {goal.domain}
        </span>
        {goal.horizonName && (
          <span className="graph-goal-node__badge">{goal.horizonName}</span>
        )}
      </div>
      {goal.progressPercent > 0 && (
        <div className="graph-goal-node__bar">
          <div
            className={`graph-goal-node__bar-fill graph-goal-node__bar-fill--${health}`}
            style={{ width: `${Math.min(goal.progressPercent, 100)}%` }}
          />
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="graph-handle--hidden" />
    </div>
  );
});

/* ── Custom Node: Planning Slot ── */

const PlanningSlotNode = memo(function PlanningSlotNode({ data }: NodeProps) {
  const d = data as unknown as PlanSlotData;
  const prefix = d.type === "month" ? "M" : "W";

  return (
    <div
      className={`graph-slot${d.isEmpty ? " graph-slot--empty" : ""}${d.isLinked ? " graph-slot--linked" : ""}`}
    >
      <Handle type="target" position={Position.Top} className="graph-handle--hidden" />
      <span className="graph-slot__badge">
        {prefix}
        {d.slotNumber}
      </span>
      <span className="graph-slot__title">{d.isEmpty ? "Empty slot" : d.title}</span>
    </div>
  );
});

/* ── Custom Node: Ghost (Add Child) ── */

const GhostAddNode = memo(function GhostAddNode({ data }: NodeProps) {
  const d = data as unknown as GhostData;

  return (
    <div
      className="graph-ghost nopan"
      onClick={(e) => {
        e.stopPropagation();
        d.onAdd();
      }}
    >
      <Handle type="target" position={Position.Top} className="graph-handle--hidden" />
      <span className="graph-ghost__plus">+</span>
      <span className="graph-ghost__label">Add supporting goal</span>
    </div>
  );
});

/* ── Custom Node: Lane Label ── */

const LaneLabelNode = memo(function LaneLabelNode({ data }: NodeProps) {
  const d = data as unknown as LaneLabelData;

  return (
    <div className={`graph-lane-label graph-lane-label--${d.type}`}>{d.label}</div>
  );
});

/* ── Node Types Registry ── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: Record<string, any> = {
  goalNode: GoalGraphNode,
  planningSlot: PlanningSlotNode,
  ghostNode: GhostAddNode,
  laneLabel: LaneLabelNode,
};

/* ── Layout Engine ── */

function buildLayout(
  goals: GoalOverviewItem[],
  horizons: GoalHorizonItem[],
  selectedGoalId: string | null,
  weekPlan: WeekPlanResponse | null,
  monthPlan: MonthPlanResponse | null,
  onSelect: (id: string) => void,
  onAddChild: () => void,
): { nodes: Node[]; edges: Edge[]; focusIds: string[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const focusIds: string[] = [];

  const activeHorizons = horizons.filter((h) => !h.isArchived);
  const active = goals.filter((g) => g.status === "active");

  // Map horizonId → lane index
  const hLane = new Map<string, number>();
  activeHorizons.forEach((h, i) => hLane.set(h.id, i));
  const hCount = activeHorizons.length;
  const noHLane = hCount; // lane for goals without a horizon

  // Focus set computation
  const selected = selectedGoalId
    ? active.find((g) => g.id === selectedGoalId) ?? null
    : null;
  const ancestors = new Set<string>();
  const children = new Set<string>();
  const siblings = new Set<string>();

  if (selected) {
    let cur: string | null | undefined = selected.parentGoalId;
    while (cur) {
      ancestors.add(cur);
      const p = active.find((g) => g.id === cur);
      cur = p?.parentGoalId;
    }
    for (const g of active) {
      if (g.parentGoalId === selectedGoalId) children.add(g.id);
    }
    if (selected.parentGoalId) {
      for (const g of active) {
        if (
          g.parentGoalId === selected.parentGoalId &&
          g.id !== selectedGoalId
        )
          siblings.add(g.id);
      }
    }
  }

  const isFocused = (id: string) =>
    id === selectedGoalId ||
    ancestors.has(id) ||
    children.has(id) ||
    siblings.has(id);

  // Group goals by lane
  const byLane = new Map<number, GoalOverviewItem[]>();
  for (const g of active) {
    const lane = g.horizonId
      ? (hLane.get(g.horizonId) ?? noHLane)
      : noHLane;
    if (!byLane.has(lane)) byLane.set(lane, []);
    byLane.get(lane)!.push(g);
  }

  // Active lanes (sorted)
  const activeLanes = [...new Set([...byLane.keys()])].sort((a, b) => a - b);

  // Y positions for each lane
  const laneY = new Map<number, number>();
  let y = 0;
  for (const lane of activeLanes) {
    laneY.set(lane, y);
    y += LANE_GAP;
  }

  // Planning lane Y positions (after a separator)
  const planningStartY = y + 40;
  const monthY = planningStartY;
  const weekY = monthY + LANE_GAP - 30;

  // ── Lane labels for horizons ──
  for (const lane of activeLanes) {
    const ly = laneY.get(lane)!;
    const label =
      lane < hCount ? activeHorizons[lane].name : "Unassigned";
    nodes.push({
      id: `ll-${lane}`,
      type: "laneLabel",
      position: { x: 0, y: ly + 20 },
      data: { label, type: "horizon" } satisfies LaneLabelData,
      selectable: false,
      draggable: false,
    });
  }

  // ── Goal nodes ──
  for (const [lane, laneGoals] of byLane) {
    const ly = laneY.get(lane);
    if (ly === undefined) continue;

    // Sort: selected first, then ancestors, then by sortOrder
    const sorted = [...laneGoals].sort((a, b) => {
      if (a.id === selectedGoalId) return -1;
      if (b.id === selectedGoalId) return 1;
      if (ancestors.has(a.id) && !ancestors.has(b.id)) return -1;
      if (!ancestors.has(a.id) && ancestors.has(b.id)) return 1;
      return a.sortOrder - b.sortOrder;
    });

    sorted.forEach((goal, i) => {
      const x = CONTENT_X + i * (NODE_W + X_GAP);
      const isSelected = goal.id === selectedGoalId;
      const isDimmed =
        selectedGoalId !== null && !isFocused(goal.id);

      if (
        isSelected ||
        ancestors.has(goal.id) ||
        children.has(goal.id)
      ) {
        focusIds.push(goal.id);
      }

      nodes.push({
        id: goal.id,
        type: "goalNode",
        position: { x, y: ly },
        data: {
          goal,
          isSelected,
          isDimmed,
          onSelect,
        } satisfies GoalNodeData,
        selectable: false,
        draggable: false,
      });
    });
  }

  // ── Parent-child edges ──
  const nodeSet = new Set(
    nodes.filter((n) => n.type === "goalNode").map((n) => n.id),
  );
  for (const g of active) {
    if (
      g.parentGoalId &&
      nodeSet.has(g.parentGoalId) &&
      nodeSet.has(g.id)
    ) {
      const onPath =
        selectedGoalId !== null &&
        ((g.id === selectedGoalId &&
          ancestors.has(g.parentGoalId)) ||
          (ancestors.has(g.id) &&
            (ancestors.has(g.parentGoalId) ||
              g.parentGoalId === selectedGoalId)) ||
          (children.has(g.id) &&
            g.parentGoalId === selectedGoalId));

      edges.push({
        id: `e-${g.parentGoalId}-${g.id}`,
        source: g.parentGoalId,
        target: g.id,
        type: "smoothstep",
        animated: onPath,
        style: {
          stroke: onPath
            ? "#d9993a"
            : "rgba(216, 166, 95, 0.15)",
          strokeWidth: onPath ? 2 : 1,
        },
      });
    }
  }

  // ── Ghost "add child" node ──
  if (selected) {
    const selLane = selected.horizonId
      ? (hLane.get(selected.horizonId) ?? noHLane)
      : noHLane;

    // Find next lower lane that has goals (or just below selected)
    const childLane = activeLanes.find((l) => l > selLane);
    let ghostX: number;
    let ghostY: number;

    if (childLane !== undefined && laneY.has(childLane)) {
      const childGoals = byLane.get(childLane) ?? [];
      ghostX = CONTENT_X + childGoals.length * (NODE_W + X_GAP);
      ghostY = laneY.get(childLane)! + 12;
    } else {
      ghostX = CONTENT_X;
      ghostY = (laneY.get(selLane) ?? 0) + LANE_GAP;
    }

    nodes.push({
      id: "ghost",
      type: "ghostNode",
      position: { x: ghostX, y: ghostY },
      data: { onAdd: onAddChild } satisfies GhostData,
      selectable: false,
      draggable: false,
    });

    edges.push({
      id: "e-ghost",
      source: selectedGoalId!,
      target: "ghost",
      type: "smoothstep",
      style: {
        stroke: "rgba(217, 153, 58, 0.25)",
        strokeWidth: 1,
        strokeDasharray: "6 4",
      },
    });

    focusIds.push("ghost");
  }

  // ── Planning lanes (only when a goal is selected) ──
  if (selectedGoalId) {
    // Month Focus lane
    nodes.push({
      id: "ll-month",
      type: "laneLabel",
      position: { x: 0, y: monthY + 14 },
      data: { label: "Month Focus", type: "planning" } satisfies LaneLabelData,
      selectable: false,
      draggable: false,
    });

    if (monthPlan) {
      for (let s = 1; s <= 3; s++) {
        const item = monthPlan.topOutcomes?.find(
          (o) => o.slot === s,
        );
        const x = CONTENT_X + (s - 1) * (NODE_W + X_GAP);
        const isLinked = item?.goalId === selectedGoalId;

        nodes.push({
          id: `m-${s}`,
          type: "planningSlot",
          position: { x, y: monthY },
          data: {
            slotNumber: s,
            title: item?.title ?? "",
            type: "month",
            isEmpty: !item?.title,
            isLinked,
          } satisfies PlanSlotData,
          selectable: false,
          draggable: false,
        });

        if (isLinked) {
          edges.push({
            id: `e-m-${s}`,
            source: selectedGoalId,
            target: `m-${s}`,
            type: "smoothstep",
            style: {
              stroke: "#d9993a",
              strokeWidth: 1.5,
              strokeDasharray: "4 3",
            },
          });
          focusIds.push(`m-${s}`);
        }
      }
    }

    // Week Priorities lane
    nodes.push({
      id: "ll-week",
      type: "laneLabel",
      position: { x: 0, y: weekY + 14 },
      data: {
        label: "Week Priorities",
        type: "planning",
      } satisfies LaneLabelData,
      selectable: false,
      draggable: false,
    });

    if (weekPlan) {
      for (let s = 1; s <= 3; s++) {
        const item = weekPlan.priorities?.find(
          (p) => p.slot === s,
        );
        const x = CONTENT_X + (s - 1) * (NODE_W + X_GAP);
        const isLinked = item?.goalId === selectedGoalId;

        nodes.push({
          id: `w-${s}`,
          type: "planningSlot",
          position: { x, y: weekY },
          data: {
            slotNumber: s,
            title: item?.title ?? "",
            type: "week",
            isEmpty: !item?.title,
            isLinked,
          } satisfies PlanSlotData,
          selectable: false,
          draggable: false,
        });

        if (isLinked) {
          edges.push({
            id: `e-w-${s}`,
            source: selectedGoalId,
            target: `w-${s}`,
            type: "smoothstep",
            style: {
              stroke: "#d9993a",
              strokeWidth: 1.5,
              strokeDasharray: "4 3",
            },
          });
          focusIds.push(`w-${s}`);
        }
      }
    }
  }

  return { nodes, edges, focusIds };
}

/* ── Graph Inner (uses React Flow hooks) ── */

function GraphInner(props: GoalsPlanGraphViewProps) {
  const {
    goals,
    horizons,
    selectedGoalId,
    weekPlan,
    monthPlan,
    onSelectGoal,
    onAddChild,
    isExpanded,
  } = props;

  const { fitView } = useReactFlow();
  const prevSelRef = useRef(selectedGoalId);

  // Stable callbacks via refs
  const onSelectRef = useRef(onSelectGoal);
  onSelectRef.current = onSelectGoal;
  const stableSelect = useCallback(
    (id: string) => onSelectRef.current(id),
    [],
  );

  const onAddRef = useRef(onAddChild);
  onAddRef.current = onAddChild;
  const stableAdd = useCallback(() => onAddRef.current(), []);

  const { nodes, edges, focusIds } = useMemo(
    () =>
      buildLayout(
        goals,
        horizons,
        selectedGoalId,
        weekPlan,
        monthPlan,
        stableSelect,
        stableAdd,
      ),
    [goals, horizons, selectedGoalId, weekPlan, monthPlan, stableSelect, stableAdd],
  );

  // Animate viewport on selection change
  useEffect(() => {
    if (prevSelRef.current !== selectedGoalId) {
      prevSelRef.current = selectedGoalId;
      const timer = setTimeout(() => {
        if (focusIds.length > 0) {
          fitView({
            nodes: focusIds.map((id) => ({ id })),
            padding: 0.3,
            duration: 400,
          });
        } else {
          fitView({ padding: 0.2, duration: 400 });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [selectedGoalId, focusIds, fitView]);

  // Initial fit
  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.2, duration: 0 }), 100);
    return () => clearTimeout(t);
  }, [fitView]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (focusIds.length > 0) {
        fitView({
          nodes: focusIds.map((id) => ({ id })),
          padding: isExpanded ? 0.18 : 0.28,
          duration: 300,
        });
        return;
      }

      fitView({
        padding: isExpanded ? 0.12 : 0.2,
        duration: 300,
      });
    }, 80);

    return () => clearTimeout(timer);
  }, [focusIds, fitView, isExpanded]);

  // Click empty canvas to deselect
  const onPaneClick = useCallback(() => {
    if (selectedGoalId) stableSelect(selectedGoalId);
  }, [selectedGoalId, stableSelect]);

  const onNodeClick = useCallback<NodeMouseHandler<Node>>(
    (_event, node) => {
      if (node.type === "goalNode") {
        stableSelect(node.id);
        return;
      }

      if (node.type === "ghostNode") {
        stableAdd();
      }
    },
    [stableAdd, stableSelect],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      panOnScroll
      zoomOnScroll={false}
      nodesConnectable={false}
      nodesDraggable={false}
      minZoom={0.3}
      maxZoom={1.5}
      proOptions={{ hideAttribution: true }}
    >
      <Background color="rgba(216, 166, 95, 0.03)" gap={40} size={1} />
    </ReactFlow>
  );
}

/* ── Exported Component ── */

export type GoalsPlanGraphViewProps = {
  goals: GoalOverviewItem[];
  domains: GoalDomainItem[];
  horizons: GoalHorizonItem[];
  weekPlan: WeekPlanResponse | null;
  monthPlan: MonthPlanResponse | null;
  selectedGoalId: string | null;
  onSelectGoal: (goalId: string) => void;
  onAddChild: () => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
};

export function GoalsPlanGraphView(props: GoalsPlanGraphViewProps) {
  const hasGoals = props.goals.some((g) => g.status === "active");
  const hasHorizons = props.horizons.some((h) => !h.isArchived);

  if (!hasGoals) {
    return (
      <div className="ghq-graph-empty">
        <div className="ghq-graph-empty__content">
          <span className="ghq-graph-empty__icon">◎</span>
          <h3>No active goals yet</h3>
          <p>
            Create your first goal to see your planning map come to life.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`ghq-graph${props.isExpanded ? " ghq-graph--expanded" : ""}`}>
      <div className="ghq-graph__toolbar">
        <button
          className="button button--ghost button--small ghq-graph__expand-btn"
          type="button"
          onClick={props.onToggleExpanded}
          aria-label={props.isExpanded ? "Exit expanded graph view" : "Expand graph view"}
          aria-pressed={props.isExpanded}
        >
          {props.isExpanded ? "Collapse canvas" : "Expand canvas"}
        </button>
      </div>

      <ReactFlowProvider>
        <GraphInner {...props} />
      </ReactFlowProvider>

      {!props.selectedGoalId && (
        <div className="ghq-graph__hint">
          <p>Select a goal to see its planning context</p>
        </div>
      )}

      {!hasHorizons && (
        <div className="ghq-graph__hint ghq-graph__hint--bottom">
          <p>
            Add planning layers in Settings to organize goals by horizon.
          </p>
        </div>
      )}
    </div>
  );
}
