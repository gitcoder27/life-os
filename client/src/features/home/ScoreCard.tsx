import { ScoreRing } from "../../shared/ui/ScoreRing";

type ScoreBucket = {
  key: string;
  label: string;
  earnedPoints: number;
  applicablePoints: number;
};

type ScoreHeroProps = {
  value: number;
  label: string;
  earnedPoints: number;
  possiblePoints: number;
  weeklyMomentum: number;
  strongDayStreak: number;
  reviewClosed: boolean;
  buckets: ScoreBucket[];
  topReasonLabel: string | null;
};

export function ScoreCard({
  value,
  label,
  earnedPoints,
  possiblePoints,
  weeklyMomentum,
  strongDayStreak,
  reviewClosed,
  buckets,
  topReasonLabel,
}: ScoreHeroProps) {
  return (
    <div className="score-hero-card">
      <div className="score-hero-card__top">
        <div className="score-hero-card__ring-area">
          <ScoreRing value={value} label={label} size={150} />
        </div>
        <div className="score-hero-card__info">
          <div className="score-hero-card__value-row">
            <span className="score-hero-card__value">{value}</span>
            <span className="score-hero-card__band">{label}</span>
          </div>
          <p className="score-hero-card__copy">
            {topReasonLabel ??
              "Live score reflects your planning, habits, and health data."}
          </p>
          <p className="score-hero-card__detail">
            {Math.round(earnedPoints)} of {possiblePoints} available points
            earned today.
          </p>
        </div>
      </div>

      {buckets.length > 0 ? (
        <div className="score-hero-card__buckets">
          {buckets.map((bucket) => {
            const pct =
              bucket.applicablePoints > 0
                ? (bucket.earnedPoints / bucket.applicablePoints) * 100
                : 0;
            return (
              <div key={bucket.key} className="score-bucket">
                <span className="score-bucket__label">{bucket.label}</span>
                <div className="score-bucket__bar">
                  <div
                    className="score-bucket__fill"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="score-bucket__value">
                  {Math.round(bucket.earnedPoints)}/{bucket.applicablePoints}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="score-hero-card__metrics">
        <div className="score-hero-card__metric">
          <span className="score-hero-card__metric-value">
            {weeklyMomentum}
          </span>
          <span className="score-hero-card__metric-label">
            Weekly Momentum
          </span>
        </div>
        <div className="score-hero-card__metric">
          <span className="score-hero-card__metric-value">
            {strongDayStreak} days
          </span>
          <span className="score-hero-card__metric-label">
            Strong Day Streak
          </span>
        </div>
        <div className="score-hero-card__metric">
          <span className="score-hero-card__metric-value">
            {reviewClosed ? "Daily closed" : "Daily open"}
          </span>
          <span className="score-hero-card__metric-label">
            Review Readiness
          </span>
        </div>
      </div>
    </div>
  );
}
