import { Link } from "react-router-dom";
import {
  useUpsertDayLaunchMutation,
  type DailyLaunchItem,
  type RescueSuggestion,
  type TaskItem,
} from "../../../shared/lib/api";
import type { useTaskActions } from "../hooks/useTaskActions";

type TaskActions = ReturnType<typeof useTaskActions>;

export function RescueModeCard({
  date,
  launch,
  suggestion,
  mustWinTask,
  deferredCandidates,
  taskActions,
  compact = false,
}: {
  date: string;
  launch: DailyLaunchItem | null;
  suggestion: RescueSuggestion | null;
  mustWinTask: TaskItem | null;
  deferredCandidates: Array<Pick<TaskItem, "id" | "title">>;
  taskActions?: TaskActions;
  compact?: boolean;
}) {
  const upsertLaunchMutation = useUpsertDayLaunchMutation(date);
  const isActive = launch?.dayMode === "rescue" || launch?.dayMode === "recovery";

  async function handleActivate() {
    if (!suggestion) {
      return;
    }

    await upsertLaunchMutation.mutateAsync({
      dayMode: suggestion.mode,
      rescueReason: suggestion.reason,
    });
  }

  async function handleExit() {
    await upsertLaunchMutation.mutateAsync({
      dayMode: "normal",
      rescueReason: null,
    });
  }

  if (!suggestion && !isActive) {
    return null;
  }

  return (
    <section className={`rescue-mode-card${compact ? " rescue-mode-card--compact" : ""}`}>
      <div className="rescue-mode-card__header">
        <div>
          <p className="rescue-mode-card__eyebrow">
            {isActive ? (launch?.dayMode === "recovery" ? "Recovery Mode" : "Rescue Mode") : "Suggested"}
          </p>
          <h2 className="rescue-mode-card__title">
            {suggestion?.title ?? (launch?.dayMode === "recovery" ? "Recovery Mode is active" : "Rescue Mode is active")}
          </h2>
        </div>
        <span className={`rescue-mode-card__badge rescue-mode-card__badge--${isActive ? "active" : "suggested"}`}>
          {isActive ? "active" : "suggested"}
        </span>
      </div>

      <p className="rescue-mode-card__copy">
        {suggestion?.detail ?? "The day has been reduced so you can protect continuity and keep one thing alive."}
      </p>

      {mustWinTask ? (
        <div className="rescue-mode-card__focus">
          <span className="rescue-mode-card__focus-label">Minimum viable action</span>
          <strong>{suggestion?.minimumViableAction ?? mustWinTask.fiveMinuteVersion ?? mustWinTask.nextAction ?? mustWinTask.title}</strong>
        </div>
      ) : null}

      {deferredCandidates.length > 0 && !compact ? (
        <div className="rescue-mode-card__defer-list">
          {deferredCandidates.slice(0, 5).map((task) => (
            <div key={task.id} className="rescue-mode-card__defer-row">
              <span>{task.title}</span>
              {taskActions ? (
                <button
                  className="button button--ghost button--small"
                  type="button"
                  disabled={taskActions.isPending}
                  onClick={() => taskActions.moveToTomorrow(task.id)}
                >
                  Tomorrow
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="rescue-mode-card__actions">
        {!isActive ? (
          <button
            className="button button--primary button--small"
            type="button"
            disabled={upsertLaunchMutation.isPending}
            onClick={() => void handleActivate()}
          >
            {upsertLaunchMutation.isPending ? "Saving..." : "Activate"}
          </button>
        ) : (
          <button
            className="button button--ghost button--small"
            type="button"
            disabled={upsertLaunchMutation.isPending}
            onClick={() => void handleExit()}
          >
            {upsertLaunchMutation.isPending ? "Saving..." : "Return to normal"}
          </button>
        )}

        {taskActions && deferredCandidates.length > 1 && !compact ? (
          <button
            className="button button--ghost button--small"
            type="button"
            disabled={taskActions.isPending}
            onClick={() => void taskActions.moveTasksToTomorrow(deferredCandidates.map((task) => task.id))}
          >
            Defer {deferredCandidates.length} tasks
          </button>
        ) : null}

        {compact ? (
          <Link className="button button--ghost button--small" to="/today">
            Open Today
          </Link>
        ) : null}
      </div>
    </section>
  );
}
