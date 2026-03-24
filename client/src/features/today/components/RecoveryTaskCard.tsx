import { useState } from "react";
import { Link } from "react-router-dom";
import { isRecurring } from "../../../shared/lib/recurrence";
import { RecurrenceInfo } from "../../../shared/ui/RecurrenceBadge";
import { getTodayDate, type LinkedGoal, type TaskItem } from "../../../shared/lib/api";
import { getRecoveryTaskDetail } from "../helpers/date-helpers";

function GoalChip({ goal }: { goal: LinkedGoal }) {
  return (
    <Link to="/goals" className="goal-chip">
      <span className={`goal-chip__dot goal-chip__dot--${goal.domain}`} />
      <span>{goal.title}</span>
    </Link>
  );
}

export function RecoveryTaskCard({
  task,
  isSelected,
  isPending,
  rescheduleDate,
  onRescheduleDateChange,
  onSelect,
  onStatusChange,
  onMoveToToday,
  onCarryForward,
  onReschedule,
}: {
  task: TaskItem;
  isSelected: boolean;
  isPending: boolean;
  rescheduleDate: string;
  onRescheduleDateChange: (date: string) => void;
  onSelect: () => void;
  onStatusChange: (status: "pending" | "completed" | "dropped") => void;
  onMoveToToday: () => void;
  onCarryForward: () => void;
  onReschedule: () => void;
}) {
  const [showReschedule, setShowReschedule] = useState(false);

  return (
    <div
      id={`recovery-task-${task.id}`}
      className={`recovery-task${isSelected ? " recovery-task--selected" : ""}`}
    >
      <div className="recovery-task__main">
        <button className="recovery-task__focus" type="button" onClick={onSelect}
          aria-label="Focus overdue task" />
        <div className="recovery-task__content">
          <div className="recovery-task__title-row">
            <div className="recovery-task__title">
              {task.title}
              {isRecurring(task.recurrence) ? (
                <RecurrenceInfo recurrence={task.recurrence} showCarryPolicy />
              ) : null}
            </div>
            {task.goal ? <GoalChip goal={task.goal} /> : null}
          </div>
          <div className="recovery-task__meta">
            <span>{getRecoveryTaskDetail(task.scheduledForDate ?? getTodayDate())}</span>
          </div>
          {showReschedule ? (
            <div className="task-card__reschedule">
              <input type="date" className="task-card__date-input"
                value={rescheduleDate} onChange={(e) => onRescheduleDateChange(e.target.value)} />
              <button className="button button--primary button--small" type="button"
                disabled={isPending}
                onClick={() => { onReschedule(); setShowReschedule(false); }}>Move</button>
              <button className="button button--ghost button--small" type="button"
                onClick={() => setShowReschedule(false)}>Cancel</button>
            </div>
          ) : null}
        </div>
      </div>
      <div className="recovery-task__actions">
        <button className="button button--ghost button--small" type="button"
          disabled={isPending} onClick={onMoveToToday}>Move to today</button>
        <button className="button button--ghost button--small" type="button"
          disabled={isPending} onClick={onCarryForward}>Tomorrow</button>
        <button className="button button--ghost button--small" type="button"
          disabled={isPending} onClick={() => setShowReschedule((v) => !v)}>Pick date</button>
        <button className="button button--ghost button--small" type="button"
          disabled={isPending} onClick={() => onStatusChange("completed")}>Complete</button>
        <button className="button button--ghost button--small" type="button"
          disabled={isPending} onClick={() => onStatusChange("dropped")}>Drop</button>
      </div>
    </div>
  );
}
