import { Link } from "react-router-dom";
import {
  useUpsertDayLaunchMutation,
  type DailyLaunchItem,
  type RescueSuggestion,
  type TaskItem,
} from "../../../shared/lib/api";
import type { useTaskActions } from "../hooks/useTaskActions";

type TaskActions = ReturnType<typeof useTaskActions>;

function getReasonLabel(reason: RescueSuggestion["reason"] | DailyLaunchItem["rescueReason"] | null | undefined) {
  switch (reason) {
    case "low_energy":
      return "Low energy";
    case "interruption":
      return "Interrupted focus";
    case "missed_day":
      return "Missed-day pattern";
    case "overload":
      return "Too much on the day";
    default:
      return "Pressure on today";
  }
}

function getModeLabel(launch: DailyLaunchItem | null, suggestion: RescueSuggestion | null, isActive: boolean) {
  if (!isActive) {
    return "Reduce Today";
  }

  return launch?.dayMode === "recovery" || suggestion?.mode === "recovery"
    ? "Reduced Day"
    : "Reduced Day";
}

export function RescueModeCard({
  date,
  launch,
  suggestion,
  mustWinTask,
  deferredCandidates,
  taskActions,
  compact = false,
  strip = false,
}: {
  date: string;
  launch: DailyLaunchItem | null;
  suggestion: RescueSuggestion | null;
  mustWinTask: TaskItem | null;
  deferredCandidates: Array<Pick<TaskItem, "id" | "title">>;
  taskActions?: TaskActions;
  compact?: boolean;
  strip?: boolean;
}) {
  const upsertLaunchMutation = useUpsertDayLaunchMutation(date);
  const isActive = launch?.dayMode === "rescue" || launch?.dayMode === "recovery";
  const isMinimal = isActive && deferredCandidates.length === 0;
  const reason = suggestion?.reason ?? launch?.rescueReason ?? null;
  const reasonLabel = getReasonLabel(reason);
  const modeLabel = getModeLabel(launch, suggestion, isActive);
  const copy = suggestion?.detail ?? "The day has been reduced so you can protect continuity and keep one thing alive.";

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

  const protectedAction =
    suggestion?.minimumViableAction
    ?? mustWinTask?.fiveMinuteVersion
    ?? mustWinTask?.nextAction
    ?? mustWinTask?.title
    ?? null;

  if (strip) {
    return (
      <section className="reduced-day-strip">
        <div className="reduced-day-strip__copy">
          <span className="reduced-day-strip__eyebrow">{modeLabel}</span>
          <strong className="reduced-day-strip__title">One action is protected for the day</strong>
          <span className="reduced-day-strip__detail">
            Why this appeared: {reasonLabel}
          </span>
        </div>

        {protectedAction ? (
          <div className="reduced-day-strip__focus">
            <span className="reduced-day-strip__focus-label">Focus now</span>
            <strong className="reduced-day-strip__focus-value">{protectedAction}</strong>
          </div>
        ) : null}

        <div className="reduced-day-strip__actions">
          <button
            className="button button--ghost button--small"
            type="button"
            disabled={upsertLaunchMutation.isPending}
            onClick={() => void handleExit()}
          >
            {upsertLaunchMutation.isPending ? "Saving..." : "Back to full plan"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`rescue-mode-card${compact ? " rescue-mode-card--compact" : ""}${isMinimal ? " rescue-mode-card--minimal" : ""}${isActive ? " rescue-mode-card--active" : " rescue-mode-card--suggested"}`}
    >
      <div className="rescue-mode-card__header">
        <div>
          <p className="rescue-mode-card__eyebrow">{modeLabel}</p>
          <h2 className="rescue-mode-card__title">
            {isActive
              ? "One action is protected for the day"
              : "Consider shrinking the day before it slips"}
          </h2>
        </div>
        <span className={`rescue-mode-card__badge rescue-mode-card__badge--${isActive ? "active" : "suggested"}`}>
          {isActive ? "on" : "suggested"}
        </span>
      </div>

      <div className="rescue-mode-card__reason">
        <span className="rescue-mode-card__reason-label">Why this appeared</span>
        <strong>{reasonLabel}</strong>
      </div>

      <p className="rescue-mode-card__copy">
        {isActive
          ? "Normal task flow is softened so you can protect one believable action."
          : copy}
      </p>

      {mustWinTask ? (
        <div className="rescue-mode-card__focus">
          <span className="rescue-mode-card__focus-label">{isMinimal ? "Focus now" : "Minimum viable action"}</span>
          <strong>{protectedAction}</strong>
        </div>
      ) : null}

      {isActive ? (
        <p className="rescue-mode-card__effect">
          The main task stream stays de-emphasized while reduced-day mode is active.
        </p>
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
            {upsertLaunchMutation.isPending ? "Saving..." : "Reduce today"}
          </button>
        ) : (
          <button
            className="button button--ghost button--small"
            type="button"
            disabled={upsertLaunchMutation.isPending}
            onClick={() => void handleExit()}
          >
            {upsertLaunchMutation.isPending ? "Saving..." : "Back to full plan"}
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
