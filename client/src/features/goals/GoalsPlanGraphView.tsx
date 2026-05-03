import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Edge, Node, NodeMouseHandler, NodeProps, Viewport } from "@xyflow/react";

import type {
  GoalHorizonItem,
  GoalOverviewItem,
} from "../../shared/lib/api";

const NODE_W = 244;
const CONTENT_X = 80;
const CONTENT_Y = 132;
const LEVEL_GAP = 168;
const SIBLING_GAP = 36;
const ROOT_GAP = 64;
const GOAL_DRAG_MIME = "application/x-life-os-goal-id";

const domainEmojis: Record<string, string> = {
  unassigned: "◌",
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

type GoalNodeData = {
  goal: GoalOverviewItem;
  level: number;
  isSelected: boolean;
  isInBranch: boolean;
  isDimmed: boolean;
  isSpotlightMatch: boolean;
  canExpand: boolean;
  isExpanded: boolean;
  previousVisibleGoalId: string | null;
  nextVisibleGoalId: string | null;
  childCount: number;
  isInMonthFocus: boolean;
  isInWeekFocus: boolean;
  onSelect: (goalId: string) => void;
  onToggleExpanded: (goalId: string) => void;
  onOpenAddChild: (goalId: string) => void;
  onOpenDetails: (goalId: string) => void;
  onOpenPlanning: (goalId: string) => void;
  onEditGoal: (goal: GoalOverviewItem) => void;
  onDetachGoal: (goalId: string) => void;
  onDuplicateGoal: (goal: GoalOverviewItem) => void;
  onArchiveGoal: (goal: GoalOverviewItem) => void;
  onAddToLane: (lane: "month" | "week", goalId: string) => void;
  onDropGoalOnGoal: (targetGoalId: string, draggedGoalId: string) => void;
};

type ChildDraftNodeData = {
  initialTitle: string;
  isPending: boolean;
  onSave: (title: string) => void;
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
  spotlightGoalIds: Set<string> | null;
  spotlightExactGoalIds: Set<string>;
  childDraft: ChildDraft | null;
  childDraftIsPending: boolean;
  monthFocusGoalIds: Set<string>;
  weekFocusGoalIds: Set<string>;
  onSelectGoal: (goalId: string) => void;
  onToggleExpanded: (goalId: string) => void;
  onOpenAddChild: (goalId: string) => void;
  onOpenDetails: (goalId: string) => void;
  onOpenPlanning: (goalId: string) => void;
  onEditGoal: (goal: GoalOverviewItem) => void;
  onDetachGoal: (goalId: string) => void;
  onDuplicateGoal: (goal: GoalOverviewItem) => void;
  onArchiveGoal: (goal: GoalOverviewItem) => void;
  onAddToLane: (lane: "month" | "week", goalId: string) => void;
  onDropGoalOnGoal: (targetGoalId: string, draggedGoalId: string) => void;
  onSaveChildDraft: (title: string) => void;
  onCancelChildDraft: () => void;
};

type GraphFilters = {
  query: string;
  domainId: string;
  horizonId: string;
  health: string;
};

type SpotlightState = {
  active: boolean;
  exactGoalIds: Set<string>;
  relatedGoalIds: Set<string>;
};

type TreeChildItem =
  | { type: "goal"; goal: GoalOverviewItem }
  | { type: "draft"; parentGoalId: string };

const sortGoals = (left: GoalOverviewItem, right: GoalOverviewItem) => {
  if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
  return left.createdAt.localeCompare(right.createdAt);
};

const isGoalDescendant = (
  goals: GoalOverviewItem[],
  ancestorGoalId: string,
  candidateGoalId: string,
) => {
  const goalMap = new Map(goals.map((goal) => [goal.id, goal]));
  let current = goalMap.get(candidateGoalId) ?? null;

  while (current?.parentGoalId) {
    if (current.parentGoalId === ancestorGoalId) {
      return true;
    }
    current = goalMap.get(current.parentGoalId) ?? null;
  }

  return false;
};

const focusGraphGoalNode = (goalId: string) => {
  window.requestAnimationFrame(() => {
    document.querySelector<HTMLElement>(`[data-goal-node-id="${goalId}"]`)?.focus();
  });
};

const GoalGraphNode = memo(function GoalGraphNode({ data }: NodeProps) {
  const d = data as unknown as GoalNodeData;
  const [isDragOver, setIsDragOver] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const health = d.goal.health ?? "on_track";

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!nodeRef.current?.contains(event.target as globalThis.Node)) {
        setMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [menuOpen]);

  return (
    <div
      ref={nodeRef}
      className={`graph-goal-node nopan${d.isSelected ? " graph-goal-node--selected" : ""}${d.isInBranch ? " graph-goal-node--branch" : ""}${d.isDimmed ? " graph-goal-node--dimmed" : ""}${d.isSpotlightMatch ? " graph-goal-node--spotlight" : ""}${isDragOver ? " graph-goal-node--drop-target" : ""}`}
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
      onDoubleClick={(event) => {
        event.stopPropagation();
        d.onOpenDetails(d.goal.id);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        d.onSelect(d.goal.id);
        setMenuOpen(true);
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) {
          return;
        }

        if (event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          d.onSelect(d.goal.id);
          return;
        }

        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          d.onSelect(d.goal.id);
          d.onOpenDetails(d.goal.id);
          return;
        }

        if (event.key === "ArrowRight" && d.canExpand && !d.isExpanded) {
          event.preventDefault();
          event.stopPropagation();
          d.onToggleExpanded(d.goal.id);
          return;
        }

        if (event.key === "ArrowLeft" && d.canExpand && d.isExpanded) {
          event.preventDefault();
          event.stopPropagation();
          d.onToggleExpanded(d.goal.id);
          return;
        }

        if (event.key === "ArrowDown" && d.nextVisibleGoalId) {
          event.preventDefault();
          event.stopPropagation();
          d.onSelect(d.nextVisibleGoalId);
          focusGraphGoalNode(d.nextVisibleGoalId);
          return;
        }

        if (event.key === "ArrowUp" && d.previousVisibleGoalId) {
          event.preventDefault();
          event.stopPropagation();
          d.onSelect(d.previousVisibleGoalId);
          focusGraphGoalNode(d.previousVisibleGoalId);
        }
      }}
      role="treeitem"
      tabIndex={0}
      data-goal-node-id={d.goal.id}
      aria-label={`${d.goal.title}, ${d.goal.domain}${d.goal.horizonName ? `, ${d.goal.horizonName}` : ""}`}
      aria-level={d.level}
      aria-selected={d.isSelected}
      aria-expanded={d.canExpand ? d.isExpanded : undefined}
      aria-keyshortcuts="Space Enter ArrowRight ArrowLeft ArrowDown ArrowUp"
      title="Click to select. Double-click or press Enter for details. Drag onto another goal or use the parent control to re-parent."
    >
      <Handle type="target" position={Position.Top} className="graph-handle--hidden" />
      <div className="graph-goal-node__row">
        <span className={`graph-goal-node__dot graph-goal-node__dot--${health}`} />
        <span className="graph-goal-node__title">{d.goal.title}</span>
        <div className="graph-goal-node__controls" aria-label="Goal actions">
          {d.canExpand ? (
            <button
              className={[
                "graph-goal-node__branch-toggle",
                d.isExpanded ? "graph-goal-node__branch-toggle--open" : "",
              ].filter(Boolean).join(" ")}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                d.onToggleExpanded(d.goal.id);
              }}
              aria-label={
                d.isExpanded
                  ? `Collapse ${d.childCount} sub-goals`
                  : `Expand ${d.childCount} sub-goals`
              }
              title={d.isExpanded ? "Collapse sub-goals" : "Expand sub-goals"}
            >
              <svg className="graph-goal-node__branch-icon" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M5.5 3.5L10 8l-4.5 4.5" />
              </svg>
              <span className="graph-goal-node__branch-count">{d.childCount}</span>
            </button>
          ) : null}
          <button
            className="graph-goal-node__quick-add"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              d.onOpenAddChild(d.goal.id);
            }}
            aria-label={`Add sub-goal under ${d.goal.title}`}
            title="Add sub-goal"
          >
            +
          </button>
          <button
            className="graph-goal-node__menu-trigger"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen((current) => !current);
            }}
            aria-label={`Open actions for ${d.goal.title}`}
            aria-expanded={menuOpen}
            title="More actions"
          >
            ⋯
          </button>
        </div>
      </div>
      <div className="graph-goal-node__meta">
        <span className="graph-goal-node__domain">
          {domainEmoji(d.goal.domainSystemKey)} {d.goal.domain}
        </span>
        {d.goal.horizonName ? (
          <span className="graph-goal-node__badge">{d.goal.horizonName}</span>
        ) : null}
        {d.isInMonthFocus ? (
          <span className="graph-goal-node__badge graph-goal-node__badge--focus">Month</span>
        ) : null}
        {d.isInWeekFocus ? (
          <span className="graph-goal-node__badge graph-goal-node__badge--focus">Week</span>
        ) : null}
      </div>
      {d.goal.progressPercent > 0 ? (
        <div className="graph-goal-node__bar">
          <div
            className={`graph-goal-node__bar-fill graph-goal-node__bar-fill--${health}`}
            style={{ width: `${Math.min(d.goal.progressPercent, 100)}%` }}
          />
        </div>
      ) : null}
      {d.isSelected ? (
        <div className="graph-goal-node__footer">
          <button
            className="graph-goal-node__action"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              d.onOpenAddChild(d.goal.id);
            }}
          >
            Add sub-goal
          </button>
          <button
            className="graph-goal-node__action"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              d.onOpenPlanning(d.goal.id);
            }}
          >
            Plan
          </button>
          <button
            className="graph-goal-node__action"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              d.onOpenDetails(d.goal.id);
            }}
          >
            Details
          </button>
          <button
            className="graph-goal-node__action"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              d.onAddToLane("week", d.goal.id);
            }}
          >
            Week
          </button>
        </div>
      ) : null}
      {menuOpen ? (
        <div className="graph-goal-node__menu" role="menu">
          <button type="button" role="menuitem" onClick={(event) => {
            event.stopPropagation();
            d.onOpenDetails(d.goal.id);
            setMenuOpen(false);
          }}>
            Details
          </button>
          <button type="button" role="menuitem" onClick={(event) => {
            event.stopPropagation();
            d.onOpenAddChild(d.goal.id);
            setMenuOpen(false);
          }}>
            Add sub-goal
          </button>
          <button type="button" role="menuitem" onClick={(event) => {
            event.stopPropagation();
            d.onOpenPlanning(d.goal.id);
            setMenuOpen(false);
          }}>
            Open focus board
          </button>
          <button type="button" role="menuitem" onClick={(event) => {
            event.stopPropagation();
            d.onAddToLane("month", d.goal.id);
            setMenuOpen(false);
          }}>
            Add to month
          </button>
          <button type="button" role="menuitem" onClick={(event) => {
            event.stopPropagation();
            d.onAddToLane("week", d.goal.id);
            setMenuOpen(false);
          }}>
            Add to week
          </button>
          <button type="button" role="menuitem" onClick={(event) => {
            event.stopPropagation();
            d.onEditGoal(d.goal);
            setMenuOpen(false);
          }}>
            Edit goal
          </button>
          <button type="button" role="menuitem" onClick={(event) => {
            event.stopPropagation();
            d.onDuplicateGoal(d.goal);
            setMenuOpen(false);
          }}>
            Duplicate
          </button>
          {d.goal.parentGoalId ? (
            <button type="button" role="menuitem" onClick={(event) => {
              event.stopPropagation();
              d.onDetachGoal(d.goal.id);
              setMenuOpen(false);
            }}>
              Make top-level
            </button>
          ) : null}
          <button type="button" role="menuitem" className="graph-goal-node__menu-danger" onClick={(event) => {
            event.stopPropagation();
            d.onArchiveGoal(d.goal);
            setMenuOpen(false);
          }}>
            Archive
          </button>
        </div>
      ) : null}
      {isDragOver ? (
        <div className="graph-goal-node__drop-hint">Drop here to re-parent</div>
      ) : null}
      <Handle type="source" position={Position.Bottom} className="graph-handle--hidden" />
    </div>
  );
});

