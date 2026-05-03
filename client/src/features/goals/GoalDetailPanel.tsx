import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import {
  useGoalDetailQuery,
  useUpdateGoalMilestonesMutation,
  type GoalDetailItem,
  type GoalLinkedHabitItem,
  type GoalLinkedPriorityItem,
  type GoalLinkedTaskItem,
  type GoalMilestoneItem,
  type GoalOverviewItem,
} from "../../shared/lib/api";
import { EmptyState, InlineErrorState } from "../../shared/ui/PageState";
import {
  formatGoalDate as formatDate,
  isGoalMilestoneOverdue as isOverdue,
} from "./goal-date-logic";
import { useGoalTodayAction } from "./useGoalTodayAction";

const cycleLabels: Record<string, string> = { day: "D", week: "W", month: "M" };

/* ── Milestone Editor ── */

type MilestoneDraft = {
  id?: string;
  title: string;
  targetDate: string;
  status: "pending" | "completed";
};

function MilestoneEditor({
  milestones,
  goalId,
  onSaved,
}: {
  milestones: GoalMilestoneItem[];
  goalId: string;
  onSaved?: () => void;
}) {
  const mutation = useUpdateGoalMilestonesMutation(goalId);

  const [drafts, setDrafts] = useState<MilestoneDraft[]>(() =>
    milestones.map((m) => ({
      id: m.id,
      title: m.title,
      targetDate: m.targetDate ?? "",
      status: m.status,
    })),
  );
  const [editing, setEditing] = useState(false);
  const addRef = useRef<HTMLInputElement>(null);

  // Sync when milestones update from server
  useEffect(() => {
    if (!editing) {
      setDrafts(
        milestones.map((m) => ({
          id: m.id,
          title: m.title,
          targetDate: m.targetDate ?? "",
          status: m.status,
        })),
      );
    }
  }, [milestones, editing]);

  function startEditing() {
    setDrafts(
      milestones.map((m) => ({
        id: m.id,
        title: m.title,
        targetDate: m.targetDate ?? "",
        status: m.status,
      })),
    );
    setEditing(true);
  }

  function addMilestone() {
    if (drafts.length >= 12) return;
    setDrafts((prev) => [...prev, { title: "", targetDate: "", status: "pending" }]);
    setTimeout(() => addRef.current?.focus(), 50);
  }

  function updateDraft(index: number, partial: Partial<MilestoneDraft>) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...partial } : d)));
  }

  function removeDraft(index: number) {
    setDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  function moveDraft(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= drafts.length) return;
    setDrafts((prev) => {
      const next = [...prev];
      [next[index], next[newIndex]] = [next[newIndex], next[index]];
      return next;
    });
  }

  async function handleSave() {
    const milestonePayload = drafts
      .filter((d) => d.title.trim())
      .map((d) => ({
        id: d.id,
        title: d.title.trim(),
        targetDate: d.targetDate || null,
        status: d.status,
      }));

    await mutation.mutateAsync({ milestones: milestonePayload });
    setEditing(false);
    onSaved?.();
  }

  function handleToggleStatus(index: number) {
    if (editing) {
      updateDraft(index, {
        status: drafts[index].status === "completed" ? "pending" : "completed",
      });
    } else {
      // Quick-toggle: immediately save
      const updated = milestones.map((m, i) => ({
        id: m.id,
        title: m.title,
        targetDate: m.targetDate || null,
        status: i === index ? (m.status === "completed" ? "pending" as const : "completed" as const) : m.status,
      }));
      mutation.mutate({ milestones: updated });
    }
  }

  if (editing) {
    return (
      <div className="detail-section">
        <div className="detail-section__header">
          <span className="detail-section__title">Milestones</span>
          <span className="detail-section__count">{drafts.length}/12</span>
        </div>
        <div className="milestone-edit">
          {drafts.map((draft, i) => (
            <div key={draft.id ?? `new-${i}`} className="milestone-edit__row">
              <button
                className={`milestone-item__check${draft.status === "completed" ? " milestone-item__check--done" : ""}`}
                type="button"
                onClick={() => handleToggleStatus(i)}
                aria-label={`Toggle milestone ${draft.title}`}
              >
                {draft.status === "completed" ? "✓" : ""}
              </button>
              <input
                ref={i === drafts.length - 1 ? addRef : undefined}
                className="milestone-edit__input"
                type="text"
                value={draft.title}
                placeholder="Milestone title"
                onChange={(e) => updateDraft(i, { title: e.target.value })}
              />
              <input
                className="milestone-edit__input milestone-edit__date"
                type="date"
                value={draft.targetDate}
                onChange={(e) => updateDraft(i, { targetDate: e.target.value })}
              />
              <div className="milestone-edit__reorder">
                <button
                  className="milestone-edit__reorder-btn"
                  type="button"
                  disabled={i === 0}
                  onClick={() => moveDraft(i, -1)}
                  aria-label="Move up"
                >
                  ▲
                </button>
                <button
                  className="milestone-edit__reorder-btn"
                  type="button"
                  disabled={i === drafts.length - 1}
                  onClick={() => moveDraft(i, 1)}
                  aria-label="Move down"
                >
                  ▼
                </button>
              </div>
              <button
                className="milestone-item__action-btn milestone-item__action-btn--danger"
                type="button"
                onClick={() => removeDraft(i)}
                aria-label="Remove milestone"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        {drafts.length < 12 && (
          <button
            className="button button--ghost button--small"
            type="button"
            onClick={addMilestone}
            style={{ alignSelf: "flex-start" }}
          >
            + Add milestone
          </button>
        )}
        {mutation.error && (
          <div className="inline-state inline-state--error" style={{ fontSize: "var(--fs-small)" }}>
            {mutation.error instanceof Error ? mutation.error.message : "Could not save milestones."}
          </div>
        )}
        <div className="milestone-save-bar">
          <span className="milestone-save-bar__msg">
            {mutation.isPending ? "Saving…" : "Unsaved changes"}
          </span>
          <div className="button-row button-row--tight">
            <button
              className="button button--primary button--small"
              type="button"
              onClick={() => void handleSave()}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Saving…" : "Save milestones"}
            </button>
            <button
              className="button button--ghost button--small"
              type="button"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="detail-section">
      <div className="detail-section__header">
        <span className="detail-section__title">Milestones</span>
        <button
          className="button button--ghost button--small"
          type="button"
          onClick={startEditing}
        >
          Edit
        </button>
      </div>
      {milestones.length > 0 ? (
        <div className="milestone-list">
          {milestones.map((ms, i) => (
            <div key={ms.id} className="milestone-item">
              <button
                className={`milestone-item__check${ms.status === "completed" ? " milestone-item__check--done" : ""}`}
                type="button"
                onClick={() => handleToggleStatus(i)}
                aria-label={`Toggle ${ms.title}`}
              >
                {ms.status === "completed" ? "✓" : ""}
              </button>
              <div className="milestone-item__body">
                <div className={`milestone-item__title${ms.status === "completed" ? " milestone-item__title--done" : ""}`}>
                  {ms.title}
                </div>
                {ms.targetDate && (
                  <div className={`milestone-item__date${isOverdue(ms.targetDate) && ms.status === "pending" ? " milestone-item__date--overdue" : ""}`}>
                    {isOverdue(ms.targetDate) && ms.status === "pending" ? "Overdue · " : ""}
                    {formatDate(ms.targetDate)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No milestones yet"
          description="Break this goal into concrete milestones to track progress."
          actionLabel="+ Add milestones"
          onAction={startEditing}
        />
      )}
    </div>
  );
}

/* ── Linked Priorities Section ── */

function LinkedPrioritiesSection({ priorities }: { priorities: GoalLinkedPriorityItem[] }) {
  if (priorities.length === 0) {
    return (
      <div className="detail-section">
        <span className="detail-section__title">Linked priorities</span>
        <p className="goal-detail__empty">No priorities linked to this goal in current cycles.</p>
      </div>
    );
  }

  return (
    <div className="detail-section">
      <div className="detail-section__header">
        <span className="detail-section__title">Linked priorities</span>
        <span className="detail-section__count">{priorities.length}</span>
      </div>
      <div className="linked-items">
        {priorities.map((p) => (
          <div key={p.id} className="linked-item">
            <span className={`linked-item__status linked-item__status--${p.status}`} />
            <span className="linked-item__cycle-badge">{cycleLabels[p.cycleType] ?? p.cycleType}</span>
            <span className={`linked-item__title${p.status === "completed" ? " linked-item__title--done" : ""}`}>
              {p.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Linked Tasks Section ── */

function LinkedTasksSection({ tasks }: { tasks: GoalLinkedTaskItem[] }) {
  if (tasks.length === 0) {
    return (
      <div className="detail-section">
        <span className="detail-section__title">Linked tasks</span>
        <p className="goal-detail__empty">No pending tasks linked to this goal.</p>
      </div>
    );
  }

  return (
    <div className="detail-section">
      <div className="detail-section__header">
        <span className="detail-section__title">Linked tasks</span>
        <span className="detail-section__count">{tasks.length}</span>
      </div>
      <div className="linked-items">
        {tasks.map((t) => (
          <div key={t.id} className="linked-item">
            <span className={`linked-item__status linked-item__status--${t.status}`} />
            <span className={`linked-item__title${t.status === "completed" ? " linked-item__title--done" : ""}`}>
              {t.title}
            </span>
            {t.dueAt && (
              <span className="linked-item__meta">
                {formatDate(t.dueAt.slice(0, 10))}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Linked Habits Section ── */

function LinkedHabitsSection({ habits }: { habits: GoalLinkedHabitItem[] }) {
  if (habits.length === 0) {
    return (
      <div className="detail-section">
        <span className="detail-section__title">Linked habits</span>
        <p className="goal-detail__empty">No habits linked to this goal.</p>
      </div>
    );
  }

  return (
    <div className="detail-section">
      <div className="detail-section__header">
        <span className="detail-section__title">Linked habits</span>
        <span className="detail-section__count">{habits.length}</span>
      </div>
      <div className="linked-items">
        {habits.map((h) => (
          <div key={h.id} className="linked-item">
            <span className={`linked-item__status linked-item__status--${h.status}`} />
            <span className="linked-item__title">{h.title}</span>
            {h.streakCount > 0 && (
              <span className="linked-habit__streak">{h.streakCount}d</span>
            )}
            {h.riskLevel !== "none" && (
              <span className={`linked-habit__risk linked-habit__risk--${h.riskLevel}`}>
                {h.riskLevel === "at_risk" ? "at risk" : "drifting"}
              </span>
            )}
            {!h.completedToday && h.dueToday && h.completedCountToday > 0 && (
              <span className="tag tag--neutral" style={{ fontSize: "var(--fs-micro)" }}>
                {Math.min(h.completedCountToday, h.targetPerDay)}/{h.targetPerDay} today
              </span>
            )}
            {h.dueToday && !h.completedToday && (
              <span className="tag tag--warning" style={{ fontSize: "var(--fs-micro)" }}>due</span>
            )}
            {h.completedToday && (
              <span className="tag tag--positive" style={{ fontSize: "var(--fs-micro)" }}>done</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Goal Execution Bridge ── */

function GoalExecutionBridge({
  goalId,
  goalStatus,
  nextBestAction,
  onLinkedToToday,
}: {
  goalId: string;
  goalStatus: GoalDetailItem["status"];
  nextBestAction: string | null;
  onLinkedToToday: () => Promise<unknown>;
}) {
  const {
    isAvailable,
    updateDayPrioritiesMutation,
    canAddToToday,
    helperCopy,
    buttonLabel,
    addToToday,
  } = useGoalTodayAction({
    goalId,
    goalStatus,
    nextBestAction,
    onLinkedToToday,
  });

  if (!isAvailable) {
    return null;
  }

  return (
    <div className="goal-execution-bridge">
      <div>
        <div className="detail-section__title">Move Into Today</div>
        <p className="goal-execution-bridge__copy">{helperCopy}</p>
      </div>

      <div className="button-row button-row--wrap">
        <button
          className="button button--primary button--small"
          type="button"
          onClick={() => void addToToday()}
          disabled={updateDayPrioritiesMutation.isPending || !canAddToToday}
        >
          {buttonLabel}
        </button>
        <Link to="/today" className="button button--ghost button--small">
          Open Today
        </Link>
      </div>

      {updateDayPrioritiesMutation.error instanceof Error ? (
        <InlineErrorState
          message={updateDayPrioritiesMutation.error.message}
          onRetry={() => void addToToday()}
        />
      ) : null}
    </div>
  );
}

/* ── Main Detail Panel ── */

const healthLabels: Record<string, string> = {
  on_track: "On track",
  drifting: "Drifting",
  stalled: "Stalled",
  achieved: "Achieved",
};

const domainLabels: Record<string, string> = {
  unassigned: "Unassigned",
  health: "Health",
  money: "Money",
  work_growth: "Work & Growth",
  home_admin: "Home admin",
  discipline: "Discipline",
  other: "Other",
};

export function GoalDetailPanel({
  goalId,
  onClose,
}: {
  goalId: string;
  onClose: () => void;
}) {
  const detailQuery = useGoalDetailQuery(goalId);

  if (detailQuery.isLoading) {
    return (
      <div className="goal-detail">
        <div className="goal-detail__header">
          <div className="goal-detail__close">
            <button className="goal-detail__close-btn" type="button" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>
        <div className="goal-detail__loading">Loading goal details…</div>
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="goal-detail">
        <div className="goal-detail__header">
          <div className="goal-detail__close">
            <button className="goal-detail__close-btn" type="button" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>
        <div className="goal-detail__body">
          <InlineErrorState
            message={detailQuery.error instanceof Error ? detailQuery.error.message : "Goal details could not load."}
            onRetry={() => void detailQuery.refetch()}
          />
        </div>
      </div>
    );
  }

  const goal: GoalDetailItem = detailQuery.data.goal;

  return (
    <div className="goal-detail">
      <div className="goal-detail__header">
        <div className="goal-detail__close">
          <button className="goal-detail__close-btn" type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="goal-detail__title">{goal.title}</div>
        <div className="goal-detail__meta">
          <span className="goal-overview-card__domain">
            <span className={`goal-chip__dot goal-chip__dot--${goal.domainSystemKey ?? "other"}`} />
            {goal.domain}
          </span>
          {goal.health && (
            <span className={`health-badge health-badge--${goal.health}`}>
              <span className="health-badge__dot" />
              {healthLabels[goal.health]}
            </span>
          )}
          {goal.targetDate && (
            <span style={{ fontSize: "var(--fs-micro)", color: "var(--text-tertiary)" }}>
              Target: {formatDate(goal.targetDate)}
            </span>
          )}
        </div>
        <div className="goal-detail__progress">
          <div className="goal-progress">
            <div className="goal-progress__bar">
              <div
                className={`goal-progress__fill${goal.health === "achieved" ? " goal-progress__fill--achieved" : ""}`}
                style={{ width: `${Math.min(goal.progressPercent, 100)}%` }}
              />
            </div>
            <span className="goal-progress__label">{goal.progressPercent}%</span>
          </div>
        </div>
      </div>

      <div className="goal-detail__body">
        {goal.nextBestAction && (
          <div className="goal-nba">
            <span className="goal-nba__icon">→</span>
            <span>{goal.nextBestAction}</span>
          </div>
        )}

        <GoalExecutionBridge
          goalId={goal.id}
          goalStatus={goal.status}
          nextBestAction={goal.nextBestAction}
          onLinkedToToday={async () => {
            await detailQuery.refetch();
          }}
        />

        <MilestoneEditor
          milestones={goal.milestones}
          goalId={goal.id}
          onSaved={() => void detailQuery.refetch()}
        />

        <LinkedPrioritiesSection priorities={goal.linkedPriorities} />
        <LinkedTasksSection tasks={goal.linkedTasks} />
        <LinkedHabitsSection habits={goal.linkedHabits} />

        {goal.notes && (
          <div className="detail-section">
            <span className="detail-section__title">Notes</span>
            <p style={{ fontSize: "var(--fs-small)", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {goal.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Shared subcomponents exported for GoalsPage ── */

export function HealthBadge({ health }: { health: GoalOverviewItem["health"] }) {
  if (!health) return null;
  return (
    <span className={`health-badge health-badge--${health}`}>
      <span className="health-badge__dot" />
      {healthLabels[health]}
    </span>
  );
}

export function MomentumSpark({ momentum }: { momentum: GoalOverviewItem["momentum"] }) {
  const maxCount = Math.max(...momentum.buckets.map((b) => b.completedCount), 1);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
      <div className="momentum-spark">
        {momentum.buckets.map((bucket) => {
          const height = Math.max((bucket.completedCount / maxCount) * 100, 15);
          const isHigh = bucket.completedCount >= maxCount * 0.7;
          return (
            <div
              key={bucket.startDate}
              className={`momentum-spark__bar${bucket.completedCount > 0 ? (isHigh ? " momentum-spark__bar--high" : " momentum-spark__bar--active") : ""}`}
              style={{ height: `${height}%` }}
              title={`${formatDate(bucket.startDate)}–${formatDate(bucket.endDate)}: ${bucket.completedCount} completed`}
            />
          );
        })}
      </div>
      <span className={`momentum-trend momentum-trend--${momentum.trend}`}>
        {momentum.trend === "up" ? "↑" : momentum.trend === "down" ? "↓" : "→"}
      </span>
    </div>
  );
}

export function GoalProgressBar({
  percent,
  achieved,
}: {
  percent: number;
  achieved?: boolean;
}) {
  return (
    <div className="goal-progress">
      <div className="goal-progress__bar">
        <div
          className={`goal-progress__fill${achieved ? " goal-progress__fill--achieved" : ""}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <span className="goal-progress__label">{percent}%</span>
    </div>
  );
}
