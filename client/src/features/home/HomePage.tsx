import { Link, useNavigate } from "react-router-dom";

import {
  formatMajorCurrency,
  formatTimeLabel,
  formatWorkoutStatus,
  getTodayDate,
  useDailyScoreQuery,
  useInboxQuery,
  useHomeOverviewQuery,
  useWeeklyMomentumQuery,
  type LinkedGoal,
} from "../../shared/lib/api";
import { getQuickCaptureDisplayText, isQuickCaptureReferenceTask } from "../../shared/lib/quickCapture";
import { MetricPill } from "../../shared/ui/MetricPill";
import {
  EmptyState,
  InlineErrorState,
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";
import { ScoreRing } from "../../shared/ui/ScoreRing";

function GoalChip({ goal }: { goal: LinkedGoal }) {
  return (
    <Link to="/goals" className="goal-chip">
      <span className={`goal-chip__dot goal-chip__dot--${goal.domain}`} />
      <span>{goal.title}</span>
    </Link>
  );
}

function ChallengeProgressRing({ completions, target }: { completions: number; target: number }) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const progress = target > 0 ? Math.min(completions / target, 1) : 0;
  const offset = circumference * (1 - progress);

  return (
    <svg className="challenge-card__progress-ring" viewBox="0 0 40 40">
      <circle className="ring-bg" cx="20" cy="20" r={radius} />
      <circle
        className="ring-fill"
        cx="20"
        cy="20"
        r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 20 20)"
      />
    </svg>
  );
}

type HomeTaskLike = {
  originType: string;
  kind: "task" | "note" | "reminder";
  notes: string | null;
  reminderAt: string | null;
};

function isQuickCaptureMetadataTask(task: HomeTaskLike) {
  return isQuickCaptureReferenceTask(task);
}

function getHomeTaskMeta(task: HomeTaskLike, fallback: string) {
  return getQuickCaptureDisplayText(task, fallback);
}

function getActionLabel(action: { type: "open_review" | "open_route"; route: string }) {
  if (action.type === "open_review") {
    return "Open review";
  }

  switch (action.route) {
    case "/today":
      return "Open Today";
    case "/habits":
      return "Open Habits";
    case "/health":
      return "Open Health";
    case "/finance":
      return "Open Finance";
    case "/inbox":
      return "Open Inbox";
    default:
      return "Open";
  }
}

function getRadarActionLabel(kind: "overdue_task" | "stale_inbox") {
  return kind === "overdue_task" ? "Recover task" : "Open Inbox";
}

function getRadarRoute(kind: "overdue_task" | "stale_inbox", itemId?: string) {
  if (kind === "stale_inbox") {
    return "/inbox";
  }

  if (itemId) {
    return `/today?view=overdue&taskId=${encodeURIComponent(itemId)}`;
  }

  return "/today?view=overdue";
}

