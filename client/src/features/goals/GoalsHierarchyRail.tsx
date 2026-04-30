import { useState } from "react";

import type {
  GoalHorizonItem,
  GoalOverviewItem,
} from "../../shared/lib/api";

export type HierarchyNode = GoalOverviewItem & {
  childNodes: HierarchyNode[];
};

export function getRootGoalIds(goals: GoalOverviewItem[]) {
  const goalIds = new Set(goals.map((goal) => goal.id));
  return goals
    .filter((goal) => !goal.parentGoalId || !goalIds.has(goal.parentGoalId))
    .map((goal) => goal.id);
}

export function buildHierarchyTree(goals: GoalOverviewItem[]): HierarchyNode[] {
  const nodeMap = new Map<string, HierarchyNode>();
  const roots: HierarchyNode[] = [];

  for (const goal of goals) {
    nodeMap.set(goal.id, { ...goal, childNodes: [] });
  }

  for (const goal of goals) {
    const node = nodeMap.get(goal.id)!;
    if (goal.parentGoalId && nodeMap.has(goal.parentGoalId)) {
      nodeMap.get(goal.parentGoalId)!.childNodes.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function sortByHorizon(goals: HierarchyNode[], horizons: GoalHorizonItem[]): HierarchyNode[] {
  const horizonOrder = new Map(horizons.map((h, i) => [h.id, i]));
  return [...goals].sort((a, b) => {
    const aOrder = a.horizonId ? (horizonOrder.get(a.horizonId) ?? 999) : 999;
    const bOrder = b.horizonId ? (horizonOrder.get(b.horizonId) ?? 999) : 999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.sortOrder - b.sortOrder;
  });
}

export function HierarchyRail({
  roots,
  horizons,
  selectedGoalId,
  onSelectGoal,
  depth = 0,
}: {
  roots: HierarchyNode[];
  horizons: GoalHorizonItem[];
  selectedGoalId: string | null;
  onSelectGoal: (goalId: string) => void;
  depth?: number;
}) {
  const sorted = sortByHorizon(roots, horizons);

  return (
    <div className={`ghq-tree${depth === 0 ? " ghq-tree--root" : ""}`}>
      {sorted.map((node) => (
        <HierarchyNodeRow
          key={node.id}
          node={node}
          horizons={horizons}
          selectedGoalId={selectedGoalId}
          onSelectGoal={onSelectGoal}
          depth={depth}
        />
      ))}
    </div>
  );
}

function HierarchyNodeRow({
  node,
  horizons,
  selectedGoalId,
  onSelectGoal,
  depth,
}: {
  node: HierarchyNode;
  horizons: GoalHorizonItem[];
  selectedGoalId: string | null;
  onSelectGoal: (goalId: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const isSelected = selectedGoalId === node.id;
  const hasChildren = node.childNodes.length > 0;
  const healthState = node.health ?? "on_track";

  return (
    <div className="ghq-tree-node">
      <div
        className={`ghq-tree-node__row${isSelected ? " ghq-tree-node__row--selected" : ""}`}
        style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
      >
        {hasChildren ? (
          <button
            className="ghq-tree-node__toggle"
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="ghq-tree-node__spacer" />
        )}
        <button
          className="ghq-tree-node__btn"
          type="button"
          onClick={() => onSelectGoal(node.id)}
        >
          <span className={`ghq-tree-node__health ghq-tree-node__health--${healthState}`} />
          <span className="ghq-tree-node__title">{node.title}</span>
          {node.horizonName && (
            <span className="ghq-tree-node__horizon">{node.horizonName}</span>
          )}
        </button>
      </div>
      {hasChildren && expanded && (
        <HierarchyRail
          roots={node.childNodes}
          horizons={horizons}
          selectedGoalId={selectedGoalId}
          onSelectGoal={onSelectGoal}
          depth={depth + 1}
        />
      )}
    </div>
  );
}
