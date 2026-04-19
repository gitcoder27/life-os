import {
  useActiveFocusSessionQuery,
  formatTimeLabel,
  getTodayDate,
  useDailyScoreQuery,
  useInboxQuery,
  useHomeOverviewQuery,
  useWeeklyMomentumQuery,
} from "../../shared/lib/api";
import { isQuickCaptureReferenceTask } from "../../shared/lib/quickCapture";
import {
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";

import { AdvisoryStrip } from "./AdvisoryStrip";
import { EssentialsBand } from "./EssentialsBand";
import { FocusSessionBanner } from "./FocusSessionBanner";
import { FocusStage } from "./FocusStage";
import { GuidanceWhisper } from "./GuidanceWhisper";
import { QuietRail } from "./QuietRail";
import { StatusStrip } from "./StatusStrip";
import { WorkspaceLaunchStrip } from "./WorkspaceLaunchStrip";

export function HomePage() {
  const today = getTodayDate();
  const homeQuery = useHomeOverviewQuery(today);
  const inboxQuery = useInboxQuery({ limit: 4 });
  const activeFocusSessionQuery = useActiveFocusSessionQuery();
  const scoreQuery = useDailyScoreQuery(today);
  const weeklyMomentumQuery = useWeeklyMomentumQuery(today);

  const retryAll = () => {
    void homeQuery.refetch();
    void inboxQuery.refetch();
    void activeFocusSessionQuery.refetch();
    void scoreQuery.refetch();
    void weeklyMomentumQuery.refetch();
  };

  if (homeQuery.isLoading && !homeQuery.data) {
    return (
      <PageLoadingState
        title="Loading command center"
        description="Pulling together today's priorities, score, and attention items."
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

  const allTasks = home.tasks;
  const executionTasks = allTasks.filter((t) => !isQuickCaptureReferenceTask(t));

  const openPriorities = [...home.topPriorities]
    .filter((p) => p.status === "pending")
    .sort((a, b) => a.slot - b.slot);
  const topOpenPriority = openPriorities[0] ?? null;
  const featuredPriority = home.mustWinTask
    ? {
        slot: 1,
        title: home.mustWinTask.title,
        goal: home.mustWinTask.goal,
      }
    : topOpenPriority;

  const openExecutionTasks = executionTasks.filter((t) => t.status === "pending");
  const nextTimedTask = [...openExecutionTasks]
    .filter((t) => Boolean(t.dueAt))
    .sort(
      (a, b) =>
        new Date(a.dueAt ?? "").getTime() - new Date(b.dueAt ?? "").getTime(),
    )[0] ?? null;

  const inboxItems = inboxQuery.data?.tasks ?? [];
  const priorityIds = new Set(home.topPriorities.map((p) => p.id));
  const nonPriorityOpenTasks = openExecutionTasks.filter((t) => !priorityIds.has(t.id));

  return (
    <main className="home-desk">
      <StatusStrip
        score={score?.value ?? 0}
        scoreLabel={score?.label ?? "Loading"}
        buckets={scoreQuery.data?.buckets ?? null}
        weeklyMomentum={home.weeklyMomentum}
        strongDayStreak={weeklyMomentumQuery.data?.strongDayStreak ?? 0}
        dailyScores={weeklyMomentumQuery.data?.dailyScores ?? null}
        reviewClosed={Boolean(scoreQuery.data?.finalizedAt)}
        phase={home.phase}
      />

      <FocusSessionBanner session={activeFocusSessionQuery.data?.session ?? null} />

      <section className="home-desk__stage" aria-label="Today's focus">
        <FocusStage
          date={home.date}
          phase={home.phase}
          mustWinTask={home.mustWinTask}
          launch={home.launch}
          topPriority={featuredPriority}
          openTaskCount={openExecutionTasks.length}
          nextTimedTask={
            nextTimedTask
              ? {
                  title: nextTimedTask.title,
                  timeLabel: formatTimeLabel(nextTimedTask.dueAt),
                }
              : null
          }
          executionTasks={executionTasks}
        />

        <QuietRail
          sessionKey={home.date}
          radarItems={home.accountabilityRadar.items}
          attentionItems={home.attentionItems}
          overdueCount={home.accountabilityRadar.overdueTaskCount}
          staleInboxCount={home.accountabilityRadar.staleInboxCount}
          priorities={home.topPriorities}
          openTaskCount={nonPriorityOpenTasks.length}
          inboxItems={inboxItems.slice(0, 4)}
          inboxHasMore={inboxItems.length > 4}
        />
      </section>

      <WorkspaceLaunchStrip today={home.date} />

      <GuidanceWhisper guidance={home.guidance} />

      <AdvisoryStrip
        date={home.date}
        launch={home.launch}
        suggestion={home.rescueSuggestion}
        mustWinTask={home.mustWinTask}
      />

      <EssentialsBand
        routines={home.routineSummary}
        habits={home.habitSummary}
        health={home.healthSummary}
        finance={home.financeSummary}
      />
    </main>
  );
}
