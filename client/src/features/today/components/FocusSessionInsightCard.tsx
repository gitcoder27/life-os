import type { FocusTaskInsight } from "../../../shared/lib/api";

type FocusSessionInsightCardProps = {
  insight: FocusTaskInsight;
  onOpenStartProtocol?: () => void;
};

export function FocusSessionInsightCard({
  insight,
  onOpenStartProtocol,
}: FocusSessionInsightCardProps) {
  const showClarifyCta =
    insight.suggestedAdjustment === "clarify_next_action" &&
    typeof onOpenStartProtocol === "function";
  const modifier =
    insight.suggestedAdjustment === "clarify_next_action"
      ? " focus-session-insight--clarify"
      : insight.suggestedAdjustment === "shorten_session"
        ? " focus-session-insight--shorten"
        : "";

  return (
    <div className={`focus-session-insight${modifier}`}>
      <span className="focus-session-insight__label">Recent pattern</span>
      <p className="focus-session-insight__message">{insight.summaryMessage}</p>
      {showClarifyCta ? (
        <button
          className="button button--ghost button--small focus-session-insight__cta"
          type="button"
          onClick={onOpenStartProtocol}
        >
          Tighten next action
        </button>
      ) : null}
    </div>
  );
}
