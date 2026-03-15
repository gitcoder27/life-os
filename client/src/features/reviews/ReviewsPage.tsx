import { useEffect, useMemo, useState } from "react";
import { NavLink, useParams } from "react-router-dom";

import {
  type DailyFrictionTag,
  getTodayDate,
  splitEntries,
  toPriorityInputs,
  useReviewDataQuery,
  useSubmitDailyReviewMutation,
  useSubmitMonthlyReviewMutation,
  useSubmitWeeklyReviewMutation,
} from "../../shared/lib/api";
import { PageHeader } from "../../shared/ui/PageHeader";
import { SectionCard } from "../../shared/ui/SectionCard";

const reviewCadences = {
  daily: {
    label: "Daily",
    title: "Close the day and seed tomorrow",
    description:
      "The daily review should stay short, practical, and tied to carry-forward decisions.",
    prompts: [
      "What went well today?",
      "What created the most friction?",
      "How was your energy?",
      "What moves to tomorrow?",
      "What are tomorrow's top 3?",
    ],
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

export function ReviewsPage() {
  const { cadence = "daily" } = useParams();
  const today = getTodayDate();
  const cadenceKey =
    cadence === "daily" || cadence === "weekly" || cadence === "monthly"
      ? cadence
      : "daily";
  const config = reviewCadences[cadenceKey];
  const reviewQuery = useReviewDataQuery(cadenceKey, today);
  const submitDailyReviewMutation = useSubmitDailyReviewMutation(today);
  const submitWeeklyReviewMutation = useSubmitWeeklyReviewMutation(today);
  const submitMonthlyReviewMutation = useSubmitMonthlyReviewMutation(today);
  const [responses, setResponses] = useState<string[]>(
    config.prompts.map(() => ""),
  );

  const requiredCount = config.prompts.length;
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
      const existing = reviewQuery.data.review.existingReview;
      setResponses([
        existing?.biggestWin ?? "",
        existing?.frictionNote ?? "",
        existing?.energyRating ? String(existing.energyRating) : "",
        existing?.optionalNote ?? "",
        "",
      ]);
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
      const fallbackPriorities = reviewQuery.data.review.incompleteTasks
        .slice(0, 3)
        .map((task) => task.title);
      await submitDailyReviewMutation.mutateAsync({
        biggestWin: responses[0] || "Closed the loop",
        frictionTag: detectFrictionTag(responses[1]),
        frictionNote: responses[1] || null,
        energyRating: parseEnergyRating(responses[2]),
        optionalNote: responses[3] || null,
        carryForwardTaskIds: [],
        droppedTaskIds: [],
        rescheduledTasks: [],
        tomorrowPriorities: toPriorityInputs(
          splitEntries(responses[4]).length ? splitEntries(responses[4]) : fallbackPriorities,
        ),
      });
      return;
    }

    if (reviewQuery.data.cadence === "weekly") {
      const nextWeekPriorities = toPriorityInputs(
        splitEntries(responses[4]).length
          ? splitEntries(responses[4])
          : [responses[3] || "Protect momentum"],
      );
      await submitWeeklyReviewMutation.mutateAsync({
        biggestWin: responses[0] || "Kept momentum",
        biggestMiss: responses[1] || "Missed a key follow-through",
        mainLesson: responses[2] || "Keep the system simple",
        keepText: responses[3] || "Protect the existing routine",
        improveText: responses[4] || "Clarify next week's priorities",
        nextWeekPriorities,
        notes: responses.join("\n\n"),
      });
      return;
    }

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

      <div className="review-progress">
        {config.prompts.map((_, index) => (
          <div
            key={index}
            className={`review-progress__step${index < 0 ? " review-progress__step--complete" : index === 0 ? " review-progress__step--active" : ""}`}
          />
        ))}
      </div>

      <div className="two-column-grid stagger">
        <SectionCard
          title="Prefilled summary"
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
          title="Required prompts"
          subtitle={`${requiredCount} sections to complete`}
        >
          <div className="stack-form">
            {config.prompts.map((prompt, index) => (
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
      </div>

      <div className="button-row" style={{ paddingTop: "0.5rem" }}>
        <button className="button button--ghost" type="button">Save draft</button>
        <button className="button button--primary" type="button" onClick={() => void handleSubmit()}>
          Submit review
        </button>
      </div>
    </div>
  );
}
