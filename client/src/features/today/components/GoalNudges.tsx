import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { GoalNudgeItem, LinkedGoal } from "../../../shared/lib/api";
import { GoalProgressBar, HealthBadge } from "../../goals/GoalDetailPanel";
import type { EditablePriority } from "../hooks/usePriorityDraft";

function GoalChip({ goal }: { goal: LinkedGoal }) {
  return (
    <Link to="/goals" className="goal-chip">
      <span className={`goal-chip__dot goal-chip__dot--${goal.domain}`} />
      <span>{goal.title}</span>
    </Link>
  );
}

export function GoalNudges({
  nudges,
  priorityDraft,
  canAdd,
  onAdd,
}: {
  nudges: GoalNudgeItem[];
  priorityDraft: EditablePriority[];
  canAdd: boolean;
  onAdd: (nudge: GoalNudgeItem) => void;
}) {
  const visible = useMemo(() => {
    const linkedGoalIds = new Set(
      priorityDraft.flatMap((p) => (p.goalId ? [p.goalId] : [])),
    );
    return nudges.filter((n) => !linkedGoalIds.has(n.goal.id));
  }, [nudges, priorityDraft]);

  if (visible.length === 0) return null;

  return (
    <div className="today-goal-nudges">
      <h3 className="today-context-title">Goal Suggestions</h3>
      <div className="today-goal-nudges__list">
        {visible.map((nudge) => (
          <div key={nudge.goal.id} className="today-goal-nudge">
            <div className="today-goal-nudge__top">
              <GoalChip goal={nudge.goal} />
              <HealthBadge health={nudge.health} />
            </div>
            <GoalProgressBar percent={nudge.progressPercent} achieved={nudge.health === "achieved"} />
            <div className="today-goal-nudge__action">
              <span className="today-goal-nudge__nba">→ {nudge.nextBestAction}</span>
              <button
                className="button button--ghost button--small"
                type="button"
                onClick={() => onAdd(nudge)}
                disabled={!canAdd}
              >
                {canAdd ? "+ Add" : "Full"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
