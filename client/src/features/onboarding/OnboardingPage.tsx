import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getMonthStartDate,
  getTodayDate,
  getWeekStartDate,
  splitEntries,
  useCompleteOnboardingMutation,
  useOnboardingStateQuery,
  useSessionQuery,
} from "../../shared/lib/api";
import { SectionCard } from "../../shared/ui/SectionCard";

const onboardingSteps = [
  {
    title: "Life priorities",
    summary: "Capture the areas that should influence the dashboard first.",
    items: ["Health", "Work growth", "Money", "Home admin"],
  },
  {
    title: "Top goals",
    summary: "Seed the first meaningful outcomes.",
    items: ["1 monthly theme", "3 outcomes", "1 focus habit"],
  },
  {
    title: "Routines and habits",
    summary: "Build the minimum default structure.",
    items: ["Morning routine", "Evening routine", "3 daily habits"],
  },
  {
    title: "Health defaults",
    summary: "Set water and workout expectations.",
    items: ["Water target", "Meal logging mode", "Workout cadence"],
  },
  {
    title: "Expense categories",
    summary: "Create enough visibility to start tracking immediately.",
    items: ["Food", "Rent", "Utilities", "Subscriptions"],
  },
  {
    title: "Review preferences",
    summary: "Choose the reflection windows.",
    items: ["Daily review time", "Week start", "Monthly review window"],
  },
] as const;

