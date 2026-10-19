import { memo, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Background,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getViewportForBounds,
  useReactFlow,
  useStore,
  useViewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Edge, Node, NodeProps } from "@xyflow/react";

import type {
  GoalHorizonItem,
  GoalOverviewItem,
} from "../../shared/lib/api";
import { EmptyState } from "../../shared/ui/PageState";
import { formatGoalTargetMonth } from "./goal-date-logic";
import {
  buildGoalGraphLayout,
  getGoalTreeOrder,
  NODE_H,
  NODE_W,
  type GoalGraphLane,
} from "./goal-graph-layout";
import { GOAL_DRAG_MIME } from "./GoalsPlanCommitmentsRail";

const MIN_ZOOM = 0.22;
const MAX_ZOOM = 1.35;
const FIT_MAX_ZOOM = 1;
const FIT_PADDING = 0.08;

type GoalNodeActions = {
  onSelect: (goalId: string) => void;
  onToggleExpanded: (goalId: string) => void;
  onOpenAddChild: (goalId: string) => void;
  onOpenDetails: (goalId: string) => void;
  onEditGoal: (goal: GoalOverviewItem) => void;
  onDetachGoal: (goalId: string) => void;
  onDuplicateGoal: (goal: GoalOverviewItem) => void;
  onArchiveGoal: (goal: GoalOverviewItem) => void;
  onAddToLane: (lane: "month" | "week", goalId: string) => void;
  onDropGoalOnGoal: (targetGoalId: string, draggedGoalId: string) => void;
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
  monthSlot: number | null;
  weekSlot: number | null;
  actions: GoalNodeActions;
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

export type CenterRequest = { goalId: string; nonce: number };

const emptyFilters: GraphFilters = { query: "", domainId: "", horizonId: "", health: "" };

const focusGraphGoalNode = (goalId: string) => {
  window.requestAnimationFrame(() => {
    document.querySelector<HTMLElement>(`[data-goal-node-id="${goalId}"]`)?.focus();
  });
};

const isTypingTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  return Boolean(
    element
    && (element.tagName === "INPUT"
      || element.tagName === "TEXTAREA"
      || element.tagName === "SELECT"
      || element.isContentEditable),
  );
};

/* ── Goal node ── */

/* Quiet by default: title, one line of facts, and a slot tag when the goal is
   committed this month or week. Health shows only when it needs attention.
   Add and menu controls appear on hover, focus or selection. */
