import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Edge, Node, NodeMouseHandler, NodeProps } from "@xyflow/react";

import type {
  GoalDomainItem,
  GoalHorizonItem,
  GoalOverviewItem,
  GoalsWorkspaceTodayAlignment,
  MonthPlanResponse,
  WeekPlanResponse,
} from "../../shared/lib/api";
import {
  getLaneDuplicateCount,
  getLaneLabel,
  getPlanningItemAtSlot,
  type PlanningDraft,
  type PlanningLane,
  type PlanningReplaceState,
  type PlanningSelection,
  type PlanningSlot,
} from "./GoalsPlanTypes";

const LANE_GAP = 150;
const PLANNING_LANE_GAP = 120;
const NODE_W = 244;
const X_GAP = 28;
const CONTENT_X = 160;
const GOAL_DRAG_MIME = "application/x-life-os-goal-id";

const domainEmojis: Record<string, string> = {
  health: "♥",
  money: "💼",
  work_growth: "🧠",
  home_admin: "🏡",
  discipline: "🎯",
};

const planningSlots: PlanningSlot[] = [1, 2, 3];

function domainEmoji(key: string | null): string {
  if (!key) return "✦";
  return domainEmojis[key] ?? "✦";
}

function getLanePrefix(lane: PlanningLane) {
  if (lane === "month") return "M";
  if (lane === "week") return "W";
  return "T";
}

function findFirstOpenSlot(occupiedSlots: PlanningSlot[]) {
  return planningSlots.find((slot) => !occupiedSlots.includes(slot)) ?? null;
}

type GoalNodeData = {
  goal: GoalOverviewItem;
  isSelected: boolean;
  isDimmed: boolean;
  onSelect: (id: string) => void;
};

type PlanSlotData = {
  lane: PlanningLane;
  slotNumber: PlanningSlot;
  title: string;
  isEmpty: boolean;
  isLinked: boolean;
  isSelected: boolean;
  duplicateCount: number;
  draft: PlanningDraft | null;
  replaceState: PlanningReplaceState | null;
  replaceOpenSlot: PlanningSlot | null;
  replaceGoalTitle: string | null;
  activeGoals: Array<{ id: string; title: string }>;
  onSelectSlot: (lane: PlanningLane, slot: PlanningSlot) => void;
  onDropGoal: (lane: PlanningLane, slot: PlanningSlot, goalId: string) => void;
  onDraftChange: (updates: Partial<PlanningDraft>) => void;
  onDraftSave: () => void;
  onDraftCancel: () => void;
  onReplaceAction: (action: "replace" | "move") => void;
  onReplaceCancel: () => void;
};

type GhostData = {
  onAdd: () => void;
};

type LaneLabelData = {
  label: string;
  type: "horizon" | "planning";
};

const GoalGraphNode = memo(function GoalGraphNode({ data }: NodeProps) {
  const d = data as unknown as GoalNodeData;
  const { goal, isSelected, isDimmed, onSelect } = d;
  const health = goal.health ?? "on_track";

  return (
    <div
      className={`graph-goal-node nopan${isSelected ? " graph-goal-node--selected" : ""}${isDimmed ? " graph-goal-node--dimmed" : ""}`}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(GOAL_DRAG_MIME, goal.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(goal.id);
      }}
      title="Click to inspect. Drag into Month, Week, or Today slots to plan."
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
        {goal.horizonName ? (
          <span className="graph-goal-node__badge">{goal.horizonName}</span>
        ) : null}
        <span className="graph-goal-node__badge graph-goal-node__badge--drag">Drag to plan</span>
      </div>
      {goal.progressPercent > 0 ? (
        <div className="graph-goal-node__bar">
          <div
            className={`graph-goal-node__bar-fill graph-goal-node__bar-fill--${health}`}
            style={{ width: `${Math.min(goal.progressPercent, 100)}%` }}
          />
        </div>
      ) : null}
      <Handle type="source" position={Position.Bottom} className="graph-handle--hidden" />
    </div>
  );
});

