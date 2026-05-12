import type {
  AdaptiveNextMove,
  AdaptiveNextMoveAction,
  BehaviorStateSnapshot,
} from "@life-os/contracts";

type NextMoveStripProps = {
  nextMove: AdaptiveNextMove | null;
  behaviorState?: BehaviorStateSnapshot | null;
  loading?: boolean;
  onAction: (action: AdaptiveNextMoveAction, move: AdaptiveNextMove) => void;
};

export function NextMoveStrip({
  nextMove,
  behaviorState = null,
  loading = false,
  onAction,
}: NextMoveStripProps) {
  if (!nextMove && !loading) {
    return null;
  }

  if (loading && !nextMove) {
    return (
      <div className="adaptive-strip adaptive-strip--loading" aria-live="polite">
        <span className="adaptive-strip__dot" />
        <span className="adaptive-strip__title">Finding next move</span>
      </div>
    );
  }

  if (!nextMove) {
    return null;
  }

  const severity = behaviorState?.severity ?? nextMove.severity;
  const title = behaviorState?.title ?? nextMove.title;
  const reason = behaviorState?.reason ?? nextMove.reason;
  const label = behaviorState?.label ?? "Next";

  return (
    <div className={`adaptive-strip adaptive-strip--${severity}`} aria-live="polite">
      <span className="adaptive-strip__dot" />
      <div className="adaptive-strip__copy">
        <span className="adaptive-strip__state">{label}</span>
        <span className="adaptive-strip__title">{title}</span>
        <span className="adaptive-strip__reason">{reason}</span>
      </div>
      <div className="adaptive-strip__actions">
        {nextMove.secondaryAction ? (
          <button
            className="adaptive-strip__secondary"
            type="button"
            onClick={() => onAction(nextMove.secondaryAction!, nextMove)}
          >
            {nextMove.secondaryAction.label}
          </button>
        ) : null}
        <button
          className="adaptive-strip__primary"
          type="button"
          onClick={() => onAction(nextMove.primaryAction, nextMove)}
        >
          {nextMove.primaryAction.label}
        </button>
      </div>
    </div>
  );
}
