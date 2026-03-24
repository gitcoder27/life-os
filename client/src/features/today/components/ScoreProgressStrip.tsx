import { useEffect, useRef, useState } from "react";
import { useDailyScoreQuery, getTodayDate } from "../../../shared/lib/api";

const BUCKET_META: Record<string, { label: string; icon: string }> = {
  plan_and_priorities: { label: "Plan", icon: "🎯" },
  routines_and_habits: { label: "Routines", icon: "⚡" },
  health_basics: { label: "Health", icon: "💧" },
  finance_and_admin: { label: "Finance", icon: "📊" },
  review_and_reset: { label: "Review", icon: "✦" },
};

function getScoreColor(value: number) {
  if (value >= 85) return "var(--positive)";
  if (value >= 70) return "var(--accent-bright)";
  if (value >= 50) return "var(--accent)";
  return "var(--negative)";
}

export function ScoreProgressStrip() {
  const today = getTodayDate();
  const scoreQuery = useDailyScoreQuery(today);
  const score = scoreQuery.data;

  const prevValueRef = useRef<number | null>(null);
  const [bumped, setBumped] = useState(false);

  useEffect(() => {
    if (score && prevValueRef.current !== null && score.value !== prevValueRef.current) {
      setBumped(true);
      const timer = setTimeout(() => setBumped(false), 600);
      return () => clearTimeout(timer);
    }
    if (score) prevValueRef.current = score.value;
  }, [score?.value]);

  if (!score) {
    return (
      <div className="today-score-strip today-score-strip--loading">
        <div className="today-score-strip__ring-wrap">
          <div className="today-score-strip__ring-placeholder" />
        </div>
        <div className="today-score-strip__body">
          <span className="today-score-strip__label">Loading score…</span>
        </div>
      </div>
    );
  }

  const pct = Math.round((score.earnedPoints / Math.max(score.possiblePoints, 1)) * 100);
  const ringColor = getScoreColor(score.value);

  return (
    <div className={`today-score-strip${bumped ? " today-score-strip--bumped" : ""}`}>
      <div className="today-score-strip__ring-wrap">
        <MiniScoreRing value={score.value} color={ringColor} />
      </div>

      <div className="today-score-strip__body">
        <div className="today-score-strip__headline">
          <span className="today-score-strip__label">{score.label}</span>
          <span className="today-score-strip__pts">
            {score.earnedPoints}/{score.possiblePoints} pts ({pct}%)
          </span>
        </div>

        <div className="today-score-strip__buckets">
          {score.buckets
            .filter((b) => b.applicablePoints > 0)
            .map((bucket) => {
              const meta = BUCKET_META[bucket.key] ?? { label: bucket.label, icon: "•" };
              const fill = bucket.applicablePoints > 0
                ? (bucket.earnedPoints / bucket.applicablePoints) * 100
                : 0;
              return (
                <div
                  key={bucket.key}
                  className="today-score-bucket"
                  title={`${bucket.label}: ${bucket.earnedPoints}/${bucket.applicablePoints} — ${bucket.explanation}`}
                >
                  <div className="today-score-bucket__bar">
                    <div
                      className="today-score-bucket__fill"
                      style={{ width: `${fill}%` }}
                    />
                  </div>
                  <span className="today-score-bucket__label">
                    {meta.icon} {meta.label}
                  </span>
                </div>
              );
            })}
        </div>
      </div>

      {score.topReasons.length > 0 ? (
        <div className="today-score-strip__nudge">
          <span className="today-score-strip__nudge-text">
            +{score.topReasons[0].missingPoints}pt: {score.topReasons[0].label}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function MiniScoreRing({ value, color }: { value: number; color: string }) {
  const size = 48;
  const strokeWidth = 4;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="today-mini-ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="today-mini-ring__progress"
        />
      </svg>
      <span className="today-mini-ring__value">{value}</span>
    </div>
  );
}