const PlanningSlotNode = memo(function PlanningSlotNode({ data }: NodeProps) {
  const d = data as unknown as PlanSlotData;
  const [isDragOver, setIsDragOver] = useState(false);
  const prefix = getLanePrefix(d.lane);

  if (d.replaceState) {
    return (
      <div className="graph-slot graph-slot--replace nopan">
        <Handle type="target" position={Position.Top} className="graph-handle--hidden" />
        <span className="graph-slot__badge">
          {prefix}
          {d.slotNumber}
        </span>
        <div className="graph-slot__replace">
          <strong>Slot already filled</strong>
          <p>Replace it with “{d.replaceGoalTitle ?? "Selected goal"}”?</p>
          <div className="graph-slot__actions">
            <button className="button button--primary button--small" type="button" onClick={() => d.onReplaceAction("replace")}>
              Replace here
            </button>
            {d.replaceOpenSlot ? (
              <button className="button button--ghost button--small" type="button" onClick={() => d.onReplaceAction("move")}>
                Move current to {prefix}
                {d.replaceOpenSlot}
              </button>
            ) : null}
            <button className="button button--ghost button--small" type="button" onClick={d.onReplaceCancel}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (d.draft) {
    return (
      <div className="graph-slot graph-slot--draft nopan">
        <Handle type="target" position={Position.Top} className="graph-handle--hidden" />
        <span className="graph-slot__badge">
          {prefix}
          {d.slotNumber}
        </span>
        <div className="graph-slot__draft">
          <input
            className="graph-slot__input"
            type="text"
            value={d.draft.title}
            placeholder="Planning item title"
            onChange={(event) => d.onDraftChange({ title: event.target.value })}
          />
          <select
            className="graph-slot__select"
            value={d.draft.goalId}
            onChange={(event) => d.onDraftChange({ goalId: event.target.value })}
          >
            {d.activeGoals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title}
              </option>
            ))}
          </select>
          {d.duplicateCount > 0 ? (
            <p className="graph-slot__warning">
              This goal already appears elsewhere in this lane.
            </p>
          ) : null}
          <div className="graph-slot__actions">
            <button className="button button--primary button--small" type="button" onClick={d.onDraftSave} disabled={!d.draft.title.trim()}>
              Save
            </button>
            <button className="button button--ghost button--small" type="button" onClick={d.onDraftCancel}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`graph-slot nopan${d.isEmpty ? " graph-slot--empty" : ""}${d.isLinked ? " graph-slot--linked" : ""}${d.isSelected ? " graph-slot--selected" : ""}${isDragOver ? " graph-slot--drag-over" : ""}${d.duplicateCount > 0 ? " graph-slot--warning" : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        d.onSelectSlot(d.lane, d.slotNumber);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragOver(false);
        const goalId = event.dataTransfer.getData(GOAL_DRAG_MIME);
        if (goalId) {
          d.onDropGoal(d.lane, d.slotNumber, goalId);
        }
      }}
    >
      <Handle type="target" position={Position.Top} className="graph-handle--hidden" />
      <span className="graph-slot__badge">
        {prefix}
        {d.slotNumber}
      </span>
      <div className="graph-slot__body">
        <span className="graph-slot__title">{d.isEmpty ? "Click or drop a goal here" : d.title}</span>
        {d.duplicateCount > 0 ? (
          <span className="graph-slot__meta">Duplicate goal link</span>
        ) : d.isEmpty ? (
          <span className="graph-slot__meta">Directly plan from the canvas</span>
        ) : null}
      </div>
    </div>
  );
});

const GhostAddNode = memo(function GhostAddNode({ data }: NodeProps) {
  const d = data as unknown as GhostData;

  return (
    <div
      className="graph-ghost nopan"
      onClick={(event) => {
        event.stopPropagation();
        d.onAdd();
      }}
    >
      <Handle type="target" position={Position.Top} className="graph-handle--hidden" />
      <span className="graph-ghost__plus">+</span>
      <span className="graph-ghost__label">Add supporting goal</span>
    </div>
  );
});

const LaneLabelNode = memo(function LaneLabelNode({ data }: NodeProps) {
  const d = data as unknown as LaneLabelData;

  return (
    <div className={`graph-lane-label graph-lane-label--${d.type}`}>{d.label}</div>
  );
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: Record<string, any> = {
  goalNode: GoalGraphNode,
  planningSlot: PlanningSlotNode,
  ghostNode: GhostAddNode,
  laneLabel: LaneLabelNode,
};

function buildLayout(props: {
  goals: GoalOverviewItem[];
  horizons: GoalHorizonItem[];
  selectedGoalId: string | null;
  selectedPlanningSelection: PlanningSelection | null;
  planningDraft: PlanningDraft | null;
  planningReplaceState: PlanningReplaceState | null;
  weekPlan: WeekPlanResponse | null;
  monthPlan: MonthPlanResponse | null;
  todayAlignment: GoalsWorkspaceTodayAlignment;
  showTodayLane: boolean;
  onSelectGoal: (id: string) => void;
  onSelectPlanningSlot: (lane: PlanningLane, slot: PlanningSlot) => void;
  onDropGoalOnSlot: (lane: PlanningLane, slot: PlanningSlot, goalId: string) => void;
  onPlanningDraftChange: (updates: Partial<PlanningDraft>) => void;
  onSavePlanningDraft: () => void;
  onCancelPlanningDraft: () => void;
  onPlanningReplaceAction: (action: "replace" | "move") => void;
  onCancelPlanningReplace: () => void;
  onAddChild: () => void;
}): { nodes: Node[]; edges: Edge[]; focusIds: string[] } {
  const {
    goals,
    horizons,
    selectedGoalId,
    selectedPlanningSelection,
    planningDraft,
    planningReplaceState,
    weekPlan,
    monthPlan,
    todayAlignment,
    showTodayLane,
    onSelectGoal,
    onSelectPlanningSlot,
    onDropGoalOnSlot,
    onPlanningDraftChange,
    onSavePlanningDraft,
    onCancelPlanningDraft,
    onPlanningReplaceAction,
    onCancelPlanningReplace,
    onAddChild,
  } = props;

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const focusIds: string[] = [];

  const activeHorizons = horizons.filter((horizon) => !horizon.isArchived);
  const activeGoals = goals.filter((goal) => goal.status === "active");
  const activeGoalOptions = activeGoals.map((goal) => ({ id: goal.id, title: goal.title }));

  const horizonLane = new Map<string, number>();
  activeHorizons.forEach((horizon, index) => horizonLane.set(horizon.id, index));
  const horizonCount = activeHorizons.length;
  const unassignedLane = horizonCount;

  const selectedGoal = selectedGoalId
    ? activeGoals.find((goal) => goal.id === selectedGoalId) ?? null
    : null;
  const ancestors = new Set<string>();
  const children = new Set<string>();
  const siblings = new Set<string>();

  if (selectedGoal) {
    let currentParentId: string | null | undefined = selectedGoal.parentGoalId;
    while (currentParentId) {
      ancestors.add(currentParentId);
      const parentGoal = activeGoals.find((goal) => goal.id === currentParentId);
      currentParentId = parentGoal?.parentGoalId;
    }

    for (const goal of activeGoals) {
      if (goal.parentGoalId === selectedGoalId) {
        children.add(goal.id);
      }
    }

    if (selectedGoal.parentGoalId) {
      for (const goal of activeGoals) {
        if (goal.parentGoalId === selectedGoal.parentGoalId && goal.id !== selectedGoalId) {
          siblings.add(goal.id);
        }
      }
    }
  }

  const isFocused = (goalId: string) =>
    goalId === selectedGoalId || ancestors.has(goalId) || children.has(goalId) || siblings.has(goalId);

  const goalsByLane = new Map<number, GoalOverviewItem[]>();
  for (const goal of activeGoals) {
    const lane = goal.horizonId ? (horizonLane.get(goal.horizonId) ?? unassignedLane) : unassignedLane;
    if (!goalsByLane.has(lane)) {
      goalsByLane.set(lane, []);
    }
    goalsByLane.get(lane)!.push(goal);
  }

  const activeLanes = [...new Set([...goalsByLane.keys()])].sort((left, right) => left - right);
  const laneY = new Map<number, number>();
  let currentY = 0;
  for (const lane of activeLanes) {
    laneY.set(lane, currentY);
    currentY += LANE_GAP;
  }

  const planningStartY = currentY + 40;

  for (const lane of activeLanes) {
    const laneTop = laneY.get(lane)!;
    nodes.push({
      id: `lane-label-${lane}`,
      type: "laneLabel",
      position: { x: 0, y: laneTop + 20 },
      data: {
        label: lane < horizonCount ? activeHorizons[lane].name : "Unassigned",
        type: "horizon",
      } satisfies LaneLabelData,
      selectable: false,
      draggable: false,
    });
  }

  for (const [lane, laneGoals] of goalsByLane) {
    const laneTop = laneY.get(lane);
    if (laneTop === undefined) {
      continue;
    }

    const sortedGoals = [...laneGoals].sort((left, right) => {
      if (left.id === selectedGoalId) return -1;
      if (right.id === selectedGoalId) return 1;
      if (ancestors.has(left.id) && !ancestors.has(right.id)) return -1;
      if (!ancestors.has(left.id) && ancestors.has(right.id)) return 1;
      return left.sortOrder - right.sortOrder;
    });

    sortedGoals.forEach((goal, index) => {
      const isSelected = goal.id === selectedGoalId;
      if (isSelected || ancestors.has(goal.id) || children.has(goal.id)) {
        focusIds.push(goal.id);
      }

      nodes.push({
        id: goal.id,
        type: "goalNode",
        position: { x: CONTENT_X + index * (NODE_W + X_GAP), y: laneTop },
        data: {
          goal,
          isSelected,
          isDimmed: selectedGoalId !== null && !isFocused(goal.id),
          onSelect: onSelectGoal,
        } satisfies GoalNodeData,
        selectable: false,
        draggable: false,
      });
    });
  }

  const goalNodeIds = new Set(nodes.filter((node) => node.type === "goalNode").map((node) => node.id));
  for (const goal of activeGoals) {
    if (!goal.parentGoalId || !goalNodeIds.has(goal.parentGoalId) || !goalNodeIds.has(goal.id)) {
      continue;
    }

    const onPath =
      selectedGoalId !== null &&
      ((goal.id === selectedGoalId && ancestors.has(goal.parentGoalId)) ||
        (ancestors.has(goal.id) &&
          (ancestors.has(goal.parentGoalId) || goal.parentGoalId === selectedGoalId)) ||
        (children.has(goal.id) && goal.parentGoalId === selectedGoalId));

    edges.push({
      id: `edge-${goal.parentGoalId}-${goal.id}`,
      source: goal.parentGoalId,
      target: goal.id,
      type: "smoothstep",
      animated: onPath,
      style: {
        stroke: onPath ? "#d9993a" : "rgba(216, 166, 95, 0.15)",
        strokeWidth: onPath ? 2 : 1,
      },
    });
  }

  if (selectedGoal) {
    const selectedLane = selectedGoal.horizonId ? (horizonLane.get(selectedGoal.horizonId) ?? unassignedLane) : unassignedLane;
    const childLane = activeLanes.find((lane) => lane > selectedLane);
    const ghostX =
      childLane !== undefined
        ? CONTENT_X + ((goalsByLane.get(childLane) ?? []).length * (NODE_W + X_GAP))
        : CONTENT_X;
    const ghostY =
      childLane !== undefined && laneY.has(childLane)
        ? laneY.get(childLane)! + 12
        : (laneY.get(selectedLane) ?? 0) + LANE_GAP;

    nodes.push({
      id: "ghost-add-child",
      type: "ghostNode",
      position: { x: ghostX, y: ghostY },
      data: { onAdd: onAddChild } satisfies GhostData,
      selectable: false,
      draggable: false,
    });

    edges.push({
      id: "edge-ghost-add-child",
      source: selectedGoal.id,
      target: "ghost-add-child",
      type: "smoothstep",
      style: {
        stroke: "rgba(217, 153, 58, 0.25)",
        strokeWidth: 1,
        strokeDasharray: "6 4",
      },
    });

    focusIds.push("ghost-add-child");
  }

  if (selectedGoalId) {
    const planningLanes: Array<{ lane: PlanningLane; items: Array<{ id: string; slot: PlanningSlot; title: string; goalId: string | null }> }> = [
      {
        lane: "month",
        items: [...(monthPlan?.topOutcomes ?? [])].sort((left, right) => left.slot - right.slot),
      },
      {
        lane: "week",
        items: [...(weekPlan?.priorities ?? [])].sort((left, right) => left.slot - right.slot),
      },
    ];

    if (showTodayLane) {
      planningLanes.push({
        lane: "today",
        items: [...todayAlignment.priorities].sort((left, right) => left.slot - right.slot),
      });
    }

    planningLanes.forEach(({ lane, items }, index) => {
      const laneYPosition = planningStartY + index * PLANNING_LANE_GAP;

      nodes.push({
        id: `lane-label-${lane}`,
        type: "laneLabel",
        position: { x: 0, y: laneYPosition + 14 },
        data: { label: getLaneLabel(lane), type: "planning" } satisfies LaneLabelData,
        selectable: false,
        draggable: false,
      });

      planningSlots.forEach((slot, slotIndex) => {
        const item = getPlanningItemAtSlot(lane, slot, weekPlan, monthPlan, todayAlignment);
        const draft = planningDraft?.lane === lane && planningDraft.slot === slot ? planningDraft : null;
        const replaceState =
          planningReplaceState?.lane === lane && planningReplaceState.slot === slot ? planningReplaceState : null;
        const replaceGoal = replaceState
          ? activeGoals.find((goal) => goal.id === replaceState.goalId) ?? null
          : null;
        const duplicateCount = item?.goalId
          ? getLaneDuplicateCount(lane, item.goalId, weekPlan, monthPlan, todayAlignment, slot)
          : draft?.goalId
            ? getLaneDuplicateCount(lane, draft.goalId, weekPlan, monthPlan, todayAlignment, slot)
            : 0;

        nodes.push({
          id: `${lane}-${slot}`,
          type: "planningSlot",
          position: { x: CONTENT_X + slotIndex * (NODE_W + X_GAP), y: laneYPosition },
          data: {
            lane,
            slotNumber: slot,
            title: item?.title ?? "",
            isEmpty: !item?.title,
            isLinked: item?.goalId === selectedGoalId,
            isSelected: selectedPlanningSelection?.lane === lane && selectedPlanningSelection.slot === slot,
            duplicateCount,
            draft,
            replaceState,
            replaceOpenSlot: replaceState ? findFirstOpenSlot(items.map((planningItem) => planningItem.slot)) : null,
            replaceGoalTitle: replaceGoal?.title ?? null,
            activeGoals: activeGoalOptions,
            onSelectSlot: onSelectPlanningSlot,
            onDropGoal: onDropGoalOnSlot,
            onDraftChange: onPlanningDraftChange,
            onDraftSave: onSavePlanningDraft,
            onDraftCancel: onCancelPlanningDraft,
            onReplaceAction: onPlanningReplaceAction,
            onReplaceCancel: onCancelPlanningReplace,
          } satisfies PlanSlotData,
          selectable: false,
          draggable: false,
        });

        if (item?.goalId === selectedGoalId) {
          edges.push({
            id: `edge-${lane}-${slot}`,
            source: selectedGoalId,
            target: `${lane}-${slot}`,
            type: "smoothstep",
            style: {
              stroke: "#d9993a",
              strokeWidth: 1.5,
              strokeDasharray: "4 3",
            },
          });
          focusIds.push(`${lane}-${slot}`);
        }

        if (draft || replaceState || (selectedPlanningSelection?.lane === lane && selectedPlanningSelection.slot === slot)) {
          focusIds.push(`${lane}-${slot}`);
        }
      });
    });
  }

  return { nodes, edges, focusIds };
}

function GraphInner(props: GoalsPlanGraphViewProps) {
  const {
    goals,
    horizons,
    selectedGoalId,
    selectedPlanningSelection,
    planningDraft,
    planningReplaceState,
    weekPlan,
    monthPlan,
    todayAlignment,
    showTodayLane,
    onSelectGoal,
    onSelectPlanningSlot,
    onDropGoalOnSlot,
    onPlanningDraftChange,
    onSavePlanningDraft,
    onCancelPlanningDraft,
    onPlanningReplaceAction,
    onCancelPlanningReplace,
    onClearActiveSelection,
    onAddChild,
    isExpanded,
  } = props;

  const { fitView } = useReactFlow();
  const prevSelectionRef = useRef(`${selectedGoalId ?? "none"}:${selectedPlanningSelection?.lane ?? "none"}:${selectedPlanningSelection?.slot ?? "0"}`);

  const onSelectGoalRef = useRef(onSelectGoal);
  onSelectGoalRef.current = onSelectGoal;
  const stableSelectGoal = useCallback((goalId: string) => onSelectGoalRef.current(goalId), []);

  const onAddChildRef = useRef(onAddChild);
  onAddChildRef.current = onAddChild;
  const stableAddChild = useCallback(() => onAddChildRef.current(), []);

  const { nodes, edges, focusIds } = useMemo(
    () =>
      buildLayout({
        goals,
        horizons,
        selectedGoalId,
        selectedPlanningSelection,
        planningDraft,
        planningReplaceState,
        weekPlan,
        monthPlan,
        todayAlignment,
        showTodayLane,
        onSelectGoal: stableSelectGoal,
        onSelectPlanningSlot,
        onDropGoalOnSlot,
        onPlanningDraftChange,
        onSavePlanningDraft,
        onCancelPlanningDraft,
        onPlanningReplaceAction,
        onCancelPlanningReplace,
        onAddChild: stableAddChild,
      }),
    [
      goals,
      horizons,
      selectedGoalId,
      selectedPlanningSelection,
      planningDraft,
      planningReplaceState,
      weekPlan,
      monthPlan,
      todayAlignment,
      showTodayLane,
      stableSelectGoal,
      onSelectPlanningSlot,
      onDropGoalOnSlot,
      onPlanningDraftChange,
      onSavePlanningDraft,
      onCancelPlanningDraft,
      onPlanningReplaceAction,
      onCancelPlanningReplace,
      stableAddChild,
    ],
  );

  useEffect(() => {
    const currentSelectionKey = `${selectedGoalId ?? "none"}:${selectedPlanningSelection?.lane ?? "none"}:${selectedPlanningSelection?.slot ?? "0"}`;
    if (prevSelectionRef.current !== currentSelectionKey) {
      prevSelectionRef.current = currentSelectionKey;
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
    return undefined;
  }, [fitView, focusIds, selectedGoalId, selectedPlanningSelection]);

  useEffect(() => {
    const timer = setTimeout(() => fitView({ padding: 0.2, duration: 0 }), 100);
    return () => clearTimeout(timer);
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
  }, [fitView, focusIds, isExpanded]);

  const onNodeClick = useCallback<NodeMouseHandler<Node>>(
    (_event, node) => {
      if (node.type === "goalNode") {
        stableSelectGoal(node.id);
        return;
      }

      if (node.type === "ghostNode") {
        stableAddChild();
      }
    },
    [stableAddChild, stableSelectGoal],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      onPaneClick={onClearActiveSelection}
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

export type GoalsPlanGraphViewProps = {
  goals: GoalOverviewItem[];
  domains: GoalDomainItem[];
  horizons: GoalHorizonItem[];
  weekPlan: WeekPlanResponse | null;
  monthPlan: MonthPlanResponse | null;
  todayAlignment: GoalsWorkspaceTodayAlignment;
  selectedGoalId: string | null;
  selectedPlanningSelection: PlanningSelection | null;
  planningDraft: PlanningDraft | null;
  planningReplaceState: PlanningReplaceState | null;
  showTodayLane: boolean;
  onSelectGoal: (goalId: string) => void;
  onSelectPlanningSlot: (lane: PlanningLane, slot: PlanningSlot) => void;
  onDropGoalOnSlot: (lane: PlanningLane, slot: PlanningSlot, goalId: string) => void;
  onPlanningDraftChange: (updates: Partial<PlanningDraft>) => void;
  onSavePlanningDraft: () => void;
  onCancelPlanningDraft: () => void;
  onPlanningReplaceAction: (action: "replace" | "move") => void;
  onCancelPlanningReplace: () => void;
  onClearActiveSelection: () => void;
  onAddChild: () => void;
  isExpanded: boolean;
  isInspectorVisible: boolean;
  onShowInspector: () => void;
  onHideInspector: () => void;
  onClearGoalFocus: () => void;
  onToggleTodayLane: () => void;
  onToggleExpanded: () => void;
};

export function GoalsPlanGraphView(props: GoalsPlanGraphViewProps) {
  const hasGoals = props.goals.some((goal) => goal.status === "active");
  const hasHorizons = props.horizons.some((horizon) => !horizon.isArchived);

  if (!hasGoals) {
    return (
      <div className="ghq-graph-empty">
        <div className="ghq-graph-empty__content">
          <span className="ghq-graph-empty__icon">◎</span>
          <h3>No active goals yet</h3>
          <p>Create your first goal to see your planning map come to life.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`ghq-graph${props.isExpanded ? " ghq-graph--expanded" : ""}`}>
      <div className="ghq-graph__toolbar">
        {props.selectedGoalId ? (
          <button
            className="button button--ghost button--small ghq-graph__toolbar-btn"
            type="button"
            onClick={props.isInspectorVisible ? props.onHideInspector : props.onShowInspector}
            aria-pressed={props.isInspectorVisible}
          >
            {props.isInspectorVisible ? "Hide details" : "Show details"}
          </button>
        ) : null}
        {props.selectedGoalId ? (
          <button
            className="button button--ghost button--small ghq-graph__toolbar-btn"
            type="button"
            onClick={props.onToggleTodayLane}
            aria-pressed={props.showTodayLane}
          >
            {props.showTodayLane ? "Hide Today" : "Show Today"}
          </button>
        ) : null}
        {props.selectedGoalId ? (
          <button
            className="button button--ghost button--small ghq-graph__toolbar-btn"
            type="button"
            onClick={props.onClearGoalFocus}
          >
            Clear focus
          </button>
        ) : null}
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

      {!props.selectedGoalId ? (
        <div className="ghq-graph__hint">
          <p>Select a goal to open Month, Week, and Today planning directly in the canvas.</p>
        </div>
      ) : null}

      {!hasHorizons ? (
        <div className="ghq-graph__hint ghq-graph__hint--bottom">
          <p>Add planning layers in Settings to organize goals by horizon.</p>
        </div>
      ) : null}
    </div>
  );
}
