import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SectionCard } from "../../../shared/ui/SectionCard";
import { EmptyState, InlineErrorState } from "../../../shared/ui/PageState";
import { RecoveryTaskCard } from "./RecoveryTaskCard";
import type { TaskItem } from "../../../shared/lib/api";
import type { useTaskActions } from "../hooks/useTaskActions";

type TaskActions = ReturnType<typeof useTaskActions>;

export function RecoveryLane({
  overdueTasks,
  overdueTasksQuery,
  taskActions,
}: {
  overdueTasks: TaskItem[];
  overdueTasksQuery: { isLoading: boolean; isError: boolean; error: unknown; data: unknown; refetch: () => void };
  taskActions: TaskActions;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const recoveryView = searchParams.get("view") === "overdue";
  const selectedTaskId = searchParams.get("taskId");
  const selectedTask = overdueTasks.find((t) => t.id === selectedTaskId) ?? null;
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!recoveryView || !selectedTaskId || overdueTasksQuery.isLoading) return;
    const el = document.getElementById(`recovery-task-${selectedTaskId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [overdueTasksQuery.isLoading, recoveryView, selectedTaskId]);

  useEffect(() => {
    if (recoveryView) setExpanded(true);
  }, [recoveryView]);

  function updateParams(nextTaskId?: string | null) {
    const next = new URLSearchParams(searchParams);
    if (nextTaskId) {
      next.set("view", "overdue");
      next.set("taskId", nextTaskId);
    } else {
      next.delete("taskId");
      if (overdueTasks.length === 0) next.delete("view");
    }
    setSearchParams(next);
  }

  if (overdueTasks.length === 0 && !recoveryView) return null;

  return (
    <SectionCard
      title="Recovery lane"
      subtitle="Recover overdue work before it disappears into the background again."
      className="today-recovery-card"
    >
      <div className="recovery-lane__header">
        <div className="recovery-lane__header-left">
          <div className="recovery-lane__count">{overdueTasks.length}</div>
          <p className="recovery-lane__copy">
            {overdueTasks.length === 0
              ? "No overdue tasks left to recover."
              : `${overdueTasks.length} overdue task${overdueTasks.length === 1 ? "" : "s"} waiting for a clear decision.`}
          </p>
        </div>
        <div className="recovery-lane__header-actions">
          {overdueTasks.length > 0 ? (
            <button
              className="button button--ghost button--small recovery-lane__toggle"
              type="button"
              onClick={() => setExpanded((v) => !v)}
            >
              <span className={`recovery-lane__chevron${expanded ? " recovery-lane__chevron--open" : ""}`}>
                ▾
              </span>
              {expanded ? "Collapse" : "Show tasks"}
            </button>
          ) : null}
          {recoveryView ? (
            <button className="button button--ghost button--small" type="button"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete("view"); next.delete("taskId");
                setSearchParams(next);
              }}>Return to today</button>
          ) : null}
        </div>
      </div>

      {selectedTask ? (
        <p className="support-copy">Focused task: <strong>{selectedTask.title}</strong></p>
      ) : null}

      {overdueTasksQuery.isError ? (
        <InlineErrorState
          message={overdueTasksQuery.error instanceof Error ? overdueTasksQuery.error.message : "Overdue tasks could not load."}
          onRetry={() => void overdueTasksQuery.refetch()}
        />
      ) : null}

      {expanded ? (
        <div className="recovery-lane__body">
          {overdueTasksQuery.isLoading && !overdueTasksQuery.data ? (
            <p className="support-copy">Loading overdue tasks…</p>
          ) : overdueTasks.length > 0 ? (
            <div className="recovery-lane">
              {overdueTasks.map((task) => (
                <RecoveryTaskCard
                  key={task.id}
                  task={task}
                  isSelected={selectedTaskId === task.id}
                  isPending={taskActions.isPending}
                  rescheduleDate={taskActions.getRescheduleDate(task.id)}
                  onRescheduleDateChange={(date) => taskActions.setRescheduleDate(task.id, date)}
                  onSelect={() => updateParams(task.id)}
                  onStatusChange={(status) =>
                    taskActions.changeStatus(task.id, status, () => {
                      if (selectedTaskId === task.id) updateParams(null);
                    })
                  }
                  onMoveToToday={() =>
                    taskActions.moveToToday(task.id, () => {
                      if (selectedTaskId === task.id) updateParams(null);
                    })
                  }
                  onCarryForward={() =>
                    taskActions.moveToTomorrow(task.id, () => {
                      if (selectedTaskId === task.id) updateParams(null);
                    })
                  }
                  onReschedule={() =>
                    taskActions.reschedule(task.id, () => {
                      if (selectedTaskId === task.id) updateParams(null);
                    })
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState title="Recovery lane is clear" description="Nothing overdue needs rescuing right now." />
          )}
        </div>
      ) : null}
    </SectionCard>
  );
}
