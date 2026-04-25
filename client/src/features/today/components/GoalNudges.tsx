import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { GoalNudgeItem, LinkedGoal } from "../../../shared/lib/api";

function GoalChip({ goal }: { goal: LinkedGoal }) {
  return (
    <Link to="/goals" className="goal-chip">
      <span className={`goal-chip__dot goal-chip__dot--${goal.domain}`} />
      <span>{goal.title}</span>
    </Link>
  );
}

function healthLabel(health: GoalNudgeItem["health"]) {
  switch (health) {
    case "stalled":
      return "stalled";
    case "drifting":
      return "drifting";
    case "on_track":
      return "steady";
    case "achieved":
      return "done";
  }
}

export function GoalNudges({
  date,
  nudges,
  onAdd,
  isAdding,
}: {
  date: string;
  nudges: GoalNudgeItem[];
  onAdd: (nudge: GoalNudgeItem) => Promise<void>;
  isAdding: boolean;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [pendingGoalId, setPendingGoalId] = useState<string | null>(null);

  const visible = useMemo(() => {
    return nudges.filter((nudge) => !dismissed.has(nudge.goal.id));
  }, [dismissed, nudges]);

  if (visible.length === 0) return null;

  async function handleAdd(nudge: GoalNudgeItem) {
    setPendingGoalId(nudge.goal.id);
    try {
      await onAdd(nudge);
      setDismissed((current) => new Set(current).add(nudge.goal.id));
    } finally {
      setPendingGoalId(null);
    }
  }

  return (
    <section className="today-goal-nudges" aria-label="Suggested from goals">
      <div className="today-goal-nudges__header">
        <h3 className="today-context-title">Suggested from goals</h3>
        <span className="today-goal-nudges__date">{date}</span>
      </div>
      <ul className="today-goal-nudges__list">
        {visible.map((nudge) => (
          <li key={nudge.goal.id} className="today-goal-nudge">
            <div className="today-goal-nudge__body">
              <div className="today-goal-nudge__meta">
                <GoalChip goal={nudge.goal} />
                <span className={`today-goal-nudge__health today-goal-nudge__health--${nudge.health}`}>
                  {healthLabel(nudge.health)}
                </span>
              </div>
              <p className="today-goal-nudge__title">{nudge.suggestedPriorityTitle}</p>
              <p className="today-goal-nudge__reason">{nudge.nextBestAction}</p>
            </div>
            <div className="today-goal-nudge__actions">
              <button
                className="button button--ghost button--small"
                type="button"
                onClick={() => setDismissed((current) => new Set(current).add(nudge.goal.id))}
                disabled={isAdding}
              >
                Not today
              </button>
              <button
                className="button button--primary button--small"
                type="button"
                onClick={() => void handleAdd(nudge)}
                disabled={isAdding}
              >
                {pendingGoalId === nudge.goal.id ? "Adding..." : "Add task"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
