import { useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  getTodayDate,
  useHabitsQuery,
  useReviewDataQuery,
} from "../../../shared/lib/api";
import { reviewCadences, type ReviewCadenceKey } from "../reviewCadenceConfig";
import { createReviewDraftStorageKey } from "../reviewDraftStorage";
import {
  formatClosedWindowStatus,
  formatCount,
  getTomorrowDate,
  isQuickCaptureMetadataTask,
} from "../reviewDraftModel";
import { useReviewDraftState } from "./useReviewDraftState";
import { useReviewSubmission } from "./useReviewSubmission";
import {
  deriveReviewWindowPresentation,
  isAlreadySubmittedError,
  isOutOfWindowError,
} from "../reviewWindowModel";

type ReviewData = NonNullable<ReturnType<typeof useReviewDataQuery>["data"]>;

const isReviewCadenceKey = (value: string): value is ReviewCadenceKey =>
  value === "daily" || value === "weekly" || value === "monthly";

const buildSummaryItems = (reviewData: ReviewData) => {
  if (reviewData.cadence === "daily") {
    const summary = reviewData.review.summary;
    return [
      `Priorities: ${summary.prioritiesCompleted}/${summary.prioritiesTotal}`,
      `Tasks: ${summary.tasksCompleted}/${summary.tasksScheduled}`,
      `Routines: ${summary.routinesCompleted}/${summary.routinesTotal}`,
      `Habits: ${summary.habitsCompleted}/${summary.habitsDue}`,
      `Water: ${summary.waterMl}/${summary.waterTargetMl} ml`,
      `Workout: ${summary.workoutStatus.replace(/_/g, " ")}`,
    ];
  }

  if (reviewData.cadence === "weekly") {
    const summary = reviewData.review.summary;
    return [
      `Average daily score: ${summary.averageDailyScore}`,
      `Strong days: ${summary.strongDayCount}`,
      `Habit completion: ${Math.round(summary.habitCompletionRate)}%`,
      `Routine completion: ${Math.round(summary.routineCompletionRate)}%`,
      `Meals logged: ${summary.mealsLoggedCount}`,
      `Top spend category: ${summary.topSpendCategory ?? "None"}`,
    ];
  }

  const summary = reviewData.review.summary;
  return [
    `Average weekly momentum: ${summary.averageWeeklyMomentum}`,
    `Best score: ${summary.bestScore ?? "N/A"}`,
    `Worst score: ${summary.worstScore ?? "N/A"}`,
    `Workouts: ${summary.workoutCount}`,
    `Water success rate: ${Math.round(summary.waterSuccessRate)}%`,
    `Top habit: ${summary.topHabits[0]?.title ?? "None"}`,
  ];
};

const getDraftStorageKey = (reviewData: ReviewData | undefined) => {
  if (!reviewData) {
    return null;
  }

  if (reviewData.cadence === "daily") {
    return createReviewDraftStorageKey("daily", reviewData.review.date);
  }

  return createReviewDraftStorageKey(
    reviewData.cadence,
    `${reviewData.review.startDate}:${reviewData.review.endDate}`,
  );
};

