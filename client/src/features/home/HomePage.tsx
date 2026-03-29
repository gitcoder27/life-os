import {
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

import { AttentionSection } from "./AttentionSection";
import { FocusBlock } from "./FocusBlock";
import { GuidanceRail } from "./GuidanceRail";
import { InboxCard } from "./InboxCard";
import { LedgerCard } from "./LedgerCard";
import { MotivationalQuoteCard } from "./MotivationalQuoteCard";
import { PrioritiesList } from "./PrioritiesList";
import { PulseCard } from "./PulseCard";
import { RoutinesCard } from "./RoutinesCard";
import { ScoreCard } from "./ScoreCard";

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
  const scoreBuckets =
    scoreQuery.data?.buckets?.filter((b) => b.applicablePoints > 0) ?? [];
  const topReasonLabel = scoreQuery.data?.topReasons[0]?.label ?? null;
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

  return (
    <div className="home-dashboard">
      <div className="home-main stagger">
        <ScoreCard
          value={score?.value ?? 0}
          label={score?.label ?? "Loading"}
          earnedPoints={score?.earnedPoints ?? 0}
          possiblePoints={score?.possiblePoints ?? 0}
          weeklyMomentum={home.weeklyMomentum}
          strongDayStreak={weeklyMomentumQuery.data?.strongDayStreak ?? 0}
          reviewClosed={Boolean(scoreQuery.data?.finalizedAt)}
          buckets={scoreBuckets}
          topReasonLabel={topReasonLabel}
        />

        <GuidanceRail
          recovery={home.guidance.recovery}
          weeklyChallenge={home.guidance.weeklyChallenge}
          recommendations={home.guidance.recommendations}
        />

        <PrioritiesList priorities={home.topPriorities} />

        <AttentionSection
          radarItems={home.accountabilityRadar.items}
          attentionItems={home.attentionItems}
        />
      </div>

      <aside className="home-sidebar stagger">
        <FocusBlock
          topPriority={topOpenPriority}
          openTaskCount={openExecutionTasks.length}
          nextTimedTask={
            nextTimedTask
              ? { title: nextTimedTask.title, timeLabel: formatTimeLabel(nextTimedTask.dueAt) }
              : null
            }
        />

        <MotivationalQuoteCard />

        <PulseCard
          waterMl={home.healthSummary.waterMl}
          waterTargetMl={home.healthSummary.waterTargetMl}
          mealsLogged={home.healthSummary.mealsLogged}
          workoutStatus={home.healthSummary.workoutStatus}
        />

        <LedgerCard
          spentThisMonth={home.financeSummary.spentThisMonth}
          budgetLabel={home.financeSummary.budgetLabel}
          upcomingBills={home.financeSummary.upcomingBills}
        />

        <RoutinesCard
          completedItems={home.routineSummary.completedItems}
          totalItems={home.routineSummary.totalItems}
          currentPeriod={home.routineSummary.currentPeriod}
          habitsCompletedToday={home.habitSummary.completedToday}
          habitsDueToday={home.habitSummary.dueToday}
        />

        <InboxCard
          items={inboxItems}
          hasMore={inboxItems.length >= 3}
        />
      </aside>
    </div>
  );
}
