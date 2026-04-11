import {
  useUpsertDayLaunchMutation,
  type DailyLaunchItem,
  type RescueSuggestion,
} from "../../../shared/lib/api";

export function PreLaunchModeNotice({
  date,
  launch,
  suggestion,
}: {
  date: string;
  launch: DailyLaunchItem | null;
  suggestion: RescueSuggestion | null;
}) {
  const upsertLaunchMutation = useUpsertDayLaunchMutation(date);
  const isDowngraded = launch?.dayMode === "rescue" || launch?.dayMode === "recovery";
  const isPrefilled = isDowngraded && !launch?.completedAt && !launch?.rescueActivatedAt;

  if (!launch || !isPrefilled) {
    return null;
  }

  const isRecovery = launch.dayMode === "recovery";

  return (
    <section className={`recovery-strip${isRecovery ? " recovery-strip--recovery" : ""}`}>
      <span className="recovery-strip__indicator" />
      <div className="recovery-strip__body">
        <div className="recovery-strip__title">
          {isRecovery ? "Recovery Mode is preloaded for today" : "Rescue Mode is preloaded for today"}
        </div>
        <div className="recovery-strip__detail">
          {suggestion?.detail ??
            "This lighter day was queued from your last review. Continue with launch to keep it, or return to normal if today has more room."}
        </div>
      </div>
      <div className="recovery-strip__actions">
        <button
          className="button button--ghost button--small"
          type="button"
          disabled={upsertLaunchMutation.isPending}
          onClick={() =>
            void upsertLaunchMutation.mutateAsync({
              dayMode: "normal",
              rescueReason: null,
            })}
        >
          {upsertLaunchMutation.isPending ? "Saving..." : "Return to normal"}
        </button>
      </div>
    </section>
  );
}
