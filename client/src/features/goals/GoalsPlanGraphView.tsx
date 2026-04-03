import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useNodesInitialized,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Edge, Node, NodeMouseHandler, NodeProps, Viewport } from "@xyflow/react";

import type {
  GoalHorizonItem,
  GoalOverviewItem,
} from "../../shared/lib/api";
import type {
  PlanningDraft,
  PlanningLane,
  PlanningReplaceState,
  PlanningSelection,
  PlanningSlot,
} from "./GoalsPlanTypes";
import { planningSlots } from "./GoalsPlanTypes";

const NODE_W = 244;
const CONTENT_X = 80;
const CONTENT_Y = 72;
const LEVEL_GAP = 168;
const SIBLING_GAP = 36;
const ROOT_GAP = 64;
const SELECTED_PLANNER_CLEARANCE = 138;
const GOAL_DRAG_MIME = "application/x-life-os-goal-id";

const domainEmojis: Record<string, string> = {
  health: "♥",
  money: "💼",
  work_growth: "🧠",
  home_admin: "🏡",
  discipline: "🎯",
};

const domainEmoji = (key: string | null) => {
  if (!key) return "✦";
  return domainEmojis[key] ?? "✦";
};

const getLaneLabel = (lane: PlanningLane) => {
  if (lane === "month") return "Month";
  if (lane === "week") return "Week";
  return "Today";
};

const getLanePrefix = (lane: PlanningLane) => {
  if (lane === "month") return "M";
  if (lane === "week") return "W";
  return "T";
};

type PlannerItem = {
  id: string;
  slot: PlanningSlot;
  title: string;
  goalId: string | null;
};

type PlannerLaneData = {
  lane: PlanningLane;
  items: PlannerItem[];
  selectedPlanningSelection: PlanningSelection | null;
  planningDraft: PlanningDraft | null;
  planningReplaceState: PlanningReplaceState | null;
  activeGoals: GoalOverviewItem[];
  onSelectSlot: (lane: PlanningLane, slot: PlanningSlot) => void;
  onDropGoalOnSlot: (lane: PlanningLane, slot: PlanningSlot, goalId: string) => void;
  onPlanningDraftChange: (updates: Partial<PlanningDraft>) => void;
  onSavePlanningDraft: () => void;
  onCancelPlanningDraft: () => void;
  onPlanningReplaceAction: (action: "replace" | "move") => void;
  onCancelPlanningReplace: () => void;
};

type GoalPlannerData = {
  showTodayLane: boolean;
  onToggleTodayLane: () => void;
  lanes: PlannerLaneData[];
};

type GoalNodeData = {
  goal: GoalOverviewItem;
  isSelected: boolean;
  isInBranch: boolean;
  isDimmed: boolean;
  canExpand: boolean;
  isExpanded: boolean;
  planner: GoalPlannerData | null;
  onSelect: (goalId: string) => void;
  onToggleExpanded: (goalId: string) => void;
  onOpenAddChild: (goalId: string) => void;
  onDropGoalOnGoal: (targetGoalId: string, draggedGoalId: string) => void;
};

type AddChildNodeData = {
  onOpen: () => void;
};

