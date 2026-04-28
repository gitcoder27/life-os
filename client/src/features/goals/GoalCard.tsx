import type { GoalOverviewItem } from "../../shared/lib/api";

const statusDisplayLabels: Record<string, string> = {
  on_track: "IN PROGRESS",
  drifting: "NEEDS ATTENTION",
  stalled: "STALLED",
  achieved: "ACHIEVED",
};

const engagementLabels: Record<string, string> = {
  primary: "Primary",
  secondary: "Secondary",
  parked: "Parked",
  maintenance: "Maintenance",
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function getNextMilestoneName(goal: GoalOverviewItem): string | null {
  if (goal.nextBestAction) {
    const prefix = "Complete milestone: ";
    if (goal.nextBestAction.startsWith(prefix)) {
      return goal.nextBestAction.slice(prefix.length);
    }
  }

  return null;
}

export function GoalCard({
  goal,
  selected,
  onSelect,
  onEditGoal,
  onOpenInPlan,
}: {
  goal: GoalOverviewItem;
  selected: boolean;
  onSelect: () => void;
  onEditGoal?: () => void;
  onOpenInPlan?: () => void;
}) {
  const milestoneName = getNextMilestoneName(goal);
  const hasMilestones = goal.milestoneCounts.total > 0;
  const healthState = goal.health ?? "on_track";
  const statusLabel = statusDisplayLabels[healthState] ?? "ACTIVE";
  const habitCount = goal.linkedSummary.activeHabits;

  return (
    <div
      className={`ap-goal-card${selected ? " ap-goal-card--selected" : ""}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {/* Status badge & horizon */}
      <div className="ap-goal-card__top-row">
        <span className={`ap-goal-card__status-badge ap-goal-card__status-badge--${healthState}`}>
          {statusLabel}
        </span>
        <div className="ap-goal-card__badges">
          {goal.engagementState ? (
            <span className="ap-goal-card__horizon-badge">{engagementLabels[goal.engagementState]}</span>
          ) : null}
          {goal.horizonName && (
            <span className="ap-goal-card__horizon-badge">{goal.horizonName}</span>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="ap-goal-card__title">{goal.title}</h3>

      {/* Description / notes */}
      {goal.notes && (
        <p className="ap-goal-card__description">{goal.notes}</p>
      )}

      {/* Meta row: target date, habits */}
      <div className="ap-goal-card__meta-row">
        {goal.targetDate && (
          <span className="ap-goal-card__meta-item">
            <span className="ap-goal-card__meta-icon">📅</span>
            {formatDate(goal.targetDate)}
          </span>
        )}
        {habitCount > 0 && (
          <span className="ap-goal-card__meta-item">
            <span className="ap-goal-card__meta-icon">●</span>
            {goal.linkedSummary.dueHabitsToday}/{habitCount} Habits
          </span>
        )}
        {goal.parentGoalId && (
          <span className="ap-goal-card__meta-item ap-goal-card__meta-item--subtle">
            child goal
          </span>
        )}
      </div>

      {/* Milestone progress */}
      {hasMilestones ? (
        <div className="ap-goal-card__milestone">
          <div className="ap-goal-card__milestone-header">
            <span className="ap-goal-card__milestone-label">
              {milestoneName ? `Next: ${milestoneName}` : `${goal.milestoneCounts.completed}/${goal.milestoneCounts.total} milestones`}
            </span>
            <span className="ap-goal-card__milestone-pct">
              {goal.progressPercent}%
            </span>
          </div>
          <div className="ap-goal-card__progress-track">
            <div
              className={`ap-goal-card__progress-fill ap-goal-card__progress-fill--${healthState}`}
              style={{ width: `${Math.min(goal.progressPercent, 100)}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="ap-goal-card__milestone ap-goal-card__milestone--empty">
          <span className="ap-goal-card__milestone-empty-title">No milestones yet</span>
          <span className="ap-goal-card__milestone-empty-copy">Open details to define the first milestone.</span>
        </div>
      )}

      {(onEditGoal || onOpenInPlan) && (
        <div className="ap-goal-card__actions">
          {onEditGoal ? (
            <button
              className="ap-goal-card__action"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditGoal();
              }}
            >
              Edit goal
            </button>
          ) : null}
          {onOpenInPlan ? (
            <button
              className="ap-goal-card__action ap-goal-card__action--primary"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenInPlan();
              }}
            >
              View in Plan →
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
