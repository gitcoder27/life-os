import "./home.css";
import { Link } from "react-router-dom";

import {
  formatMajorCurrency,
  formatTimeLabel,
  formatWorkoutStatus,
  getTodayDate,
  useDailyScoreQuery,
  useHomeOverviewQuery,
  useInboxQuery,
  useWeeklyMomentumQuery,
} from "../../shared/lib/api";
import {
  getQuickCaptureDisplayText,
  isQuickCaptureReferenceTask,
} from "../../shared/lib/quickCapture";
import {
  InlineErrorState,
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";
import {
  DayStatusPanel,
  GoalChip,
  HomeAttentionList,
  HomeKeyStatList,
  HomePanel,
  HomeSignalRows,
  type HomeAttentionEntry,
  type HomeKeyStat,
  type HomeSignalEntry,
} from "./HomeSections";

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

function getRecoveryRoute({
  overdueTaskCount,
  staleInboxCount,
}: {
  overdueTaskCount: number;
  staleInboxCount: number;
}) {
  if (overdueTaskCount > 0) {
    return getRadarRoute("overdue_task");
  }

  if (staleInboxCount > 0) {
    return "/inbox";
  }

  return "/today";
}

export function HomePage() {
  const today = getTodayDate();
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
        title="Loading home"
        description="Pulling together the score, attention queue, and today handoff."
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
  const nextTimedTask =
    [...openExecutionTasks]
      .filter((task) => Boolean(task.dueAt))
      .sort((left, right) => new Date(left.dueAt ?? "").getTime() - new Date(right.dueAt ?? "").getTime())[0] ??
    null;
  const quickCaptureDayNotes = allTasks.filter(isQuickCaptureMetadataTask);
  const inboxPreviewItems = inboxQuery.data?.tasks ?? [];
  const accountabilityRadar = home.accountabilityRadar;
  const weeklyChallenge = home.guidance.weeklyChallenge;
  const weeklyFocusSummary =
    weeklyChallenge?.status === "on_track"
      ? `${weeklyChallenge.weekCompletions}/${weeklyChallenge.weekTarget} this week`
      : null;
  const dayStatusMetrics: HomeKeyStat[] = [
    {
      label: "Weekly momentum",
      value: String(home.weeklyMomentum),
      detail: `${weeklyMomentumQuery.data?.strongDayStreak ?? 0} day strong streak`,
    },
    {
      label: "Review readiness",
      value: scoreQuery.data?.finalizedAt ? "Closed" : "Open",
      detail: scoreQuery.data?.finalizedAt ? "Daily review completed" : "Score can still move",
    },
    {
      label: "Execution load",
      value: `${openPriorities.length} priorities`,
      detail: `${openExecutionTasks.length} open tasks waiting in Today`,
    },
  ];
  const handoffHeadline = topOpenPriority
    ? `Start with Priority ${topOpenPriority.slot}: ${topOpenPriority.title}`
    : openExecutionTasks.length > 0
      ? `${openExecutionTasks.length} open tasks are waiting in Today`
      : accountabilityRadar.overdueTaskCount > 0
        ? "Clear recovery before adding more work"
        : "Today is clear enough to work from intention";
  const handoffCopy = topOpenPriority
    ? "Home should help you choose. Today should help you finish."
    : "Keep Home for awareness and move into Today once you know the next step.";
  const handoffMetrics: HomeKeyStat[] = [
    {
      label: "Open priorities",
      value: String(openPriorities.length),
      detail: topOpenPriority ? topOpenPriority.title : "No ranked focus yet",
    },
    {
      label: "Open tasks",
      value: String(openExecutionTasks.length),
      detail: openExecutionTasks.length > 0 ? "Use Today to finish or move them" : "Execution lane is clear",
    },
    {
      label: "Next timed block",
      value: nextTimedTask?.dueAt ? formatTimeLabel(nextTimedTask.dueAt) : "None",
      detail: nextTimedTask ? nextTimedTask.title : "No timed task scheduled",
    },
    {
      label: "Day notes",
      value: String(quickCaptureDayNotes.length),
      detail: quickCaptureDayNotes.length > 0 ? "Quick notes and reminders are attached" : "No notes attached to today",
    },
  ];
  const secondaryHandoffAction =
    accountabilityRadar.overdueTaskCount > 0
      ? { label: "Review overdue", route: getRadarRoute("overdue_task") }
      : accountabilityRadar.staleInboxCount > 0 || inboxPreviewItems.length > 0
        ? { label: "Open Inbox", route: "/inbox" }
        : null;
  const scoreDetailsSummary =
    scoreReasons.length > 0
      ? `${scoreReasons.length} score gaps still open`
      : scoreBuckets.length > 0
        ? "See score buckets"
        : null;

  const attentionEntries: HomeAttentionEntry[] = [];

  if (home.guidance.recovery && accountabilityRadar.totalCount > 0) {
    attentionEntries.push({
      id: "recovery-guidance",
      title: home.guidance.recovery.title,
      detail: home.guidance.recovery.detail,
      route: getRecoveryRoute(accountabilityRadar),
      actionLabel: accountabilityRadar.overdueTaskCount > 0 ? "Review overdue" : "Open Inbox",
      tone: home.guidance.recovery.tone === "recovery" ? "urgent" : "warning",
      badge: "Recovery",
    });
  }

  for (const item of accountabilityRadar.items.slice(0, 2)) {
    attentionEntries.push({
      id: item.id,
      title:
        item.kind === "stale_inbox"
          ? getQuickCaptureDisplayText(
              {
                kind: item.taskKind,
                notes: item.notes,
                reminderAt: item.reminderAt,
              },
              item.title,
            )
          : item.title,
      detail: item.label,
      route: getRadarRoute(item.kind, item.id),
      actionLabel: getRadarActionLabel(item.kind),
      tone: item.kind === "overdue_task" ? "urgent" : "warning",
      badge: item.kind === "overdue_task" ? "Overdue" : "Inbox",
    });
  }

  if (weeklyChallenge && weeklyChallenge.status !== "on_track") {
    attentionEntries.push({
      id: `weekly-challenge-${weeklyChallenge.habitId}`,
      title: weeklyChallenge.title,
      detail:
        weeklyChallenge.status === "behind"
          ? `${weeklyChallenge.weekCompletions}/${weeklyChallenge.weekTarget} done this week. Momentum needs recovery.`
          : `${weeklyChallenge.weekCompletions}/${weeklyChallenge.weekTarget} done this week. It is due today.`,
      route: "/habits",
      actionLabel: "Open Habits",
      tone: weeklyChallenge.status === "behind" ? "urgent" : "warning",
      badge: "Weekly focus",
    });
  }

  for (const item of home.attentionItems) {
    attentionEntries.push({
      id: item.id,
      title: item.title,
      detail: item.detail ?? `${item.kind.replace(/_/g, " ")} needs a decision`,
      route: item.action.route,
      actionLabel: getActionLabel(item.action),
      tone: item.tone,
      badge: "Attention",
    });
  }

  for (const item of home.guidance.recommendations) {
    attentionEntries.push({
      id: item.id,
      title: item.title,
      detail: `${item.detail} ${item.impactLabel}`,
      route: item.action.route,
      actionLabel: getActionLabel(item.action),
      tone: "info",
      badge: "Suggested next",
    });
  }

  const visibleAttentionItems = attentionEntries.slice(0, 5);
  const signalItems: HomeSignalEntry[] = [
    {
      id: "routines",
      label: "Routines",
      value:
        home.routineSummary.totalItems > 0
          ? `${home.routineSummary.completedItems}/${home.routineSummary.totalItems}`
          : "Inactive",
      detail:
        home.routineSummary.totalItems > 0
          ? `${home.routineSummary.currentPeriod[0]?.toUpperCase() ?? ""}${home.routineSummary.currentPeriod.slice(1)} routine`
          : "No active morning or evening routine",
      route: "/habits",
      actionLabel: "Habits",
      tone:
        home.routineSummary.totalItems > 0 &&
        home.routineSummary.completedItems === home.routineSummary.totalItems
          ? "positive"
          : "default",
    },
    {
      id: "inbox",
      label: "Inbox",
      value: inboxPreviewItems.length > 0 ? `${inboxPreviewItems.length} waiting` : "Clear",
      detail:
        inboxPreviewItems.length > 0
          ? inboxPreviewItems
              .slice(0, 2)
              .map((task) => getHomeTaskMeta(task, task.title))
              .join(" · ")
          : accountabilityRadar.staleInboxCount > 0
            ? `${accountabilityRadar.staleInboxCount} stale capture${accountabilityRadar.staleInboxCount === 1 ? "" : "s"} need triage`
            : "No captured items waiting for triage",
      route: "/inbox",
      actionLabel: "Inbox",
      tone: accountabilityRadar.staleInboxCount > 0 ? "warning" : "default",
    },
    {
      id: "health",
      label: "Health",
      value: `${(home.healthSummary.waterMl / 1000).toFixed(1)}L / ${(home.healthSummary.waterTargetMl / 1000).toFixed(1)}L`,
      detail: `${home.healthSummary.mealsLogged} meals · ${formatWorkoutStatus(home.healthSummary.workoutStatus)}`,
      route: "/health",
      actionLabel: "Health",
    },
    {
      id: "finance",
      label: "Finance",
      value: formatMajorCurrency(home.financeSummary.spentThisMonth),
      detail: `${home.financeSummary.upcomingBills} upcoming bills · ${home.financeSummary.budgetLabel || "Tracking"}`,
      route: "/finance",
      actionLabel: "Finance",
    },
  ];

  if (weeklyChallenge && weeklyFocusSummary) {
    signalItems.push({
      id: "weekly-focus",
      label: "Weekly focus",
      value: weeklyFocusSummary,
      detail:
        weeklyChallenge.streakCount > 0
          ? `${weeklyChallenge.streakCount} day streak`
          : "On track this week",
      route: "/habits",
      actionLabel: "Habits",
      tone: "positive",
    });
  }

  return (
    <div className="page home-page">
      <div className="home-grid">
        <HomePanel
          className="home-panel--status"
          eyebrow="Day status"
          title={`Score ${score?.value ?? 0}`}
          subtitle="A quieter read on the state of the day."
        >
          <DayStatusPanel
            detail={scoreQuery.isError ? "Live score details are delayed. Home is showing the last safe summary." : undefined}
            metrics={dayStatusMetrics}
            scoreCopy={
              scoreReasons[0]?.label ??
              "The score should help you orient quickly, not pull you into a dashboard dig."
            }
            scoreDetail={
              score
                ? `${Math.round(score.earnedPoints)} of ${score.possiblePoints} available points earned today.`
                : undefined
            }
            scoreLabel={score?.label ?? "Loading"}
            scoreValue={score?.value ?? 0}
          />
          {scoreQuery.isError ? (
            <InlineErrorState
              message={
                scoreQuery.error instanceof Error
                  ? scoreQuery.error.message
                  : "Score details could not load."
              }
              onRetry={() => void scoreQuery.refetch()}
            />
          ) : null}
        </HomePanel>

        <HomePanel
          className="home-panel--attention"
          eyebrow="Needs attention"
          title={
            visibleAttentionItems.length > 0
              ? `${attentionEntries.length} item${attentionEntries.length === 1 ? "" : "s"} worth a decision`
              : "Nothing is pulling for attention"
          }
          subtitle="Overdue work, stale captures, and the next best moves live in one queue."
        >
          <HomeAttentionList
            items={visibleAttentionItems}
            overflowCount={Math.max(attentionEntries.length - visibleAttentionItems.length, 0)}
          />
        </HomePanel>

        <HomePanel
          className="home-panel--handoff"
          eyebrow="Today handoff"
          title="Decide here, work in Today"
          subtitle="Home stays light. Today is where work gets finished, moved, or dropped."
          action={<Link className="button button--primary" to="/today">Open Today</Link>}
        >
          <div className="home-handoff">
            <div className="home-handoff__copy">
              <p className="home-handoff__headline">{handoffHeadline}</p>
              <p className="home-handoff__text">{handoffCopy}</p>
              {topOpenPriority?.goal ? <GoalChip goal={topOpenPriority.goal} /> : null}
            </div>
            <HomeKeyStatList items={handoffMetrics} />
          </div>
          {secondaryHandoffAction ? (
            <div className="home-secondary-actions">
              <Link className="home-inline-link" to={secondaryHandoffAction.route}>
                {secondaryHandoffAction.label}
              </Link>
            </div>
          ) : null}
        </HomePanel>

        <HomePanel
          className="home-panel--signals"
          eyebrow="Daily signals"
          title="Other life areas stay compact"
          subtitle="These stay quiet until they need a deeper page."
        >
          {inboxQuery.isError ? (
            <InlineErrorState
              message={
                inboxQuery.error instanceof Error
                  ? inboxQuery.error.message
                  : "Inbox preview could not load."
              }
              onRetry={() => void inboxQuery.refetch()}
            />
          ) : null}
          <HomeSignalRows items={signalItems} />
        </HomePanel>

        {scoreDetailsSummary ? (
          <HomePanel
            className="home-panel--details"
            eyebrow="Score detail"
            title="Why this score?"
            subtitle="Keep the detail nearby, but out of the way until you need it."
          >
            <details className="home-score-details">
              <summary className="home-score-details__summary">
                <span>{scoreDetailsSummary}</span>
                <span className="home-score-details__toggle">Expand</span>
              </summary>
              <div className="home-score-details__body">
                {scoreBuckets.length > 0 ? (
                  <div className="home-score-details__section">
                    <h3 className="home-score-details__section-title">Buckets</h3>
                    <div className="home-score-buckets">
                      {scoreBuckets.map((bucket) => (
                        <div key={bucket.key} className="home-score-buckets__row">
                          <div className="home-score-buckets__heading">
                            <span>{bucket.label}</span>
                            <strong>
                              {Math.round(bucket.earnedPoints)}/{bucket.applicablePoints}
                            </strong>
                          </div>
                          <p className="home-score-buckets__detail">{bucket.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {scoreReasons.length > 0 ? (
                  <div className="home-score-details__section">
                    <h3 className="home-score-details__section-title">Open gaps</h3>
                    <div className="home-score-reasons">
                      {scoreReasons.map((reason) => (
                        <div key={reason.label} className="home-score-reasons__row">
                          <strong>{reason.label}</strong>
                          <span>{reason.missingPoints} points still open</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </details>
          </HomePanel>
        ) : null}
      </div>
    </div>
  );
}