type ChildDraftNodeData = {
  title: string;
  isPending: boolean;
  onChange: (title: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

type ChildDraft = {
  parentGoalId: string;
  title: string;
  horizonId: string | null;
};

type LayoutProps = {
  goals: GoalOverviewItem[];
  horizons: GoalHorizonItem[];
  selectedGoalId: string | null;
  expandedGoalIds: Set<string>;
  isFocusMode: boolean;
  childDraft: ChildDraft | null;
  childDraftIsPending: boolean;
  monthItems: PlannerItem[];
  weekItems: PlannerItem[];
  todayItems: PlannerItem[];
  selectedPlanningSelection: PlanningSelection | null;
  planningDraft: PlanningDraft | null;
  planningReplaceState: PlanningReplaceState | null;
  showTodayLane: boolean;
  onSelectGoal: (goalId: string) => void;
  onToggleExpanded: (goalId: string) => void;
  onOpenAddChild: (goalId: string) => void;
  onDropGoalOnGoal: (targetGoalId: string, draggedGoalId: string) => void;
  onChildDraftChange: (title: string) => void;
  onSaveChildDraft: () => void;
  onCancelChildDraft: () => void;
  onSelectPlanningSlot: (lane: PlanningLane, slot: PlanningSlot) => void;
  onDropGoalOnSlot: (lane: PlanningLane, slot: PlanningSlot, goalId: string) => void;
  onPlanningDraftChange: (updates: Partial<PlanningDraft>) => void;
  onSavePlanningDraft: () => void;
  onCancelPlanningDraft: () => void;
  onPlanningReplaceAction: (action: "replace" | "move") => void;
  onCancelPlanningReplace: () => void;
  onToggleTodayLane: () => void;
};

type TreeChildItem =
  | { type: "goal"; goal: GoalOverviewItem }
  | { type: "add"; parentGoalId: string }
  | { type: "draft"; parentGoalId: string };

const sortGoals = (left: GoalOverviewItem, right: GoalOverviewItem) => {
  if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
  return left.createdAt.localeCompare(right.createdAt);
};

const PlannerLane = memo(function PlannerLane({ data }: { data: PlannerLaneData }) {
  const [dragOverSlot, setDragOverSlot] = useState<PlanningSlot | null>(null);
  const draft = data.planningDraft?.lane === data.lane ? data.planningDraft : null;
  const replaceState = data.planningReplaceState?.lane === data.lane ? data.planningReplaceState : null;
  const openSlot =
    planningSlots.find((slot) => !data.items.some((item) => item.slot === slot)) ?? null;
  const replaceGoal = replaceState
    ? data.activeGoals.find((goal) => goal.id === replaceState.goalId) ?? null
    : null;

  return (
    <section
      className={`graph-planner__lane${draft ? " graph-planner__lane--draft" : ""}${replaceState ? " graph-planner__lane--replace" : ""}`}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="graph-planner__lane-header">
        <span className="graph-planner__lane-label">{getLaneLabel(data.lane)}</span>
        <span className="graph-planner__lane-count">{data.items.length}/3</span>
      </div>

      <div className="graph-planner__slot-row">
        {planningSlots.map((slot) => {
          const item = data.items.find((entry) => entry.slot === slot) ?? null;
          const isSelected =
            data.selectedPlanningSelection?.lane === data.lane &&
            data.selectedPlanningSelection.slot === slot;
          const isDraftSlot = draft?.slot === slot;
          const isReplaceSlot = replaceState?.slot === slot;

          return (
            <button
              key={`${data.lane}-${slot}`}
              className={`graph-planner__slot${item ? " graph-planner__slot--filled" : " graph-planner__slot--empty"}${isSelected ? " graph-planner__slot--selected" : ""}${dragOverSlot === slot ? " graph-planner__slot--drag-over" : ""}${isDraftSlot ? " graph-planner__slot--draft" : ""}${isReplaceSlot ? " graph-planner__slot--replace" : ""}`}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                data.onSelectSlot(data.lane, slot);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOverSlot(slot);
              }}
              onDragLeave={() => setDragOverSlot((current) => (current === slot ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                setDragOverSlot(null);
                const goalId = event.dataTransfer.getData(GOAL_DRAG_MIME);
                if (goalId) {
                  data.onDropGoalOnSlot(data.lane, slot, goalId);
                }
              }}
            >
              <span className="graph-planner__slot-badge">
                {getLanePrefix(data.lane)}
                {slot}
              </span>
              <span className="graph-planner__slot-text">
                {item ? item.title : "Empty"}
              </span>
            </button>
          );
        })}
      </div>

      {draft ? (
        <div className="graph-planner__editor">
          <input
            className="graph-planner__input"
            type="text"
            value={draft.title}
            placeholder={`${getLaneLabel(data.lane)} item`}
            onChange={(event) => data.onPlanningDraftChange({ title: event.target.value })}
          />
          <div className="graph-planner__editor-row">
            <select
              className="graph-planner__select"
              value={draft.goalId}
              onChange={(event) => data.onPlanningDraftChange({ goalId: event.target.value })}
            >
              {data.activeGoals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.title}
                </option>
              ))}
            </select>
            <div className="graph-planner__actions">
              <button
                className="button button--primary button--small"
                type="button"
                onClick={data.onSavePlanningDraft}
                disabled={!draft.title.trim()}
              >
                Save
              </button>
              <button
                className="button button--ghost button--small"
                type="button"
                onClick={data.onCancelPlanningDraft}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {replaceState ? (
        <div className="graph-planner__replace">
          <span className="graph-planner__replace-text">
            Replace with {replaceGoal?.title ?? "selected goal"}?
          </span>
          <div className="graph-planner__actions">
            <button
              className="button button--primary button--small"
              type="button"
              onClick={() => data.onPlanningReplaceAction("replace")}
            >
              Replace
            </button>
            {openSlot ? (
              <button
                className="button button--ghost button--small"
                type="button"
                onClick={() => data.onPlanningReplaceAction("move")}
              >
                Move current
              </button>
            ) : null}
            <button
              className="button button--ghost button--small"
              type="button"
              onClick={data.onCancelPlanningReplace}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
});

const GoalInlinePlanner = memo(function GoalInlinePlanner({ planner }: { planner: GoalPlannerData }) {
  return (
    <div className="graph-planner" onClick={(event) => event.stopPropagation()}>
      <div className="graph-planner__stem" aria-hidden="true" />
      <div className="graph-planner__header">
        <span className="graph-planner__eyebrow">Plan</span>
        <button
          className="graph-planner__toggle"
          type="button"
          onClick={planner.onToggleTodayLane}
        >
          {planner.showTodayLane ? "Hide Today" : "Show Today"}
        </button>
      </div>
      <div className="graph-planner__lanes">
        {planner.lanes.map((lane) => (
          <PlannerLane key={lane.lane} data={lane} />
        ))}
      </div>
    </div>
  );
});

const GoalGraphNode = memo(function GoalGraphNode({ data }: NodeProps) {
  const d = data as unknown as GoalNodeData;
  const [isDragOver, setIsDragOver] = useState(false);
  const health = d.goal.health ?? "on_track";

  return (
    <div
      className={`graph-goal-node nopan${d.isSelected ? " graph-goal-node--selected" : ""}${d.isInBranch ? " graph-goal-node--branch" : ""}${d.isDimmed ? " graph-goal-node--dimmed" : ""}${isDragOver ? " graph-goal-node--drop-target" : ""}`}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(GOAL_DRAG_MIME, d.goal.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragOver(false);
        const draggedGoalId = event.dataTransfer.getData(GOAL_DRAG_MIME);
        if (draggedGoalId) {
          d.onDropGoalOnGoal(d.goal.id, draggedGoalId);
        }
      }}
      onClick={(event) => {
        event.stopPropagation();
        d.onSelect(d.goal.id);
      }}
      title="Click to inspect. Drag onto another goal to make it a child."
    >
      <Handle type="target" position={Position.Top} className="graph-handle--hidden" />
      <div className="graph-goal-node__row">
        <span className={`graph-goal-node__dot graph-goal-node__dot--${health}`} />
        <span className="graph-goal-node__title">{d.goal.title}</span>
        {d.canExpand ? (
          <button
            className="graph-goal-node__expand"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              d.onToggleExpanded(d.goal.id);
            }}
            aria-label={d.isExpanded ? "Collapse branch" : "Expand branch"}
          >
            {d.isExpanded ? "−" : "+"}
          </button>
        ) : null}
      </div>
      <div className="graph-goal-node__meta">
        <span className="graph-goal-node__domain">
          {domainEmoji(d.goal.domainSystemKey)} {d.goal.domain}
        </span>
        {d.goal.horizonName ? (
          <span className="graph-goal-node__badge">{d.goal.horizonName}</span>
        ) : null}
        <span className="graph-goal-node__badge graph-goal-node__badge--drag">Drag to re-branch or plan</span>
      </div>
      {d.goal.progressPercent > 0 ? (
        <div className="graph-goal-node__bar">
          <div
            className={`graph-goal-node__bar-fill graph-goal-node__bar-fill--${health}`}
            style={{ width: `${Math.min(d.goal.progressPercent, 100)}%` }}
          />
        </div>
      ) : null}
      {isDragOver ? (
        <div className="graph-goal-node__drop-hint">Drop here to make this a child</div>
      ) : null}
      {d.planner ? <GoalInlinePlanner planner={d.planner} /> : null}
      <Handle type="source" position={Position.Bottom} className="graph-handle--hidden" />
    </div>
  );
});

