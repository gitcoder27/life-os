import {
  splitEntries,
  toPriorityInputs,
  useSubmitDailyReviewMutation,
  useReviewDataQuery,
  useSubmitMonthlyReviewMutation,
  useSubmitWeeklyReviewMutation,
} from "../../../shared/lib/api";
import {
  detectFrictionTag,
  parseEnergyRating,
  prioritySlots,
  type DailyInputs,
  type DailyPriorityDraft,
  type DailyTaskDecision,
} from "../reviewDraftModel";
import { isAlreadySubmittedError } from "../reviewWindowModel";

type ReviewData = NonNullable<ReturnType<typeof useReviewDataQuery>["data"]>;

type UseReviewSubmissionArgs = {
  reviewDate: string;
  reviewData: ReviewData | undefined;
  refetchReview: () => Promise<unknown>;
  clearDraft: () => void;
  dailyInputs: DailyInputs;
  dailyTaskDecisions: Record<string, DailyTaskDecision>;
  dailyTomorrowPriorities: DailyPriorityDraft[];
  responses: string[];
  focusHabitId: string | null;
};

export const useReviewSubmission = ({
  reviewDate,
  reviewData,
  refetchReview,
  clearDraft,
  dailyInputs,
  dailyTaskDecisions,
  dailyTomorrowPriorities,
  responses,
  focusHabitId,
}: UseReviewSubmissionArgs) => {
  const submitDailyReviewMutation = useSubmitDailyReviewMutation(reviewDate);
  const submitWeeklyReviewMutation = useSubmitWeeklyReviewMutation(reviewDate);
  const submitMonthlyReviewMutation = useSubmitMonthlyReviewMutation(reviewDate);

  const isSubmitting =
    submitDailyReviewMutation.isPending ||
    submitWeeklyReviewMutation.isPending ||
    submitMonthlyReviewMutation.isPending;
  const submitError =
    submitDailyReviewMutation.error ??
    submitWeeklyReviewMutation.error ??
    submitMonthlyReviewMutation.error;
  const submitResult =
    submitDailyReviewMutation.data ??
    submitWeeklyReviewMutation.data ??
    submitMonthlyReviewMutation.data;

  const handleSubmit = async () => {
    if (!reviewData) {
      return;
    }

    if (reviewData.cadence === "daily") {
      const pendingTasks = reviewData.review.incompleteTasks.filter((task) => task.status === "pending");
      const carryForwardTaskIds: string[] = [];
      const droppedTaskIds: string[] = [];
      const rescheduledTasks: Array<{ taskId: string; targetDate: string }> = [];

      for (const task of pendingTasks) {
        const decision = dailyTaskDecisions[task.id];
        if (!decision) {
          return;
        }

        if (decision.type === "carry_forward") {
          carryForwardTaskIds.push(task.id);
          continue;
        }

        if (decision.type === "drop") {
          droppedTaskIds.push(task.id);
          continue;
        }

        if (!decision.targetDate) {
          return;
        }

        rescheduledTasks.push({
          taskId: task.id,
          targetDate: decision.targetDate,
        });
      }

      await submitDailyReviewMutation.mutateAsync({
        biggestWin: dailyInputs.biggestWin.trim() || "Closed the loop",
        frictionTag: detectFrictionTag(dailyInputs.frictionNote),
        frictionNote: dailyInputs.frictionNote.trim() || null,
        energyRating: parseEnergyRating(dailyInputs.energyRating),
        optionalNote: dailyInputs.optionalNote.trim() || null,
        tomorrowAdjustment: dailyInputs.tomorrowAdjustment || null,
        carryForwardTaskIds,
        droppedTaskIds,
        rescheduledTasks,
        tomorrowPriorities: dailyTomorrowPriorities.map((priority, index) => ({
          id: priority.id,
          slot: prioritySlots[index],
          title: priority.title.trim(),
        })),
      });
      clearDraft();
      return;
    }

    if (reviewData.cadence === "weekly") {
      const nextWeekPriorities = toPriorityInputs(
        splitEntries(responses[4]).length
          ? splitEntries(responses[4])
          : [responses[3] || "Protect momentum"],
      );

      try {
        await submitWeeklyReviewMutation.mutateAsync({
          biggestWin: responses[0] || "Kept momentum",
          biggestMiss: responses[1] || "Missed a key follow-through",
          mainLesson: responses[2] || "Keep the system simple",
          keepText: responses[3] || "Protect the existing routine",
          improveText: responses[4] || "Clarify next week's priorities",
          nextWeekPriorities,
          focusHabitId: focusHabitId || null,
          notes: responses.join("\n\n"),
        });
        clearDraft();
      } catch (error) {
        if (isAlreadySubmittedError(error)) {
          await refetchReview();
        }
      }
      return;
    }

    try {
      await submitMonthlyReviewMutation.mutateAsync({
        monthVerdict: responses[0] || "Steady progress",
        biggestWin: responses[1] || "Built consistency",
        biggestLeak: responses[2] || "Lost time on low-value work",
        ratings: {
          overall: 3,
        },
        nextMonthTheme: responses[3] || "Protect momentum",
        threeOutcomes: splitEntries(responses[4]),
        habitChanges: [],
        simplifyText: responses[2] || "Remove low-signal commitments",
        notes: responses.join("\n\n"),
      });
      clearDraft();
    } catch (error) {
      if (isAlreadySubmittedError(error)) {
        await refetchReview();
      }
    }
  };

  return {
    isSubmitting,
    submitError,
    submitResult,
    handleSubmit,
  };
};