export function OnboardingPage() {
  const navigate = useNavigate();
  const today = getTodayDate();
  const sessionQuery = useSessionQuery();
  const onboardingQuery = useOnboardingStateQuery(true);
  const completeOnboardingMutation = useCompleteOnboardingMutation();
  const [activeStep, setActiveStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const step = onboardingSteps[activeStep];
  const defaults = onboardingQuery.data?.defaults;
  const timezone =
    defaults?.timezone ??
    Intl.DateTimeFormat().resolvedOptions().timeZone ??
    "UTC";

  function keyFor(stepTitle: string, item: string) {
    return `${stepTitle}:${item}`;
  }

  function valueFor(stepTitle: string, item: string) {
    return values[keyFor(stepTitle, item)] ?? "";
  }

  function setValue(stepTitle: string, item: string, value: string) {
    setValues((current) => ({
      ...current,
      [keyFor(stepTitle, item)]: value,
    }));
  }

  function parseWaterTarget(value: string) {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return defaults?.dailyWaterTargetMl ?? 3500;
    }

    const numeric = Number.parseFloat(normalized.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(numeric)) {
      return defaults?.dailyWaterTargetMl ?? 3500;
    }

    return normalized.includes("l") ? Math.round(numeric * 1000) : Math.round(numeric);
  }

  async function handleComplete() {
    const lifePriorities = onboardingSteps[0].items
      .map((item) => valueFor(onboardingSteps[0].title, item).trim() || item)
      .filter(Boolean);

    const goalTitles = onboardingSteps[1].items.flatMap((item) =>
      splitEntries(valueFor(onboardingSteps[1].title, item)),
    );

    const goals = (goalTitles.length ? goalTitles : ["Build the first working Life OS loop"]).map(
      (title) => ({
        title,
        domain: "other" as const,
      }),
    );

    const routineTemplates = defaults?.routineTemplates ?? [];
    const morningItems = splitEntries(valueFor(onboardingSteps[2].title, "Morning routine"));
    const eveningItems = splitEntries(valueFor(onboardingSteps[2].title, "Evening routine"));
    const habitItems = splitEntries(valueFor(onboardingSteps[2].title, "3 daily habits"));

    const routines = [
      {
        name: "Morning routine",
        period: "morning" as const,
        items: (morningItems.length
          ? morningItems
          : routineTemplates.find((template) => template.period === "morning")?.items ?? [
              "Wake on time",
              "Review priorities",
            ]).map((title) => ({ title })),
      },
      {
        name: "Evening routine",
        period: "evening" as const,
        items: (eveningItems.length
          ? eveningItems
          : routineTemplates.find((template) => template.period === "evening")?.items ?? [
              "Close the day",
              "Prepare tomorrow",
            ]).map((title) => ({ title })),
      },
    ];

    const habits = (habitItems.length
      ? habitItems
      : defaults?.habitSuggestions?.slice(0, 3) ?? [
          "Morning sunlight",
          "Review priorities",
          "Close the day",
        ]).map((title) => ({
      title,
      targetPerDay: 1,
    }));

    const expenseCategories = onboardingSteps[4].items
      .map((item) => valueFor(onboardingSteps[4].title, item).trim() || item)
      .filter(Boolean)
      .map((name) => ({ name }));

    const reviewTime = valueFor(onboardingSteps[5].title, "Daily review time").trim();

    await completeOnboardingMutation.mutateAsync({
      displayName: sessionQuery.data?.user?.displayName ?? "Owner",
      timezone,
      currencyCode: defaults?.currencyCode ?? "USD",
      weekStartsOn: defaults?.weekStartsOn ?? 1,
      dailyWaterTargetMl: parseWaterTarget(
        valueFor(onboardingSteps[3].title, "Water target"),
      ),
      dailyReviewStartTime: reviewTime || defaults?.dailyReviewStartTime ?? "20:30",
      dailyReviewEndTime: defaults?.dailyReviewEndTime ?? null,
      lifePriorities,
      goals,
      habits,
      routines,
      expenseCategories,
      mealTemplates:
        defaults?.mealTemplateSuggestions?.map((meal) => ({
          name: meal.name,
          mealSlot: meal.mealSlot,
          description: meal.name,
        })) ?? [],
      firstWeekStartDate: getWeekStartDate(today),
      firstMonthStartDate: getMonthStartDate(today),
    });

    navigate("/", { replace: true });
  }

  return (
    <div className="auth-layout" style={{ alignItems: "start", paddingTop: "3rem" }}>
      <div style={{ width: "min(100%, 44rem)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <span
            style={{
              display: "inline-flex",
              width: "2.4rem",
              height: "2.4rem",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "var(--r-sm)",
              background: "linear-gradient(135deg, rgba(217,153,58,0.2), rgba(217,153,58,0.06))",
              border: "1px solid rgba(217,153,58,0.25)",
              color: "var(--accent-bright)",
              fontFamily: "var(--font-display)",
              fontSize: "1.1rem",
              fontWeight: 600,
            }}
          >
            L
          </span>
          <div>
            <span className="page-eyebrow">First-run setup</span>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 500, marginTop: "0.15rem" }}>
              Create your Life OS
            </div>
          </div>
        </div>

        <div className="onboarding-stepper">
          {onboardingSteps.map((currentStep, index) => (
            <button
              key={currentStep.title}
              className={`onboarding-stepper__step${index < activeStep ? " onboarding-stepper__step--complete" : index === activeStep ? " onboarding-stepper__step--active" : ""}`}
              onClick={() => setActiveStep(index)}
              aria-label={`Step ${index + 1}: ${currentStep.title}`}
              type="button"
            />
          ))}
        </div>

        <SectionCard
          title={`${activeStep + 1}. ${step.title}`}
          subtitle={step.summary}
        >
          <div className="stack-form" style={{ paddingTop: "0.5rem" }}>
            {step.items.map((item) => (
              <label key={item} className="field">
                <span>{item}</span>
                <input
                  placeholder={`Enter ${item.toLowerCase()}...`}
                  type="text"
                  value={valueFor(step.title, item)}
                  onChange={(event) => setValue(step.title, item, event.target.value)}
                />
              </label>
            ))}
          </div>
        </SectionCard>

        {completeOnboardingMutation.error ? (
          <p className="list__subtle" style={{ color: "var(--danger, #e88f8f)", marginTop: "0.75rem" }}>
            {completeOnboardingMutation.error instanceof Error
              ? completeOnboardingMutation.error.message
              : "Unable to complete onboarding."}
          </p>
        ) : null}

        <div className="button-row" style={{ marginTop: "1rem", justifyContent: "space-between" }}>
          <button
            className="button button--ghost"
            type="button"
            disabled={activeStep === 0}
            onClick={() => setActiveStep((currentStep) => Math.max(0, currentStep - 1))}
          >
            Back
          </button>
          <div className="button-row">
            <span className="list__subtle" style={{ alignSelf: "center" }}>
              Step {activeStep + 1} of {onboardingSteps.length}
            </span>
            {activeStep < onboardingSteps.length - 1 ? (
              <button
                className="button button--primary"
                type="button"
                onClick={() => setActiveStep((currentStep) => Math.min(onboardingSteps.length - 1, currentStep + 1))}
              >
                Next
              </button>
            ) : (
              <button
                className="button button--primary"
                type="button"
                onClick={() => void handleComplete()}
                disabled={completeOnboardingMutation.isPending}
              >
                {completeOnboardingMutation.isPending ? "Completing..." : "Complete setup"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
