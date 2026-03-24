import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { isRecurring } from "../../../shared/lib/recurrence";
import { getQuickCaptureDisplayText } from "../../../shared/lib/quickCapture";
import { RecurrenceInfo } from "../../../shared/ui/RecurrenceBadge";
import { CheckIcon, MoreIcon } from "../helpers/icons";
import type { TaskItem, LinkedGoal } from "../../../shared/lib/api";

function GoalChip({ goal }: { goal: LinkedGoal }) {
  return (
    <Link to="/goals" className="goal-chip">
      <span className={`goal-chip__dot goal-chip__dot--${goal.domain}`} />
      <span>{goal.title}</span>
    </Link>
  );
}

function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  active: boolean,
  onClose: () => void,
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!active) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onCloseRef.current();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [active, ref]);
}

export function TaskCard({
  task,
  isPending,
  rescheduleDate,
  onRescheduleDateChange,
  onStatusChange,
  onCarryForward,
  onReschedule,
}: {
  task: TaskItem;
  isPending: boolean;
  rescheduleDate: string;
  onRescheduleDateChange: (date: string) => void;
  onStatusChange: (status: "pending" | "completed" | "dropped") => void;
  onCarryForward: () => void;
  onReschedule: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, menuOpen, () => setMenuOpen(false));

  const isDone = task.status === "completed";
  const isDropped = task.status === "dropped";
  const isTaskPending = task.status === "pending";
  const metaText = getQuickCaptureDisplayText(task, task.scheduledForDate ?? "Scheduled today");

  return (
    <div
      className={
        "today-task-card" +
        (isDone ? " today-task-card--done" : "") +
        (isDropped ? " today-task-card--dropped" : "")
      }
    >
      <button
        className={
          "today-task-card__check" +
          (isDone ? " today-task-card__check--done" : "") +
          (isDropped ? " today-task-card__check--dropped" : "")
        }
        type="button"
        onClick={() => onStatusChange(isDone || isDropped ? "pending" : "completed")}
        disabled={isPending}
        aria-label={isDone || isDropped ? "Reopen task" : "Complete task"}
      >
        {isDone ? <CheckIcon /> : null}
        {isDropped ? <span className="today-task-card__x">×</span> : null}
      </button>

      <div className="today-task-card__content">
        <div className="today-task-card__title">
          {task.title}
          {isRecurring(task.recurrence) ? (
            <RecurrenceInfo recurrence={task.recurrence} showCarryPolicy />
          ) : null}
        </div>
        <div className="today-task-card__meta">
          <span>{metaText}</span>
          {task.goal ? <GoalChip goal={task.goal} /> : null}
        </div>
        {showReschedule ? (
          <div className="today-task-card__reschedule">
            <input type="date" className="today-task-card__date-input"
              value={rescheduleDate} onChange={(e) => onRescheduleDateChange(e.target.value)} />
            <button className="button button--primary button--small" type="button"
              disabled={!isTaskPending || isPending}
              onClick={() => { onReschedule(); setShowReschedule(false); }}>Move</button>
            <button className="button button--ghost button--small" type="button"
              onClick={() => setShowReschedule(false)}>Cancel</button>
          </div>
        ) : null}
      </div>

      <div className="today-task-card__actions" ref={menuRef}>
        <button className="today-task-card__more" type="button"
          onClick={() => setMenuOpen(!menuOpen)} aria-label="Task actions">
          <MoreIcon />
        </button>
        {menuOpen ? (
          <div className="action-menu">
            {isTaskPending ? (
              <>
                <button className="action-menu__item" type="button"
                  onClick={() => { onStatusChange("dropped"); setMenuOpen(false); }}>✗ Drop</button>
                <div className="action-menu__divider" />
                <button className="action-menu__item" type="button"
                  onClick={() => { onCarryForward(); setMenuOpen(false); }}>
                  {isRecurring(task.recurrence) ? "↷ Skip to next" : "→ Tomorrow"}
                </button>
                <button className="action-menu__item" type="button"
                  onClick={() => { setShowReschedule(true); setMenuOpen(false); }}>📅 Reschedule…</button>
              </>
            ) : (
              <button className="action-menu__item" type="button"
                onClick={() => { onStatusChange("pending"); setMenuOpen(false); }}>↶ Reopen</button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
