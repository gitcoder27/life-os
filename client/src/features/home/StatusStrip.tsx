type TimePhase = "morning" | "midday" | "evening";

type BucketInfo = {
  key: string;
  label: string;
  earnedPoints: number;
  applicablePoints: number;
};

type DayScoreInfo = {
  date: string;
  value: number;
};

type StatusStripProps = {
  score: number;
  scoreLabel: string;
  buckets: BucketInfo[] | null;
  weeklyMomentum: number;
  strongDayStreak: number;
  dailyScores: DayScoreInfo[] | null;
  reviewClosed: boolean;
  phase: TimePhase;
};

const BUCKET_SHORT: Record<string, string> = {
  plan_and_priorities: "Plan",
  routines_and_habits: "Habits",
  health_basics: "Health",
  finance_and_admin: "Finance",
  review_and_reset: "Review",
};

function tierKey(label: string) {
  if (label.includes("Strong")) return "strong";
  if (label.includes("Solid")) return "solid";
  if (label.includes("Recovering")) return "recovering";
  return "off-track";
}

function nextTier(score: number) {
  if (score >= 85) return null;
  if (score >= 70) return { label: "Strong", pts: 85 - score };
  if (score >= 55) return { label: "Solid", pts: 70 - score };
  return { label: "Recovering", pts: 55 - score };
}

function phaseName(p: TimePhase) {
  if (p === "morning") return "Morning";
  if (p === "midday") return "Afternoon";
  return "Evening";
}

const SZ = 56;
const SW = 4;
const R = (SZ - SW * 2) / 2;
const C = 2 * Math.PI * R;

export function StatusStrip({
  score,
  scoreLabel,
  buckets,
  weeklyMomentum,
  strongDayStreak,
  dailyScores,
  reviewClosed,
  phase,
}: StatusStripProps) {
  const tier = tierKey(scoreLabel);
  const next = nextTier(score);
  const dashOffset = C - (score / 100) * C;

  return (
    <div className="day-hud" data-tier={tier}>
      {/* ── Score Ring ── */}
      <div className="day-hud__score">
        <div className="day-hud__ring">
          <svg viewBox={`0 0 ${SZ} ${SZ}`} width={SZ} height={SZ}>
            <circle
              className="day-hud__ring-track"
              cx={SZ / 2}
              cy={SZ / 2}
              r={R}
            />
            <circle
              className="day-hud__ring-fill"
              cx={SZ / 2}
              cy={SZ / 2}
              r={R}
              strokeDasharray={C}
              strokeDashoffset={dashOffset}
              style={{ "--circ": C } as React.CSSProperties}
            />
          </svg>
          <span className="day-hud__ring-val">{score}</span>
        </div>
      </div>

      {/* ── Progress ── */}
      <div className="day-hud__progress">
        <div className="day-hud__head">
          <span className="day-hud__tier">{scoreLabel}</span>
          {next ? (
            <span className="day-hud__next">
              +{next.pts} to {next.label}
            </span>
          ) : (
            <span className="day-hud__next day-hud__next--peak">
              Peak performance
            </span>
          )}
        </div>

        {buckets && buckets.length > 0 ? (
          <div className="day-hud__segments">
            {buckets.map((b) => {
              const pct =
                b.applicablePoints > 0
                  ? (b.earnedPoints / b.applicablePoints) * 100
                  : 0;
              return (
                <div
                  key={b.key}
                  className={`day-hud__seg${pct >= 100 ? " day-hud__seg--done" : ""}${pct === 0 ? " day-hud__seg--zero" : ""}`}
                >
                  <div className="day-hud__seg-track">
                    <div
                      className="day-hud__seg-fill"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <span className="day-hud__seg-label">
                    {BUCKET_SHORT[b.key] ?? b.label}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="day-hud__fallback-track">
            <div
              className="day-hud__fallback-fill"
              style={{ width: `${score}%` }}
            />
          </div>
        )}
      </div>

      {/* ── Stats ── */}
      <div className="day-hud__stats">
        <div className="day-hud__stat">
          <span className="day-hud__stat-val">{weeklyMomentum}</span>
          <span className="day-hud__stat-lbl">Momentum</span>
        </div>

        {strongDayStreak > 0 && (
          <div className="day-hud__stat day-hud__stat--streak">
            <span className="day-hud__stat-val">
              <span className="day-hud__flame">🔥</span>
              {strongDayStreak}
            </span>
            <span className="day-hud__stat-lbl">Streak</span>
          </div>
        )}

        {dailyScores && dailyScores.length > 0 && (
          <div className="day-hud__sparkline" aria-label="This week">
            {dailyScores.map((d, i) => (
              <div
                key={d.date}
                className={`day-hud__spark${i === dailyScores.length - 1 ? " day-hud__spark--today" : ""}`}
                style={{ height: `${Math.max(d.value, 6)}%` }}
                title={`${d.date}: ${d.value}`}
              />
            ))}
          </div>
        )}

        <div
          className={`day-hud__stat ${reviewClosed ? "day-hud__stat--done" : "day-hud__stat--open"}`}
        >
          <span className="day-hud__stat-val">
            {reviewClosed ? "✓" : "○"}
          </span>
          <span className="day-hud__stat-lbl">Review</span>
        </div>

        <div className="day-hud__stat day-hud__stat--phase">
          <span className="day-hud__stat-val">{phaseName(phase)}</span>
        </div>
      </div>
    </div>
  );
}
