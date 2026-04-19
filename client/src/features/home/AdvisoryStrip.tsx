import {
  useUpsertDayLaunchMutation,
  type DailyLaunchItem,
  type RescueSuggestion,
  type TaskItem,
} from "../../shared/lib/api";

type AdvisoryStripProps = {
  date: string;
  launch: DailyLaunchItem | null;
  suggestion: RescueSuggestion | null;
  mustWinTask: TaskItem | null;
};

function reasonLabel(reason: RescueSuggestion["reason"] | DailyLaunchItem["rescueReason"] | null | undefined) {
  switch (reason) {
    case "low_energy":
      return "Low energy";
    case "interruption":
      return "Interrupted focus";
    case "missed_day":
      return "Missed-day pattern";
    case "overload":
      return "Overloaded";
    default:
      return "Pressure on today";
  }
}

export function AdvisoryStrip({
  date,
  launch,
  suggestion,
  mustWinTask,
}: AdvisoryStripProps) {
  const upsertLaunchMutation = useUpsertDayLaunchMutation(date);
  const isActive = launch?.dayMode === "rescue" || launch?.dayMode === "recovery";

  if (!suggestion && !isActive) {
    return null;
  }

  const reason = suggestion?.reason ?? launch?.rescueReason ?? null;
  const protectedAction =
    suggestion?.minimumViableAction ??
    mustWinTask?.fiveMinuteVersion ??
    mustWinTask?.nextAction ??
    mustWinTask?.title ??
    null;

  async function handleActivate() {
    if (!suggestion) return;
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

  return (
    <section className={`advisory-strip${isActive ? " advisory-strip--active" : ""}`}>
      <span className="advisory-strip__dot" />

      <div className="advisory-strip__copy">
        <span className="advisory-strip__eyebrow">
          {isActive ? "Reduced day" : "Consider reducing today"}
        </span>
        <p className="advisory-strip__body">
          {isActive
            ? protectedAction
              ? `Protecting: ${protectedAction}`
              : "One action protected for the day."
            : suggestion?.detail ?? "Today is showing pressure. A softer shape keeps continuity."}
          {" · "}
          <span className="advisory-strip__reason">{reasonLabel(reason)}</span>
        </p>
      </div>

      <div className="advisory-strip__actions">
        {!isActive ? (
          <button
            type="button"
            className="advisory-strip__btn advisory-strip__btn--primary"
            disabled={upsertLaunchMutation.isPending}
            onClick={() => void handleActivate()}
          >
            {upsertLaunchMutation.isPending ? "Saving…" : "Reduce today"}
          </button>
        ) : (
          <button
            type="button"
            className="advisory-strip__btn"
            disabled={upsertLaunchMutation.isPending}
            onClick={() => void handleExit()}
          >
            {upsertLaunchMutation.isPending ? "Saving…" : "Back to full plan"}
          </button>
        )}
      </div>
    </section>
  );
}