const ChildDraftNode = memo(function ChildDraftNode({ data }: NodeProps) {
  const d = data as unknown as ChildDraftNodeData;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState(d.initialTitle);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        if (!inputRef.current.value) {
          inputRef.current.select();
        }
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="graph-child-draft nopan">
      <Handle type="target" position={Position.Top} className="graph-handle--hidden" />
      <input
        ref={inputRef}
        className="graph-child-draft__input"
        type="text"
        value={title}
        placeholder="Supporting goal title"
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent.isComposing) {
            return;
          }

          event.preventDefault();
          if (!d.isPending && title.trim()) {
            d.onSave(title);
          }
        }}
      />
      <div className="graph-child-draft__actions">
        <button
          className="button button--primary button--small"
          type="button"
          onClick={() => d.onSave(title)}
          disabled={d.isPending || !title.trim()}
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

const goalMatchesFilters = (goal: GoalOverviewItem, filters: GraphFilters) => {
  const query = filters.query.trim().toLowerCase();
  const matchesQuery =
    !query
    || goal.title.toLowerCase().includes(query)
    || goal.domain.toLowerCase().includes(query)
    || (goal.horizonName ?? "").toLowerCase().includes(query);
  const matchesDomain = !filters.domainId || goal.domainId === filters.domainId;
  const matchesHorizon = !filters.horizonId || goal.horizonId === filters.horizonId;
  const matchesHealth = !filters.health || (goal.health ?? "on_track") === filters.health;

  return matchesQuery && matchesDomain && matchesHorizon && matchesHealth;
};

