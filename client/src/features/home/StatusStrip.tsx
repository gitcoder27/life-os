import { Link } from "react-router-dom";
import { type CSSProperties, useState } from "react";

import {
  type ScoreHistoryDay,
  useScoreHistoryQuery,
} from "../../shared/lib/api";

import { ScoreHistoryRibbon } from "./ScoreHistoryRibbon";

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
  date: string;
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

const HISTORY_LEGEND = [
  { label: "Unscored", tone: "empty" },
  { label: "Off-track", tone: "off-track" },
  { label: "Recovering", tone: "recovering" },
  { label: "Solid", tone: "solid" },
  { label: "Strong", tone: "strong" },
] as const;

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

function phaseName(phase: TimePhase) {
  if (phase === "morning") return "Morning";
  if (phase === "midday") return "Afternoon";
  return "Evening";
}

function labelFromValue(value: number): ScoreHistoryDay["label"] {
  if (value >= 85) return "Strong Day";
  if (value >= 70) return "Solid Day";
  if (value >= 55) return "Recovering Day";
  return "Off-Track Day";
}

function buildFallbackHistory(days: DayScoreInfo[] | null): ScoreHistoryDay[] | null {
  if (!days || days.length === 0) {
    return null;
  }

  return days.map((day) => ({
    date: day.date,
    value: day.value,
    label: labelFromValue(day.value),
    finalized: true,
    isToday: false,
  }));
}

function countSolidDays(entries: ScoreHistoryDay[]) {
  return entries.filter((entry) => (entry.value ?? 0) >= 70).length;
}

function formatPreviewSummary(entries: ScoreHistoryDay[] | null, days: number) {
  if (!entries || entries.length === 0) {
    return null;
  }

  return `${countSolidDays(entries)}/${days} solid+`;
}

function formatAverageDelta(current: number | null, previous: number | null) {
  if (current === null) {
    return "Waiting for scored days";
  }

  if (previous === null) {
    return "New this week";
  }

  const delta = current - previous;
  if (delta === 0) {
    return "Steady vs prev";
  }

  return `${delta > 0 ? "+" : ""}${delta} vs prev`;
}

function buildHistoryDetailText(
  solidPlusDays: number | null,
  totalDays: number | null,
  isError: boolean,
) {
  if (isError) {
    return "Open the reflection archive for a longer-range view.";
  }

  if (solidPlusDays === null || totalDays === null) {
    return "Pulling together your recent consistency pattern.";
  }

  if (solidPlusDays === 0) {
    return "Close a few days cleanly and the pattern will start to show.";
  }

  return `${solidPlusDays}/${totalDays} days landed at solid or better.`;
}

const SZ = 64;
const SW = 3.5;
const R = (SZ - SW * 2) / 2;
const C = 2 * Math.PI * R;

