import type { GoalOverviewItem } from "../../shared/lib/api";

const domainLabels: Record<string, string> = {
  health: "Health",
  money: "Money",
  work_growth: "Work & Growth",
  home_admin: "Home admin",
  discipline: "Discipline",
  other: "Other",
};

const healthLabels: Record<string, string> = {
  on_track: "On Track",
  drifting: "Drifting",
  stalled: "Stalled",
  achieved: "Achieved",
};

const statusDisplayLabels: Record<string, string> = {
  on_track: "IN PROGRESS",
  drifting: "NEEDS ATTENTION",
  stalled: "STALLED",
  achieved: "ACHIEVED",
};

const domainIcons: Record<string, string> = {
  health: "💪",
  money: "💰",
  work_growth: "🚀",
  home_admin: "🏠",
  discipline: "🎯",
  other: "✦",
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
    return goal.nextBestAction;
  }
  return null;
}

export function GoalCard({
  goal,
  selected,
  onSelect,
}: {
  goal: GoalOverviewItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const milestoneName = getNextMilestoneName(goal);
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
      {/* Status badge & domain icon */}
      <div className="ap-goal-card__top-row">
        <span className={`ap-goal-card__status-badge ap-goal-card__status-badge--${healthState}`}>
          {statusLabel}
        </span>
        <span className="ap-goal-card__domain-icon" title={domainLabels[goal.domain] ?? goal.domain}>
          {domainIcons[goal.domain] ?? "✦"}
        </span>
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
      </div>

      {/* Milestone progress */}
      {milestoneName && (
        <div className="ap-goal-card__milestone">
          <div className="ap-goal-card__milestone-header">
            <span className="ap-goal-card__milestone-label">
              Milestone: {milestoneName}
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
      )}

      {/* Fallback: show progress bar even without milestone name */}
      {!milestoneName && goal.progressPercent > 0 && (
        <div className="ap-goal-card__milestone">
          <div className="ap-goal-card__milestone-header">
            <span className="ap-goal-card__milestone-label">
              {goal.milestoneCounts.completed}/{goal.milestoneCounts.total} milestones
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
      )}
    </div>
  );
}