const AddChildNode = memo(function AddChildNode({ data }: NodeProps) {
  const d = data as unknown as AddChildNodeData;

  return (
    <div className="graph-ghost nopan" onClick={d.onOpen}>
      <Handle type="target" position={Position.Top} className="graph-handle--hidden" />
      <span className="graph-ghost__plus">+</span>
      <span className="graph-ghost__label">Add supporting goal</span>
    </div>
  );
});

const ChildDraftNode = memo(function ChildDraftNode({ data }: NodeProps) {
  const d = data as unknown as ChildDraftNodeData;

  return (
    <div className="graph-child-draft nopan">
      <Handle type="target" position={Position.Top} className="graph-handle--hidden" />
      <input
        className="graph-child-draft__input"
        type="text"
        value={d.title}
        placeholder="Supporting goal title"
        onChange={(event) => d.onChange(event.target.value)}
      />
      <div className="graph-child-draft__actions">
        <button
          className="button button--primary button--small"
          type="button"
          onClick={d.onSave}
          disabled={d.isPending || !d.title.trim()}
        >
          {d.isPending ? "Saving..." : "Save"}
        </button>
        <button
          className="button button--ghost button--small"
          type="button"
          onClick={d.onCancel}
          disabled={d.isPending}
        >
          Cancel
        </button>
      </div>
    </div>
  );
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: Record<string, any> = {
  goalNode: GoalGraphNode,
  addChildNode: AddChildNode,
  childDraftNode: ChildDraftNode,
};

const buildVisibleTree = (goals: GoalOverviewItem[], expandedGoalIds: Set<string>) => {
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

  const visibleIds = new Set<string>();

  const markVisible = (goal: GoalOverviewItem) => {
    visibleIds.add(goal.id);
    if (!expandedGoalIds.has(goal.id)) {
      return;
    }

    for (const child of childrenByParent.get(goal.id) ?? []) {
      markVisible(child);
    }
  };

  roots.forEach(markVisible);

  return { goalMap, childrenByParent, roots, visibleIds };
};

const buildBranchIds = (
  selectedGoalId: string | null,
  goalMap: Map<string, GoalOverviewItem>,
  childrenByParent: Map<string, GoalOverviewItem[]>,
  visibleIds: Set<string>,
) => {
  const branchIds = new Set<string>();
  if (!selectedGoalId) {
    return branchIds;
  }

  let current = goalMap.get(selectedGoalId) ?? null;
  while (current) {
    if (visibleIds.has(current.id)) {
      branchIds.add(current.id);
    }
    current = current.parentGoalId ? goalMap.get(current.parentGoalId) ?? null : null;
  }

  const stack = [selectedGoalId];
  while (stack.length > 0) {
    const goalId = stack.pop()!;
    if (visibleIds.has(goalId)) {
      branchIds.add(goalId);
    }
    for (const child of childrenByParent.get(goalId) ?? []) {
      if (visibleIds.has(child.id)) {
        stack.push(child.id);
      }
    }
  }

  return branchIds;
};

const buildLayout = (props: LayoutProps) => {
  const activeGoals = props.goals.filter((goal) => goal.status === "active");
  const { goalMap, childrenByParent, roots, visibleIds } = buildVisibleTree(activeGoals, props.expandedGoalIds);
  const branchIds = buildBranchIds(props.selectedGoalId, goalMap, childrenByParent, visibleIds);
  const activeGoalOptions = activeGoals;

  const plannerForGoal = (goal: GoalOverviewItem): GoalPlannerData | null => {
    if (props.selectedGoalId !== goal.id) {
      return null;
    }

    const lanes: PlannerLaneData[] = [
      {
        lane: "month",
        items: props.monthItems,
        selectedPlanningSelection: props.selectedPlanningSelection,
        planningDraft: props.planningDraft,
        planningReplaceState: props.planningReplaceState,
        activeGoals: activeGoalOptions,
        onSelectSlot: props.onSelectPlanningSlot,
        onDropGoalOnSlot: props.onDropGoalOnSlot,
        onPlanningDraftChange: props.onPlanningDraftChange,
        onSavePlanningDraft: props.onSavePlanningDraft,
        onCancelPlanningDraft: props.onCancelPlanningDraft,
        onPlanningReplaceAction: props.onPlanningReplaceAction,
        onCancelPlanningReplace: props.onCancelPlanningReplace,
      },
      {
        lane: "week",
        items: props.weekItems,
        selectedPlanningSelection: props.selectedPlanningSelection,
        planningDraft: props.planningDraft,
        planningReplaceState: props.planningReplaceState,
        activeGoals: activeGoalOptions,
        onSelectSlot: props.onSelectPlanningSlot,
        onDropGoalOnSlot: props.onDropGoalOnSlot,
        onPlanningDraftChange: props.onPlanningDraftChange,
        onSavePlanningDraft: props.onSavePlanningDraft,
        onCancelPlanningDraft: props.onCancelPlanningDraft,
        onPlanningReplaceAction: props.onPlanningReplaceAction,
        onCancelPlanningReplace: props.onCancelPlanningReplace,
      },
    ];

    if (props.showTodayLane) {
      lanes.push({
        lane: "today",
        items: props.todayItems,
        selectedPlanningSelection: props.selectedPlanningSelection,
        planningDraft: props.planningDraft,
        planningReplaceState: props.planningReplaceState,
        activeGoals: activeGoalOptions,
        onSelectSlot: props.onSelectPlanningSlot,
        onDropGoalOnSlot: props.onDropGoalOnSlot,
        onPlanningDraftChange: props.onPlanningDraftChange,
        onSavePlanningDraft: props.onSavePlanningDraft,
        onCancelPlanningDraft: props.onCancelPlanningDraft,
        onPlanningReplaceAction: props.onPlanningReplaceAction,
        onCancelPlanningReplace: props.onCancelPlanningReplace,
      });
    }

    return {
      showTodayLane: props.showTodayLane,
      onToggleTodayLane: props.onToggleTodayLane,
      lanes,
    };
  };

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const childItemsForGoal = (goal: GoalOverviewItem): TreeChildItem[] => {
    const items: TreeChildItem[] = [];

    if (props.expandedGoalIds.has(goal.id)) {
      for (const child of childrenByParent.get(goal.id) ?? []) {
        if (visibleIds.has(child.id)) {
          items.push({ type: "goal", goal: child });
        }
      }
    }

    if (props.childDraft?.parentGoalId === goal.id) {
      items.push({ type: "draft", parentGoalId: goal.id });
    } else if (props.selectedGoalId === goal.id) {
      items.push({ type: "add", parentGoalId: goal.id });
    }

    return items;
  };

  const widthCache = new Map<string, number>();

  const measureItemWidth = (item: TreeChildItem): number => {
    if (item.type === "goal") {
      return measureGoalWidth(item.goal);
    }
    return NODE_W;
  };

  const measureGoalWidth = (goal: GoalOverviewItem): number => {
    const cached = widthCache.get(goal.id);
    if (cached !== undefined) {
      return cached;
    }

    const childItems = childItemsForGoal(goal);
    if (childItems.length === 0) {
      widthCache.set(goal.id, NODE_W);
      return NODE_W;
    }

    const childrenWidth = childItems.reduce((total, item, index) => {
      return total + measureItemWidth(item) + (index > 0 ? SIBLING_GAP : 0);
    }, 0);
    const width = Math.max(NODE_W, childrenWidth);
    widthCache.set(goal.id, width);
    return width;
  };

  const layoutGoal = (
    goal: GoalOverviewItem,
    leftX: number,
    depth: number,
    verticalOffset: number,
  ) => {
    const childItems = childItemsForGoal(goal);
    const goalWidth = measureGoalWidth(goal);
    const childrenWidth = childItems.reduce((total, item, index) => {
      return total + measureItemWidth(item) + (index > 0 ? SIBLING_GAP : 0);
    }, 0);
    const goalX = leftX + (goalWidth - NODE_W) / 2;
    const goalY = CONTENT_Y + depth * LEVEL_GAP + verticalOffset;
    const childVerticalOffset =
      verticalOffset +
      (props.selectedGoalId === goal.id ? SELECTED_PLANNER_CLEARANCE : 0);

    nodes.push({
      id: goal.id,
      type: "goalNode",
      position: { x: goalX, y: goalY },
      zIndex:
        props.selectedGoalId === goal.id
          ? 80
          : branchIds.has(goal.id)
            ? 20
            : 1,
      data: {
        goal,
        isSelected: props.selectedGoalId === goal.id,
        isInBranch: branchIds.has(goal.id),
        isDimmed: props.isFocusMode && props.selectedGoalId !== null && !branchIds.has(goal.id),
        canExpand: (childrenByParent.get(goal.id)?.length ?? 0) > 0,
        isExpanded: props.expandedGoalIds.has(goal.id),
        planner: plannerForGoal(goal),
        onSelect: props.onSelectGoal,
        onToggleExpanded: props.onToggleExpanded,
        onOpenAddChild: props.onOpenAddChild,
        onDropGoalOnGoal: props.onDropGoalOnGoal,
      } satisfies GoalNodeData,
      selectable: false,
      draggable: false,
    });

    if (childItems.length === 0) {
      return;
    }

    let currentLeft = leftX + (goalWidth - childrenWidth) / 2;

    for (const item of childItems) {
      const itemWidth = measureItemWidth(item);
      const itemNodeX = currentLeft + (itemWidth - NODE_W) / 2;
      const itemNodeY = CONTENT_Y + (depth + 1) * LEVEL_GAP + childVerticalOffset;

      if (item.type === "goal") {
        layoutGoal(item.goal, currentLeft, depth + 1, childVerticalOffset);
        edges.push({
          id: `edge-${goal.id}-${item.goal.id}`,
          source: goal.id,
          target: item.goal.id,
          type: "smoothstep",
          animated: props.selectedGoalId === goal.id || props.selectedGoalId === item.goal.id,
          style: {
            stroke:
              branchIds.has(goal.id) && branchIds.has(item.goal.id)
                ? "#d9993a"
                : "rgba(216, 166, 95, 0.16)",
            strokeWidth: branchIds.has(goal.id) && branchIds.has(item.goal.id) ? 2 : 1,
            opacity: props.isFocusMode && !branchIds.has(item.goal.id) ? 0.2 : 1,
          },
        });
      } else if (item.type === "add") {
        const addNodeId = `add-child-${item.parentGoalId}`;
        nodes.push({
          id: addNodeId,
          type: "addChildNode",
          position: { x: itemNodeX, y: itemNodeY },
          zIndex: props.selectedGoalId === goal.id ? 70 : 5,
          data: {
            onOpen: () => props.onOpenAddChild(item.parentGoalId),
          } satisfies AddChildNodeData,
          selectable: false,
          draggable: false,
        });
        edges.push({
          id: `edge-${goal.id}-${addNodeId}`,
          source: goal.id,
          target: addNodeId,
          type: "smoothstep",
          animated: true,
          style: {
            stroke: "rgba(217, 153, 58, 0.24)",
            strokeWidth: 1,
            strokeDasharray: "6 4",
          },
        });
      } else {
        const draftNodeId = `child-draft-${item.parentGoalId}`;
        nodes.push({
          id: draftNodeId,
          type: "childDraftNode",
          position: { x: itemNodeX, y: itemNodeY },
          zIndex: props.selectedGoalId === goal.id ? 70 : 5,
          data: {
            title: props.childDraft?.title ?? "",
            isPending: props.childDraftIsPending,
            onChange: props.onChildDraftChange,
            onSave: props.onSaveChildDraft,
            onCancel: props.onCancelChildDraft,
          } satisfies ChildDraftNodeData,
          selectable: false,
          draggable: false,
        });
        edges.push({
          id: `edge-${goal.id}-${draftNodeId}`,
          source: goal.id,
          target: draftNodeId,
          type: "smoothstep",
          animated: true,
          style: {
            stroke: "#d9993a",
            strokeWidth: 1.5,
            strokeDasharray: "6 4",
          },
        });
      }

      currentLeft += itemWidth + SIBLING_GAP;
    }
  };

  let currentLeft = CONTENT_X;
  for (const root of roots) {
    const rootWidth = measureGoalWidth(root);
    layoutGoal(root, currentLeft, 0, 0);
    currentLeft += rootWidth + ROOT_GAP;
  }

  return {
    nodes,
    edges,
    visibleGoalIds: [...visibleIds],
    branchNodeIds: [...branchIds].filter((goalId) => visibleIds.has(goalId)),
  };
};

type GraphInnerProps = LayoutProps & {
  isExpanded: boolean;
  onCanvasClear: () => void;
};

const GraphInner = (props: GraphInnerProps) => {
  const { fitView, getViewport, setViewport } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const lastInitialFitKeyRef = useRef<string | null>(null);
  const savedViewportRef = useRef<Viewport | null>(null);
  const previousFocusModeRef = useRef(false);

  const { nodes, edges, visibleGoalIds, branchNodeIds } = useMemo(
    () => buildLayout(props),
    [props],
  );

  useEffect(() => {
    if (!nodesInitialized || visibleGoalIds.length === 0) {
      return;
    }

    const fitKey = visibleGoalIds.join("|");
    if (lastInitialFitKeyRef.current === fitKey) {
      return;
    }

    lastInitialFitKeyRef.current = fitKey;
    const targets = visibleGoalIds.map((id) => ({ id }));
    const firstFrame = window.requestAnimationFrame(() => {
      void fitView({
        nodes: targets,
        padding: props.isExpanded ? 0.12 : 0.16,
        duration: 0,
      });
    });
    const secondFrame = window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        void fitView({
          nodes: targets,
          padding: props.isExpanded ? 0.12 : 0.16,
          duration: 180,
        });
      });
    }, 120);

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.clearTimeout(secondFrame);
    };
  }, [fitView, nodesInitialized, props.isExpanded, visibleGoalIds]);

  useEffect(() => {
    if (!nodesInitialized) {
      return;
    }

    if (props.isFocusMode && props.selectedGoalId && branchNodeIds.length > 0) {
      if (!previousFocusModeRef.current) {
        savedViewportRef.current = getViewport();
      }

      previousFocusModeRef.current = true;
      const frame = window.requestAnimationFrame(() => {
        void fitView({
          nodes: branchNodeIds.map((id) => ({ id })),
          padding: props.isExpanded ? 0.16 : 0.22,
          duration: 280,
        });
      });

      return () => window.cancelAnimationFrame(frame);
    }

    if (previousFocusModeRef.current && savedViewportRef.current) {
      previousFocusModeRef.current = false;
      void setViewport(savedViewportRef.current, { duration: 220 });
      return;
    }

    previousFocusModeRef.current = false;
  }, [
    branchNodeIds,
    fitView,
    getViewport,
    nodesInitialized,
    props.isExpanded,
    props.isFocusMode,
    props.selectedGoalId,
    setViewport,
  ]);

  const handleNodeClick: NodeMouseHandler<Node> = (_event, node) => {
    if (node.type === "goalNode") {
      props.onSelectGoal(node.id);
      return;
    }

    if (node.type === "addChildNode" && node.id.startsWith("add-child-")) {
      props.onOpenAddChild(node.id.replace("add-child-", ""));
    }
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={handleNodeClick}
      onPaneClick={props.onCanvasClear}
      panOnScroll
      zoomOnScroll={false}
      nodesConnectable={false}
      nodesDraggable={false}
      minZoom={0.22}
      maxZoom={1.35}
      proOptions={{ hideAttribution: true }}
    >
      <Background color="rgba(216, 166, 95, 0.03)" gap={40} size={1} />
    </ReactFlow>
  );
};

