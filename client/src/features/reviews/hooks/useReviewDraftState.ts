import { useEffect, useState } from "react";

import { useReviewDataQuery } from "../../../shared/lib/api";
import { reviewCadences } from "../reviewCadenceConfig";
import {
  clearStoredReviewDraft,
  readStoredReviewDraft,
  writeStoredReviewDraft,
} from "../reviewDraftStorage";
import {
  fillThreePriorityDraft,
  formatDraftStatus,
  hasMeaningfulDailyDraft,
  hasMeaningfulPromptResponses,
  normalizePromptResponses,
  type DailyInputs,
  type DailyPriorityDraft,
  type DailyReviewDraft,
  type DailyTaskDecision,
  type MonthlyReviewDraft,
  type ReviewDraftState,
  type WeeklyReviewDraft,
} from "../reviewDraftModel";

type ReviewData = NonNullable<ReturnType<typeof useReviewDataQuery>["data"]>;

type UseReviewDraftStateArgs = {
  reviewData: ReviewData | undefined;
  draftStorageKey: string | null;
};

export const useReviewDraftState = ({
  reviewData,
  draftStorageKey,
}: UseReviewDraftStateArgs) => {
  const [responses, setResponses] = useState<string[]>([]);
  const [dailyInputs, setDailyInputs] = useState<DailyInputs>({
    biggestWin: "",
    frictionNote: "",
    energyRating: "3",
    optionalNote: "",
    tomorrowAdjustment: "",
  });
  const [dailyTaskDecisions, setDailyTaskDecisions] = useState<Record<string, DailyTaskDecision>>({});
  const [dailyTomorrowPriorities, setDailyTomorrowPriorities] = useState<DailyPriorityDraft[]>([
    { title: "" },
    { title: "" },
  ]);
  const [dailyTomorrowPrioritiesTouched, setDailyTomorrowPrioritiesTouched] = useState(false);
  const [focusHabitId, setFocusHabitId] = useState<string | null>(null);
  const [draftState, setDraftState] = useState<ReviewDraftState>({
    hydratedKey: null,
    lastSavedAt: null,
  });

  useEffect(() => {
    if (!reviewData || !draftStorageKey || draftState.hydratedKey === draftStorageKey) {
      return;
    }

    if (reviewData.cadence === "daily") {
      const review = reviewData.review;
      const existing = review.existingReview;
      const canEditSubmittedReview = review.isCompleted && review.canEditSubmittedReview;
      const storedDraft =
        !review.isCompleted || canEditSubmittedReview
          ? readStoredReviewDraft<DailyReviewDraft>(draftStorageKey)
          : null;
      const baseDailyInputs: DailyInputs = {
        biggestWin: existing?.biggestWin ?? "",
        frictionNote: existing?.frictionNote ?? "",
        energyRating: existing?.energyRating ? String(existing.energyRating) : "3",
        optionalNote: existing?.optionalNote ?? "",
        tomorrowAdjustment:
          existing?.tomorrowAdjustment ??
          review.tomorrowAdjustmentRecommendation.suggestedAdjustment ??
          "",
      };

      const seededPriorities = [...review.seededTomorrowPriorities]
        .sort((left, right) => left.slot - right.slot)
        .map((priority) => ({
          id: priority.id,
          title: priority.title,
        }));
      const fallbackTaskTitles = review.incompleteTasks
        .filter((task) => task.status === "pending")
        .slice(0, 2)
        .map((task) => ({ title: task.title }));
      const seededDailyTomorrowPriorities = fillThreePriorityDraft(
        seededPriorities.length > 0 ? seededPriorities : fallbackTaskTitles,
      );

      if (review.isCompleted && !review.canEditSubmittedReview) {
        clearStoredReviewDraft(draftStorageKey);
      }

      const storedDailyInputs = storedDraft?.value.dailyInputs;
      setDailyInputs(
        storedDailyInputs
          ? {
              biggestWin: storedDailyInputs.biggestWin ?? "",
              frictionNote: storedDailyInputs.frictionNote ?? "",
              energyRating: storedDailyInputs.energyRating ?? "3",
              optionalNote: storedDailyInputs.optionalNote ?? "",
              tomorrowAdjustment: storedDailyInputs.tomorrowAdjustment ?? "",
            }
          : baseDailyInputs,
      );
      const storedDraftPriorities = fillThreePriorityDraft(
        storedDraft?.value.dailyTomorrowPriorities ?? [],
      );
      const storedDraftTouched =
        typeof storedDraft?.value.dailyTomorrowPrioritiesTouched === "boolean"
          ? storedDraft.value.dailyTomorrowPrioritiesTouched
          : storedDraftPriorities.some((priority, index) =>
              priority.title.trim() !== seededDailyTomorrowPriorities[index]?.title.trim(),
            );
      setDailyTomorrowPriorities(
        storedDraftTouched ? storedDraftPriorities : seededDailyTomorrowPriorities,
      );
      setDailyTomorrowPrioritiesTouched(storedDraftTouched);
      setDailyTaskDecisions(storedDraft?.value.dailyTaskDecisions ?? {});
      setDraftState({
        hydratedKey: draftStorageKey,
        lastSavedAt: storedDraft?.savedAt ?? null,
      });
      return;
    }

    if (reviewData.cadence === "weekly") {
      const existing = reviewData.review.existingReview;
      const storedDraft = existing
        ? null
        : readStoredReviewDraft<WeeklyReviewDraft>(draftStorageKey);
      const baseResponses = [
        existing?.biggestWin ?? "",
        existing?.biggestMiss ?? "",
        existing?.mainLesson ?? "",
        existing?.keepText ?? "",
        existing?.improveText ?? "",
      ];

      if (existing) {
        clearStoredReviewDraft(draftStorageKey);
      }

      setResponses(
        normalizePromptResponses(
          storedDraft?.value.responses ?? baseResponses,
          reviewCadences.weekly.prompts.length,
        ),
      );
      setFocusHabitId(storedDraft?.value.focusHabitId ?? existing?.focusHabitId ?? null);
      setDraftState({
        hydratedKey: draftStorageKey,
        lastSavedAt: storedDraft?.savedAt ?? null,
      });
      return;
    }

    const existing = reviewData.review.existingReview;
    const storedDraft = existing
      ? null
      : readStoredReviewDraft<MonthlyReviewDraft>(draftStorageKey);
    const baseResponses = [
      existing?.monthVerdict ?? "",
      existing?.biggestWin ?? "",
      existing?.biggestLeak ?? "",
      existing?.nextMonthTheme ?? "",
      existing?.nextMonthOutcomes.map((outcome) => outcome.title).join("\n") ?? "",
    ];

    if (existing) {
      clearStoredReviewDraft(draftStorageKey);
    }

    setResponses(
      normalizePromptResponses(
        storedDraft?.value.responses ?? baseResponses,
        reviewCadences.monthly.prompts.length,
      ),
    );
    setDraftState({
      hydratedKey: draftStorageKey,
      lastSavedAt: storedDraft?.savedAt ?? null,
    });
  }, [draftState.hydratedKey, draftStorageKey, reviewData]);

  useEffect(() => {
    if (!reviewData || !draftStorageKey || draftState.hydratedKey !== draftStorageKey) {
      return;
    }

    let shouldPersist = false;
    let draftPayload: DailyReviewDraft | WeeklyReviewDraft | MonthlyReviewDraft | null = null;

    if (reviewData.cadence === "daily") {
      if (reviewData.review.isCompleted && !reviewData.review.canEditSubmittedReview) {
        return;
      }

      draftPayload = {
        dailyInputs,
        dailyTaskDecisions,
        dailyTomorrowPriorities: fillThreePriorityDraft(dailyTomorrowPriorities),
        dailyTomorrowPrioritiesTouched,
      };
      shouldPersist =
        hasMeaningfulDailyDraft(draftPayload) ||
        (dailyTomorrowPrioritiesTouched &&
          draftPayload.dailyTomorrowPriorities.some((priority) => priority.title.trim().length > 0));
    } else if (reviewData.cadence === "weekly") {
      if (reviewData.review.existingReview) {
        return;
      }

      draftPayload = {
        responses: normalizePromptResponses(responses, reviewCadences.weekly.prompts.length),
        focusHabitId,
      };
      shouldPersist =
        hasMeaningfulPromptResponses(draftPayload.responses) ||
        Boolean(draftPayload.focusHabitId);
    } else {
      if (reviewData.review.existingReview) {
        return;
      }

      draftPayload = {
        responses: normalizePromptResponses(responses, reviewCadences.monthly.prompts.length),
      };
      shouldPersist = hasMeaningfulPromptResponses(draftPayload.responses);
    }

    const timeoutId = window.setTimeout(() => {
      if (!draftPayload || !shouldPersist) {
        clearStoredReviewDraft(draftStorageKey);
        setDraftState((current) => ({
          ...current,
          lastSavedAt: null,
        }));
        return;
      }

      const savedDraft = writeStoredReviewDraft(draftStorageKey, draftPayload);
      if (!savedDraft) {
        return;
      }

      setDraftState((current) => ({
        ...current,
        lastSavedAt: savedDraft.savedAt,
      }));
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [
    dailyInputs,
    dailyTaskDecisions,
    dailyTomorrowPriorities,
    dailyTomorrowPrioritiesTouched,
    draftState.hydratedKey,
    draftStorageKey,
    focusHabitId,
    responses,
    reviewData,
  ]);

  const clearDraft = () => {
    if (!draftStorageKey) {
      return;
    }

    clearStoredReviewDraft(draftStorageKey);
    setDailyTomorrowPrioritiesTouched(false);
    setDraftState((current) => ({
      ...current,
      lastSavedAt: null,
    }));
  };

  return {
    responses,
    setResponses,
    dailyInputs,
    setDailyInputs,
    dailyTaskDecisions,
    setDailyTaskDecisions,
    dailyTomorrowPriorities,
    setDailyTomorrowPriorities,
    dailyTomorrowPrioritiesTouched,
    setDailyTomorrowPrioritiesTouched,
    focusHabitId,
    setFocusHabitId,
    draftStatusText: formatDraftStatus(draftState.lastSavedAt),
    clearDraft,
  };
};