const buildSpotlightState = (goals: GoalOverviewItem[], filters: GraphFilters): SpotlightState => {
  const hasActiveFilters = Boolean(
    filters.query.trim()
    || filters.domainId
    || filters.horizonId
    || filters.health,
  );

  if (!hasActiveFilters) {
    return {
      active: false,
      exactGoalIds: new Set(),
      relatedGoalIds: new Set(),
    };
  }

  const goalMap = new Map(goals.map((goal) => [goal.id, goal]));
  const childrenByParent = new Map<string, GoalOverviewItem[]>();
  for (const goal of goals) {
    if (!goal.parentGoalId) {
      continue;
    }

    const children = childrenByParent.get(goal.parentGoalId) ?? [];
    children.push(goal);
    childrenByParent.set(goal.parentGoalId, children);
  }

  const exactGoalIds = new Set(goals.filter((goal) => goalMatchesFilters(goal, filters)).map((goal) => goal.id));
  const relatedGoalIds = new Set(exactGoalIds);

  for (const goalId of exactGoalIds) {
    let current = goalMap.get(goalId) ?? null;
    while (current?.parentGoalId) {
      relatedGoalIds.add(current.parentGoalId);
      current = goalMap.get(current.parentGoalId) ?? null;
    }

    const stack = [...(childrenByParent.get(goalId) ?? [])];
    while (stack.length > 0) {
      const child = stack.pop()!;
      relatedGoalIds.add(child.id);
      stack.push(...(childrenByParent.get(child.id) ?? []));
    }
  }

  return {
    active: true,
    exactGoalIds,
    relatedGoalIds,
  };
};

