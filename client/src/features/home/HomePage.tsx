import {
  formatTimeLabel,
  getTodayDate,
  useDailyScoreQuery,
  useHomeQuoteQuery,
  useInboxQuery,
  useHomeOverviewQuery,
  useWeeklyMomentumQuery,
} from "../../shared/lib/api";
import { isQuickCaptureReferenceTask } from "../../shared/lib/quickCapture";
import {
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";

import { AtRiskLane } from "./AtRiskLane";
import { CommandBlock } from "./CommandBlock";
import { EssentialsBand } from "./EssentialsBand";
import { GuidanceRail } from "./GuidanceRail";
import { SecondaryContext } from "./SecondaryContext";
import { StatusStrip } from "./StatusStrip";
import { TodayControl } from "./TodayControl";
import { DailyLaunchCard } from "../today/components/DailyLaunchCard";
import { PreLaunchModeNotice } from "../today/components/PreLaunchModeNotice";
import { RescueModeCard } from "../today/components/RescueModeCard";

export function HomePage() {
  const today = getTodayDate();
  const homeQuery = useHomeOverviewQuery(today);
  const inboxQuery = useInboxQuery({ limit: 4 });
  const quoteQuery = useHomeQuoteQuery();
  const scoreQuery = useDailyScoreQuery(today);
  const weeklyMomentumQuery = useWeeklyMomentumQuery(today);

  const retryAll = () => {
    void homeQuery.refetch();
    void inboxQuery.refetch();
    void quoteQuery.refetch();
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
  const shouldShowDailyLaunch = !home.launch?.completedAt;

  // Derive action data
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

  // Tasks beyond priorities
  const priorityIds = new Set(home.topPriorities.map((p) => p.id));
  const nonPriorityOpenTasks = openExecutionTasks.filter((t) => !priorityIds.has(t.id));
  const atRiskLaneProps = {
    sessionKey: home.date,
    radarItems: home.accountabilityRadar.items,
    attentionItems: home.attentionItems,
    overdueCount: home.accountabilityRadar.overdueTaskCount,
    staleInboxCount: home.accountabilityRadar.staleInboxCount,
  };

  return (
    <div className="home-operator">
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

      <div className="home-operator__core">
        <div className="home-operator__main-stack">
          {shouldShowDailyLaunch ? (
            <PreLaunchModeNotice
              date={home.date}
              launch={home.launch}
              suggestion={home.rescueSuggestion}
            />
          ) : null}

          {!shouldShowDailyLaunch ? (
            <RescueModeCard
              date={home.date}
              launch={home.launch}
              suggestion={home.rescueSuggestion}
              mustWinTask={home.mustWinTask}
              deferredCandidates={openExecutionTasks.filter((task) => task.id !== home.mustWinTask?.id)}
              compact
            />
          ) : null}

          <CommandBlock
            date={home.date}
            topPriority={featuredPriority}
            mustWinTask={home.mustWinTask}
            openTaskCount={openExecutionTasks.length}
            nextTimedTask={
              nextTimedTask
                ? { title: nextTimedTask.title, timeLabel: formatTimeLabel(nextTimedTask.dueAt) }
                : null
            }
            phase={home.phase}
          />

          {shouldShowDailyLaunch ? (
            <AtRiskLane {...atRiskLaneProps} />
          ) : null}

          <GuidanceRail
            recovery={home.guidance.recovery}
            weeklyChallenge={home.guidance.weeklyChallenge}
            recommendations={home.guidance.recommendations}
          />
        </div>

        <div className="home-operator__side-stack">
          {!shouldShowDailyLaunch ? (
            <AtRiskLane {...atRiskLaneProps} />
          ) : null}

          {shouldShowDailyLaunch ? (
            <DailyLaunchCard
              date={home.date}
              tasks={executionTasks}
              launch={home.launch}
              mustWinTask={home.mustWinTask}
            />
          ) : null}
        </div>
      </div>

      <div className="home-operator__middle">
        <TodayControl
          priorities={home.topPriorities}
          openTaskCount={nonPriorityOpenTasks.length}
          overdueTaskCount={home.accountabilityRadar.overdueTaskCount}
        />

        <EssentialsBand
          routines={home.routineSummary}
          habits={home.habitSummary}
          health={home.healthSummary}
          finance={home.financeSummary}
        />
      </div>

      <SecondaryContext
        inboxItems={inboxItems.slice(0, 3)}
        inboxHasMore={inboxItems.length > 3}
        weeklyChallenge={null}
        quote={quoteQuery.data?.quote ?? null}
      />
    </div>
  );
}