export function StatusStrip({
  date,
  score,
  scoreLabel,
  buckets,
  weeklyMomentum,
  strongDayStreak,
  dailyScores,
  reviewClosed,
  phase,
}: StatusStripProps) {
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const previewHistoryQuery = useScoreHistoryQuery(date, 7);
  const expandedHistoryQuery = useScoreHistoryQuery(date, 30, historyLoaded);

  const tier = tierKey(scoreLabel);
  const next = nextTier(score);
  const dashOffset = C - (score / 100) * C;

  const fallbackHistory = buildFallbackHistory(dailyScores);
  const previewEntries = previewHistoryQuery.data?.entries ?? fallbackHistory;
  const previewSummary =
    previewHistoryQuery.data
      ? `${previewHistoryQuery.data.summary.solidPlusDays}/${previewHistoryQuery.data.days} solid+`
      : fallbackHistory
        ? formatPreviewSummary(fallbackHistory, fallbackHistory.length)
        : previewHistoryQuery.isError
          ? "Unavailable"
          : "Loading…";
  const expandedSummary = expandedHistoryQuery.data?.summary ?? null;
  const expandedDays = expandedHistoryQuery.data?.days ?? null;
  const historyDetail = buildHistoryDetailText(
    expandedSummary?.solidPlusDays ?? null,
    expandedDays,
    expandedHistoryQuery.isError,
  );

  function handleToggleHistory() {
    setHistoryLoaded(true);
    setHistoryExpanded((current) => !current);
  }

  return (
    <section
      className={`status-instrument${historyExpanded ? " status-instrument--history-open" : ""}`}
      data-tier={tier}
      aria-label="Day status"
    >
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
              style={{ "--circ": C } as CSSProperties}
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
          buckets.map((bucket) => {
            const percentage =
              bucket.applicablePoints > 0
                ? Math.min((bucket.earnedPoints / bucket.applicablePoints) * 100, 100)
                : 0;
            return (
              <div
                key={bucket.key}
                className={`status-bar${percentage >= 100 ? " status-bar--done" : ""}${percentage === 0 ? " status-bar--zero" : ""}`}
              >
                <span className="status-bar__label">{BUCKET_SHORT[bucket.key] ?? bucket.label}</span>
                <div className="status-bar__track">
                  <div className="status-bar__fill" style={{ width: `${percentage}%` }} />
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

        <div className="status-stat status-stat--history">
          <div className="status-history__head">
            <span className="status-history__summary">{previewSummary}</span>
            <button
              type="button"
              className={`status-history__toggle${historyExpanded ? " status-history__toggle--open" : ""}`}
              onClick={handleToggleHistory}
              aria-expanded={historyExpanded}
              aria-controls="home-score-history"
              aria-label={historyExpanded ? "Collapse 30 day score history" : "Expand 30 day score history"}
            >
              <span className="status-history__toggle-text">
                {historyExpanded ? "Less" : "30d"}
              </span>
              <span className="status-history__toggle-icon" aria-hidden="true" />
            </button>
          </div>
          <div className="status-history__preview">
            <ScoreHistoryRibbon
              entries={previewEntries}
              size="compact"
              placeholderCount={7}
              ariaLabel="Recent seven day score history"
            />
          </div>
          <span className="status-stat__label">Recent consistency</span>
        </div>

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

      <div
        id="home-score-history"
        className={`status-history-tray${historyExpanded ? " status-history-tray--open" : ""}`}
        aria-hidden={!historyExpanded}
      >
        {historyLoaded ? (
          <div className="status-history-panel">
            <div className="status-history-panel__header">
              <div className="status-history-panel__copy">
                <span className="status-history-panel__eyebrow">Consistency</span>
                <span className="status-history-panel__title">Last 30 days</span>
                <span className="status-history-panel__detail">{historyDetail}</span>
              </div>
              {historyExpanded ? (
                <Link
                  to="/reviews/history?cadence=daily&range=30d"
                  className="status-history-panel__link"
                >
                  Archive
                </Link>
              ) : null}
            </div>

            {expandedHistoryQuery.isError ? (
              <p className="status-history-panel__empty">
                Longer score history is unavailable right now.
              </p>
            ) : (
              <>
                <ScoreHistoryRibbon
                  entries={expandedHistoryQuery.data?.entries ?? null}
                  size="expanded"
                  placeholderCount={30}
                  ariaLabel="Thirty day score history"
                />

                <div className="status-history-panel__legend" aria-label="Score history legend">
                  {HISTORY_LEGEND.map((item) => (
                    <span key={item.label} className="status-history-panel__legend-item">
                      <span
                        className="status-history-panel__legend-swatch"
                        data-tone={item.tone}
                        aria-hidden="true"
                      />
                      <span className="status-history-panel__legend-label">{item.label}</span>
                    </span>
                  ))}
                  <span className="status-history-panel__legend-item status-history-panel__legend-item--today">
                    <span
                      className="status-history-panel__legend-swatch status-history-panel__legend-swatch--today"
                      data-tone="solid"
                      aria-hidden="true"
                    />
                    <span className="status-history-panel__legend-label">Outline = today</span>
                  </span>
                </div>

                <div className="status-history-panel__stats">
                  <div className="status-history-panel__stat">
                    <span className="status-history-panel__stat-value">
                      {expandedSummary ? `${expandedSummary.consistencyRun}d` : "—"}
                    </span>
                    <span className="status-history-panel__stat-label">Consistency run</span>
                    <span className="status-history-panel__stat-meta">Solid or better</span>
                  </div>

                  <div className="status-history-panel__stat">
                    <span className="status-history-panel__stat-value">
                      {expandedSummary && expandedDays
                        ? `${expandedSummary.solidPlusDays}/${expandedDays}`
                        : "—"}
                    </span>
                    <span className="status-history-panel__stat-label">30d solid+</span>
                    <span className="status-history-panel__stat-meta">
                      {expandedSummary ? `${expandedSummary.strongDays} strong days` : "Scored days"}
                    </span>
                  </div>

                  <div className="status-history-panel__stat">
                    <span className="status-history-panel__stat-value">
                      {expandedSummary?.current7DayAverage ?? "—"}
                    </span>
                    <span className="status-history-panel__stat-label">7d average</span>
                    <span className="status-history-panel__stat-meta">
                      {expandedSummary
                        ? formatAverageDelta(
                            expandedSummary.current7DayAverage,
                            expandedSummary.previous7DayAverage,
                          )
                        : "Comparing weeks"}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
