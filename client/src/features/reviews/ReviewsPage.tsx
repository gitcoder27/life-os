import { PageHeader } from "../../shared/ui/PageHeader";
import {
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";
import { DailyReviewWorkspace } from "./components/DailyReviewWorkspace";
import { PeriodicReviewWorkspace } from "./components/PeriodicReviewWorkspace";
import { ReviewWindowBanner } from "./ReviewWindowBanner";
import { ReviewsCadenceNav } from "./components/ReviewsCadenceNav";
import { useReviewsPageState } from "./hooks/useReviewsPageState";
import { isAlreadySubmittedError, isOutOfWindowError } from "./reviewWindowModel";

export function ReviewsPage() {
  const state = useReviewsPageState();

  if (state.reviewQuery.isLoading && !state.reviewQuery.data) {
    return (
      <PageLoadingState
        title={`${state.config.label} review loading`}
        description="Pulling the generated summary and existing responses into the review form."
      />
    );
  }

  if (state.reviewQuery.isError || !state.reviewQuery.data) {
    return (
      <PageErrorState
        title={`${state.config.label} review is unavailable`}
        message={state.reviewQuery.error instanceof Error ? state.reviewQuery.error.message : undefined}
        onRetry={() => void state.reviewQuery.refetch()}
      />
    );
  }

  const activeHabits =
    state.habitsQuery.data?.habits
      .filter((habit) => habit.status === "active")
      .map((habit) => ({
        id: habit.id,
        title: habit.title,
        category: habit.category,
      })) ?? [];

  const submitErrorClassName = state.submitError
    ? isAlreadySubmittedError(state.submitError)
      ? "inline-state--already-submitted"
      : isOutOfWindowError(state.submitError)
        ? "inline-state--out-of-window"
        : "inline-state--error"
    : null;

  const submitSuccessMessage = state.submitResult
    ? "nextWeekPriorities" in state.submitResult
      ? `Weekly review saved. ${state.submitResult.nextWeekPriorities.length} priorities seeded for next week.`
      : "nextMonthOutcomes" in state.submitResult
        ? `Monthly review saved. ${state.submitResult.nextMonthOutcomes.length} outcomes seeded for next month.`
        : null
    : null;

  const summaryRetryMessage =
    state.reviewQuery.data.cadence === "weekly" ? state.reviewQuery.data.momentumError?.message ?? null : null;

  return (
    <div className="page">
      <ReviewsCadenceNav cadenceKey={state.cadenceKey} />

      <PageHeader
        eyebrow={`${state.config.label} review`}
        title={state.config.title}
        description={state.config.description}
      />

      {state.windowPresentation ? (
        <ReviewWindowBanner
          presentation={state.windowPresentation}
          cadence={state.cadenceKey}
          onNavigateToAllowed={state.handleNavigateToAllowed}
        />
      ) : null}

      {state.reviewQuery.data.cadence === "daily" ? (
        <DailyReviewWorkspace
          review={state.reviewQuery.data.review}
          summaryItems={state.summaryItems}
          dailyPendingTasks={state.dailyPendingTasks}
          dailyInputs={state.dailyInputs}
          setDailyInputs={state.setDailyInputs}
          dailyTaskDecisions={state.dailyTaskDecisions}
          setDailyTaskDecisions={state.setDailyTaskDecisions}
          dailyTomorrowPriorities={state.dailyTomorrowPriorities}
          setDailyTomorrowPriorities={state.setDailyTomorrowPriorities}
          tomorrow={state.tomorrow}
          isSubmitting={state.isSubmitting}
          canSubmitDaily={state.canSubmitDaily}
          isWindowOpen={state.isWindowOpen}
          dailySubmitBlockers={state.dailySubmitBlockers}
          draftStatusText={state.draftStatusText}
          submitError={state.submitError}
          submitErrorText={state.submitErrorText}
          submitResult={state.submitResult && "score" in state.submitResult ? state.submitResult : null}
          windowPresentation={state.windowPresentation}
          onSubmit={() => void state.handleSubmit()}
        />
      ) : state.reviewQuery.data.cadence === "weekly" ? (
        <PeriodicReviewWorkspace
          cadenceKey="weekly"
          review={state.reviewQuery.data.review}
          summaryItems={state.summaryItems}
          summaryRetryMessage={summaryRetryMessage}
          onRetrySummary={() => void state.reviewQuery.refetch()}
          responses={state.responses}
          setResponses={state.setResponses}
          focusHabitId={state.focusHabitId}
          setFocusHabitId={state.setFocusHabitId}
          activeHabits={activeHabits}
          habitsLoading={state.habitsQuery.isLoading}
          requiredCount={state.requiredCount}
          completedCount={state.completedCount}
          activeStep={state.activeStep}
          isSubmitting={state.isSubmitting}
          isWindowOpen={state.isWindowOpen}
          draftStatusText={state.draftStatusText}
          submitErrorClassName={submitErrorClassName}
          submitErrorText={state.submitErrorText}
          submitSuccessMessage={submitSuccessMessage}
          onSubmit={() => void state.handleSubmit()}
        />
      ) : (
        <PeriodicReviewWorkspace
          cadenceKey="monthly"
          review={state.reviewQuery.data.review}
          summaryItems={state.summaryItems}
          summaryRetryMessage={null}
          onRetrySummary={() => void state.reviewQuery.refetch()}
          responses={state.responses}
          setResponses={state.setResponses}
          requiredCount={state.requiredCount}
          completedCount={state.completedCount}
          activeStep={state.activeStep}
          isSubmitting={state.isSubmitting}
          isWindowOpen={state.isWindowOpen}
          draftStatusText={state.draftStatusText}
          submitErrorClassName={submitErrorClassName}
          submitErrorText={state.submitErrorText}
          submitSuccessMessage={submitSuccessMessage}
          onSubmit={() => void state.handleSubmit()}
        />
      )}
    </div>
  );
}
