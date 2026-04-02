import { type CSSProperties } from "react";

import type {
  ConsistencyBar,
  DailyScore,
} from "../types";

function getScoreColor(value: number) {
  if (value >= 85) return "var(--positive)";
  if (value >= 70) return "var(--accent-bright)";
  if (value >= 50) return "var(--accent)";
  return "var(--negative)";
}

function HabitScoreRing({ value, color }: { value: number; color: string }) {
  const size = 50;
  const strokeWidth = 4;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="habits-score-strip__ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="habits-score-strip__ring-progress"
        />
      </svg>
      <span className="habits-score-strip__ring-value">{value}</span>
    </div>
  );
}

function buildSparklinePoints(days: ConsistencyBar[]) {
  const width = 280;
  const height = 44;
  const paddingX = 4;
  const paddingY = 4;
  const stepX = days.length > 1 ? (width - paddingX * 2) / (days.length - 1) : 0;

  return days.map((day, index) => {
    const x = paddingX + stepX * index;
    const normalizedValue = Math.max(0, Math.min(day.value, 100));
    const y = height - paddingY - (normalizedValue / 100) * (height - paddingY * 2);

    return { x, y, day };
  });
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

function buildAreaPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";

  const height = 44;
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  return `${buildLinePath(points)} L ${lastPoint.x} ${height} L ${firstPoint.x} ${height} Z`;
}

function ScoreTrendSparkline({ days }: { days: ConsistencyBar[] }) {
  const width = 280;
  const height = 44;
  const points = buildSparklinePoints(days);
  const currentPoint = points[points.length - 1];

  if (points.length === 0) return null;

  return (
    <div className="habits-score-strip__sparkline" aria-label="Daily score trend">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="habits-score-strip__sparkline-chart"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="habitScoreTrendArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(240, 192, 96, 0.16)" />
            <stop offset="100%" stopColor="rgba(240, 192, 96, 0.01)" />
          </linearGradient>
        </defs>
        <path d={buildAreaPath(points)} fill="url(#habitScoreTrendArea)" />
        <path
          d={buildLinePath(points)}
          fill="none"
          stroke="var(--accent-bright)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point, index) => (
          <circle
            key={point.day.date}
            cx={point.x}
            cy={point.y}
            r={index === points.length - 1 ? 3.75 : 2.25}
            className={`habits-score-strip__sparkline-point${index === points.length - 1 ? " habits-score-strip__sparkline-point--current" : ""}`}
          >
            <title>{`${point.day.date}: ${point.day.value} (${point.day.label})`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

type HabitsScoreStripProps = {
  score: DailyScore;
  scoreError: boolean;
  scorePercent: number;
  consistencyBars: ConsistencyBar[];
  trendError: boolean;
  statsCount: number;
  dueCompletedUnits: number;
  dueTargetUnits: number;
  routineCompleted: number;
  routineTotal: number;
  momentumValue: number | null | undefined;
  strongDayStreak: number;
};

export function HabitsScoreStrip({
  score,
  scoreError,
  scorePercent,
  consistencyBars,
  trendError,
  statsCount,
  dueCompletedUnits,
  dueTargetUnits,
  routineCompleted,
  routineTotal,
  momentumValue,
  strongDayStreak,
}: HabitsScoreStripProps) {
  return (
    <section className="habits-score-strip" aria-label="Habit score summary">
      <div className="habits-score-strip__primary">
        {scoreError ? (
          <>
            <div className="habits-score-strip__ring-placeholder" />
            <div className="habits-score-strip__primary-body">
              <span className="habits-score-strip__eyebrow">Overall score</span>
              <span className="habits-score-strip__label">Score unavailable</span>
            </div>
          </>
        ) : score ? (
          <>
            <HabitScoreRing value={score.value} color={getScoreColor(score.value)} />
            <div className="habits-score-strip__primary-body">
              <span className="habits-score-strip__eyebrow">Overall score</span>
              <div className="habits-score-strip__headline">
                <span className="habits-score-strip__label">{score.label}</span>
                <span className="habits-score-strip__value">{score.value}</span>
              </div>
              <span className="habits-score-strip__pts">
                {score.earnedPoints}/{score.possiblePoints} pts ({scorePercent}%)
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="habits-score-strip__ring-placeholder" />
            <div className="habits-score-strip__primary-body">
              <span className="habits-score-strip__eyebrow">Overall score</span>
              <span className="habits-score-strip__label">Loading score...</span>
            </div>
          </>
        )}
      </div>

      <div className="habits-score-strip__trend">
        <div className="habits-score-strip__trend-header">
          <span className="habits-score-strip__trend-label">Daily score trend</span>
          <span className="habits-score-strip__trend-period">Last 7 days</span>
        </div>
        {trendError ? (
          <span className="habits-score-strip__trend-empty">
            Trend unavailable right now.
          </span>
        ) : consistencyBars.length > 0 ? (
          <ScoreTrendSparkline days={consistencyBars} />
        ) : (
          <span className="habits-score-strip__trend-empty">
            Trend will appear after a few scored days.
          </span>
        )}
      </div>

      <div
        className="habits-score-strip__stats"
        style={{ "--stats-count": statsCount } as CSSProperties}
      >
        <div className="habits-score-strip__stat">
          <span className="habits-score-strip__stat-label">Habit progress</span>
          <span className="habits-score-strip__stat-value">
            {dueTargetUnits > 0 ? `${dueCompletedUnits}/${dueTargetUnits}` : "None"}
          </span>
        </div>
        <div className="habits-score-strip__stat">
          <span className="habits-score-strip__stat-label">Routine steps</span>
          <span className="habits-score-strip__stat-value">
            {routineTotal > 0 ? `${routineCompleted}/${routineTotal}` : "None"}
          </span>
        </div>
        <div className="habits-score-strip__stat">
          <span className="habits-score-strip__stat-label">Momentum</span>
          <span className="habits-score-strip__stat-value">{momentumValue ?? "—"}</span>
        </div>
        {strongDayStreak > 0 ? (
          <div className="habits-score-strip__stat">
            <span className="habits-score-strip__stat-label">Strong days</span>
            <span className="habits-score-strip__stat-value">{strongDayStreak}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
