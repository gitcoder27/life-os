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

export function TodayHero({
  mode,
  onModeChange,
  plannerBlockCount,
  compact = false,
}: {
  mode: "execute" | "plan";
  onModeChange: (mode: "execute" | "plan") => void;
  plannerBlockCount: number;
  compact?: boolean;
}) {
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

  const pct = score
    ? Math.round((score.earnedPoints / Math.max(score.possiblePoints, 1)) * 100)
    : 0;

  return (
    <section className={`today-hero${compact ? " today-hero--compact" : ""}`}>
      <div className={`today-hero__score${bumped ? " today-hero__score--bumped" : ""}`}>
        {score ? (
          <>
            <HeroScoreRing value={score.value} color={getScoreColor(score.value)} />
            <div className="today-hero__score-info">
              <span className="today-hero__score-label">{score.label}</span>
              <span className="today-hero__score-pts">
                {score.earnedPoints}/{score.possiblePoints} pts ({pct}%)
              </span>
              <HeroBuckets buckets={score.buckets} />
            </div>
            {score.topReasons.length > 0 ? (
              <div className="today-hero__nudge">
                +{score.topReasons[0].missingPoints}pt: {score.topReasons[0].label}
              </div>
            ) : null}
          </>
        ) : (
          <div className="today-hero__score-loading">
            <div className="today-hero__ring-placeholder" />
            <span className="today-hero__score-label">Loading score…</span>
          </div>
        )}
      </div>

      <div className="today-hero__right">
        <div className="mode-toggle">
          <button
            className={`mode-toggle__btn ${mode === "execute" ? "mode-toggle__btn--active" : ""}`}
            type="button"
            onClick={() => onModeChange("execute")}
          >
            <span className="mode-toggle__icon">▶</span>
            Execute
          </button>
          <button
            className={`mode-toggle__btn ${mode === "plan" ? "mode-toggle__btn--active" : ""}`}
            type="button"
            onClick={() => onModeChange("plan")}
          >
            <span className="mode-toggle__icon">◫</span>
            Plan
            {plannerBlockCount > 0 ? (
              <span className="mode-toggle__badge">{plannerBlockCount}</span>
            ) : null}
          </button>
        </div>
      </div>
    </section>
  );
}

function HeroScoreRing({ value, color }: { value: number; color: string }) {
  const size = 72;
  const strokeWidth = 5;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="today-hero__ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="today-hero__ring-progress"
        />
      </svg>
      <span className="today-hero__ring-value">{value}</span>
    </div>
  );
}

type ScoreBucket = {
  key: string;
  label: string;
  earnedPoints: number;
  applicablePoints: number;
  explanation: string;
};

function HeroBuckets({ buckets }: { buckets: ScoreBucket[] }) {
  const visible = buckets.filter((b) => b.applicablePoints > 0);
  if (visible.length === 0) return null;

  return (
    <div className="today-hero__buckets">
      {visible.map((bucket) => {
        const meta = BUCKET_META[bucket.key] ?? { label: bucket.label, icon: "•" };
        const fill = bucket.applicablePoints > 0
          ? (bucket.earnedPoints / bucket.applicablePoints) * 100
          : 0;
        return (
          <div
            key={bucket.key}
            className="today-hero__bucket"
            title={`${bucket.label}: ${bucket.earnedPoints}/${bucket.applicablePoints}`}
          >
            <div className="today-hero__bucket-bar">
              <div className="today-hero__bucket-fill" style={{ width: `${fill}%` }} />
            </div>
            <span className="today-hero__bucket-label">{meta.icon} {meta.label}</span>
          </div>
        );
      })}
    </div>
  );
}