const GoalGraphNode = memo(function GoalGraphNode({ data }: NodeProps) {
  const d = data as unknown as GoalNodeData;
  const { goal, actions } = d;
  const [isDragOver, setIsDragOver] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const health = goal.health ?? "on_track";
  const facts = [
    goal.domain,
    goal.targetDate
      ? formatGoalTargetMonth(goal.targetDate)
      : goal.milestoneCounts.total > 0
        ? `${goal.milestoneCounts.completed} of ${goal.milestoneCounts.total}`
        : null,
  ].filter(Boolean).join(" · ");

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

  const runMenuAction = (action: () => void) => (event: MouseEvent) => {
    event.stopPropagation();
    setMenuOpen(false);
    action();
  };

  return (
    <div
      ref={nodeRef}
      className={[
        "graph-goal-node",
        "nopan",
        d.isSelected ? "graph-goal-node--selected" : "",
        d.isInBranch ? "graph-goal-node--branch" : "",
        d.isDimmed ? "graph-goal-node--dimmed" : "",
        d.isSpotlightMatch ? "graph-goal-node--spotlight" : "",
        isDragOver ? "graph-goal-node--drop-target" : "",
        menuOpen ? "graph-goal-node--menu-open" : "",
      ].filter(Boolean).join(" ")}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(GOAL_DRAG_MIME, goal.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(GOAL_DRAG_MIME)) {
          return;
        }
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragOver(false);
        const draggedGoalId = event.dataTransfer.getData(GOAL_DRAG_MIME);
        if (draggedGoalId) {
          actions.onDropGoalOnGoal(goal.id, draggedGoalId);
        }
      }}
      onClick={(event) => {
        event.stopPropagation();
        actions.onSelect(goal.id);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        actions.onOpenDetails(goal.id);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        actions.onSelect(goal.id);
        setMenuOpen(true);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) {
          event.preventDefault();
          event.stopPropagation();
          setMenuOpen(false);
          nodeRef.current?.focus();
          return;
        }

        if (event.target !== event.currentTarget) {
          return;
        }

        const handle = (run: () => void) => {
          event.preventDefault();
          event.stopPropagation();
          run();
        };

        if (event.key === " ") {
          handle(() => actions.onSelect(goal.id));
        } else if (event.key === "Enter") {
          handle(() => {
            actions.onSelect(goal.id);
            actions.onOpenDetails(goal.id);
          });
        } else if (event.key === "ArrowRight" && d.canExpand && !d.isExpanded) {
          handle(() => actions.onToggleExpanded(goal.id));
        } else if (event.key === "ArrowLeft" && d.canExpand && d.isExpanded) {
          handle(() => actions.onToggleExpanded(goal.id));
        } else if (event.key === "ArrowDown" && d.nextVisibleGoalId) {
          const nextId = d.nextVisibleGoalId;
          handle(() => {
            actions.onSelect(nextId);
            focusGraphGoalNode(nextId);
          });
        } else if (event.key === "ArrowUp" && d.previousVisibleGoalId) {
          const previousId = d.previousVisibleGoalId;
          handle(() => {
            actions.onSelect(previousId);
            focusGraphGoalNode(previousId);
          });
        }
      }}
      role="treeitem"
      tabIndex={0}
      data-goal-node-id={goal.id}
      aria-label={[
        goal.title,
        goal.domain,
        goal.horizonName,
        d.monthSlot ? `month slot M${d.monthSlot}` : null,
        d.weekSlot ? `week slot W${d.weekSlot}` : null,
        health === "drifting" || health === "stalled" ? health : null,
      ].filter(Boolean).join(", ")}
      aria-level={d.level}
      aria-selected={d.isSelected}
      aria-expanded={d.canExpand ? d.isExpanded : undefined}
    >
      <Handle type="target" position={Position.Top} className="graph-handle--hidden" />
      <span className="graph-goal-node__title">{goal.title}</span>
      <div className="graph-goal-node__meta">
        {health === "stalled" ? (
          <span className="graph-goal-node__health graph-goal-node__health--stalled">Stalled</span>
        ) : health === "drifting" ? (
          <span
            className="graph-goal-node__health graph-goal-node__health--drifting"
            title="Drifting: nothing linked to this goal was completed in the last 7 days"
          />
        ) : health === "achieved" ? (
          <span className="graph-goal-node__health graph-goal-node__health--achieved">Achieved</span>
        ) : null}
        <span className="graph-goal-node__facts">{facts}</span>
        <span className="graph-goal-node__tags">
          {d.monthSlot ? <span className="graph-goal-node__slot">M{d.monthSlot}</span> : null}
          {d.weekSlot ? <span className="graph-goal-node__slot">W{d.weekSlot}</span> : null}
          {d.canExpand ? (
            <button
              className={`graph-goal-node__branch-toggle${d.isExpanded ? " graph-goal-node__branch-toggle--open" : ""}`}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                actions.onToggleExpanded(goal.id);
              }}
              aria-label={d.isExpanded ? `Collapse ${d.childCount} sub-goals` : `Expand ${d.childCount} sub-goals`}
              title={d.isExpanded ? "Collapse sub-goals" : "Expand sub-goals"}
            >
              <svg className="graph-goal-node__branch-icon" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M5.5 3.5L10 8l-4.5 4.5" />
              </svg>
              <span>{d.childCount}</span>
            </button>
          ) : null}
        </span>
      </div>
      {goal.progressPercent > 0 ? (
        <div className="graph-goal-node__bar" aria-hidden="true">
          <div className="graph-goal-node__bar-fill" style={{ width: `${Math.min(goal.progressPercent, 100)}%` }} />
        </div>
      ) : null}
      <div className="graph-goal-node__controls">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            actions.onOpenAddChild(goal.id);
          }}
          aria-label={`Add sub-goal under ${goal.title}`}
          title="Add sub-goal (A)"
        >
          +
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            actions.onSelect(goal.id);
            setMenuOpen((current) => !current);
          }}
          aria-label={`More actions for ${goal.title}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title="More actions"
        >
          ⋯
        </button>
      </div>
      {menuOpen ? (
        <div className="graph-goal-node__menu" role="menu">
          <button type="button" role="menuitem" onClick={runMenuAction(() => actions.onOpenDetails(goal.id))}>
            Open details
          </button>
          <button type="button" role="menuitem" onClick={runMenuAction(() => actions.onOpenAddChild(goal.id))}>
            Add sub-goal
          </button>
          <button type="button" role="menuitem" onClick={runMenuAction(() => actions.onAddToLane("month", goal.id))}>
            {d.monthSlot ? `In month as M${d.monthSlot}` : "Add to month"}
          </button>
          <button type="button" role="menuitem" onClick={runMenuAction(() => actions.onAddToLane("week", goal.id))}>
            {d.weekSlot ? `In week as W${d.weekSlot}` : "Add to week"}
          </button>
          <button type="button" role="menuitem" onClick={runMenuAction(() => actions.onEditGoal(goal))}>
            Edit goal
          </button>
          <button type="button" role="menuitem" onClick={runMenuAction(() => actions.onDuplicateGoal(goal))}>
            Duplicate
          </button>
          {goal.parentGoalId ? (
            <button type="button" role="menuitem" onClick={runMenuAction(() => actions.onDetachGoal(goal.id))}>
              Make top-level
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className="graph-goal-node__menu-danger"
            onClick={runMenuAction(() => actions.onArchiveGoal(goal))}
          >
            Archive
          </button>
        </div>
      ) : null}
      {isDragOver ? <div className="graph-goal-node__drop-hint">Drop to move under this goal</div> : null}
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
      inputRef.current?.focus();
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
        placeholder="Sub-goal title"
        aria-label="Sub-goal title"
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            d.onCancel();
            return;
          }

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
          {d.isPending ? "Saving…" : "Save"}
        </button>
        <button className="button button--ghost button--small" type="button" onClick={d.onCancel} disabled={d.isPending}>
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

/* ── Filters and spotlight ── */

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
  const hasActiveFilters = Boolean(filters.query.trim() || filters.domainId || filters.horizonId || filters.health);

  if (!hasActiveFilters) {
    return { active: false, exactGoalIds: new Set(), relatedGoalIds: new Set() };
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

  return { active: true, exactGoalIds, relatedGoalIds };
};

/* ── Node animation and stable edges ── */

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const useAnimatedNodes = (nodes: Node[], disabled = false) => {
  const [animatedNodes, setAnimatedNodes] = useState(nodes);
  const displayedNodesRef = useRef(nodes);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    displayedNodesRef.current = animatedNodes;
  }, [animatedNodes]);

  useEffect(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sourceById = new Map(displayedNodesRef.current.map((node) => [node.id, node]));
    const hasPositionChanges = nodes.some((node) => {
      const source = sourceById.get(node.id);
      return Boolean(source && (source.position.x !== node.position.x || source.position.y !== node.position.y));
    });

    if (disabled || prefersReducedMotion || !hasPositionChanges) {
      displayedNodesRef.current = nodes;
      setAnimatedNodes(nodes);
      return;
    }

    const start = window.performance.now();
    const duration = 240;

    const tick = (timestamp: number) => {
      const eased = easeOutCubic(Math.min((timestamp - start) / duration, 1));
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

      if (eased < 1) {
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

const edgeMatches = (left: Edge, right: Edge) =>
  left.id === right.id
  && left.source === right.source
  && left.target === right.target
  && left.className === right.className;

const useStableEdges = (edges: Edge[]) => {
  const stableEdgesRef = useRef(edges);

  return useMemo(() => {
    const previousEdges = stableEdgesRef.current;
    if (previousEdges.length === edges.length && previousEdges.every((edge, index) => edgeMatches(edge, edges[index]))) {
      return previousEdges;
    }
    stableEdgesRef.current = edges;
    return edges;
  }, [edges]);
};

/* ── Horizon lanes ── */

/* Bands sit behind the flow and labels sit in a gutter, both following the
   viewport's vertical pan and zoom, so a lane's name stays readable however
   far the map is panned sideways. */
function LaneBands({ lanes }: { lanes: GoalGraphLane[] }) {
  const { y, zoom } = useViewport();

  return (
    <div className="ghq-lanes" aria-hidden="true">
      {lanes.map((lane, index) => (
        <div
          key={lane.id}
          className={[
            "ghq-lanes__band",
            index % 2 === 1 ? "ghq-lanes__band--alt" : "",
            lane.isUnassigned ? "ghq-lanes__band--unassigned" : "",
          ].filter(Boolean).join(" ")}
          style={{ transform: `translateY(${lane.top * zoom + y}px)`, height: lane.height * zoom }}
        />
      ))}
    </div>
  );
}

function LaneGutter({ lanes }: { lanes: GoalGraphLane[] }) {
  const { y, zoom } = useViewport();

  return (
    <div className="ghq-lanes-gutter" aria-label="Planning layers">
      {lanes.map((lane, index) => (
        <div
          key={lane.id}
          className={[
            "ghq-lanes-gutter__lane",
            index % 2 === 1 ? "ghq-lanes-gutter__lane--alt" : "",
            lane.isUnassigned ? "ghq-lanes-gutter__lane--unassigned" : "",
          ].filter(Boolean).join(" ")}
          style={{ transform: `translateY(${lane.top * zoom + y}px)`, height: lane.height * zoom }}
        >
          <span className="ghq-lanes-gutter__name">{lane.label}</span>
          <span className="ghq-lanes-gutter__count">{lane.goalCount}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Canvas ── */

type GraphCanvasProps = {
  activeGoals: GoalOverviewItem[];
  horizons: GoalHorizonItem[];
  selectedGoalId: string | null;
  expandedGoalIds: Set<string>;
  spotlight: SpotlightState;
  childDraft: ChildDraft | null;
  childDraftIsPending: boolean;
  monthSlotByGoalId: Map<string, number>;
  weekSlotByGoalId: Map<string, number>;
  isFullscreen: boolean;
  centerRequest: CenterRequest | null;
  actions: GoalNodeActions;
  onSaveChildDraft: (title: string) => void;
  onCancelChildDraft: () => void;
  onCanvasClear: () => void;
};

function GraphCanvas({
  activeGoals,
  horizons,
  selectedGoalId,
  expandedGoalIds,
  spotlight,
  childDraft,
  childDraftIsPending,
  monthSlotByGoalId,
  weekSlotByGoalId,
  isFullscreen,
  centerRequest,
  actions,
  onSaveChildDraft,
  onCancelChildDraft,
  onCanvasClear,
}: GraphCanvasProps) {
  const { setViewport, setCenter, getZoom, zoomIn, zoomOut } = useReactFlow();
  const flowWidth = useStore((state) => state.width);
  const flowHeight = useStore((state) => state.height);
  const initialFitDoneRef = useRef(false);
  const handledCenterNonceRef = useRef<number | null>(null);

  const layout = useMemo(
    () => buildGoalGraphLayout({
      goals: activeGoals,
      horizons,
      expandedGoalIds,
      draft: childDraft ? { parentGoalId: childDraft.parentGoalId, horizonId: childDraft.horizonId } : null,
    }),
    [activeGoals, childDraft, expandedGoalIds, horizons],
  );

  const branchIds = useMemo(() => {
    const ids = new Set<string>();
    if (!selectedGoalId) {
      return ids;
    }
    const visible = new Set(layout.visibleGoalIds);
    let current = layout.goalMap.get(selectedGoalId) ?? null;
    while (current) {
      if (visible.has(current.id)) ids.add(current.id);
      current = current.parentGoalId ? layout.goalMap.get(current.parentGoalId) ?? null : null;
    }
    const stack = [selectedGoalId];
    while (stack.length > 0) {
      const goalId = stack.pop()!;
      if (visible.has(goalId)) ids.add(goalId);
      for (const child of layout.childrenByParent.get(goalId) ?? []) {
        if (visible.has(child.id)) stack.push(child.id);
      }
    }
    return ids;
  }, [layout, selectedGoalId]);

  const nodes = useMemo<Node[]>(() => {
    const indexById = new Map(layout.visibleGoalIds.map((goalId, index) => [goalId, index]));

    return layout.items.map((item) => {
      if (item.kind === "draft") {
        return {
          id: item.id,
          type: "childDraftNode",
          position: { x: item.x, y: item.y },
          zIndex: 70,
          data: {
            initialTitle: childDraft?.title ?? "",
            isPending: childDraftIsPending,
            onSave: onSaveChildDraft,
            onCancel: onCancelChildDraft,
          } satisfies ChildDraftNodeData,
          selectable: false,
          draggable: false,
        };
      }

      const index = indexById.get(item.id) ?? -1;
      const childCount = layout.childrenByParent.get(item.id)?.length ?? 0;
      return {
        id: item.id,
        type: "goalNode",
        position: { x: item.x, y: item.y },
        zIndex: selectedGoalId === item.id ? 80 : branchIds.has(item.id) ? 20 : 1,
        data: {
          goal: item.goal,
          level: item.depth + 1,
          isSelected: selectedGoalId === item.id,
          isInBranch: branchIds.has(item.id),
          isDimmed: spotlight.active && !spotlight.relatedGoalIds.has(item.id),
          isSpotlightMatch: spotlight.exactGoalIds.has(item.id),
          canExpand: childCount > 0,
          isExpanded: expandedGoalIds.has(item.id),
          previousVisibleGoalId: index > 0 ? layout.visibleGoalIds[index - 1] : null,
          nextVisibleGoalId: index >= 0 ? layout.visibleGoalIds[index + 1] ?? null : null,
          childCount,
          monthSlot: monthSlotByGoalId.get(item.id) ?? null,
          weekSlot: weekSlotByGoalId.get(item.id) ?? null,
          actions,
        } satisfies GoalNodeData,
        selectable: false,
        draggable: false,
      };
    });
  }, [
    actions,
    branchIds,
    childDraft?.title,
    childDraftIsPending,
    expandedGoalIds,
    layout,
    monthSlotByGoalId,
    onCancelChildDraft,
    onSaveChildDraft,
    selectedGoalId,
    spotlight,
    weekSlotByGoalId,
  ]);

  const edges = useMemo<Edge[]>(
    () => layout.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: "smoothstep",
      className:
        edge.kind === "draft"
          ? "ghq-edge ghq-edge--draft"
          : branchIds.has(edge.source) && branchIds.has(edge.target)
            ? "ghq-edge ghq-edge--branch"
            : spotlight.active && !(spotlight.relatedGoalIds.has(edge.source) && spotlight.relatedGoalIds.has(edge.target))
              ? "ghq-edge ghq-edge--dimmed"
              : "ghq-edge",
    })),
    [branchIds, layout.edges, spotlight],
  );

  const animatedNodes = useAnimatedNodes(nodes, Boolean(childDraft));
  const stableEdges = useStableEdges(edges);

  const bounds = useMemo(() => {
    if (layout.items.length === 0) {
      return null;
    }
    const xs = layout.items.map((item) => item.x);
    const ys = layout.items.map((item) => item.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs) + NODE_W;
    const lastLane = layout.lanes.at(-1);
    const minY = layout.lanes.length > 0 ? layout.lanes[0].top : Math.min(...ys);
    const maxY = lastLane ? lastLane.top + lastLane.height : Math.max(...ys) + NODE_H;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, [layout]);

  const fitMap = useCallback(
    (duration: number) => {
      if (!bounds || !flowWidth || !flowHeight) {
        return;
      }
      void setViewport(
        getViewportForBounds(bounds, flowWidth, flowHeight, MIN_ZOOM, FIT_MAX_ZOOM, FIT_PADDING),
        { duration },
      );
    },
    [bounds, flowHeight, flowWidth, setViewport],
  );
  const fitMapRef = useRef(fitMap);
  fitMapRef.current = fitMap;

  useEffect(() => {
    if (initialFitDoneRef.current || !bounds || !flowWidth || !flowHeight) {
      return;
    }
    initialFitDoneRef.current = true;
    fitMap(0);
  }, [bounds, fitMap, flowHeight, flowWidth]);

  // Entering or leaving full screen resizes the canvas; refit once it settles.
  const previousFullscreenRef = useRef(isFullscreen);
  useEffect(() => {
    if (previousFullscreenRef.current === isFullscreen) {
      return;
    }
    previousFullscreenRef.current = isFullscreen;
    const timeoutId = window.setTimeout(() => fitMapRef.current(200), 120);
    return () => window.clearTimeout(timeoutId);
  }, [isFullscreen]);

  useEffect(() => {
    if (!centerRequest || handledCenterNonceRef.current === centerRequest.nonce) {
      return;
    }
    const item = layout.items.find((candidate) => candidate.id === centerRequest.goalId);
    if (!item) {
      return;
    }
    handledCenterNonceRef.current = centerRequest.nonce;
    void setCenter(item.x + NODE_W / 2, item.y + NODE_H / 2, {
      zoom: Math.max(getZoom(), 0.85),
      duration: 260,
    });
  }, [centerRequest, getZoom, layout.items, setCenter]);

  const centerSelectedGoal = useCallback(() => {
    const item = selectedGoalId ? layout.items.find((candidate) => candidate.id === selectedGoalId) : null;
    if (!item) {
      fitMap(220);
      return;
    }
    void setCenter(item.x + NODE_W / 2, item.y + NODE_H / 2, { zoom: Math.max(getZoom(), 0.85), duration: 220 });
  }, [fitMap, getZoom, layout.items, selectedGoalId, setCenter]);

  return (
    <div className="ghq-graph__canvas">
      {layout.lanes.length > 0 ? <LaneGutter lanes={layout.lanes} /> : null}
      <div className="ghq-graph__flow" role="tree" aria-label="Goal map">
        {layout.lanes.length > 0 ? <LaneBands lanes={layout.lanes} /> : null}
        <ReactFlow
          nodes={animatedNodes}
          edges={stableEdges}
          nodeTypes={nodeTypes}
          onPaneClick={onCanvasClear}
          panOnScroll
          zoomOnScroll={false}
          nodesConnectable={false}
          nodesDraggable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="var(--wash-3)" gap={40} size={1} />
        </ReactFlow>
        <div className="ghq-graph__viewport-controls nopan" aria-label="Map view controls">
          <button type="button" onClick={() => void zoomOut({ duration: 180 })} aria-label="Zoom out">
            −
          </button>
          <button type="button" onClick={() => void zoomIn({ duration: 180 })} aria-label="Zoom in">
            +
          </button>
          <button type="button" onClick={() => fitMap(220)}>
            Fit
          </button>
          {selectedGoalId ? (
            <button type="button" onClick={centerSelectedGoal}>
              Center
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ── Toolbar pieces ── */

function FilterMenu({
  filters,
  domains,
  horizons,
  onChange,
}: {
  filters: GraphFilters;
  domains: Array<[string, string]>;
  horizons: GoalHorizonItem[];
  onChange: (updates: Partial<GraphFilters>) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeCount = [filters.domainId, filters.horizonId, filters.health].filter(Boolean).length;

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as globalThis.Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  return (
    <div
      className="ghq-filter-menu"
      ref={containerRef}
      onKeyDown={(event) => {
        if (event.key === "Escape" && isOpen) {
          event.preventDefault();
          event.stopPropagation();
          setIsOpen(false);
        }
      }}
    >
      <button
        className={`button button--ghost button--small${activeCount > 0 ? " ghq-filter-menu__trigger--active" : ""}`}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        Filter{activeCount > 0 ? <span className="ghq-filter-menu__count">{activeCount}</span> : null}
      </button>
      {isOpen ? (
        <div className="ghq-filter-menu__panel">
          <label className="ghq-filter-menu__field">
            <span>Domain</span>
            <select
              className="ghq-planning-form__select"
              value={filters.domainId}
              onChange={(event) => onChange({ domainId: event.target.value })}
            >
              <option value="">All domains</option>
              {domains.map(([domainId, domain]) => (
                <option key={domainId} value={domainId}>{domain}</option>
              ))}
            </select>
          </label>
          <label className="ghq-filter-menu__field">
            <span>Planning layer</span>
            <select
              className="ghq-planning-form__select"
              value={filters.horizonId}
              onChange={(event) => onChange({ horizonId: event.target.value })}
            >
              <option value="">All layers</option>
              {horizons.map((horizon) => (
                <option key={horizon.id} value={horizon.id}>{horizon.name}</option>
              ))}
            </select>
          </label>
          <label className="ghq-filter-menu__field">
            <span>Health</span>
            <select
              className="ghq-planning-form__select"
              value={filters.health}
              onChange={(event) => onChange({ health: event.target.value })}
            >
              <option value="">Any health</option>
              <option value="on_track">On track</option>
              <option value="drifting">Drifting</option>
              <option value="stalled">Stalled</option>
              <option value="achieved">Achieved</option>
            </select>
          </label>
          {activeCount > 0 ? (
            <button
              className="ghq-rail__text-btn"
              type="button"
              onClick={() => onChange({ domainId: "", horizonId: "", health: "" })}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DisplayFullscreenButton() {
  const [isDisplayFullscreen, setIsDisplayFullscreen] = useState(() => Boolean(document.fullscreenElement));

  useEffect(() => {
    const handleChange = () => setIsDisplayFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  if (!document.fullscreenEnabled) {
    return null;
  }

  return (
    <button
      className="button button--ghost button--small ghq-toolbar__icon-btn"
      type="button"
      onClick={() => {
        if (document.fullscreenElement) {
          void document.exitFullscreen().catch(() => undefined);
        } else {
          void document.documentElement.requestFullscreen().catch(() => undefined);
        }
      }}
      aria-pressed={isDisplayFullscreen}
      aria-label={isDisplayFullscreen ? "Leave the whole display" : "Use the whole display"}
      title={isDisplayFullscreen ? "Leave the whole display" : "Use the whole display (hides the browser)"}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        {isDisplayFullscreen ? (
          <path d="M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4" />
        ) : (
          <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" />
        )}
      </svg>
    </button>
  );
}

const shortcutRows: Array<[string[], string]> = [
  [["N"], "New goal"],
  [["A"], "Add a sub-goal to the selected goal"],
  [["M"], "Add the selected goal to this month"],
  [["W"], "Add the selected goal to this week"],
  [["Enter"], "Open details (or double-click)"],
  [["↑", "↓"], "Move between goals"],
  [["←", "→"], "Collapse or expand sub-goals"],
  [["/"], "Search; Enter jumps to the next match"],
  [["F"], "Full screen"],
  [["Esc"], "Close details, clear selection, leave full screen"],
  [["?"], "Show or hide this list"],
];

function ShortcutSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="ghq-shortcuts" role="dialog" aria-label="Keyboard shortcuts and legend">
      <div className="ghq-shortcuts__header">
        <h3>Keyboard shortcuts</h3>
        <button className="ghq-rail__text-btn" type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <dl className="ghq-shortcuts__list">
        {shortcutRows.map(([keys, label]) => (
          <div key={label} className="ghq-shortcuts__row">
            <dt>
              {keys.map((key) => (
                <kbd key={key}>{key}</kbd>
              ))}
            </dt>
            <dd>{label}</dd>
          </div>
        ))}
      </dl>
      <h3 className="ghq-shortcuts__subhead">On the map</h3>
      <dl className="ghq-shortcuts__list">
        <div className="ghq-shortcuts__row">
          <dt><span className="graph-goal-node__slot">M1</span></dt>
          <dd>Committed to this month (W for this week)</dd>
        </div>
        <div className="ghq-shortcuts__row">
          <dt><span className="graph-goal-node__health graph-goal-node__health--drifting" /></dt>
          <dd>Drifting: nothing linked was completed in 7 days</dd>
        </div>
        <div className="ghq-shortcuts__row">
          <dt><span className="graph-goal-node__health graph-goal-node__health--stalled">Stalled</span></dt>
          <dd>No progress in 14 days and a date has passed</dd>
        </div>
        <div className="ghq-shortcuts__row">
          <dt><span className="ghq-shortcuts__lane-sample" /></dt>
          <dd>Rows are planning layers, set in Settings</dd>
        </div>
      </dl>
    </div>
  );
}

/* ── Main view ── */

export type GoalsPlanGraphViewProps = {
  goals: GoalOverviewItem[];
  horizons: GoalHorizonItem[];
  selectedGoalId: string | null;
  expandedGoalIds: Set<string>;
  childDraft: ChildDraft | null;
  childDraftIsPending: boolean;
  monthSlotByGoalId: Map<string, number>;
  weekSlotByGoalId: Map<string, number>;
  structureError: string | null;
  structureMessage: string | null;
  isFullscreen: boolean;
  centerRequest: CenterRequest | null;
  viewSwitch: ReactNode;
  onSelectGoal: (goalId: string) => void;
  onToggleExpanded: (goalId: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onOpenCreateGoal: () => void;
  onOpenAddChild: (goalId: string) => void;
  onOpenDetails: (goalId: string) => void;
  onEditGoal: (goal: GoalOverviewItem) => void;
  onDetachGoal: (goalId: string) => void;
  onDuplicateGoal: (goal: GoalOverviewItem) => void;
  onArchiveGoal: (goal: GoalOverviewItem) => void;
  onAddToLane: (lane: "month" | "week", goalId: string) => void;
  onDropGoalOnGoal: (targetGoalId: string, draggedGoalId: string) => void;
  onSaveChildDraft: (title: string) => void;
  onCancelChildDraft: () => void;
  onCanvasClear: () => void;
  onRevealGoal: (goalId: string) => void;
  onRequestCenter: (goalId: string) => void;
  onEscape: () => void;
  onToggleFullscreen: () => void;
};

export const GoalsPlanGraphView = ({
  goals,
  horizons,
  selectedGoalId,
  expandedGoalIds,
  childDraft,
  childDraftIsPending,
  monthSlotByGoalId,
  weekSlotByGoalId,
  structureError,
  structureMessage,
  isFullscreen,
  centerRequest,
  viewSwitch,
  onSelectGoal,
  onToggleExpanded,
  onExpandAll,
  onCollapseAll,
  onOpenCreateGoal,
  onOpenAddChild,
  onOpenDetails,
  onEditGoal,
  onDetachGoal,
  onDuplicateGoal,
  onArchiveGoal,
  onAddToLane,
  onDropGoalOnGoal,
  onSaveChildDraft,
  onCancelChildDraft,
  onCanvasClear,
  onRevealGoal,
  onRequestCenter,
  onEscape,
  onToggleFullscreen,
}: GoalsPlanGraphViewProps) => {
  const [filters, setFilters] = useState<GraphFilters>(emptyFilters);
  const [matchIndex, setMatchIndex] = useState(-1);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const activeGoals = useMemo(() => goals.filter((goal) => goal.status === "active"), [goals]);
  const activeDomains = useMemo(() => {
    const domainMap = new Map<string, string>();
    for (const goal of activeGoals) {
      domainMap.set(goal.domainId, goal.domain);
    }
    return [...domainMap.entries()].sort((left, right) => left[1].localeCompare(right[1]));
  }, [activeGoals]);
  const activeHorizons = useMemo(
    () => horizons.filter((horizon) => !horizon.isArchived).sort((left, right) => left.sortOrder - right.sortOrder),
    [horizons],
  );
  const spotlight = useMemo(() => buildSpotlightState(activeGoals, filters), [activeGoals, filters]);
  const treeOrder = useMemo(() => getGoalTreeOrder(activeGoals), [activeGoals]);
  const hasQuery = filters.query.trim().length > 0;
  const matchIds = useMemo(
    () => (hasQuery ? treeOrder.filter((goalId) => spotlight.exactGoalIds.has(goalId)) : []),
    [hasQuery, spotlight.exactGoalIds, treeOrder],
  );
  const goalIdsWithChildren = useMemo(
    () => new Set(activeGoals.flatMap((goal) => (goal.parentGoalId ? [goal.parentGoalId] : []))),
    [activeGoals],
  );
  const allExpanded = [...goalIdsWithChildren].every((goalId) => expandedGoalIds.has(goalId));

  const actions = useMemo<GoalNodeActions>(
    () => ({
      onSelect: onSelectGoal,
      onToggleExpanded,
      onOpenAddChild,
      onOpenDetails,
      onEditGoal,
      onDetachGoal,
      onDuplicateGoal,
      onArchiveGoal,
      onAddToLane,
      onDropGoalOnGoal,
    }),
    [
      onAddToLane,
      onArchiveGoal,
      onDetachGoal,
      onDropGoalOnGoal,
      onDuplicateGoal,
      onEditGoal,
      onOpenAddChild,
      onOpenDetails,
      onSelectGoal,
      onToggleExpanded,
    ],
  );

  const jumpToMatch = useCallback(
    (direction: 1 | -1) => {
      if (matchIds.length === 0) {
        return;
      }
      const nextIndex = matchIndex < 0
        ? (direction === 1 ? 0 : matchIds.length - 1)
        : (matchIndex + direction + matchIds.length) % matchIds.length;
      const goalId = matchIds[nextIndex];
      setMatchIndex(nextIndex);
      onRevealGoal(goalId);
      onSelectGoal(goalId);
      onRequestCenter(goalId);
    },
    [matchIds, matchIndex, onRequestCenter, onRevealGoal, onSelectGoal],
  );

  // One keyboard map for the whole Plan map. Inputs, the goal form and open
  // menus handle their own keys first.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      // Modals (goal form, quick capture) and other dialogs own their keys.
      if (
        document.querySelector("[aria-modal=\"true\"]")
        || (event.target instanceof Element && event.target.closest("[role=\"dialog\"]:not(.ghq-shortcuts)"))
      ) {
        return;
      }

      const typing = isTypingTarget(event.target);

      if (event.key === "Escape") {
        if (typing) {
          return;
        }
        event.preventDefault();
        if (isShortcutsOpen) {
          setIsShortcutsOpen(false);
          return;
        }
        onEscape();
        return;
      }

      if (typing) {
        return;
      }

      const run = (action: () => void) => {
        event.preventDefault();
        action();
      };

      switch (event.key) {
        case "n":
          run(onOpenCreateGoal);
          break;
        case "a":
          if (selectedGoalId) run(() => onOpenAddChild(selectedGoalId));
          break;
        case "m":
          if (selectedGoalId) run(() => onAddToLane("month", selectedGoalId));
          break;
        case "w":
          if (selectedGoalId) run(() => onAddToLane("week", selectedGoalId));
          break;
        case "f":
          run(onToggleFullscreen);
          break;
        case "/":
          run(() => searchRef.current?.focus());
          break;
        case "?":
          run(() => setIsShortcutsOpen((current) => !current));
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isShortcutsOpen, onAddToLane, onEscape, onOpenAddChild, onOpenCreateGoal, onToggleFullscreen, selectedGoalId]);

  if (activeGoals.length === 0) {
    return (
      <div className="ghq-graph ghq-graph--empty">
        <div className="ghq-toolbar">
          <div className="ghq-toolbar__group">{viewSwitch}</div>
        </div>
        <div className="ghq-graph-empty">
          <EmptyState
            title="Map your first goal"
            description="Start with something big, like a five-year direction. You can break it down into yearly and quarterly goals here."
            actionLabel="+ New goal"
            onAction={onOpenCreateGoal}
          />
        </div>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="ghq-graph">
        <div className="ghq-toolbar">
          <div className="ghq-toolbar__group">
            {viewSwitch}
            <label className="ghq-toolbar__search">
              <span className="sr-only">Search goals</span>
              <input
                ref={searchRef}
                type="search"
                value={filters.query}
                placeholder="Search goals"
                onChange={(event) => {
                  setMatchIndex(-1);
                  setFilters((current) => ({ ...current, query: event.target.value }));
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    jumpToMatch(event.shiftKey ? -1 : 1);
                  } else if (event.key === "ArrowDown") {
                    event.preventDefault();
                    jumpToMatch(1);
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    jumpToMatch(-1);
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    if (filters.query) {
                      setMatchIndex(-1);
                      setFilters((current) => ({ ...current, query: "" }));
                    } else {
                      searchRef.current?.blur();
                    }
                  }
                }}
              />
              {hasQuery ? (
                <span className="ghq-toolbar__match-count" aria-live="polite">
                  {matchIds.length === 0
                    ? "No matches"
                    : matchIndex >= 0
                      ? `${matchIndex + 1} of ${matchIds.length}`
                      : `${matchIds.length} found`}
                </span>
              ) : null}
            </label>
            <FilterMenu
              filters={filters}
              domains={activeDomains}
              horizons={activeHorizons}
              onChange={(updates) => setFilters((current) => ({ ...current, ...updates }))}
            />
          </div>
          <div className="ghq-toolbar__group ghq-toolbar__group--end">
            {goalIdsWithChildren.size > 0 ? (
              <button
                className="button button--ghost button--small"
                type="button"
                onClick={allExpanded ? onCollapseAll : onExpandAll}
              >
                {allExpanded ? "Collapse all" : "Expand all"}
              </button>
            ) : null}
            <button
              className="button button--ghost button--small ghq-toolbar__icon-btn"
              type="button"
              onClick={() => setIsShortcutsOpen((current) => !current)}
              aria-expanded={isShortcutsOpen}
              aria-label="Keyboard shortcuts and legend"
              title="Keyboard shortcuts (?)"
            >
              ?
            </button>
            {isFullscreen ? <DisplayFullscreenButton /> : null}
            <button
              className="button button--ghost button--small"
              type="button"
              onClick={onToggleFullscreen}
              aria-pressed={isFullscreen}
              title={isFullscreen ? "Leave full screen (F or Esc)" : "Full screen (F)"}
            >
              {isFullscreen ? "Exit full screen" : "Full screen"}
            </button>
            <button className="button button--primary button--small" type="button" onClick={onOpenCreateGoal}>
              + New goal
            </button>
          </div>
        </div>

        <div className="ghq-graph__body">
          <GraphCanvas
            activeGoals={activeGoals}
            horizons={horizons}
            selectedGoalId={selectedGoalId}
            expandedGoalIds={expandedGoalIds}
            spotlight={spotlight}
            childDraft={childDraft}
            childDraftIsPending={childDraftIsPending}
            monthSlotByGoalId={monthSlotByGoalId}
            weekSlotByGoalId={weekSlotByGoalId}
            isFullscreen={isFullscreen}
            centerRequest={centerRequest}
            actions={actions}
            onSaveChildDraft={onSaveChildDraft}
            onCancelChildDraft={onCancelChildDraft}
            onCanvasClear={onCanvasClear}
          />

          {isShortcutsOpen ? <ShortcutSheet onClose={() => setIsShortcutsOpen(false)} /> : null}

          {structureError || structureMessage ? (
            <div
              className={`ghq-graph__notice${structureError ? " ghq-graph__notice--error" : ""}`}
              role={structureError ? "alert" : "status"}
            >
              <p>{structureError ?? structureMessage}</p>
            </div>
          ) : null}

          {activeHorizons.length === 0 ? (
            <p className="ghq-graph__hint">
              <Link to="/settings#planning-layers">Add planning layers</Link> to see goals by time horizon.
            </p>
          ) : null}
        </div>
      </div>
    </ReactFlowProvider>
  );
};
