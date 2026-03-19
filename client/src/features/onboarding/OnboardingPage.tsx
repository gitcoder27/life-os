import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

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
    title: "Owner profile",
    summary: "Set the identity and baseline settings this workspace will use.",
  },
  {
    title: "Life priorities",
    summary: "Choose the areas this dashboard should optimize around first.",
  },
  {
    title: "Top goals",
    summary: "Define the first three outcomes you want this system to track.",
  },
  {
    title: "Routines and habits",
    summary: "Create the minimum recurring structure for your day.",
  },
  {
    title: "Tracking defaults",
    summary: "Set the defaults for water and expense tracking.",
  },
  {
    title: "Review rhythm",
    summary: "Choose when your review loop should reset and check in.",
  },
] as const;

type OnboardingValues = {
  displayName: string;
  lifePriorities: string;
  monthlyTheme: string;
  secondGoal: string;
  thirdGoal: string;
  morningRoutine: string;
  eveningRoutine: string;
  habits: string;
  waterTargetMl: string;
  expenseCategories: string;
  dailyReviewTime: string;
  weekStartsOn: string;
};

function normalizeTimeInput(value: string) {
  const trimmed = value.trim().toLowerCase();

  if (!trimmed) {
    return "";
  }

  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);

  if (!match) {
    return value;
  }

  const hour = Number.parseInt(match[1] ?? "0", 10);
  const minute = Number.parseInt(match[2] ?? "0", 10);

  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 1 || hour > 12 || minute < 0 || minute > 59) {
    return value;
  }

  const normalizedHour =
    match[3] === "pm"
      ? hour === 12
        ? 12
        : hour + 12
      : hour === 12
        ? 0
        : hour;

  return `${String(normalizedHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function readFieldErrors(error: unknown) {
  if (!error || typeof error !== "object" || !("fieldErrors" in error)) {
    return [];
  }

  const fieldErrors = (error as { fieldErrors?: unknown }).fieldErrors;

  if (!Array.isArray(fieldErrors)) {
    return [];
  }

  return fieldErrors
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const field = "field" in entry && typeof entry.field === "string" ? entry.field : "field";
      const message = "message" in entry && typeof entry.message === "string" ? entry.message : "Invalid value";
      return `${field}: ${message}`;
    })
    .filter((entry): entry is string => Boolean(entry));
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const today = getTodayDate();
  const sessionQuery = useSessionQuery();
  const onboardingQuery = useOnboardingStateQuery(true);
  const completeOnboardingMutation = useCompleteOnboardingMutation();
  const [activeStep, setActiveStep] = useState(0);
  const [values, setValues] = useState<OnboardingValues>({
    displayName: "",
    lifePriorities: "",
    monthlyTheme: "",
    secondGoal: "",
    thirdGoal: "",
    morningRoutine: "",
    eveningRoutine: "",
    habits: "",
    waterTargetMl: "",
    expenseCategories: "",
    dailyReviewTime: "",
    weekStartsOn: "",
  });
  const step = onboardingSteps[activeStep];
  const defaults = onboardingQuery.data?.defaults;
  const timezone = defaults?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  const mutationFieldErrors = readFieldErrors(completeOnboardingMutation.error);

  function setValue<Key extends keyof OnboardingValues>(key: Key, value: OnboardingValues[Key]) {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function parseWaterTarget(value: string) {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return defaults?.dailyWaterTargetMl ?? 2500;
    }

    const numeric = Number.parseFloat(normalized.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(numeric)) {
      return defaults?.dailyWaterTargetMl ?? 2500;
    }

    if (normalized.includes(" l") || normalized.endsWith("l")) {
      return Math.round(numeric * 1000);
    }

    return Math.round(numeric);
  }

  async function handleComplete() {
    const lifePriorities = splitEntries(values.lifePriorities).slice(0, 5);
    const goalTitles = [values.monthlyTheme, values.secondGoal, values.thirdGoal]
      .map((value) => value.trim())
      .filter(Boolean);

    const goals = (goalTitles.length ? goalTitles : ["Build the first working Life OS loop"]).map((title) => ({
      title,
      domain: "other" as const,
    }));

    const routineTemplates = defaults?.routineTemplates ?? [];
    const morningItems = splitEntries(values.morningRoutine);
    const eveningItems = splitEntries(values.eveningRoutine);
    const habitItems = splitEntries(values.habits);

    const routines = [
      {
        name: "Morning routine",
        period: "morning" as const,
        items: (morningItems.length
          ? morningItems
          : routineTemplates.find((template) => template.period === "morning")?.items ?? [
              "Review priorities",
              "Drink water",
            ]).map((title) => ({ title })),
      },
      {
        name: "Evening routine",
        period: "evening" as const,
        items: (eveningItems.length
          ? eveningItems
          : routineTemplates.find((template) => template.period === "evening")?.items ?? [
              "Daily review",
              "Prepare tomorrow",
            ]).map((title) => ({ title })),
      },
    ];

    const habits = (habitItems.length
      ? habitItems
      : defaults?.habitSuggestions?.slice(0, 3) ?? ["Morning planning", "Workout", "Hydration"]).map((title) => ({
      title,
      targetPerDay: 1,
    }));

    const expenseCategories = (
      splitEntries(values.expenseCategories).length
        ? splitEntries(values.expenseCategories)
        : defaults?.expenseCategorySuggestions?.slice(0, 6) ?? ["Groceries", "Dining", "Transport", "Utilities"]
    ).map((name) => ({ name }));

    const reviewTime = normalizeTimeInput(values.dailyReviewTime);
    const parsedWeekStartsOn = Number.parseInt(values.weekStartsOn || String(defaults?.weekStartsOn ?? 1), 10);

    await completeOnboardingMutation.mutateAsync({
      displayName: values.displayName.trim() || sessionQuery.data?.user?.displayName || "Owner",
      timezone,
      currencyCode: defaults?.currencyCode ?? "USD",
      weekStartsOn: Number.isFinite(parsedWeekStartsOn) ? parsedWeekStartsOn : (defaults?.weekStartsOn ?? 1),
      dailyWaterTargetMl: parseWaterTarget(values.waterTargetMl),
      dailyReviewStartTime: (reviewTime || defaults?.dailyReviewStartTime) ?? "20:00",
      dailyReviewEndTime: defaults?.dailyReviewEndTime ?? null,
      lifePriorities: lifePriorities.length ? lifePriorities : ["Health", "Work growth", "Money"],
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
      <div style={{ width: "min(100%, 48rem)" }}>
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
            <span className="page-eyebrow">Optional setup</span>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 500, marginTop: "0.15rem" }}>
              Starter setup
            </div>
          </div>
        </div>

        <div
          style={{
            marginBottom: "1rem",
            padding: "0.9rem 1rem",
            borderRadius: "var(--r-md)",
            border: "1px solid var(--line, rgba(255,255,255,0.08))",
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <div className="page-eyebrow" style={{ marginBottom: "0.4rem" }}>How this works</div>
          <div style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
            This optional wizard sets up your habits, routines, goals, and tracking defaults in one pass.
            You can skip this entirely — everything here can be configured later from Settings and the Habits page.
            If you leave routines, habits, or categories blank, the app will create sensible starter defaults.
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

        <SectionCard title={`${activeStep + 1}. ${step.title}`} subtitle={step.summary}>
          {activeStep === 0 ? (
            <div className="stack-form" style={{ paddingTop: "0.5rem" }}>
              <label className="field">
                <span>Display name</span>
                <input
                  placeholder="Owner"
                  type="text"
                  value={values.displayName}
                  onChange={(event) => setValue("displayName", event.target.value)}
                />
              </label>
              <div
                style={{
                  padding: "0.95rem 1rem",
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--line, rgba(255,255,255,0.08))",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div className="page-eyebrow" style={{ marginBottom: "0.4rem" }}>Detected defaults</div>
                <div style={{ display: "grid", gap: "0.35rem", color: "var(--text-secondary)" }}>
                  <div><strong style={{ color: "var(--text-primary)" }}>Timezone:</strong> {timezone}</div>
                  <div><strong style={{ color: "var(--text-primary)" }}>Currency:</strong> {defaults?.currencyCode ?? "USD"}</div>
                  <div><strong style={{ color: "var(--text-primary)" }}>Today:</strong> {today}</div>
                </div>
              </div>
            </div>
          ) : null}

          {activeStep === 1 ? (
            <div className="stack-form" style={{ paddingTop: "0.5rem" }}>
              <label className="field">
                <span>Life priorities</span>
                <textarea
                  placeholder={"Health\nWork growth\nMoney"}
                  rows={6}
                  value={values.lifePriorities}
                  onChange={(event) => setValue("lifePriorities", event.target.value)}
                />
              </label>
              <p className="list__subtle">Enter 3 to 5 priorities, one per line. Example: `Health`, `Money`, `Family`, `Work growth`.</p>
            </div>
          ) : null}

          {activeStep === 2 ? (
            <div className="stack-form" style={{ paddingTop: "0.5rem" }}>
              <label className="field">
                <span>Primary goal</span>
                <input
                  placeholder="Build a stable weekly operating rhythm"
                  type="text"
                  value={values.monthlyTheme}
                  onChange={(event) => setValue("monthlyTheme", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Second goal</span>
                <input
                  placeholder="Log all major expenses this month"
                  type="text"
                  value={values.secondGoal}
                  onChange={(event) => setValue("secondGoal", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Third goal</span>
                <input
                  placeholder="Complete morning routine 5 days a week"
                  type="text"
                  value={values.thirdGoal}
                  onChange={(event) => setValue("thirdGoal", event.target.value)}
                />
              </label>
            </div>
          ) : null}

          {activeStep === 3 ? (
            <div className="stack-form" style={{ paddingTop: "0.5rem" }}>
              <label className="field">
                <span>Morning routine</span>
                <textarea
                  placeholder={"Drink water\nReview priorities\nCheck calendar"}
                  rows={5}
                  value={values.morningRoutine}
                  onChange={(event) => setValue("morningRoutine", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Evening routine</span>
                <textarea
                  placeholder={"Daily review\nPrep tomorrow\nTidy desk"}
                  rows={5}
                  value={values.eveningRoutine}
                  onChange={(event) => setValue("eveningRoutine", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Daily habits</span>
                <textarea
                  placeholder={"Workout\nHydration\nEvening reset"}
                  rows={4}
                  value={values.habits}
                  onChange={(event) => setValue("habits", event.target.value)}
                />
              </label>
              <p className="list__subtle">Use one item per line. If you leave this blank, starter defaults will be created automatically.</p>
            </div>
          ) : null}

          {activeStep === 4 ? (
            <div className="stack-form" style={{ paddingTop: "0.5rem" }}>
              <label className="field">
                <span>Daily water target</span>
                <input
                  placeholder="2500"
                  type="number"
                  min="250"
                  step="50"
                  value={values.waterTargetMl}
                  onChange={(event) => setValue("waterTargetMl", event.target.value)}
                />
              </label>
              <p className="list__subtle">Enter milliliters. Example: `2500` means 2.5 liters.</p>
              <label className="field">
                <span>Expense categories</span>
                <textarea
                  placeholder={"Groceries\nDining\nTransport\nUtilities"}
                  rows={6}
                  value={values.expenseCategories}
                  onChange={(event) => setValue("expenseCategories", event.target.value)}
                />
              </label>
              <p className="list__subtle">One category per line. Leave blank to use the starter category set.</p>
            </div>
          ) : null}

          {activeStep === 5 ? (
            <div className="stack-form" style={{ paddingTop: "0.5rem" }}>
              <label className="field">
                <span>Daily review time</span>
                <input
                  type="time"
                  value={values.dailyReviewTime || defaults?.dailyReviewStartTime || "20:00"}
                  onChange={(event) => setValue("dailyReviewTime", event.target.value)}
                />
              </label>
              <p className="list__subtle">Use 24-hour time. Example: `20:00` for 8:00 PM.</p>
              <label className="field">
                <span>Week starts on</span>
                <select
                  value={values.weekStartsOn || String(defaults?.weekStartsOn ?? 1)}
                  onChange={(event) => setValue("weekStartsOn", event.target.value)}
                >
                  <option value="0">Sunday</option>
                  <option value="1">Monday</option>
                  <option value="2">Tuesday</option>
                  <option value="3">Wednesday</option>
                  <option value="4">Thursday</option>
                  <option value="5">Friday</option>
                  <option value="6">Saturday</option>
                </select>
              </label>
            </div>
          ) : null}
        </SectionCard>

        {completeOnboardingMutation.error ? (
          <div
            style={{
              marginTop: "0.75rem",
              padding: "0.9rem 1rem",
              borderRadius: "var(--r-md)",
              border: "1px solid rgba(232,143,143,0.35)",
              background: "rgba(128,32,32,0.12)",
            }}
          >
            <p className="list__subtle" style={{ color: "var(--danger, #e88f8f)", marginBottom: mutationFieldErrors.length ? "0.5rem" : 0 }}>
              {completeOnboardingMutation.error instanceof Error
                ? completeOnboardingMutation.error.message
                : "Unable to complete onboarding."}
            </p>
            {mutationFieldErrors.length ? (
              <ul className="list__subtle" style={{ margin: 0, paddingLeft: "1.1rem", color: "var(--danger, #e88f8f)" }}>
                {mutationFieldErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="button-row" style={{ marginTop: "1rem", justifyContent: "space-between" }}>
          <div className="button-row">
            <button
              className="button button--ghost"
              type="button"
              disabled={activeStep === 0}
              onClick={() => setActiveStep((currentStep) => Math.max(0, currentStep - 1))}
            >
              Back
            </button>
            <Link
              className="button button--ghost"
              to="/"
              style={{ color: "var(--text-tertiary)" }}
            >
              Skip, go to app
            </Link>
          </div>
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