export type GoalsPlanGraphViewProps = {
  goals: GoalOverviewItem[];
  horizons: GoalHorizonItem[];
  monthItems: PlannerItem[];
  weekItems: PlannerItem[];
  todayItems: PlannerItem[];
  selectedGoalId: string | null;
  expandedGoalIds: Set<string>;
  isFocusMode: boolean;
  childDraft: ChildDraft | null;
  childDraftIsPending: boolean;
  selectedPlanningSelection: PlanningSelection | null;
  planningDraft: PlanningDraft | null;
  planningReplaceState: PlanningReplaceState | null;
  showTodayLane: boolean;
  structureError: string | null;
  isExpanded: boolean;
  isInspectorVisible: boolean;
  onSelectGoal: (goalId: string) => void;
  onToggleExpanded: (goalId: string) => void;
  onOpenAddChild: (goalId: string) => void;
  onDropGoalOnGoal: (targetGoalId: string, draggedGoalId: string) => void;
  onDropGoalOnHorizon: (horizonId: string | null, goalId: string) => void;
  onChildDraftChange: (title: string) => void;
  onSaveChildDraft: () => void;
  onCancelChildDraft: () => void;
  onSelectPlanningSlot: (lane: PlanningLane, slot: PlanningSlot) => void;
  onDropGoalOnSlot: (lane: PlanningLane, slot: PlanningSlot, goalId: string) => void;
  onPlanningDraftChange: (updates: Partial<PlanningDraft>) => void;
  onSavePlanningDraft: () => void;
  onCancelPlanningDraft: () => void;
  onPlanningReplaceAction: (action: "replace" | "move") => void;
  onCancelPlanningReplace: () => void;
  onToggleTodayLane: () => void;
  onCanvasClear: () => void;
  onShowInspector: () => void;
  onHideInspector: () => void;
  onEnterFocusMode: () => void;
  onExitFocusMode: () => void;
  onClearSelection: () => void;
  onToggleExpandedCanvas: () => void;
};

