import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  type DailyFrictionTag,
  getTodayDate,
  toIsoDate,
  splitEntries,
  toPriorityInputs,
  useHabitsQuery,
  useReviewDataQuery,
  useSubmitDailyReviewMutation,
  useSubmitMonthlyReviewMutation,
  useSubmitWeeklyReviewMutation,
} from "../../shared/lib/api";
import { isRecurring } from "../../shared/lib/recurrence";
import { getQuickCaptureDisplayText, parseQuickCaptureNotes } from "../../shared/lib/quickCapture";
import { PageHeader } from "../../shared/ui/PageHeader";
import {
  EmptyState,
  InlineErrorState,
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";
import { RecurrenceBadge } from "../../shared/ui/RecurrenceBadge";
import { SectionCard } from "../../shared/ui/SectionCard";
import { ReviewWindowBanner } from "./ReviewWindowBanner";
import { deriveReviewWindowPresentation, isAlreadySubmittedError, isOutOfWindowError } from "./reviewWindowModel";

const reviewCadences = {
  daily: {
    label: "Daily",
    title: "Close the day and seed tomorrow",
    description:
      "The daily review should stay short, practical, and tied to carry-forward decisions.",
  },
  weekly: {
    label: "Weekly",
    title: "Review the pattern, not just the day",
    description:
      "Weekly review pulls together score trend, habits, health, and spending so next-week planning is grounded.",
    prompts: [
      "What was the biggest win?",
      "What hurt progress most?",
      "What should continue next week?",
      "What should change next week?",
      "Which habit matters most next week?",
    ],
  },
  monthly: {
    label: "Monthly",
    title: "Reset the larger system",
    description:
      "Monthly review should reframe direction and simplify the next month instead of becoming a giant questionnaire.",
    prompts: [
      "How did this month go in one sentence?",
      "What mattered most?",
      "What leaked time, energy, or money?",
      "What is next month's theme?",
      "What three outcomes matter most next month?",
    ],
  },
} as const;

type DailyTaskDecision = {
  type: "carry_forward" | "drop" | "reschedule";
  targetDate?: string;
};

type DailyPriorityDraft = {
  id?: string;
  title: string;
};

const prioritySlots: Array<1 | 2 | 3> = [1, 2, 3];

function detectFrictionTag(value: string): DailyFrictionTag {
  const normalized = value.toLowerCase();
  if (normalized.includes("energy")) return "low energy";
  if (normalized.includes("interrupt")) return "interruptions";
  if (normalized.includes("distraction")) return "distraction";
  if (normalized.includes("overcommit")) return "overcommitment";
  if (normalized.includes("avoid")) return "avoidance";
  if (normalized.includes("unclear")) return "unclear task";
  if (normalized.includes("travel") || normalized.includes("schedule")) return "travel or schedule disruption";
  return "poor planning";
}

function parseEnergyRating(value: string) {
  const number = Number.parseInt(value.replace(/[^0-9]/g, ""), 10);
  if (!Number.isFinite(number)) {
    return 3;
  }

  return Math.min(5, Math.max(1, number));
}

function getTomorrowDate(isoDate: string) {
  const tomorrow = new Date(`${isoDate}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toIsoDate(tomorrow);
}

function isQuickCaptureMetadataTask(task: { originType: string; notes: string | null }) {
  return task.originType === "quick_capture" && parseQuickCaptureNotes(task.notes) !== null;
}

function fillThreePriorityDraft(values: DailyPriorityDraft[]) {
  const next = values.slice(0, 3);
  while (next.length < 3) {
    next.push({ title: "" });
  }

  return next;
}

export function ReviewsPage() {
  const { cadence = "daily" } = useParams();
  const [searchParams] = useSearchParams();
  const today = getTodayDate();
  const dateParam = searchParams.get("date");
  const reviewDate = dateParam || today;
  const tomorrow = getTomorrowDate(reviewDate);
  const cadenceKey =
    cadence === "daily" || cadence === "weekly" || cadence === "monthly"
      ? cadence
      : "daily";
  const config = reviewCadences[cadenceKey];
  const reviewQuery = useReviewDataQuery(cadenceKey, reviewDate);
  const submitDailyReviewMutation = useSubmitDailyReviewMutation(reviewDate);
  const submitWeeklyReviewMutation = useSubmitWeeklyReviewMutation(reviewDate);
  const submitMonthlyReviewMutation = useSubmitMonthlyReviewMutation(reviewDate);
  const [responses, setResponses] = useState<string[]>([]);
  const [dailyInputs, setDailyInputs] = useState({
    biggestWin: "",
    frictionNote: "",
    energyRating: "3",
    optionalNote: "",
  });
  const [dailyTaskDecisions, setDailyTaskDecisions] = useState<Record<string, DailyTaskDecision>>({});
  const [dailyTomorrowPriorities, setDailyTomorrowPriorities] = useState<DailyPriorityDraft[]>([
    { title: "" },
    { title: "" },
    { title: "" },
  ]);
  const [focusHabitId, setFocusHabitId] = useState<string | null>(null);
  const habitsQuery = useHabitsQuery();
  const navigate = useNavigate();

  const submissionWindow = reviewQuery.data?.review.submissionWindow ?? null;
  const windowPresentation = submissionWindow
    ? deriveReviewWindowPresentation(submissionWindow, cadenceKey)
    : null;
  const isWindowOpen = submissionWindow?.isOpen ?? false;

  // Auto-redirect: if no explicit ?date= and the backend says a different date is allowed
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
  }, [dateParam, submissionWindow, reviewQuery.data?.keyDate, cadenceKey, navigate]);

  const requiredCount = "prompts" in config ? config.prompts.length : 0;
  const completedCount = responses.filter((response) => response.trim().length > 0).length;
  const activeStep = responses.findIndex((response) => response.trim().length === 0);

  const summaryItems = useMemo(() => {
    if (!reviewQuery.data) {
      return [];
    }

    if (reviewQuery.data.cadence === "daily") {
      const summary = reviewQuery.data.review.summary;
      return [
        `Priorities: ${summary.prioritiesCompleted}/${summary.prioritiesTotal}`,
        `Tasks: ${summary.tasksCompleted}/${summary.tasksScheduled}`,
        `Routines: ${summary.routinesCompleted}/${summary.routinesTotal}`,
        `Habits: ${summary.habitsCompleted}/${summary.habitsDue}`,
        `Water: ${summary.waterMl}/${summary.waterTargetMl} ml`,
        `Workout: ${summary.workoutStatus.replace(/_/g, " ")}`,
      ];
    }

    if (reviewQuery.data.cadence === "weekly") {
      const summary = reviewQuery.data.review.summary;
      return [
        `Average daily score: ${summary.averageDailyScore}`,
        `Strong days: ${summary.strongDayCount}`,
        `Habit completion: ${Math.round(summary.habitCompletionRate)}%`,
        `Routine completion: ${Math.round(summary.routineCompletionRate)}%`,
        `Meals logged: ${summary.mealsLoggedCount}`,
        `Top spend category: ${summary.topSpendCategory ?? "None"}`,
      ];
    }

    const summary = reviewQuery.data.review.summary;
    return [
      `Average weekly momentum: ${summary.averageWeeklyMomentum}`,
      `Best score: ${summary.bestScore ?? "N/A"}`,
      `Worst score: ${summary.worstScore ?? "N/A"}`,
      `Workouts: ${summary.workoutCount}`,
      `Water success rate: ${Math.round(summary.waterSuccessRate)}%`,
      `Top habit: ${summary.topHabits[0]?.title ?? "None"}`,
    ];
  }, [reviewQuery.data]);

  useEffect(() => {
    if (!reviewQuery.data) {
      return;
    }

    if (reviewQuery.data.cadence === "daily") {
      const review = reviewQuery.data.review;
      const existing = review.existingReview;

      setDailyInputs({
        biggestWin: existing?.biggestWin ?? "",
        frictionNote: existing?.frictionNote ?? "",
        energyRating: existing?.energyRating ? String(existing.energyRating) : "3",
        optionalNote: existing?.optionalNote ?? "",
      });

      const seededPriorities = [...review.seededTomorrowPriorities]
        .sort((left, right) => left.slot - right.slot)
        .map((priority) => ({
          id: priority.id,
          title: priority.title,
        }));
      const fallbackTaskTitles = review.incompleteTasks
        .filter((task) => task.status === "pending")
        .slice(0, 3)
        .map((task) => ({ title: task.title }));

      setDailyTomorrowPriorities(
        fillThreePriorityDraft(
          seededPriorities.length > 0 ? seededPriorities : fallbackTaskTitles,
        ),
      );
      setDailyTaskDecisions({});
      return;
    }

    if (reviewQuery.data.cadence === "weekly") {
      const existing = reviewQuery.data.review.existingReview;
      setResponses([
        existing?.biggestWin ?? "",
        existing?.biggestMiss ?? "",
        existing?.mainLesson ?? "",
        existing?.keepText ?? "",
        existing?.improveText ?? "",
      ]);
      setFocusHabitId(existing?.focusHabitId ?? null);
      return;
    }

    const existing = reviewQuery.data.review.existingReview;
    setResponses([
      existing?.monthVerdict ?? "",
      existing?.biggestWin ?? "",
      existing?.biggestLeak ?? "",
      existing?.nextMonthTheme ?? "",
      existing?.threeOutcomes.join("\n") ?? "",
    ]);
  }, [reviewQuery.data]);

  async function handleSubmit() {
    if (!reviewQuery.data) {
      return;
    }

    if (reviewQuery.data.cadence === "daily") {
      const pendingTasks = reviewQuery.data.review.incompleteTasks.filter(
        (task) => task.status === "pending",
      );

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
        carryForwardTaskIds,
        droppedTaskIds,
        rescheduledTasks,
        tomorrowPriorities: dailyTomorrowPriorities.map((priority, index) => ({
          id: priority.id,
          slot: prioritySlots[index],
          title: priority.title.trim(),
        })),
      });
      return;
    }

    if (reviewQuery.data.cadence === "weekly") {
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
      } catch (error) {
        if (isAlreadySubmittedError(error)) {
          void reviewQuery.refetch();
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
    } catch (error) {
      if (isAlreadySubmittedError(error)) {
        void reviewQuery.refetch();
      }
    }
  }

  if (reviewQuery.isLoading && !reviewQuery.data) {
    return (
      <PageLoadingState
        title={`${config.label} review loading`}
        description="Pulling the generated summary and existing responses into the review form."
      />
    );
  }

  if (reviewQuery.isError || !reviewQuery.data) {
    return (
      <PageErrorState
        title={`${config.label} review is unavailable`}
        message={reviewQuery.error instanceof Error ? reviewQuery.error.message : undefined}
        onRetry={() => void reviewQuery.refetch()}
      />
    );
  }

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
  const dailyReview = reviewQuery.data.cadence === "daily" ? reviewQuery.data.review : null;
  const isDailyCompleted = dailyReview?.isCompleted ?? false;

  const weeklyReview = reviewQuery.data.cadence === "weekly" ? reviewQuery.data.review : null;
  const isWeeklyLocked = weeklyReview?.existingReview !== null && weeklyReview?.existingReview !== undefined;

  const monthlyReview = reviewQuery.data.cadence === "monthly" ? reviewQuery.data.review : null;
  const isMonthlyLocked = monthlyReview?.existingReview !== null && monthlyReview?.existingReview !== undefined;
  const seededNextWeekPriorities = Array.isArray(weeklyReview?.seededNextWeekPriorities)
    ? weeklyReview.seededNextWeekPriorities
    : [];
  const monthlyThreeOutcomes = Array.isArray(monthlyReview?.existingReview?.threeOutcomes)
    ? monthlyReview.existingReview.threeOutcomes
    : [];
  const monthlyHabitChanges = Array.isArray(monthlyReview?.existingReview?.habitChanges)
    ? monthlyReview.existingReview.habitChanges
    : [];
  const seededNextMonthTheme = monthlyReview?.seededNextMonthTheme ?? null;
  const seededNextMonthOutcomes = Array.isArray(monthlyReview?.seededNextMonthOutcomes)
    ? monthlyReview.seededNextMonthOutcomes
    : [];

  const dailyPendingTasks =
    dailyReview?.incompleteTasks
      .filter((task) => task.status === "pending")
      .filter((task) => !isQuickCaptureMetadataTask(task)) ?? [];
  const hasDecisionForEveryPendingTask =
    reviewQuery.data.cadence === "daily"
      ? dailyPendingTasks.every((task) => {
          const decision = dailyTaskDecisions[task.id];
          if (!decision) {
            return false;
          }

          if (decision.type === "reschedule") {
            return Boolean(decision.targetDate);
          }

          return true;
        })
      : false;
  const hasThreeTomorrowPriorities =
    reviewQuery.data.cadence === "daily"
      ? dailyTomorrowPriorities.length === 3 &&
        dailyTomorrowPriorities.every((priority) => priority.title.trim().length > 0)
      : false;

  const canSubmitDaily =
    reviewQuery.data.cadence === "daily" &&
    !isDailyCompleted &&
    isWindowOpen &&
    hasDecisionForEveryPendingTask &&
    hasThreeTomorrowPriorities &&
    !isSubmitting;

  function handleNavigateToAllowed() {
    if (submissionWindow?.allowedDate) {
      navigate(`/reviews/${cadenceKey}?date=${submissionWindow.allowedDate}`);
    }
  }

  function formatSubmitError(error: unknown): string {
    if (isAlreadySubmittedError(error)) {
      return "This review period has already been submitted and is now locked.";
    }
    if (isOutOfWindowError(error)) {
      return windowPresentation
        ? `Submission blocked: ${windowPresentation.headline.toLowerCase()}. ${windowPresentation.description}`
        : "This review cannot be submitted outside its allowed time window.";
    }
    if (error instanceof Error) {
      return error.message;
    }
    return "Review submission failed.";
  }

  return (
    <div className="page">
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.25rem" }}>
        {(["daily", "weekly", "monthly"] as const).map((currentCadence) => (
          <NavLink
            key={currentCadence}
            to={`/reviews/${currentCadence}`}
            className={`button ${currentCadence === cadenceKey ? "button--primary" : "button--ghost"} button--small`}
          >
            {reviewCadences[currentCadence].label}
          </NavLink>
        ))}
      </div>

      <PageHeader
        eyebrow={`${config.label} review`}
        title={config.title}
        description={config.description}
      />

      {windowPresentation && (
        <ReviewWindowBanner
          presentation={windowPresentation}
          cadence={cadenceKey}
          onNavigateToAllowed={handleNavigateToAllowed}
        />
      )}

      {reviewQuery.data.cadence === "daily" ? (
        <>
          <div className="two-column-grid stagger">
            <SectionCard
              title="Generated summary"
              subtitle="System-generated overview"
            >
              <ul className="list">
                {summaryItems.map((item) => (
                  <li key={item}>
                    <span>{item}</span>
                    <span className="tag tag--neutral">auto</span>
                  </li>
                ))}
              </ul>
              <p className="support-copy" style={{ marginTop: "0.7rem" }}>
                Score band: {reviewQuery.data.review.score.label} ({reviewQuery.data.review.score.value})
              </p>
            </SectionCard>

            <SectionCard
              title="Pending tasks"
              subtitle={isDailyCompleted ? "Review closed" : "Choose one decision per task"}
            >
              {dailyPendingTasks.length > 0 ? (
                <div className="review-decision-list">
                  {dailyPendingTasks.map((task) => {
                    const decision = dailyTaskDecisions[task.id];
                    const isCarry = decision?.type === "carry_forward";
                    const isDrop = decision?.type === "drop";
                    const isReschedule = decision?.type === "reschedule";
                    return (
                      <div key={task.id} className="review-decision-item">
                        <div>
                          <strong>
                            {task.title}
                            {isRecurring(task.recurrence) && (
                              <RecurrenceBadge recurrence={task.recurrence} compact />
                            )}
                          </strong>
                          <div className="list__subtle">
                            {isRecurring(task.recurrence)
                              ? "Recurring — your decision updates the series"
                              : getQuickCaptureDisplayText(task.notes, task.title)}
                          </div>
                        </div>
                        {isDailyCompleted ? (
                          <span className="tag tag--neutral">closed</span>
                        ) : (
                          <>
                            <div className="button-row button-row--tight button-row--wrap">
                              <button
                                className={`button ${isCarry ? "button--primary" : "button--ghost"} button--small`}
                                type="button"
                                onClick={() =>
                                  setDailyTaskDecisions((current) => ({
                                    ...current,
                                    [task.id]: {
                                      type: "carry_forward",
                                    },
                                  }))
                                }
                              >
                                Carry forward
                              </button>
                              <button
                                className={`button ${isDrop ? "button--primary" : "button--ghost"} button--small`}
                                type="button"
                                onClick={() =>
                                  setDailyTaskDecisions((current) => ({
                                    ...current,
                                    [task.id]: {
                                      type: "drop",
                                    },
                                  }))
                                }
                              >
                                Drop
                              </button>
                              <button
                                className={`button ${isReschedule ? "button--primary" : "button--ghost"} button--small`}
                                type="button"
                                onClick={() =>
                                  setDailyTaskDecisions((current) => ({
                                    ...current,
                                    [task.id]: {
                                      type: "reschedule",
                                      targetDate:
                                        current[task.id]?.targetDate ?? tomorrow,
                                    },
                                  }))
                                }
                              >
                                Reschedule
                              </button>
                            </div>
                            {isReschedule ? (
                              <label className="field" style={{ marginTop: "0.5rem" }}>
                                <span>Target date</span>
                                <input
                                  type="date"
                                  value={decision.targetDate ?? tomorrow}
                                  onChange={(event) =>
                                    setDailyTaskDecisions((current) => ({
                                      ...current,
                                      [task.id]: {
                                        type: "reschedule",
                                        targetDate: event.target.value,
                                      },
                                    }))
                                  }
                                />
                              </label>
                            ) : null}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="No pending tasks"
                  description="All day tasks are already resolved."
                />
              )}
            </SectionCard>

            {isDailyCompleted ? (
              <>
                <SectionCard
                  title="Submitted daily reflection"
                  subtitle="Read-only closed state"
                >
                  {reviewQuery.data.review.existingReview ? (
                    <ul className="list">
                      <li>
                        <strong>Biggest win</strong>
                        <span className="list__subtle">{reviewQuery.data.review.existingReview.biggestWin}</span>
                      </li>
                      <li>
                        <strong>Friction tag</strong>
                        <span className="list__subtle">{reviewQuery.data.review.existingReview.frictionTag}</span>
                      </li>
                      <li>
                        <strong>Friction note</strong>
                        <span className="list__subtle">{reviewQuery.data.review.existingReview.frictionNote ?? "None"}</span>
                      </li>
                      <li>
                        <strong>Energy</strong>
                        <span className="list__subtle">{reviewQuery.data.review.existingReview.energyRating}/5</span>
                      </li>
                      <li>
                        <strong>Optional note</strong>
                        <span className="list__subtle">{reviewQuery.data.review.existingReview.optionalNote ?? "None"}</span>
                      </li>
                    </ul>
                  ) : (
                    <EmptyState
                      title="No reflection captured"
                      description="The review is closed but no reflection details were returned."
                    />
                  )}
                </SectionCard>

                <SectionCard
                  title="Seeded tomorrow priorities"
                  subtitle="Submitted output"
                >
                  {reviewQuery.data.review.seededTomorrowPriorities.length > 0 ? (
                    <ol className="priority-list">
                      {[...reviewQuery.data.review.seededTomorrowPriorities]
                        .sort((left, right) => left.slot - right.slot)
                        .map((priority, index) => (
                          <li key={priority.id} className="priority-list__item">
                            <span>
                              <span className="tag tag--neutral" style={{ marginRight: "0.5rem" }}>
                                P{index + 1}
                              </span>
                              {priority.title}
                            </span>
                          </li>
                        ))}
                    </ol>
                  ) : (
                    <EmptyState
                      title="No priorities seeded"
                      description="No tomorrow priorities were returned with this closed review."
                    />
                  )}
                </SectionCard>
              </>
            ) : (
              <>
                <SectionCard
                  title="Daily reflection"
                  subtitle="Short and practical"
                >
                  <div className="stack-form">
                    <label className="field">
                      <span>Biggest win</span>
                      <textarea
                        rows={2}
                        placeholder="What moved the day forward?"
                        value={dailyInputs.biggestWin}
                        onChange={(event) =>
                          setDailyInputs((current) => ({
                            ...current,
                            biggestWin: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Main friction note</span>
                      <textarea
                        rows={2}
                        placeholder="What created the most friction?"
                        value={dailyInputs.frictionNote}
                        onChange={(event) =>
                          setDailyInputs((current) => ({
                            ...current,
                            frictionNote: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Energy rating (1-5)</span>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={dailyInputs.energyRating}
                        onChange={(event) =>
                          setDailyInputs((current) => ({
                            ...current,
                            energyRating: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Optional note</span>
                      <textarea
                        rows={2}
                        placeholder="Anything else worth capturing?"
                        value={dailyInputs.optionalNote}
                        onChange={(event) =>
                          setDailyInputs((current) => ({
                            ...current,
                            optionalNote: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                </SectionCard>

                <SectionCard
                  title="Tomorrow priorities"
                  subtitle="Exactly 3 priorities required"
                >
                  <div className="stack-form">
                    {dailyTomorrowPriorities.map((priority, index) => (
                      <label key={`tomorrow-priority-${index}`} className="field">
                        <span>Priority {index + 1}</span>
                        <input
                          type="text"
                          value={priority.title}
                          placeholder="Enter tomorrow's priority"
                          onChange={(event) =>
                            setDailyTomorrowPriorities((current) =>
                              current.map((entry, entryIndex) =>
                                entryIndex === index
                                  ? {
                                      ...entry,
                                      title: event.target.value,
                                    }
                                  : entry,
                              ),
                            )
                          }
                        />
                      </label>
                    ))}
                  </div>
                </SectionCard>
              </>
            )}
          </div>

          {isDailyCompleted ? (
            <div className="inline-state inline-state--success" style={{ marginTop: "0.75rem" }}>
              Daily review is already closed for {dailyReview?.date}.
            </div>
            ) : (
            <>
              <div className="button-row" style={{ paddingTop: "0.5rem" }}>
                <span className="support-copy">
                  {!isWindowOpen
                    ? "Submission is currently disabled — the review window is not open."
                    : hasDecisionForEveryPendingTask
                      ? "All pending tasks have decisions."
                      : "Choose carry forward, drop, or reschedule for every pending task."}{" "}
                  {isWindowOpen &&
                    (hasThreeTomorrowPriorities
                      ? "Three tomorrow priorities are set."
                      : "Fill all three tomorrow priorities to submit.")}
                </span>
                <button
                  className="button button--primary"
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={!canSubmitDaily}
                >
                  {isSubmitting ? "Submitting..." : "Submit daily review"}
                </button>
              </div>
              {submitError ? (
                <div
                  className={`inline-state ${isOutOfWindowError(submitError) ? "inline-state--out-of-window" : "inline-state--error"}`}
                  style={{ marginTop: "0.75rem" }}
                >
                  {formatSubmitError(submitError)}
                </div>
              ) : null}
              {submitResult && "score" in submitResult ? (
                <div className="inline-state inline-state--success" style={{ marginTop: "0.75rem" }}>
                  Daily review closed. {submitResult.tomorrowPriorities.length} priorities seeded for tomorrow.
                </div>
              ) : null}
            </>
          )}
        </>
      ) : (isWeeklyLocked && weeklyReview?.existingReview) ? (
        <>
          <div className="locked-review-banner" role="status">
            <span className="tag tag--positive">Submitted</span>
            <span className="locked-review-banner__text">
              This weekly review was finalized on{" "}
              {new Date(weeklyReview.existingReview.completedAt).toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>

          <div className="two-column-grid stagger">
            <SectionCard
              title="Generated summary"
              subtitle="System-generated overview"
            >
              {"momentumError" in reviewQuery.data && reviewQuery.data.momentumError ? (
                <InlineErrorState
                  message={reviewQuery.data.momentumError.message}
                  onRetry={() => void reviewQuery.refetch()}
                />
              ) : (
                <ul className="list">
                  {summaryItems.map((item) => (
                    <li key={item}>
                      <span>{item}</span>
                      <span className="tag tag--neutral">auto</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard
              title="Submitted weekly reflection"
              subtitle="Read-only · locked after submission"
            >
              <dl className="snapshot-list">
                <div className="snapshot-list__row">
                  <dt>Biggest win</dt>
                  <dd>{weeklyReview.existingReview.biggestWin}</dd>
                </div>
                <div className="snapshot-list__row">
                  <dt>Biggest miss</dt>
                  <dd>{weeklyReview.existingReview.biggestMiss}</dd>
                </div>
                <div className="snapshot-list__row">
                  <dt>Main lesson</dt>
                  <dd>{weeklyReview.existingReview.mainLesson}</dd>
                </div>
                <div className="snapshot-list__row">
                  <dt>Keep doing</dt>
                  <dd>{weeklyReview.existingReview.keepText}</dd>
                </div>
                <div className="snapshot-list__row">
                  <dt>Improve</dt>
                  <dd>{weeklyReview.existingReview.improveText}</dd>
                </div>
                {weeklyReview.existingReview.focusHabitId ? (
                  <div className="snapshot-list__row">
                    <dt>Focus habit</dt>
                    <dd>
                      {habitsQuery.data?.habits.find(
                        (h) => h.id === weeklyReview.existingReview!.focusHabitId,
                      )?.title ?? weeklyReview.existingReview.focusHabitId}
                    </dd>
                  </div>
                ) : null}
                {weeklyReview.existingReview.notes ? (
                  <div className="snapshot-list__row">
                    <dt>Notes</dt>
                    <dd>{weeklyReview.existingReview.notes}</dd>
                  </div>
                ) : null}
              </dl>
            </SectionCard>

            <SectionCard
              title="Seeded next-week priorities"
              subtitle="Planning outputs from this review"
            >
              {seededNextWeekPriorities.length > 0 ? (
                <ol className="priority-list">
                  {[...seededNextWeekPriorities]
                    .sort((left, right) => left.slot - right.slot)
                    .map((priority, index) => (
                      <li key={priority.id} className="priority-list__item">
                        <span>
                          <span className="tag tag--neutral" style={{ marginRight: "0.5rem" }}>
                            P{index + 1}
                          </span>
                          {priority.title}
                        </span>
                        <span className={`tag tag--${priority.status === "completed" ? "positive" : priority.status === "dropped" ? "negative" : "neutral"}`}>
                          {priority.status}
                        </span>
                      </li>
                    ))}
                </ol>
              ) : (
                <EmptyState
                  title="No priorities seeded"
                  description="This review did not produce next-week priorities."
                />
              )}
            </SectionCard>
          </div>
        </>
      ) : (isMonthlyLocked && monthlyReview?.existingReview) ? (
        <>
          <div className="locked-review-banner" role="status">
            <span className="tag tag--positive">Submitted</span>
            <span className="locked-review-banner__text">
              This monthly review was finalized on{" "}
              {new Date(monthlyReview.existingReview.completedAt).toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>

          <div className="two-column-grid stagger">
            <SectionCard
              title="Generated summary"
              subtitle="System-generated overview"
            >
              <ul className="list">
                {summaryItems.map((item) => (
                  <li key={item}>
                    <span>{item}</span>
                    <span className="tag tag--neutral">auto</span>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard
              title="Submitted monthly reflection"
              subtitle="Read-only · locked after submission"
            >
              <dl className="snapshot-list">
                <div className="snapshot-list__row">
                  <dt>Month verdict</dt>
                  <dd>{monthlyReview.existingReview.monthVerdict}</dd>
                </div>
                <div className="snapshot-list__row">
                  <dt>Biggest win</dt>
                  <dd>{monthlyReview.existingReview.biggestWin}</dd>
                </div>
                <div className="snapshot-list__row">
                  <dt>Biggest leak</dt>
                  <dd>{monthlyReview.existingReview.biggestLeak}</dd>
                </div>
                <div className="snapshot-list__row">
                  <dt>Next month theme</dt>
                  <dd>{monthlyReview.existingReview.nextMonthTheme}</dd>
                </div>
                <div className="snapshot-list__row">
                  <dt>Three outcomes</dt>
                  <dd>
                    {monthlyThreeOutcomes.length > 0 ? (
                      <ol className="snapshot-outcomes">
                        {monthlyThreeOutcomes.map((outcome, index) => (
                          <li key={index}>{outcome}</li>
                        ))}
                      </ol>
                    ) : (
                      "None specified"
                    )}
                  </dd>
                </div>
                {monthlyHabitChanges.length > 0 ? (
                  <div className="snapshot-list__row">
                    <dt>Habit changes</dt>
                    <dd>{monthlyHabitChanges.join(", ")}</dd>
                  </div>
                ) : null}
                <div className="snapshot-list__row">
                  <dt>Simplify</dt>
                  <dd>{monthlyReview.existingReview.simplifyText}</dd>
                </div>
                {monthlyReview.existingReview.notes ? (
                  <div className="snapshot-list__row">
                    <dt>Notes</dt>
                    <dd>{monthlyReview.existingReview.notes}</dd>
                  </div>
                ) : null}
              </dl>
            </SectionCard>

            <SectionCard
              title="Seeded next-month planning"
              subtitle="Planning outputs from this review"
            >
              <dl className="snapshot-list">
                <div className="snapshot-list__row">
                  <dt>Next month theme</dt>
                  <dd>{seededNextMonthTheme ?? "No theme set"}</dd>
                </div>
              </dl>
              {seededNextMonthOutcomes.length > 0 ? (
                <ol className="priority-list" style={{ marginTop: "0.5rem" }}>
                  {[...seededNextMonthOutcomes]
                    .sort((left, right) => left.slot - right.slot)
                    .map((outcome, index) => (
                      <li key={outcome.id} className="priority-list__item">
                        <span>
                          <span className="tag tag--neutral" style={{ marginRight: "0.5rem" }}>
                            O{index + 1}
                          </span>
                          {outcome.title}
                        </span>
                        <span className={`tag tag--${outcome.status === "completed" ? "positive" : outcome.status === "dropped" ? "negative" : "neutral"}`}>
                          {outcome.status}
                        </span>
                      </li>
                    ))}
                </ol>
              ) : (
                <EmptyState
                  title="No outcomes seeded"
                  description="This review did not produce next-month outcomes."
                />
              )}
            </SectionCard>
          </div>
        </>
      ) : (
        <>
          <div className="review-progress">
            {("prompts" in config ? config.prompts : []).map((_, index) => (
              <div
                key={index}
                className={`review-progress__step${
                  index < completedCount ? " review-progress__step--complete" : ""
                }${
                  index === (activeStep === -1 ? completedCount - 1 : activeStep)
                    ? " review-progress__step--active"
                    : ""
                }`}
              />
            ))}
          </div>
          <p className="support-copy" style={{ marginTop: "0.75rem" }}>
            {completedCount} of {requiredCount} prompts currently answered.
          </p>

          <div className="two-column-grid stagger">
            <SectionCard
              title="Prefilled summary"
              subtitle="System-generated overview"
            >
              {"momentumError" in reviewQuery.data && reviewQuery.data.momentumError ? (
                <InlineErrorState
                  message={reviewQuery.data.momentumError.message}
                  onRetry={() => void reviewQuery.refetch()}
                />
              ) : (
                <ul className="list">
                  {summaryItems.map((item) => (
                    <li key={item}>
                      <span>{item}</span>
                      <span className="tag tag--neutral">auto</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard
              title="Required prompts"
              subtitle={`${requiredCount} sections to complete`}
            >
              <div className="stack-form">
                {("prompts" in config ? config.prompts : []).map((prompt, index) => (
                  <label key={prompt} className="field">
                    <span>{prompt}</span>
                    <textarea
                      placeholder="Type your response..."
                      rows={2}
                      value={responses[index] ?? ""}
                      onChange={(event) =>
                        setResponses((current) =>
                          current.map((value, currentIndex) =>
                            currentIndex === index ? event.target.value : value,
                          ),
                        )
                      }
                    />
                  </label>
                ))}
              </div>
            </SectionCard>

            {cadenceKey === "weekly" ? (
              <SectionCard
                title="Focus habit for next week"
                subtitle="Choose one habit to commit to — this seeds the weekly challenge"
              >
                {habitsQuery.data ? (() => {
                  const activeHabits = habitsQuery.data.habits.filter((h) => h.status === "active");
                  return activeHabits.length > 0 ? (
                    <div className="focus-habit-field">
                      <select
                        value={focusHabitId ?? ""}
                        onChange={(event) => setFocusHabitId(event.target.value || null)}
                      >
                        <option value="">No focus habit</option>
                        {activeHabits.map((habit) => (
                          <option key={habit.id} value={habit.id}>
                            {habit.title}{habit.category ? ` (${habit.category})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <EmptyState
                      title="No active habits"
                      description="Create an active habit first to set a weekly focus."
                    />
                  );
                })() : (
                  <p className="support-copy">Loading habits…</p>
                )}
              </SectionCard>
            ) : null}
          </div>

          <div className="button-row" style={{ paddingTop: "0.5rem" }}>
            <span className="support-copy">
              {!isWindowOpen
                ? "Submission is currently disabled — the review window is not open."
                : "Draft saving is not live yet, so this form only supports full submit."}
            </span>
            <button
              className="button button--primary"
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isSubmitting || !isWindowOpen}
            >
              {isSubmitting ? "Submitting..." : "Submit review"}
            </button>
          </div>
          {submitError ? (
            <div
              className={`inline-state ${isAlreadySubmittedError(submitError) ? "inline-state--already-submitted" : isOutOfWindowError(submitError) ? "inline-state--out-of-window" : "inline-state--error"}`}
              style={{ marginTop: "0.75rem" }}
            >
              {formatSubmitError(submitError)}
            </div>
          ) : null}
          {submitResult ? (
            <div className="inline-state inline-state--success" style={{ marginTop: "0.75rem" }}>
              {"score" in submitResult
                ? `Daily review closed. ${submitResult.tomorrowPriorities.length} priorities seeded for tomorrow.`
                : "nextWeekPriorities" in submitResult
                  ? `Weekly review saved. ${submitResult.nextWeekPriorities.length} priorities seeded for next week.`
                  : `Monthly review saved. ${submitResult.nextMonthOutcomes.length} outcomes seeded for next month.`}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
