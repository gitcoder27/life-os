import { useEffect, useRef, useState } from "react";

import type { ConsistencyBar, DailyScore } from "../types";
import { Tally } from "./Tally";

const SPARK_WIDTH = 168;
const SPARK_HEIGHT = 36;
const SPARK_PAD = 4;

function ScoreSparkline({ days }: { days: ConsistencyBar[] }) {
  if (days.length === 0) return null;

  const stepX = days.length > 1 ? (SPARK_WIDTH - SPARK_PAD * 2) / (days.length - 1) : 0;
  const points = days.map((day, index) => ({
    day,
    x: SPARK_PAD + stepX * index,
    y: SPARK_HEIGHT - SPARK_PAD - (Math.max(0, Math.min(day.value, 100)) / 100) * (SPARK_HEIGHT - SPARK_PAD * 2),
  }));
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const last = points[points.length - 1];

  return (
    <svg
      className="hb-hero__spark"
      viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
      role="img"
      aria-label={`Daily score, last ${days.length} days: ${days.map((day) => day.value).join(", ")}`}
    >
      <path className="hb-hero__spark-line" d={path} />
      {points.map((point) => (
        <circle
          key={point.day.date}
          className={`hb-hero__spark-point${point === last ? " is-current" : ""}`}
          cx={point.x}
          cy={point.y}
          r={point === last ? 3 : 1.75}
        >
          <title>{`${point.day.date}: ${point.day.value} (${point.day.label})`}</title>
        </circle>
      ))}
    </svg>
  );
}

type TodayHeroProps = {
  dueCompletedUnits: number;
  dueTargetUnits: number;
  routineCompleted: number;
  routineTotal: number;
  score: DailyScore;
  scoreError: boolean;
  consistencyBars: ConsistencyBar[];
  trendError: boolean;
  momentumValue: number | null | undefined;
  strongDayStreak: number;
};

export function TodayHero({
  dueCompletedUnits,
  dueTargetUnits,
  routineCompleted,
  routineTotal,
  score,
  scoreError,
  consistencyBars,
  trendError,
  momentumValue,
  strongDayStreak,
}: TodayHeroProps) {
  const hasDue = dueTargetUnits > 0;
  const allDone = hasDue && dueCompletedUnits >= dueTargetUnits;
  const celebrate = useCelebration(allDone);
  const initialCount = useRef(dueCompletedUnits);
  const countChanged = dueCompletedUnits !== initialCount.current;

  return (
    <section className={`hb-hero${allDone ? " is-all-done" : ""}`} aria-label="Today's progress">
      <div className="hb-hero__progress">
        <p
          className={`hb-hero__headline${!hasDue || allDone ? " hb-hero__headline--phrase" : ""}`}
          aria-live="polite"
          aria-atomic="true"
        >
          {!hasDue ? (
            "No habits due today."
          ) : allDone ? (
            "All done for today."
          ) : (
            <>
              <span
                key={dueCompletedUnits}
                className={`hb-hero__count${countChanged ? " is-rolling" : ""}`}
              >
                {dueCompletedUnits}
              </span>
              <span className="hb-hero__of"> of </span>
              <span>{dueTargetUnits}</span>
            </>
          )}
        </p>
        <p className="hb-hero__caption">
          {!hasDue
            ? routineTotal > 0
              ? "Your routines for today are below."
              : "Habits show up here on the days they're scheduled."
            : allDone
              ? `${dueTargetUnits} of ${dueTargetUnits} check-ins logged. Nice work.`
              : "check-ins done today"}
        </p>
        <Tally
          total={dueTargetUnits}
          filled={dueCompletedUnits}
          size="lg"
          celebrate={celebrate}
          label={`${dueCompletedUnits} of ${dueTargetUnits} check-ins done today`}
        />
      </div>

      <div className="hb-hero__score">
        <span className="hb-hero__score-label">Today's score</span>
        {scoreError ? (
          <span className="hb-hero__score-empty">Score unavailable</span>
        ) : score ? (
          <span className="hb-hero__score-line">
            <span className="hb-hero__score-value">{score.value}</span>
            <span className="hb-hero__score-word">{score.label}</span>
          </span>
        ) : (
          <span className="hb-hero__score-empty">Loading score</span>
        )}
        {trendError ? (
          <span className="hb-hero__score-empty">Trend unavailable</span>
        ) : consistencyBars.length > 0 ? (
          <span className="hb-hero__trend">
            <ScoreSparkline days={consistencyBars} />
            <span className="hb-hero__trend-label">Last 7 days</span>
          </span>
        ) : (
          <span className="hb-hero__score-empty">The trend appears after a few scored days.</span>
        )}
      </div>

      <dl className="hb-stats">
        {routineTotal > 0 ? (
          <div className="hb-stat">
            <dt className="hb-stat__label">routine steps</dt>
            <dd className="hb-stat__value">
              {routineCompleted} of {routineTotal}
            </dd>
          </div>
        ) : null}
        <div className="hb-stat">
          <dt className="hb-stat__label">momentum</dt>
          <dd className="hb-stat__value">{momentumValue ?? "—"}</dd>
        </div>
        {strongDayStreak > 0 ? (
          <div className="hb-stat">
            <dt className="hb-stat__label">
              strong {strongDayStreak === 1 ? "day" : "days"} in a row
            </dt>
            <dd className="hb-stat__value">{strongDayStreak}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

/** True for a moment when today flips to all-done during this visit, not on load. */
function useCelebration(allDone: boolean) {
  const previous = useRef(allDone);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    const flippedToDone = allDone && !previous.current;
    previous.current = allDone;
    if (!flippedToDone) return;

    setCelebrate(true);
    const timeout = window.setTimeout(() => setCelebrate(false), 900);
    return () => {
      window.clearTimeout(timeout);
      setCelebrate(false);
    };
  }, [allDone]);

  return celebrate;
}
