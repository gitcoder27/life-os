import type {
  AdaptiveNextMove,
  AdaptiveNextMoveAction,
} from "@life-os/contracts";

type NextMoveStripProps = {
  nextMove: AdaptiveNextMove | null;
  loading?: boolean;
  onAction: (action: AdaptiveNextMoveAction, move: AdaptiveNextMove) => void;
};

export function NextMoveStrip({
  nextMove,
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

  return (
    <div className={`adaptive-strip adaptive-strip--${nextMove.severity}`} aria-live="polite">
      <span className="adaptive-strip__dot" />
      <div className="adaptive-strip__copy">
        <span className="adaptive-strip__title">{nextMove.title}</span>
        <span className="adaptive-strip__reason">{nextMove.reason}</span>
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