export const GoalsPlanGraphView = ({
  goals,
  horizons,
  monthItems,
  weekItems,
  todayItems,
  selectedGoalId,
  expandedGoalIds,
  isFocusMode,
  childDraft,
  childDraftIsPending,
  selectedPlanningSelection,
  planningDraft,
  planningReplaceState,
  showTodayLane,
  structureError,
  isExpanded,
  isInspectorVisible,
  onSelectGoal,
  onToggleExpanded,
  onOpenAddChild,
  onDropGoalOnGoal,
  onDropGoalOnHorizon: _onDropGoalOnHorizon,
  onChildDraftChange,
  onSaveChildDraft,
  onCancelChildDraft,
  onSelectPlanningSlot,
  onDropGoalOnSlot,
  onPlanningDraftChange,
  onSavePlanningDraft,
  onCancelPlanningDraft,
  onPlanningReplaceAction,
  onCancelPlanningReplace,
  onToggleTodayLane,
  onCanvasClear,
  onShowInspector,
  onHideInspector,
  onEnterFocusMode,
  onExitFocusMode,
  onClearSelection,
  onToggleExpandedCanvas,
}: GoalsPlanGraphViewProps) => {
  const hasGoals = goals.some((goal) => goal.status === "active");

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
    <div className={`ghq-graph${isExpanded ? " ghq-graph--expanded" : ""}`}>
      <div className="ghq-graph__toolbar">
        {selectedGoalId ? (
          <button
            className="button button--ghost button--small ghq-graph__toolbar-btn"
            type="button"
            onClick={isInspectorVisible ? onHideInspector : onShowInspector}
            aria-pressed={isInspectorVisible}
          >
            {isInspectorVisible ? "Hide details" : "Show details"}
          </button>
        ) : null}
        {selectedGoalId ? (
          <button
            className="button button--ghost button--small ghq-graph__toolbar-btn"
            type="button"
            onClick={isFocusMode ? onExitFocusMode : onEnterFocusMode}
            aria-pressed={isFocusMode}
          >
            {isFocusMode ? "Exit focus" : "Focus branch"}
          </button>
        ) : null}
        {selectedGoalId ? (
          <button
            className="button button--ghost button--small ghq-graph__toolbar-btn"
            type="button"
            onClick={onClearSelection}
          >
            Clear selection
          </button>
        ) : null}
        <button
          className="button button--ghost button--small ghq-graph__expand-btn"
          type="button"
          onClick={onToggleExpandedCanvas}
          aria-label={isExpanded ? "Exit expanded graph view" : "Expand graph view"}
          aria-pressed={isExpanded}
        >
          {isExpanded ? "Collapse canvas" : "Expand canvas"}
        </button>
      </div>

      <ReactFlowProvider>
        <GraphInner
          goals={goals}
          horizons={horizons}
          monthItems={monthItems}
          weekItems={weekItems}
          todayItems={todayItems}
          selectedGoalId={selectedGoalId}
          expandedGoalIds={expandedGoalIds}
          isFocusMode={isFocusMode}
          childDraft={childDraft}
          childDraftIsPending={childDraftIsPending}
          selectedPlanningSelection={selectedPlanningSelection}
          planningDraft={planningDraft}
          planningReplaceState={planningReplaceState}
          showTodayLane={showTodayLane}
          onSelectGoal={onSelectGoal}
          onToggleExpanded={onToggleExpanded}
          onOpenAddChild={onOpenAddChild}
          onDropGoalOnGoal={onDropGoalOnGoal}
          onChildDraftChange={onChildDraftChange}
          onSaveChildDraft={onSaveChildDraft}
          onCancelChildDraft={onCancelChildDraft}
          onSelectPlanningSlot={onSelectPlanningSlot}
          onDropGoalOnSlot={onDropGoalOnSlot}
          onPlanningDraftChange={onPlanningDraftChange}
          onSavePlanningDraft={onSavePlanningDraft}
          onCancelPlanningDraft={onCancelPlanningDraft}
          onPlanningReplaceAction={onPlanningReplaceAction}
          onCancelPlanningReplace={onCancelPlanningReplace}
          onToggleTodayLane={onToggleTodayLane}
          isExpanded={isExpanded}
          onCanvasClear={onCanvasClear}
        />
      </ReactFlowProvider>

      {!selectedGoalId ? (
        <div className="ghq-graph__hint">
          <p>Select a goal to open an inline planning ladder without leaving the graph.</p>
        </div>
      ) : null}

      {structureError ? (
        <div className="ghq-graph__notice">
          <p>{structureError}</p>
        </div>
      ) : null}

      {horizons.filter((horizon) => !horizon.isArchived).length === 0 ? (
        <div className="ghq-graph__hint ghq-graph__hint--bottom">
          <p>Add planning layers in Settings to make the hierarchy clearer.</p>
        </div>
      ) : null}
    </div>
  );
};
