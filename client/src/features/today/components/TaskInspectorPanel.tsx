import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import {
  useUpdateTaskMutation,
  type FocusSessionItem,
  type TaskItem,
} from "../../../shared/lib/api";
import { getRecoveryTaskDetail } from "../helpers/date-helpers";
import type { useTaskActions } from "../hooks/useTaskActions";
import { FocusSessionLauncher } from "./FocusSessionLauncher";
import { FocusSessionPanel } from "./FocusSessionPanel";
import { StartProtocolSheet } from "./StartProtocolSheet";
import { StuckFlowSheet } from "./StuckFlowSheet";

type TaskActions = ReturnType<typeof useTaskActions>;

function getTaskStateLabel(task: TaskItem) {
  if (task.status === "completed") return "Complete";
  if (task.status === "dropped") return "Dropped";
  if (task.progressState === "advanced") return "In progress";
  if (task.progressState === "started") return "Started";
  return "Ready";
}

function getScheduleLabel(task: TaskItem, today: string) {
  if (!task.scheduledForDate) return "Unscheduled";
  if (task.scheduledForDate === today) return "Today";
  if (task.scheduledForDate < today) return getRecoveryTaskDetail(task.scheduledForDate);
  return task.scheduledForDate;
}

export function TaskInspectorPanel({
  date,
  task,
  taskActions,
  activeFocusSession,
  onAddTask,
  onPlanDay,
  onClarifyTask,
}: {
  date: string;
  task: TaskItem | null;
  taskActions: TaskActions;
  activeFocusSession: FocusSessionItem | null;
  onAddTask: () => void;
  onPlanDay: () => void;
  onClarifyTask: (taskId: string) => void;
}) {
  const updateTaskMutation = useUpdateTaskMutation(date);
  const [protocolOpen, setProtocolOpen] = useState(false);
  const [stuckOpen, setStuckOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const isBusy = taskActions.isPending || updateTaskMutation.isPending;

  useEffect(() => {
    setMoreOpen(false);
  }, [task?.id]);

  useEffect(() => {
    if (!moreOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (moreRef.current?.contains(event.target as Node)) {
        return;
      }

      setMoreOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMoreOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [moreOpen]);

  if (!task) {
    return (
      <section className="task-inspector" aria-label="Task inspector">
        <FocusSessionPanel
          date={date}
          session={activeFocusSession}
          onClarifyTask={onClarifyTask}
        />
        <div className="task-inspector__empty">
          <span className="task-inspector__eyebrow">Today queue</span>
          <h2 className="task-inspector__empty-title">No task selected</h2>
          <p className="task-inspector__empty-copy">
            Choose a task from the queue, add one, or plan the day before the work spreads out.
          </p>
          <div className="task-inspector__actions">
            <button className="task-inspector__text-action task-inspector__text-action--strong" type="button" onClick={onAddTask}>
              Add task
            </button>
            <button className="task-inspector__text-action" type="button" onClick={onPlanDay}>
              Plan day
            </button>
          </div>
        </div>
      </section>
    );
  }

  const isPending = task.status === "pending";
  const isCompleted = task.status === "completed";
  const isOverdue = Boolean(task.scheduledForDate && task.scheduledForDate < date && isPending);
  const canFocus = task.kind === "task" && isPending;

  return (
    <section className="task-inspector" aria-label="Task inspector">
      <FocusSessionPanel
        date={date}
        session={activeFocusSession}
        onClarifyTask={onClarifyTask}
      />

      <section className="task-inspector__body">
        <div className="task-inspector__header">
          <span className="task-inspector__eyebrow">Selected task</span>
          <span className={`task-inspector__state task-inspector__state--${isOverdue ? "overdue" : task.status}`}>
            {getTaskStateLabel(task)}
          </span>
        </div>

        <h2 className="task-inspector__title">{task.title}</h2>

        <div className="task-inspector__meta">
          <span>{getScheduleLabel(task, date)}</span>
          {task.goal ? (
            <Link to="/goals" className="task-inspector__goal">
              {task.goal.title}
            </Link>
          ) : null}
        </div>

        <div className="task-inspector__brief">
          <span>Next action</span>
          <strong>{task.nextAction?.trim() || "Define the first visible step."}</strong>
          {task.fiveMinuteVersion || task.estimatedDurationMinutes ? (
            <p className="task-inspector__quiet-meta">
              {task.fiveMinuteVersion ? (
                <span>Small version: {task.fiveMinuteVersion}</span>
              ) : null}
              {task.estimatedDurationMinutes ? (
                <span>{task.estimatedDurationMinutes} min</span>
              ) : null}
            </p>
          ) : null}
        </div>

        {canFocus ? (
          <div className="task-inspector__primary-action">
            <FocusSessionLauncher
              date={date}
              task={task}
              activeSession={activeFocusSession}
              buttonClassName="task-inspector__start"
              activeChipClassName="task-inspector__chip"
            />
          </div>
        ) : null}

        <div className="task-inspector__secondary-actions">
          {isPending ? (
            <button
              className="task-inspector__text-action task-inspector__text-action--strong"
              type="button"
              disabled={isBusy}
              onClick={() => taskActions.changeStatus(task.id, "completed")}
            >
              Complete
            </button>
          ) : null}

          {isPending && task.progressState !== "advanced" ? (
            <button
              className="task-inspector__text-action"
              type="button"
              disabled={isBusy}
              onClick={() =>
                updateTaskMutation.mutate({
                  taskId: task.id,
                  progressState: "advanced",
                  startedAt: task.startedAt ?? new Date().toISOString(),
                })
              }
            >
              Mark progress
            </button>
          ) : null}

          <div className="task-inspector__more" ref={moreRef}>
            <button
              className="task-inspector__text-action"
              type="button"
              onClick={() => setMoreOpen((current) => !current)}
              aria-expanded={moreOpen}
            >
              More
            </button>
            {moreOpen ? (
              <div className="task-inspector__more-menu">
                {!isCompleted && isPending ? (
                  <button
                    className="task-inspector__menu-action"
                    type="button"
                    onClick={() => {
                      setStuckOpen(true);
                      setMoreOpen(false);
                    }}
                  >
                    I&apos;m stuck
                  </button>
                ) : null}
                <button
                  className="task-inspector__menu-action"
                  type="button"
                  onClick={() => {
                    setProtocolOpen(true);
                    setMoreOpen(false);
                  }}
                >
                  Open protocol
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {isOverdue ? (
          <div className="task-inspector__recovery">
            <span>Overdue</span>
            <p>This slipped from an earlier day. Pull it into today only if it still matters.</p>
            <div className="task-inspector__recovery-actions">
              <button
                className="task-inspector__text-action task-inspector__text-action--strong"
                type="button"
                disabled={isBusy}
                onClick={() => taskActions.moveToToday(task.id)}
              >
                Pull to today
              </button>
              <button
                className="task-inspector__text-action"
                type="button"
                disabled={isBusy}
                onClick={() => taskActions.moveToTomorrow(task.id)}
              >
                Tomorrow
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <StartProtocolSheet
        open={protocolOpen}
        date={date}
        task={task}
        onClose={() => setProtocolOpen(false)}
      />
      <StuckFlowSheet
        open={stuckOpen}
        date={date}
        task={task}
        onClose={() => setStuckOpen(false)}
      />
    </section>
  );
}