export const useReviewsPageState = () => {
  const { cadence = "daily" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const today = getTodayDate();
  const dateParam = searchParams.get("date");
  const reviewDate = dateParam || today;
  const cadenceKey = isReviewCadenceKey(cadence) ? cadence : "daily";
  const config = reviewCadences[cadenceKey];
  const tomorrow = getTomorrowDate(reviewDate);

  const reviewQuery = useReviewDataQuery(cadenceKey, reviewDate);
  const habitsQuery = useHabitsQuery();
  const submissionWindow = reviewQuery.data?.review.submissionWindow ?? null;
  const windowPresentation = submissionWindow
    ? deriveReviewWindowPresentation(submissionWindow, cadenceKey)
    : null;
  const isWindowOpen = submissionWindow?.isOpen ?? false;
  const draftStorageKey = useMemo(() => getDraftStorageKey(reviewQuery.data), [reviewQuery.data]);
  const summaryItems = useMemo(
    () => (reviewQuery.data ? buildSummaryItems(reviewQuery.data) : []),
    [reviewQuery.data],
  );

  const draftState = useReviewDraftState({
    reviewData: reviewQuery.data,
    draftStorageKey,
  });
  const submissionState = useReviewSubmission({
    reviewDate,
    reviewData: reviewQuery.data,
    refetchReview: () => reviewQuery.refetch(),
    clearDraft: draftState.clearDraft,
    dailyInputs: draftState.dailyInputs,
    dailyTaskDecisions: draftState.dailyTaskDecisions,
    dailyTomorrowPriorities: draftState.dailyTomorrowPriorities,
    responses: draftState.responses,
    focusHabitId: draftState.focusHabitId,
  });

  useEffect(() => {
    if (
      !dateParam &&
      submissionWindow?.allowedDate &&
      submissionWindow.allowedDate !== reviewQuery.data?.keyDate
    ) {
      navigate(`/reviews/${cadenceKey}?date=${submissionWindow.allowedDate}`, {
        replace: true,
      });
    }
  }, [cadenceKey, dateParam, navigate, reviewQuery.data?.keyDate, submissionWindow]);

  const dailyPendingTasks =
    reviewQuery.data?.cadence === "daily"
      ? reviewQuery.data.review.incompleteTasks
          .filter((task) => task.status === "pending")
          .filter((task) => !isQuickCaptureMetadataTask(task))
      : [];
  const unresolvedTaskDecisionCount =
    reviewQuery.data?.cadence === "daily"
      ? dailyPendingTasks.filter((task) => {
          const decision = draftState.dailyTaskDecisions[task.id];
          if (!decision) {
            return true;
          }

          return decision.type === "reschedule" && !decision.targetDate;
        }).length
      : 0;
  const missingTomorrowPriorityCount =
    reviewQuery.data?.cadence === "daily"
      ? draftState.dailyTomorrowPriorities.filter((priority) => priority.title.trim().length === 0).length
      : 0;
  const hasDecisionForEveryPendingTask =
    reviewQuery.data?.cadence === "daily"
      ? dailyPendingTasks.every((task) => {
          const decision = draftState.dailyTaskDecisions[task.id];
          if (!decision) {
            return false;
          }

          return decision.type === "reschedule" ? Boolean(decision.targetDate) : true;
        })
      : false;
  const hasThreeTomorrowPriorities =
    reviewQuery.data?.cadence === "daily"
      ? draftState.dailyTomorrowPriorities.length === 3 &&
        draftState.dailyTomorrowPriorities.every((priority) => priority.title.trim().length > 0)
      : false;
  const dailySubmitBlockers =
    reviewQuery.data?.cadence === "daily"
      ? [
          ...(!isWindowOpen ? [formatClosedWindowStatus(windowPresentation)] : []),
          ...(isWindowOpen && unresolvedTaskDecisionCount > 0
            ? [
                `${formatCount(
                  unresolvedTaskDecisionCount,
                  "pending task still needs a decision",
                  "pending tasks still need decisions",
                )}.`,
              ]
            : []),
          ...(isWindowOpen && missingTomorrowPriorityCount > 0
            ? [
                `${formatCount(
                  missingTomorrowPriorityCount,
                  "tomorrow priority is still empty",
                  "tomorrow priorities are still empty",
                )}.`,
              ]
            : []),
        ]
      : [];
  const canSubmitDaily =
    reviewQuery.data?.cadence === "daily" &&
    (!reviewQuery.data.review.isCompleted || reviewQuery.data.review.canEditSubmittedReview) &&
    isWindowOpen &&
    hasDecisionForEveryPendingTask &&
    hasThreeTomorrowPriorities &&
    !submissionState.isSubmitting;
  const requiredCount = "prompts" in config ? config.prompts.length : 0;
  const completedCount = draftState.responses.filter((response) => response.trim().length > 0).length;
  const activeStep = draftState.responses.findIndex((response) => response.trim().length === 0);

  const handleNavigateToAllowed = () => {
    if (submissionWindow?.allowedDate) {
      navigate(`/reviews/${cadenceKey}?date=${submissionWindow.allowedDate}`);
    }
  };

  const submitErrorText = submissionState.submitError
    ? (() => {
        if (isAlreadySubmittedError(submissionState.submitError)) {
          return "This review period has already been submitted and is now locked.";
        }
        if (isOutOfWindowError(submissionState.submitError)) {
          return windowPresentation
            ? `Submission blocked: ${windowPresentation.headline.toLowerCase()}. ${windowPresentation.description}`
            : "This review cannot be submitted outside its allowed time window.";
        }
        if (submissionState.submitError instanceof Error) {
          return submissionState.submitError.message;
        }
        return "Review submission failed.";
      })()
    : null;

  return {
    cadenceKey,
    config,
    reviewDate,
    reviewQuery,
    habitsQuery,
    summaryItems,
    windowPresentation,
    isWindowOpen,
    draftStatusText: draftState.draftStatusText,
    responses: draftState.responses,
    setResponses: draftState.setResponses,
    dailyInputs: draftState.dailyInputs,
    setDailyInputs: draftState.setDailyInputs,
    dailyTaskDecisions: draftState.dailyTaskDecisions,
    setDailyTaskDecisions: draftState.setDailyTaskDecisions,
    dailyTomorrowPriorities: draftState.dailyTomorrowPriorities,
    setDailyTomorrowPriorities: draftState.setDailyTomorrowPriorities,
    focusHabitId: draftState.focusHabitId,
    setFocusHabitId: draftState.setFocusHabitId,
    handleSubmit: submissionState.handleSubmit,
    handleNavigateToAllowed,
    isSubmitting: submissionState.isSubmitting,
    submitError: submissionState.submitError,
    submitErrorText,
    submitResult: submissionState.submitResult,
    tomorrow,
    dailyPendingTasks,
    dailySubmitBlockers,
    canSubmitDaily,
    requiredCount,
    completedCount,
    activeStep,
  };
};
