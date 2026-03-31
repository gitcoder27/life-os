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
import { SecondaryContext } from "./SecondaryContext";
import { StatusStrip } from "./StatusStrip";
import { TodayControl } from "./TodayControl";

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
  const topReasonLabel = scoreQuery.data?.topReasons[0]?.label ?? null;

  // Derive action data
  const allTasks = home.tasks;
  const executionTasks = allTasks.filter((t) => !isQuickCaptureReferenceTask(t));
  const openPriorities = [...home.topPriorities]
    .filter((p) => p.status === "pending")
    .sort((a, b) => a.slot - b.slot);
  const topOpenPriority = openPriorities[0] ?? null;
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
        <CommandBlock
          topPriority={topOpenPriority}
          openTaskCount={openExecutionTasks.length}
          nextTimedTask={
            nextTimedTask
              ? { title: nextTimedTask.title, timeLabel: formatTimeLabel(nextTimedTask.dueAt) }
              : null
          }
          recovery={home.guidance.recovery}
          phase={home.phase}
          topScoreReason={topReasonLabel}
        />

        <AtRiskLane
          radarItems={home.accountabilityRadar.items}
          attentionItems={home.attentionItems}
          overdueCount={home.accountabilityRadar.overdueTaskCount}
          staleInboxCount={home.accountabilityRadar.staleInboxCount}
        />
      </div>

      <div className="home-operator__middle">
        <TodayControl
          priorities={home.topPriorities}
          openTaskCount={nonPriorityOpenTasks.length}
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
        weeklyChallenge={home.guidance.weeklyChallenge}
        quote={quoteQuery.data?.quote ?? null}
      />
    </div>
  );
}