const buildLayout = (props: LayoutProps) => {
  const activeGoals = props.goals.filter((goal) => goal.status === "active");
  const { goalMap, childrenByParent, roots, visibleIds } = buildVisibleTree(activeGoals, props.expandedGoalIds);
  const visibleGoalIds = [...visibleIds];
  const visibleGoalIndexById = new Map(visibleGoalIds.map((goalId, index) => [goalId, index]));
  const branchIds = buildBranchIds(props.selectedGoalId, goalMap, childrenByParent, visibleIds);

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
  ) => {
    const childItems = childItemsForGoal(goal);
    const goalWidth = measureGoalWidth(goal);
    const visibleGoalIndex = visibleGoalIndexById.get(goal.id) ?? -1;
    const childrenWidth = childItems.reduce((total, item, index) => {
      return total + measureItemWidth(item) + (index > 0 ? SIBLING_GAP : 0);
    }, 0);
    const goalX = leftX + (goalWidth - NODE_W) / 2;
    const goalY = CONTENT_Y + depth * LEVEL_GAP;

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
        level: depth + 1,
        isSelected: props.selectedGoalId === goal.id,
        isInBranch: branchIds.has(goal.id),
        isDimmed:
          (props.isFocusMode && props.selectedGoalId !== null && !branchIds.has(goal.id))
          || (props.spotlightGoalIds !== null && !props.spotlightGoalIds.has(goal.id)),
        isSpotlightMatch: props.spotlightExactGoalIds.has(goal.id),
        canExpand: (childrenByParent.get(goal.id)?.length ?? 0) > 0,
        isExpanded: props.expandedGoalIds.has(goal.id),
        previousVisibleGoalId: visibleGoalIndex > 0 ? visibleGoalIds[visibleGoalIndex - 1] : null,
        nextVisibleGoalId: visibleGoalIndex >= 0 ? visibleGoalIds[visibleGoalIndex + 1] ?? null : null,
        childCount: childrenByParent.get(goal.id)?.length ?? 0,
        isInMonthFocus: props.monthFocusGoalIds.has(goal.id),
        isInWeekFocus: props.weekFocusGoalIds.has(goal.id),
        onSelect: props.onSelectGoal,
        onToggleExpanded: props.onToggleExpanded,
        onOpenAddChild: props.onOpenAddChild,
        onOpenDetails: props.onOpenDetails,
        onOpenPlanning: props.onOpenPlanning,
        onEditGoal: props.onEditGoal,
        onDetachGoal: props.onDetachGoal,
        onDuplicateGoal: props.onDuplicateGoal,
        onArchiveGoal: props.onArchiveGoal,
        onAddToLane: props.onAddToLane,
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
      const itemNodeY = CONTENT_Y + (depth + 1) * LEVEL_GAP;

      if (item.type === "goal") {
        layoutGoal(item.goal, currentLeft, depth + 1);
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
      } else {
        const draftNodeId = `child-draft-${item.parentGoalId}`;
        nodes.push({
          id: draftNodeId,
          type: "childDraftNode",
          position: { x: itemNodeX, y: itemNodeY },
          zIndex: props.selectedGoalId === goal.id ? 70 : 5,
          data: {
            initialTitle: props.childDraft?.title ?? "",
            isPending: props.childDraftIsPending,
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
    layoutGoal(root, currentLeft, 0);
    currentLeft += rootWidth + ROOT_GAP;
  }

  return {
    nodes,
    edges,
    visibleGoalIds,
    branchNodeIds: [...branchIds].filter((goalId) => visibleIds.has(goalId)),
  };
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const useAnimatedNodes = (nodes: Node[], disabled = false) => {
  const [animatedNodes, setAnimatedNodes] = useState(nodes);
  const displayedNodesRef = useRef(nodes);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    displayedNodesRef.current = animatedNodes;
  }, [animatedNodes]);

  useEffect(() => {
    if (disabled) {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      displayedNodesRef.current = nodes;
      setAnimatedNodes(nodes);
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sourceNodes = displayedNodesRef.current;
    const sourceById = new Map(sourceNodes.map((node) => [node.id, node]));
    const hasPositionChanges = nodes.some((node) => {
      const source = sourceById.get(node.id);
      return Boolean(
        source
        && (
          source.position.x !== node.position.x
          || source.position.y !== node.position.y
        ),
      );
    });

    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (prefersReducedMotion || !hasPositionChanges) {
      displayedNodesRef.current = nodes;
      setAnimatedNodes(nodes);
      return;
    }

    const start = window.performance.now();
    const duration = 240;

    const tick = (timestamp: number) => {
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = easeOutCubic(progress);
      const nextNodes = nodes.map((node) => {
        const source = sourceById.get(node.id);

        if (!source) {
          return node;
        }

        return {
          ...node,
          position: {
            x: source.position.x + (node.position.x - source.position.x) * eased,
            y: source.position.y + (node.position.y - source.position.y) * eased,
          },
        };
      });

      displayedNodesRef.current = nextNodes;
      setAnimatedNodes(nextNodes);

      if (progress < 1) {
        frameRef.current = window.requestAnimationFrame(tick);
        return;
      }

      frameRef.current = null;
      displayedNodesRef.current = nodes;
      setAnimatedNodes(nodes);
    };

    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [disabled, nodes]);

  return disabled ? nodes : animatedNodes;
};

const edgeStyleMatches = (
  left: Edge["style"],
  right: Edge["style"],
) => {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return (
    left.stroke === right.stroke
    && left.strokeWidth === right.strokeWidth
    && left.opacity === right.opacity
    && left.strokeDasharray === right.strokeDasharray
  );
};

const edgeMatches = (left: Edge, right: Edge) => (
  left.id === right.id
  && left.source === right.source
  && left.target === right.target
  && left.type === right.type
  && left.animated === right.animated
  && edgeStyleMatches(left.style, right.style)
);

const useStableEdges = (edges: Edge[]) => {
  const stableEdgesRef = useRef(edges);

  return useMemo(() => {
    const previousEdges = stableEdgesRef.current;
    const canReusePrevious =
      previousEdges.length === edges.length
      && previousEdges.every((edge, index) => edgeMatches(edge, edges[index]));

    if (canReusePrevious) {
      return previousEdges;
    }

    stableEdgesRef.current = edges;
    return edges;
  }, [edges]);
};

type GraphInnerProps = LayoutProps & {
  isExpanded: boolean;
  onCanvasClear: () => void;
};

const GraphInner = (props: GraphInnerProps) => {
  const { fitView, getViewport, setViewport, zoomIn, zoomOut } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const initialFitDoneRef = useRef(false);
  const savedViewportRef = useRef<Viewport | null>(null);
  const previousFocusModeRef = useRef(false);

  const { nodes, edges, visibleGoalIds, branchNodeIds } = useMemo(
    () => buildLayout(props),
    [props],
  );
  const animatedNodes = useAnimatedNodes(nodes, Boolean(props.childDraft));
  const stableEdges = useStableEdges(edges);

  useEffect(() => {
    if (!nodesInitialized || visibleGoalIds.length === 0) {
      return;
    }

    if (initialFitDoneRef.current) {
      return;
    }

    initialFitDoneRef.current = true;
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
    }
  };

  const fitVisibleGoals = useCallback(() => {
    if (visibleGoalIds.length === 0) {
      return;
    }

    void fitView({
      nodes: visibleGoalIds.map((id) => ({ id })),
      padding: props.isExpanded ? 0.12 : 0.16,
      duration: 220,
    });
  }, [fitView, props.isExpanded, visibleGoalIds]);

  const centerSelectedGoal = useCallback(() => {
    if (!props.selectedGoalId) {
      fitVisibleGoals();
      return;
    }

    void fitView({
      nodes: [{ id: props.selectedGoalId }],
      padding: 0.46,
      duration: 220,
    });
  }, [fitView, fitVisibleGoals, props.selectedGoalId]);

  return (
    <div className="ghq-graph__canvas" role="tree" aria-label="Goal hierarchy graph">
      <ReactFlow
        nodes={animatedNodes}
        edges={stableEdges}
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
        <div className="ghq-graph__viewport-controls nopan" aria-label="Canvas view controls">
          <button type="button" onClick={() => void zoomIn({ duration: 180 })} aria-label="Zoom in">
            +
          </button>
          <button type="button" onClick={() => void zoomOut({ duration: 180 })} aria-label="Zoom out">
            −
          </button>
          <button type="button" onClick={fitVisibleGoals}>
            Fit
          </button>
          <button type="button" onClick={centerSelectedGoal}>
            Center
          </button>
        </div>
      </ReactFlow>
    </div>
  );
};

export type GoalsPlanGraphViewProps = {
  goals: GoalOverviewItem[];
  horizons: GoalHorizonItem[];
  selectedGoalId: string | null;
  expandedGoalIds: Set<string>;
  isFocusMode: boolean;
  childDraft: ChildDraft | null;
  childDraftIsPending: boolean;
  monthFocusGoalIds: Set<string>;
  weekFocusGoalIds: Set<string>;
  structureError: string | null;
  structureMessage: string | null;
  isExpanded: boolean;
  onSelectGoal: (goalId: string) => void;
  onToggleExpanded: (goalId: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onOpenCreateGoal: () => void;
  onOpenAddChild: (goalId: string) => void;
  onOpenDetails: (goalId: string) => void;
  onOpenPlanning: (goalId: string) => void;
  onEditGoal: (goal: GoalOverviewItem) => void;
  onDetachGoal: (goalId: string) => void;
  onReparentGoal: (goalId: string, parentGoalId: string | null) => void;
  onDuplicateGoal: (goal: GoalOverviewItem) => void;
  onArchiveGoal: (goal: GoalOverviewItem) => void;
  onAddToLane: (lane: "month" | "week", goalId: string) => void;
  onDropGoalOnGoal: (targetGoalId: string, draggedGoalId: string) => void;
  onSaveChildDraft: (title: string) => void;
  onCancelChildDraft: () => void;
  onCanvasClear: () => void;
  onEnterFocusMode: () => void;
  onExitFocusMode: () => void;
  onClearSelection: () => void;
  onToggleExpandedCanvas: () => void;
};

export const GoalsPlanGraphView = ({
  goals,
  horizons,
  selectedGoalId,
  expandedGoalIds,
  isFocusMode,
  childDraft,
  childDraftIsPending,
  monthFocusGoalIds,
  weekFocusGoalIds,
  structureError,
  structureMessage,
  isExpanded,
  onSelectGoal,
  onToggleExpanded,
  onExpandAll,
  onCollapseAll,
  onOpenCreateGoal,
  onOpenAddChild,
  onOpenDetails,
  onOpenPlanning,
  onEditGoal,
  onDetachGoal,
  onReparentGoal,
  onDuplicateGoal,
  onArchiveGoal,
  onAddToLane,
  onDropGoalOnGoal,
  onSaveChildDraft,
  onCancelChildDraft,
  onCanvasClear,
  onEnterFocusMode,
  onExitFocusMode,
  onClearSelection,
  onToggleExpandedCanvas,
}: GoalsPlanGraphViewProps) => {
  const hasGoals = goals.some((goal) => goal.status === "active");
  const [filters, setFilters] = useState<GraphFilters>({
    query: "",
    domainId: "",
    horizonId: "",
    health: "",
  });
  const activeGoals = useMemo(() => goals.filter((goal) => goal.status === "active"), [goals]);
  const selectedGoal = useMemo(
    () => (selectedGoalId ? activeGoals.find((goal) => goal.id === selectedGoalId) ?? null : null),
    [activeGoals, selectedGoalId],
  );
  const parentGoalOptions = useMemo(
    () => (
      selectedGoalId
        ? activeGoals
            .filter((goal) => goal.id !== selectedGoalId && !isGoalDescendant(activeGoals, selectedGoalId, goal.id))
            .sort(sortGoals)
        : []
    ),
    [activeGoals, selectedGoalId],
  );
  const activeDomains = useMemo(() => {
    const domainMap = new Map<string, string>();
    for (const goal of activeGoals) {
      domainMap.set(goal.domainId, goal.domain);
    }
    return [...domainMap.entries()].sort((left, right) => left[1].localeCompare(right[1]));
  }, [activeGoals]);
  const activeHorizonIds = useMemo(() => new Set(activeGoals.flatMap((goal) => (goal.horizonId ? [goal.horizonId] : []))), [activeGoals]);
  const activeHorizons = useMemo(
    () => horizons.filter((horizon) => !horizon.isArchived && activeHorizonIds.has(horizon.id)),
    [activeHorizonIds, horizons],
  );
  const spotlight = useMemo(() => buildSpotlightState(activeGoals, filters), [activeGoals, filters]);
  const filterMatchCount = spotlight.active ? spotlight.exactGoalIds.size : activeGoals.length;
  const hasActiveFilters = spotlight.active;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT"
        || target?.tagName === "TEXTAREA"
        || target?.tagName === "SELECT"
        || target?.isContentEditable;

      if (isTyping || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key === "n") {
        event.preventDefault();
        onOpenCreateGoal();
      } else if (event.key === "a" && selectedGoalId) {
        event.preventDefault();
        onOpenAddChild(selectedGoalId);
      } else if (event.key === "p" && selectedGoalId) {
        event.preventDefault();
        onOpenPlanning(selectedGoalId);
      } else if (event.key === "Escape" && selectedGoalId) {
        event.preventDefault();
        onClearSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClearSelection, onOpenAddChild, onOpenCreateGoal, onOpenPlanning, selectedGoalId]);

  if (!hasGoals) {
    return (
      <div className="ghq-graph-empty">
        <div className="ghq-graph-empty__content">
          <span className="ghq-graph-empty__icon">◎</span>
          <h3>No active goals yet</h3>
          <p>Create your first goal to see your planning map come to life.</p>
          <button className="button button--primary button--small" type="button" onClick={onOpenCreateGoal}>
            + New Goal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`ghq-graph${isExpanded ? " ghq-graph--expanded" : ""}`}>
      <div className="ghq-graph__workbar" aria-label="Goal canvas tools">
        <button className="button button--primary button--small" type="button" onClick={onOpenCreateGoal}>
          + New Goal
        </button>
        <label className="ghq-graph__search">
          <span className="sr-only">Search goal canvas</span>
          <input
            type="search"
            value={filters.query}
            placeholder="Search canvas"
            onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
          />
        </label>
        <select
          className="ghq-graph__select"
          value={filters.domainId}
          onChange={(event) => setFilters((current) => ({ ...current, domainId: event.target.value }))}
          aria-label="Filter by domain"
        >
          <option value="">All domains</option>
          {activeDomains.map(([domainId, domain]) => (
            <option key={domainId} value={domainId}>{domain}</option>
          ))}
        </select>
        <select
          className="ghq-graph__select"
          value={filters.horizonId}
          onChange={(event) => setFilters((current) => ({ ...current, horizonId: event.target.value }))}
          aria-label="Filter by planning layer"
        >
          <option value="">All layers</option>
          {activeHorizons.map((horizon) => (
            <option key={horizon.id} value={horizon.id}>{horizon.name}</option>
          ))}
        </select>
        <select
          className="ghq-graph__select"
          value={filters.health}
          onChange={(event) => setFilters((current) => ({ ...current, health: event.target.value }))}
          aria-label="Filter by health"
        >
          <option value="">All health</option>
          <option value="on_track">On track</option>
          <option value="drifting">Drifting</option>
          <option value="stalled">Stalled</option>
          <option value="achieved">Achieved</option>
        </select>
        {hasActiveFilters ? (
          <button
            className="button button--ghost button--small"
            type="button"
            onClick={() => setFilters({ query: "", domainId: "", horizonId: "", health: "" })}
          >
            Clear
          </button>
        ) : null}
        <span className="ghq-graph__match-count">{filterMatchCount} shown</span>
      </div>
      <div className="ghq-graph__toolbar">
        {selectedGoalId ? (
          <div className="ghq-graph__toolbar-group ghq-graph__toolbar-group--selection" aria-label="Selected goal actions">
            <span className="ghq-graph__toolbar-label">Selected</span>
            <button
              className="button button--primary button--small ghq-graph__toolbar-btn"
              type="button"
              onClick={() => onOpenDetails(selectedGoalId)}
            >
              Open details
            </button>
            <button
              className="button button--ghost button--small ghq-graph__toolbar-btn"
              type="button"
              onClick={() => onOpenPlanning(selectedGoalId)}
            >
              Open plan
            </button>
            <button
              className="button button--ghost button--small ghq-graph__toolbar-btn"
              type="button"
              onClick={isFocusMode ? onExitFocusMode : onEnterFocusMode}
              aria-pressed={isFocusMode}
            >
              {isFocusMode ? "Exit focus" : "Focus"}
            </button>
            {selectedGoal ? (
              <label className="ghq-graph__parent-field">
                <span className="sr-only">Move selected goal under</span>
                <select
                  className="ghq-graph__select ghq-graph__parent-select"
                  value={selectedGoal.parentGoalId ?? ""}
                  onChange={(event) => onReparentGoal(selectedGoal.id, event.target.value || null)}
                  aria-label="Move selected goal under"
                >
                  <option value="">Top-level</option>
                  {parentGoalOptions.map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      {goal.title}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        ) : null}
        <div className="ghq-graph__toolbar-group ghq-graph__toolbar-group--view" aria-label="Canvas view actions">
          <button
            className="button button--ghost button--small ghq-graph__toolbar-btn"
            type="button"
            onClick={onExpandAll}
          >
            Expand
          </button>
          <button
            className="button button--ghost button--small ghq-graph__toolbar-btn"
            type="button"
            onClick={onCollapseAll}
          >
            Collapse
          </button>
          {selectedGoalId ? (
            <button
              className="button button--ghost button--small ghq-graph__toolbar-btn"
              type="button"
              onClick={onClearSelection}
            >
              Clear
            </button>
          ) : null}
          <button
            className="button button--ghost button--small ghq-graph__expand-btn"
            type="button"
            onClick={onToggleExpandedCanvas}
            aria-label={isExpanded ? "Exit expanded graph view" : "Expand graph view"}
            aria-pressed={isExpanded}
          >
            {isExpanded ? "Canvas off" : "Canvas"}
          </button>
        </div>
      </div>

      <ReactFlowProvider>
        <GraphInner
          goals={goals}
          horizons={horizons}
          selectedGoalId={selectedGoalId}
          expandedGoalIds={expandedGoalIds}
          isFocusMode={isFocusMode}
          spotlightGoalIds={spotlight.active ? spotlight.relatedGoalIds : null}
          spotlightExactGoalIds={spotlight.exactGoalIds}
          childDraft={childDraft}
          childDraftIsPending={childDraftIsPending}
          monthFocusGoalIds={monthFocusGoalIds}
          weekFocusGoalIds={weekFocusGoalIds}
          onSelectGoal={onSelectGoal}
          onToggleExpanded={onToggleExpanded}
          onOpenAddChild={onOpenAddChild}
          onOpenDetails={onOpenDetails}
          onOpenPlanning={onOpenPlanning}
          onEditGoal={onEditGoal}
          onDetachGoal={onDetachGoal}
          onDuplicateGoal={onDuplicateGoal}
          onArchiveGoal={onArchiveGoal}
          onAddToLane={onAddToLane}
          onDropGoalOnGoal={onDropGoalOnGoal}
          onSaveChildDraft={onSaveChildDraft}
          onCancelChildDraft={onCancelChildDraft}
          isExpanded={isExpanded}
          onCanvasClear={onCanvasClear}
        />
      </ReactFlowProvider>

      {structureError ? (
        <div className="ghq-graph__notice ghq-graph__notice--error">
          <p>{structureError}</p>
        </div>
      ) : null}

      {structureMessage ? (
        <div className="ghq-graph__notice ghq-graph__notice--success">
          <p>{structureMessage}</p>
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
