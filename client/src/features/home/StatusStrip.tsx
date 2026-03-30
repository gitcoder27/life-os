import { ScoreRing } from "../../shared/ui/ScoreRing";

type TimePhase = "morning" | "midday" | "evening";

type StatusStripProps = {
  score: number;
  scoreLabel: string;
  weeklyMomentum: number;
  strongDayStreak: number;
  reviewClosed: boolean;
  phase: TimePhase;
};

function phaseLabel(phase: TimePhase) {
  if (phase === "morning") return "Morning";
  if (phase === "midday") return "Afternoon";
  return "Evening";
}

export function StatusStrip({
  score,
  scoreLabel,
  weeklyMomentum,
  strongDayStreak,
  reviewClosed,
  phase,
}: StatusStripProps) {
  return (
    <div className="status-strip">
      <div className="status-strip__score">
        <ScoreRing value={score} label={scoreLabel} size={36} />
        <div className="status-strip__score-text">
          <span className="status-strip__score-value">{score}</span>
          <span className="status-strip__score-label">{scoreLabel}</span>
        </div>
      </div>

      <div className="status-strip__chips">
        <span className="status-chip">
          <span className="status-chip__value">{weeklyMomentum}</span>
          <span className="status-chip__label">Momentum</span>
        </span>

        {strongDayStreak > 0 ? (
          <span className="status-chip status-chip--streak">
            <span className="status-chip__value">{strongDayStreak}d</span>
            <span className="status-chip__label">Streak</span>
          </span>
        ) : null}

        <span className={`status-chip ${reviewClosed ? "status-chip--done" : "status-chip--open"}`}>
          <span className="status-chip__value">
            {reviewClosed ? "Closed" : "Open"}
          </span>
          <span className="status-chip__label">Review</span>
        </span>

        <span className="status-chip status-chip--phase">
          <span className="status-chip__value">{phaseLabel(phase)}</span>
        </span>
      </div>
    </div>
  );
}
