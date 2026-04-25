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
  compact = false,
}: {
  date: string;
  nudges: GoalNudgeItem[];
  onAdd: (nudge: GoalNudgeItem) => Promise<void>;
  isAdding: boolean;
  compact?: boolean;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [pendingGoalId, setPendingGoalId] = useState<string | null>(null);

  const visible = useMemo(() => {
    return nudges.filter((nudge) => !dismissed.has(nudge.goal.id));
  }, [dismissed, nudges]);

  if (visible.length === 0) return null;
  const leadNudge = visible[0];

  async function handleAdd(nudge: GoalNudgeItem) {
    setPendingGoalId(nudge.goal.id);
    try {
      await onAdd(nudge);
      setDismissed((current) => new Set(current).add(nudge.goal.id));
    } finally {
      setPendingGoalId(null);
    }
  }

  if (compact) {
    const waitLabel = visible.length > 1 ? `+${visible.length - 1} more` : null;

    return (
      <section className="today-goal-nudges today-goal-nudges--compact" aria-label="Goal momentum suggestion">
        <div className="today-rail-note today-rail-note--goal">
          <div className="today-rail-note__header">
            <span className="today-rail-note__label">Goal momentum</span>
            {waitLabel ? (
              <span className="today-rail-note__count">{waitLabel}</span>
            ) : null}
          </div>
          <div className="today-rail-note__body">
            <Link to="/goals" className="today-rail-note__title">
              {leadNudge.goal.title}
            </Link>
            <span className="today-rail-note__detail">
              {healthLabel(leadNudge.health)} · {leadNudge.suggestedPriorityTitle}
            </span>
          </div>
          <div className="today-rail-note__actions">
            <button
              className="today-rail-link"
              type="button"
              onClick={() => setDismissed((current) => new Set(current).add(leadNudge.goal.id))}
              disabled={isAdding}
            >
              Skip
            </button>
            <button
              className="today-rail-link today-rail-link--strong"
              type="button"
              onClick={() => void handleAdd(leadNudge)}
              disabled={isAdding}
            >
              {pendingGoalId === leadNudge.goal.id ? "Adding..." : "Add"}
            </button>
          </div>
        </div>
      </section>
    );
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
