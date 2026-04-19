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
  finance_and_admin: "Money",
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

const SZ = 64;
const SW = 3.5;
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
    <section className="status-instrument" data-tier={tier} aria-label="Day status">
      <div className="status-instrument__leader">
        <div className="status-instrument__ring">
          <svg viewBox={`0 0 ${SZ} ${SZ}`} width={SZ} height={SZ}>
            <circle
              className="status-instrument__ring-track"
              cx={SZ / 2}
              cy={SZ / 2}
              r={R}
            />
            <circle
              className="status-instrument__ring-fill"
              cx={SZ / 2}
              cy={SZ / 2}
              r={R}
              strokeDasharray={C}
              strokeDashoffset={dashOffset}
              style={{ "--circ": C } as React.CSSProperties}
            />
          </svg>
          <span className="status-instrument__ring-val">{score}</span>
        </div>

        <div className="status-instrument__leader-text">
          <span className="status-instrument__tier">{scoreLabel}</span>
          <span className="status-instrument__sub">
            {next ? (
              <>+{next.pts} to {next.label}</>
            ) : (
              <span className="status-instrument__peak">Peak</span>
            )}
          </span>
        </div>
      </div>

      <div className="status-instrument__matrix">
        {buckets && buckets.length > 0 ? (
          buckets.map((b) => {
            const pct =
              b.applicablePoints > 0
                ? Math.min((b.earnedPoints / b.applicablePoints) * 100, 100)
                : 0;
            return (
              <div
                key={b.key}
                className={`status-bar${pct >= 100 ? " status-bar--done" : ""}${pct === 0 ? " status-bar--zero" : ""}`}
              >
                <span className="status-bar__label">{BUCKET_SHORT[b.key] ?? b.label}</span>
                <div className="status-bar__track">
                  <div className="status-bar__fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })
        ) : (
          <div className="status-bar">
            <div className="status-bar__track">
              <div className="status-bar__fill" style={{ width: `${score}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="status-instrument__stats">
        <div className="status-stat">
          <span className="status-stat__value">{weeklyMomentum}</span>
          <span className="status-stat__label">Momentum</span>
        </div>

        {strongDayStreak > 0 ? (
          <div className="status-stat status-stat--streak">
            <span className="status-stat__value">{strongDayStreak}d</span>
            <span className="status-stat__label">Strong streak</span>
          </div>
        ) : null}

        {dailyScores && dailyScores.length > 0 ? (
          <div className="status-stat status-stat--spark" aria-label="This week's scores">
            <div className="status-spark">
              {dailyScores.map((d, i) => (
                <span
                  key={d.date}
                  className={`status-spark__bar${i === dailyScores.length - 1 ? " status-spark__bar--today" : ""}`}
                  style={{ height: `${Math.max(d.value, 6)}%` }}
                  title={`${d.date}: ${d.value}`}
                />
              ))}
            </div>
            <span className="status-stat__label">This week</span>
          </div>
        ) : null}

        <div className={`status-stat${reviewClosed ? " status-stat--done" : ""}`}>
          <span className="status-stat__value">
            {reviewClosed ? "Done" : "Open"}
          </span>
          <span className="status-stat__label">Review</span>
        </div>

        <div className="status-stat status-stat--phase">
          <span className="status-stat__value">{phaseName(phase)}</span>
          <span className="status-stat__label">Phase</span>
        </div>
      </div>
    </section>
  );
}