export function HomePage() {
  const today = getTodayDate();
  const navigate = useNavigate();
  const homeQuery = useHomeOverviewQuery(today);
  const inboxQuery = useInboxQuery({ limit: 3 });
  const scoreQuery = useDailyScoreQuery(today);
  const weeklyMomentumQuery = useWeeklyMomentumQuery(today);
  const retryAll = () => {
    void homeQuery.refetch();
    void inboxQuery.refetch();
    void scoreQuery.refetch();
    void weeklyMomentumQuery.refetch();
  };

  if (homeQuery.isLoading && !homeQuery.data) {
    return (
      <PageLoadingState
        title="Loading command center"
        description="Pulling together today’s priorities, score, and attention items."
      />
    );
  }

  if (homeQuery.isError || !homeQuery.data) {
    return (
      <PageErrorState
        title="Home is unavailable"
        message={homeQuery.error instanceof Error ? homeQuery.error.message : undefined}
        onRetry={retryAll}
      />
    );
  }

  const home = homeQuery.data;
  const score = scoreQuery.data ?? home.dailyScore;
  const homeMetrics = [
    {
      label: "Weekly momentum",
      value: String(home.weeklyMomentum),
    },
    {
      label: "Strong day streak",
      value: `${weeklyMomentumQuery.data?.strongDayStreak ?? 0} days`,
    },
    {
      label: "Review readiness",
      value: scoreQuery.data?.finalizedAt ? "Daily closed" : "Daily open",
    },
  ];
  const attentionItems = home.attentionItems;
  const routines = [
    {
      title:
        home.routineSummary.currentPeriod === "none"
          ? "Routines"
          : `${home.routineSummary.currentPeriod[0].toUpperCase()}${home.routineSummary.currentPeriod.slice(1)} routine`,
      detail: `${home.routineSummary.completedItems} of ${home.routineSummary.totalItems} complete`,
    },
  ];
  const healthSnapshot = [
    {
      label: "Water",
      value: `${(home.healthSummary.waterMl / 1000).toFixed(1)}L / ${(home.healthSummary.waterTargetMl / 1000).toFixed(1)}L`,
    },
    {
      label: "Meals",
      value: `${home.healthSummary.mealsLogged} logged`,
    },
    {
      label: "Workout",
      value: formatWorkoutStatus(home.healthSummary.workoutStatus),
    },
  ];
  const financeSnapshot = [
    {
      label: "Month spend",
      value: formatMajorCurrency(home.financeSummary.spentThisMonth),
    },
    {
      label: "Budget label",
      value: home.financeSummary.budgetLabel || "Tracking",
    },
    {
      label: "Upcoming bills",
      value: String(home.financeSummary.upcomingBills),
    },
  ];
  const scoreReasons = scoreQuery.data?.topReasons ?? [];
  const scoreBuckets =
    scoreQuery.data?.buckets?.filter((bucket) => bucket.applicablePoints > 0) ?? [];
  const allTasks = home.tasks;
  const executionTasks = allTasks.filter((task) => !isQuickCaptureMetadataTask(task));
  const openPriorities = [...home.topPriorities]
    .filter((priority) => priority.status === "pending")
    .sort((left, right) => left.slot - right.slot);
  const topOpenPriority = openPriorities[0] ?? null;
  const openExecutionTasks = executionTasks.filter((task) => task.status === "pending");
  const nextTimedTask = [...openExecutionTasks]
    .filter((task) => Boolean(task.dueAt))
    .sort((left, right) => new Date(left.dueAt ?? "").getTime() - new Date(right.dueAt ?? "").getTime())[0] ?? null;
  const quickCaptureDayNotes = allTasks.filter(isQuickCaptureMetadataTask);
  const inboxPreviewItems = inboxQuery.data?.tasks ?? [];
  const accountabilityRadar = home.accountabilityRadar;

  return (
    <div className="page">
      <section className="score-hero">
        <div className="score-hero__primary">
          <p className="score-hero__label">Daily score</p>
          <div className="score-hero__ring-area">
            <ScoreRing value={score?.value ?? 0} label={score?.label ?? "Loading"} size={140} />
            <div>
              <div className="score-hero__value-row">
                <span className="score-hero__value">{score?.value ?? 0}</span>
                <span className="score-hero__band">{score?.label ?? "Loading"}</span>
              </div>
              <p className="score-hero__copy">
                {scoreQuery.data?.topReasons[0]?.label ??
                  "Live score details will reflect your latest planning, habits, and health data."}
              </p>
              {score ? (
                <p className="score-hero__detail">
                  {Math.round(score.earnedPoints)} of {score.possiblePoints} available points earned today.
                </p>
              ) : null}
            </div>
          </div>
          {scoreQuery.isError ? (
            <InlineErrorState
              message={scoreQuery.error instanceof Error ? scoreQuery.error.message : "Score details could not load."}
              onRetry={() => void scoreQuery.refetch()}
            />
          ) : null}
          <div className="bucket-bar">
            {scoreBuckets.map((bucket) => (
              <div key={bucket.key} className="bucket-row">
                <span className="bucket-row__label">{bucket.label}</span>
                <div className="bucket-row__bar">
                  <div
                    className="bucket-row__fill"
                    style={{
                      width: `${(bucket.earnedPoints / bucket.applicablePoints) * 100}%`,
                    }}
                  />
                </div>
                <span className="bucket-row__value">
                  {Math.round(bucket.earnedPoints)}/{bucket.applicablePoints}
                </span>
              </div>
            ))}
          </div>
          {scoreBuckets.length > 0 ? (
            <div className="score-bucket-notes">
              {scoreBuckets.map((bucket) => (
                <div key={bucket.key} className="score-bucket-notes__item">
                  <strong>{bucket.label}</strong>
                  <span>{bucket.explanation}</span>
                </div>
              ))}
            </div>
          ) : null}
          {scoreReasons.length > 0 ? (
            <div className="score-reasons">
              {scoreReasons.map((reason) => (
                <div key={reason.label} className="score-reasons__item">
                  <strong>{reason.label}</strong>
                  <span>{reason.missingPoints} points still open</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="score-hero__metrics">
          {homeMetrics.map((metric) => (
            <MetricPill
              key={metric.label}
              label={metric.label}
              value={metric.value}
            />
          ))}
        </div>
      </section>

      <div className="guidance-rail">
        {home.guidance.recovery ? (
          <div className={`recovery-strip${home.guidance.recovery.tone === "recovery" ? " recovery-strip--recovery" : ""}`}>
            <span className="recovery-strip__indicator" />
            <div className="recovery-strip__body">
              <div className="recovery-strip__title">{home.guidance.recovery.title}</div>
              <div className="recovery-strip__detail">{home.guidance.recovery.detail}</div>
            </div>
          </div>
        ) : null}

        {home.guidance.weeklyChallenge ? (() => {
          const weeklyChallenge = home.guidance.weeklyChallenge;
          return (
            <Link
              to="/habits"
              className={`challenge-card${weeklyChallenge.status === "behind" ? " challenge-card--behind" : ""}`}
            >
              <ChallengeProgressRing
                completions={weeklyChallenge.weekCompletions}
                target={weeklyChallenge.weekTarget}
              />
              <div className="challenge-card__body">
                <div className="challenge-card__label">Weekly focus</div>
                <div className="challenge-card__title">{weeklyChallenge.title}</div>
                <div className="challenge-card__meta">
                  {weeklyChallenge.weekCompletions}/{weeklyChallenge.weekTarget} this week
                  {weeklyChallenge.streakCount > 0 ? ` · ${weeklyChallenge.streakCount} day streak` : ""}
                </div>
              </div>
              <span className="challenge-card__status">
                <span
                  className={`tag ${weeklyChallenge.status === "on_track" ? "tag--positive" : weeklyChallenge.status === "due_today" ? "tag--warning" : "tag--negative"}`}
                >
                  {weeklyChallenge.status === "on_track"
                    ? "on track"
                    : weeklyChallenge.status === "due_today"
                      ? "due today"
                      : "behind"}
                </span>
              </span>
            </Link>
          );
        })() : null}

        {home.guidance.recommendations.length > 0 ? (
          <div className="rec-stack">
            {home.guidance.recommendations.map((recommendation) => (
              <div key={recommendation.id} className="rec-item">
                <span className={`rec-item__kind rec-item__kind--${recommendation.kind}`} />
                <div className="rec-item__body">
                  <div className="rec-item__title">{recommendation.title}</div>
                  <div className="rec-item__detail">{recommendation.detail}</div>
                </div>
                <span className="rec-item__impact">{recommendation.impactLabel}</span>
                <div className="rec-item__action">
                  <button
                    className="button button--ghost button--small"
                    type="button"
                    onClick={() => navigate(recommendation.action.route)}
                  >
                    {getActionLabel(recommendation.action)}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="unified-dashboard stagger">
        <section className="focus-section">
          <Link to="/today" className="focus-section__header-link">
            <h2 className="focus-section__title">Today Focus</h2>
            <p className="focus-section__subtitle">Use Home to decide. Use Today to work. &rarr;</p>
          </Link>
          <div className="today-focus">
            <div className="today-focus__lede">
              <div className="today-focus__eyebrow">Execution handoff</div>
              <div className="today-focus__headline">
                {topOpenPriority
                  ? `Start with Priority ${topOpenPriority.slot}: ${topOpenPriority.title}`
                  : openExecutionTasks.length > 0
                    ? `${openExecutionTasks.length} open tasks are waiting in Today`
                    : "Today is clear enough to work from intention, not clutter"}
              </div>
              <p className="today-focus__copy">
                Home keeps the day legible. Move into Today to complete, move, reorder, or drop work.
              </p>
              {topOpenPriority?.goal ? <GoalChip goal={topOpenPriority.goal} /> : null}
            </div>

            <div className="today-focus__grid">
              <div className="today-focus__metric">
                <span className="today-focus__metric-label">Open priorities</span>
                <strong className="today-focus__metric-value">{openPriorities.length}</strong>
                <span className="today-focus__metric-detail">
                  {topOpenPriority ? topOpenPriority.title : "No ranked focus yet"}
                </span>
              </div>
              <div className="today-focus__metric">
                <span className="today-focus__metric-label">Open tasks</span>
                <strong className="today-focus__metric-value">{openExecutionTasks.length}</strong>
                <span className="today-focus__metric-detail">
                  {openExecutionTasks.length > 0 ? "Resolve or move them in Today" : "Execution lane is clear"}
                </span>
              </div>
              <div className="today-focus__metric">
                <span className="today-focus__metric-label">Next timed block</span>
                <strong className="today-focus__metric-value">
                  {nextTimedTask?.dueAt ? formatTimeLabel(nextTimedTask.dueAt) : "None"}
                </strong>
                <span className="today-focus__metric-detail">
                  {nextTimedTask ? nextTimedTask.title : "No timed task scheduled"}
                </span>
              </div>
              <div className="today-focus__metric">
                <span className="today-focus__metric-label">Day notes</span>
                <strong className="today-focus__metric-value">{quickCaptureDayNotes.length}</strong>
                <span className="today-focus__metric-detail">
                  {quickCaptureDayNotes.length > 0 ? "Quick notes and reminders attached to today" : "No quick-capture notes today"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {(accountabilityRadar.totalCount > 0 || attentionItems.length > 0) && (
          <section className="focus-section">
            <div className="focus-section__header">
              <h2 className="focus-section__title">Attention Required</h2>
              <p className="focus-section__subtitle">Catch work that slipped out of view or needs immediate decision.</p>
            </div>
            
            {accountabilityRadar.totalCount > 0 && (
              <div className="radar-list">
                {accountabilityRadar.items.map((item) => (
                  <Link key={item.id} to={getRadarRoute(item.kind, item.id)} className={`radar-item radar-item--${item.kind}`}>
                    <div className="radar-item__content">
                      <div className="radar-item__title">
                        {item.kind === "stale_inbox"
                          ? getQuickCaptureDisplayText(
                              {
                                kind: item.taskKind,
                                notes: item.notes,
                                reminderAt: item.reminderAt,
                              },
                              item.title,
                            )
                          : item.title}
                      </div>
                      <div className="radar-item__detail">{item.label}</div>
                    </div>
                    <span className="radar-item__action-label">{getRadarActionLabel(item.kind)} &rarr;</span>
                  </Link>
                ))}
              </div>
            )}

            {attentionItems.length > 0 && (
              <div className="radar-list">
                {attentionItems.map((item) => (
                  <Link key={item.id} to={item.action.route} className="radar-item radar-item--attention">
                    <span className="attention-item__icon" />
                    <div className="radar-item__content">
                      <div className="radar-item__title">{item.title}</div>
                      <div className="radar-item__detail">
                        {item.detail ?? `${item.kind.replace(/_/g, " ")} • ${item.tone}`}
                      </div>
                    </div>
                    <span className="radar-item__action-label">{getActionLabel(item.action)} &rarr;</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="focus-section focus-section--compact">
          <div className="focus-section__header">
            <h2 className="focus-section__title">Daily Overview</h2>
            <p className="focus-section__subtitle">Status and captures at a glance.</p>
          </div>
          <div className="snapshot-grid">
            <Link to="/habits" className="snapshot-card">
              <div className="snapshot-card__title">Routines & Habits &rarr;</div>
              {home.routineSummary.totalItems > 0 ? (
                <div className="snapshot-card__list">
                  {routines.map((routine) => (
                    <div key={routine.title} className="snapshot-card__row">
                      <span className="snapshot-card__label">{routine.title}</span>
                      <span className="snapshot-card__value">{routine.detail}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="snapshot-card__value">No active routines yet.</span>
              )}
            </Link>

            <Link to="/health" className="snapshot-card">
              <div className="snapshot-card__title">Health Snapshot &rarr;</div>
              <div className="snapshot-card__list">
                {healthSnapshot.map((item) => (
                  <div key={item.label} className="snapshot-card__row">
                    <span className="snapshot-card__label">{item.label}</span>
                    <span className="snapshot-card__value">{item.value}</span>
                  </div>
                ))}
              </div>
            </Link>

            <Link to="/finance" className="snapshot-card">
              <div className="snapshot-card__title">Finance Snapshot &rarr;</div>
              <div className="snapshot-card__list">
                {financeSnapshot.map((item) => (
                  <div key={item.label} className="snapshot-card__row">
                    <span className="snapshot-card__label">{item.label}</span>
                    <span className="snapshot-card__value">{item.value}</span>
                  </div>
                ))}
              </div>
            </Link>

            <Link to="/inbox" className="snapshot-card">
              <div className="snapshot-card__title">Capture Inbox &rarr;</div>
              {inboxPreviewItems.length > 0 ? (
                <div className="snapshot-card__list">
                  {inboxPreviewItems.map((task) => (
                    <div key={task.id} className="snapshot-card__row">
                      <span className="snapshot-card__label" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                        {getHomeTaskMeta(task, task.title)}
                      </span>
                      <span className="snapshot-card__value">Triage</span>
                    </div>
                  ))}
                  {inboxPreviewItems.length >= 3 && (
                    <div className="snapshot-card__row" style={{ marginTop: '0.25rem' }}>
                      <span className="snapshot-card__value">See all in Inbox...</span>
                    </div>
                  )}
                </div>
              ) : (
                <span className="snapshot-card__value">Inbox is clear.</span>
              )}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
