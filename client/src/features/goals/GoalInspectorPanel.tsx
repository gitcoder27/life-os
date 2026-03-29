import { useState } from "react";
import { Link } from "react-router-dom";

import {
  useGoalDetailQuery,
  useUpdateGoalMilestonesMutation,
  type GoalDetailItem,
  type GoalLinkedHabitItem,
  type GoalMilestoneItem,
} from "../../shared/lib/api";
import { InlineErrorState } from "../../shared/ui/PageState";
import { useGoalTodayAction } from "./useGoalTodayAction";

/* ── Helpers ── */

const domainLabels: Record<string, string> = {
  health: "Health & Vitality",
  money: "Wealth & Finance",
  work_growth: "Work & Growth",
  home_admin: "Home & Admin",
  discipline: "Discipline & Focus",
  other: "General",
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
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isOverdue(targetDate: string | null): boolean {
  if (!targetDate) return false;
  const ref = new Date().toISOString().slice(0, 10);
  return targetDate < ref;
}

function getDueLabel(targetDate: string | null): string | null {
  if (!targetDate) return null;
  const now = new Date();
  const target = new Date(`${targetDate}T12:00:00`);
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `Overdue`;
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  return `Due in ${diffDays} days`;
}

/* ── Collapsible Section ── */

function CollapsibleSection({
  icon,
  title,
  children,
  defaultOpen = true,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="ap-inspector-section">
      <button
        className="ap-inspector-section__header"
        type="button"
        onClick={() => setOpen(!open)}
      >
        <span className="ap-inspector-section__icon">{icon}</span>
        <span className="ap-inspector-section__title">{title}</span>
        <span className={`ap-inspector-section__chevron${open ? " ap-inspector-section__chevron--open" : ""}`}>
          ‹
        </span>
      </button>
      {open && (
        <div className="ap-inspector-section__body">
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Milestones Section ── */

function InspectorMilestones({
  milestones,
  goalId,
  onSaved,
}: {
  milestones: GoalMilestoneItem[];
  goalId: string;
  onSaved?: () => void;
}) {
  const mutation = useUpdateGoalMilestonesMutation(goalId);

  function handleToggle(index: number) {
    const updated = milestones.map((m, i) => ({
      id: m.id,
      title: m.title,
      targetDate: m.targetDate || null,
      status: i === index
        ? (m.status === "completed" ? "pending" as const : "completed" as const)
        : m.status,
    }));
    mutation.mutate({ milestones: updated }, {
      onSuccess: () => onSaved?.(),
    });
  }

  if (milestones.length === 0) {
    return (
      <p className="ap-inspector__empty-section">
        No milestones defined yet.
      </p>
    );
  }

  return (
    <div className="ap-inspector-milestones">
      {milestones.map((ms, i) => {
        const due = getDueLabel(ms.targetDate);
        const overdue = isOverdue(ms.targetDate) && ms.status === "pending";

        return (
          <div key={ms.id} className="ap-inspector-milestone">
            <span className={`ap-inspector-milestone__dot ap-inspector-milestone__dot--${ms.status === "completed" ? "done" : overdue ? "overdue" : "pending"}`} />
            <div className="ap-inspector-milestone__body">
              <span className={`ap-inspector-milestone__title${ms.status === "completed" ? " ap-inspector-milestone__title--done" : ""}`}>
                {ms.title}
              </span>
              {due && (
                <span className={`ap-inspector-milestone__due${overdue ? " ap-inspector-milestone__due--overdue" : ms.status === "completed" ? " ap-inspector-milestone__due--done" : ""}`}>
                  {ms.status === "completed" ? `Completed ${formatDate(ms.completedAt)}` : due}
                </span>
              )}
            </div>
            <button
              className={`ap-inspector-milestone__check${ms.status === "completed" ? " ap-inspector-milestone__check--done" : ""}`}
              type="button"
              onClick={() => handleToggle(i)}
              aria-label={`Toggle ${ms.title}`}
              disabled={mutation.isPending}
            >
              {ms.status === "completed" ? "✓" : ""}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ── Linked Habits Section ── */

function InspectorHabits({ habits }: { habits: GoalLinkedHabitItem[] }) {
  if (habits.length === 0) {
    return (
      <p className="ap-inspector__empty-section">
        No habits linked to this goal.
      </p>
    );
  }

  return (
    <div className="ap-inspector-habits">
      {habits.map((h) => (
        <div key={h.id} className="ap-inspector-habit">
          <span className={`ap-inspector-habit__dot ap-inspector-habit__dot--${h.status}`} />
          <span className="ap-inspector-habit__title">{h.title}</span>
          {h.streakCount > 0 && (
            <span className="ap-inspector-habit__streak">{h.streakCount}d</span>
          )}
          {h.completedToday && (
            <span className="ap-inspector-habit__badge ap-inspector-habit__badge--done">✓</span>
          )}
          {h.dueToday && !h.completedToday && (
            <span className="ap-inspector-habit__badge ap-inspector-habit__badge--due">due</span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Execution Bridge ── */

function InspectorExecutionBridge({
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
    buttonLabel,
    addToToday,
  } = useGoalTodayAction({
    goalId,
    goalStatus,
    nextBestAction,
    onLinkedToToday,
  });

  if (!isAvailable) return null;

  return (
    <div className="ap-inspector-cta">
      <button
        className="ap-inspector-cta__btn"
        type="button"
        onClick={() => void addToToday()}
        disabled={updateDayPrioritiesMutation.isPending || !canAddToToday}
      >
        <span className="ap-inspector-cta__icon">✍</span>
        {buttonLabel}
      </button>
    </div>
  );
}

/* ── Main Inspector Panel ── */

export function GoalInspectorPanel({
  goalId,
  onClose,
}: {
  goalId: string;
  onClose: () => void;
}) {
  const detailQuery = useGoalDetailQuery(goalId);

  if (detailQuery.isLoading) {
    return (
      <aside className="ap-inspector">
        <div className="ap-inspector__header">
          <span className="ap-inspector__header-label">Inspector</span>
          <button className="ap-inspector__close" type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="ap-inspector__loading">Loading goal details…</div>
      </aside>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <aside className="ap-inspector">
        <div className="ap-inspector__header">
          <span className="ap-inspector__header-label">Inspector</span>
          <button className="ap-inspector__close" type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="ap-inspector__body">
          <InlineErrorState
            message={detailQuery.error instanceof Error ? detailQuery.error.message : "Could not load goal details."}
            onRetry={() => void detailQuery.refetch()}
          />
        </div>
      </aside>
    );
  }

  const goal: GoalDetailItem = detailQuery.data.goal;

  return (
    <aside className="ap-inspector">
      {/* Header */}
      <div className="ap-inspector__header">
        <span className="ap-inspector__header-label">Inspector</span>
        <div className="ap-inspector__header-actions">
          <button className="ap-inspector__action-btn" type="button" title="Edit goal">
            ✎
          </button>
          <button className="ap-inspector__close" type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>
      </div>

      {/* Title */}
      <div className="ap-inspector__title-area">
        <h2 className="ap-inspector__title">{goal.title}</h2>

        {/* Primary Domain */}
        <div className="ap-inspector__domain">
          <span className="ap-inspector__domain-icon">
            {domainIcons[goal.domain] ?? "✦"}
          </span>
          <div>
            <div className="ap-inspector__domain-label">Primary Domain</div>
            <div className="ap-inspector__domain-value">
              {domainLabels[goal.domain] ?? goal.domain}
            </div>
          </div>
        </div>
      </div>

      {/* Body sections */}
      <div className="ap-inspector__body">
        {/* Milestones */}
        <CollapsibleSection icon="⚡" title="Milestones" defaultOpen>
          <InspectorMilestones
            milestones={goal.milestones}
            goalId={goal.id}
            onSaved={() => void detailQuery.refetch()}
          />
        </CollapsibleSection>

        {/* Support Habits */}
        <CollapsibleSection icon="🔄" title="Support Habits">
          <InspectorHabits habits={goal.linkedHabits} />
        </CollapsibleSection>

        {/* Linked Priorities — Reflection */}
        <CollapsibleSection icon="📊" title="Reflection" defaultOpen={false}>
          {goal.linkedPriorities.length > 0 ? (
            <div className="ap-inspector-linked">
              {goal.linkedPriorities.map((p) => (
                <div key={p.id} className="ap-inspector-linked__item">
                  <span className={`ap-inspector-linked__dot ap-inspector-linked__dot--${p.status}`} />
                  <span className="ap-inspector-linked__title">{p.title}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="ap-inspector__empty-section">
              No linked priorities in current cycles.
            </p>
          )}
        </CollapsibleSection>

        {/* Execution bridge / CTA */}
        <InspectorExecutionBridge
          goalId={goal.id}
          goalStatus={goal.status}
          nextBestAction={goal.nextBestAction}
          onLinkedToToday={async () => {
            await detailQuery.refetch();
          }}
        />

        {/* Quick link to Today */}
        {goal.nextBestAction && (
          <Link to="/today" className="ap-inspector__today-link">
            Open Today →
          </Link>
        )}

        {/* Notes */}
        {goal.notes && (
          <div className="ap-inspector-notes">
            <span className="ap-inspector-notes__label">Notes</span>
            <p className="ap-inspector-notes__text">{goal.notes}</p>
          </div>
        )}
      </div>
    </aside>
  );
}
