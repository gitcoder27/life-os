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

export function RescueModeCard({
  date,
  launch,
  suggestion,
  deferredCandidates,
  taskActions,
}: {
  date: string;
  launch: DailyLaunchItem | null;
  suggestion: RescueSuggestion | null;
  mustWinTask?: TaskItem | null;
  deferredCandidates: Array<Pick<TaskItem, "id" | "title">>;
  taskActions?: TaskActions;
  compact?: boolean;
  strip?: boolean;
}) {
  const upsertLaunchMutation = useUpsertDayLaunchMutation(date);
  const isActive = launch?.dayMode === "rescue" || launch?.dayMode === "recovery";
  const reason = suggestion?.reason ?? launch?.rescueReason ?? null;
  const reasonLabel = getReasonLabel(reason);
  const detail = suggestion?.detail ?? "The day has been reduced so you can protect continuity and keep one thing alive.";

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

  // Always render as a slim advisory strip in the redesigned Today.
  // Never a boxed hero competitor.
  const eyebrow = isActive ? "Reduced day" : "Reduce today";
  const title = isActive
    ? "One action is protected for the day."
    : "Consider shrinking the day before it slips.";
  const showDefer = isActive && deferredCandidates.length > 1 && taskActions;

  return (
    <section className={`reduced-day-strip${isActive ? " reduced-day-strip--active" : " reduced-day-strip--suggested"}`}>
      <div className="reduced-day-strip__copy">
        <span className="reduced-day-strip__eyebrow">{eyebrow}</span>
        <strong className="reduced-day-strip__title">{title}</strong>
        <span className="reduced-day-strip__detail">
          {isActive ? `Why this appeared: ${reasonLabel}` : detail}
        </span>
      </div>

      <div className="reduced-day-strip__actions">
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
          <>
            {showDefer ? (
              <button
                className="button button--ghost button--small"
                type="button"
                disabled={taskActions.isPending}
                onClick={() =>
                  void taskActions.moveTasksToTomorrow(deferredCandidates.map((task) => task.id))
                }
              >
                Defer {deferredCandidates.length}
              </button>
            ) : null}
            <button
              className="button button--ghost button--small"
              type="button"
              disabled={upsertLaunchMutation.isPending}
              onClick={() => void handleExit()}
            >
              {upsertLaunchMutation.isPending ? "Saving..." : "Back to full plan"}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
