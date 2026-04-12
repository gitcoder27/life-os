import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  getMonthStartDate,
  getTodayDate,
  getWeekStartDate,
  useCompleteOnboardingMutation,
  useGoalsConfigQuery,
  useOnboardingStateQuery,
  useSessionQuery,
  type GoalDomainItem,
  type GoalDomainSystemKey,
} from "../../shared/lib/api";
import {
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";
import { SectionCard } from "../../shared/ui/SectionCard";
import {
  RoutineItemEditor,
  createEmptyItem,
  type RoutineItemEntry,
} from "../habits/RoutineItemEditor";

const onboardingSteps = [
  {
    title: "Basics",
    summary: "Keep the first-run setup light. Confirm the defaults and adjust only the pieces that matter now.",
  },
  {
    title: "First focus",
    summary: "Capture the few areas and starter goals you want Life OS to steer toward first.",
  },
  {
    title: "Daily rhythm",
    summary: "Seed the routines and habits that make the rest of the workspace useful immediately.",
  },
  {
    title: "Finish",
    summary: "Review the setup summary before creating your starter workspace.",
  },
] as const;

const fallbackGoalDomains: Array<{
  key: GoalDomainSystemKey;
  label: string;
}> = [
  { key: "health", label: "Health" },
  { key: "money", label: "Money" },
  { key: "work_growth", label: "Work & Growth" },
  { key: "home_admin", label: "Home & Admin" },
  { key: "discipline", label: "Discipline" },
  { key: "other", label: "Other" },
];

const weekDayOptions = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

type TextListEntry = {
  key: string;
  value: string;
};

type GoalDraft = {
  key: string;
  title: string;
  domain: GoalDomainSystemKey;
};

type OnboardingValues = {
  displayName: string;
  weekStartsOn: string;
  dailyReviewTime: string;
  dailyWaterTargetMl: string;
  focusAreas: TextListEntry[];
  goals: GoalDraft[];
  morningRoutine: RoutineItemEntry[];
  eveningRoutine: RoutineItemEntry[];
  habits: TextListEntry[];
};

let nextOnboardingKey = 1;

function makeOnboardingKey() {
  const key = `onboarding-${nextOnboardingKey}`;
  nextOnboardingKey += 1;
  return key;
}

function createTextListEntry(value = ""): TextListEntry {
  return {
    key: makeOnboardingKey(),
    value,
  };
}

function createGoalDraft(
  defaultDomain: GoalDomainSystemKey,
  title = "",
): GoalDraft {
  return {
    key: makeOnboardingKey(),
    title,
    domain: defaultDomain,
  };
}

function buildRoutineEntries(items: string[]) {
  if (items.length === 0) {
    return [createEmptyItem()];
  }

  return items.map((title) => ({
    ...createEmptyItem(),
    title,
  }));
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

function parseWaterTarget(value: string, fallback: number) {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return fallback;
  }

  const numeric = Number.parseFloat(normalized.replace(/[^0-9.]/g, ""));

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  if (normalized.includes(" l") || normalized.endsWith("l")) {
    return Math.round(numeric * 1000);
  }

  return Math.round(numeric);
}

function sanitizeTextEntries(entries: TextListEntry[]) {
  return entries
    .map((entry) => entry.value.trim())
    .filter(Boolean);
}

function sanitizeRoutine(
  name: string,
  period: "morning" | "evening",
  items: RoutineItemEntry[],
) {
  const sanitizedItems = items
    .map((item) => ({
      title: item.title.trim(),
      isRequired: item.isRequired,
    }))
    .filter((item) => item.title);

  if (sanitizedItems.length === 0) {
    return null;
  }

  return {
    name,
    period,
    items: sanitizedItems,
  };
}

function buildGoalDomainOptions(domains?: GoalDomainItem[]) {
  const configuredDomains = (domains ?? [])
    .filter((domain) => !domain.isArchived && domain.systemKey)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((domain) => ({
      key: domain.systemKey as GoalDomainSystemKey,
      label: domain.name,
    }));

  return configuredDomains.length > 0 ? configuredDomains : fallbackGoalDomains;
}

function TextListEditor({
  entries,
  label,
  hint,
  emptyPlaceholder,
  addLabel,
  suggestions,
  onChange,
}: {
  entries: TextListEntry[];
  label: string;
  hint?: string;
  emptyPlaceholder: string;
  addLabel: string;
  suggestions?: string[];
  onChange: (entries: TextListEntry[]) => void;
}) {
  function updateEntry(key: string, value: string) {
    onChange(
      entries.map((entry) => entry.key === key ? { ...entry, value } : entry),
    );
  }

  function removeEntry(key: string) {
    if (entries.length === 1) {
      onChange([{ ...entries[0], value: "" }]);
      return;
    }

    onChange(entries.filter((entry) => entry.key !== key));
  }

  function addEntry(initialValue = "") {
    onChange([...entries, createTextListEntry(initialValue)]);
  }

  return (
    <div className="onboarding-list-editor">
      <div className="onboarding-list-editor__header">
        <span className="onboarding-list-editor__label">{label}</span>
        {hint ? (
          <span className="onboarding-list-editor__hint">{hint}</span>
        ) : null}
      </div>

      {suggestions && suggestions.length > 0 ? (
        <div className="onboarding-suggestions">
          {suggestions.map((suggestion) => {
            const exists = entries.some(
              (entry) => entry.value.trim().toLowerCase() === suggestion.toLowerCase(),
            );

            return (
              <button
                key={suggestion}
                className={`onboarding-suggestions__chip${exists ? " onboarding-suggestions__chip--active" : ""}`}
                type="button"
                onClick={() => {
                  if (!exists) {
                    addEntry(suggestion);
                  }
                }}
                disabled={exists}
              >
                {suggestion}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="onboarding-list-editor__rows">
        {entries.map((entry, index) => (
          <div key={entry.key} className="onboarding-list-row">
            <span className="onboarding-list-row__index">{index + 1}</span>
            <input
              className="onboarding-list-row__input"
              type="text"
              value={entry.value}
              placeholder={index === 0 ? emptyPlaceholder : "Add another"}
              onChange={(event) => updateEntry(entry.key, event.target.value)}
              maxLength={200}
            />
            <button
              className="onboarding-list-row__remove"
              type="button"
              onClick={() => removeEntry(entry.key)}
              aria-label={`Remove ${label.toLowerCase()} item ${index + 1}`}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <button
        className="onboarding-list-editor__add"
        type="button"
        onClick={() => addEntry()}
      >
        + {addLabel}
      </button>
    </div>
  );
}

function GoalListEditor({
  goals,
  domainOptions,
  onChange,
}: {
  goals: GoalDraft[];
  domainOptions: Array<{ key: GoalDomainSystemKey; label: string }>;
  onChange: (goals: GoalDraft[]) => void;
}) {
  function updateGoal(key: string, patch: Partial<GoalDraft>) {
    onChange(
      goals.map((goal) => goal.key === key ? { ...goal, ...patch } : goal),
    );
  }

  function removeGoal(key: string) {
    if (goals.length === 1) {
      onChange([{ ...goals[0], title: "" }]);
      return;
    }

    onChange(goals.filter((goal) => goal.key !== key));
  }

  function addGoal() {
    if (goals.length >= 3) {
      return;
    }

    onChange([
      ...goals,
      createGoalDraft(domainOptions[0]?.key ?? "other"),
    ]);
  }

  return (
    <div className="onboarding-list-editor">
      <div className="onboarding-list-editor__header">
        <span className="onboarding-list-editor__label">Starter goals</span>
        <span className="onboarding-list-editor__hint">Add up to 3 goals</span>
      </div>

      <div className="onboarding-goal-editor">
        {goals.map((goal, index) => (
          <div key={goal.key} className="onboarding-goal-row">
            <span className="onboarding-list-row__index">{index + 1}</span>
            <input
              className="onboarding-goal-row__title"
              type="text"
              value={goal.title}
              placeholder={index === 0 ? "Build a weekly operating rhythm" : "Another starter goal"}
              onChange={(event) => updateGoal(goal.key, { title: event.target.value })}
              maxLength={200}
            />
            <select
              className="onboarding-goal-row__domain"
              value={goal.domain}
              onChange={(event) =>
                updateGoal(goal.key, { domain: event.target.value as GoalDomainSystemKey })
              }
            >
              {domainOptions.map((domain) => (
                <option key={domain.key} value={domain.key}>
                  {domain.label}
                </option>
              ))}
            </select>
            <button
              className="onboarding-list-row__remove"
              type="button"
              onClick={() => removeGoal(goal.key)}
              aria-label={`Remove goal ${index + 1}`}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <button
        className="onboarding-list-editor__add"
        type="button"
        onClick={addGoal}
        disabled={goals.length >= 3}
      >
        + Add goal
      </button>
    </div>
  );
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const today = getTodayDate();
  const sessionQuery = useSessionQuery();
  const onboardingQuery = useOnboardingStateQuery(true);
  const goalsConfigQuery = useGoalsConfigQuery();
  const completeOnboardingMutation = useCompleteOnboardingMutation();
  const [activeStep, setActiveStep] = useState(0);
  const [hasSeededDefaults, setHasSeededDefaults] = useState(false);
  const [values, setValues] = useState<OnboardingValues>({
    displayName: "",
    weekStartsOn: "1",
    dailyReviewTime: "20:00",
    dailyWaterTargetMl: "2500",
    focusAreas: [createTextListEntry("")],
    goals: [createGoalDraft("other")],
    morningRoutine: [createEmptyItem()],
    eveningRoutine: [createEmptyItem()],
    habits: [createTextListEntry("")],
  });

  const defaults = onboardingQuery.data?.defaults;
  const mutationFieldErrors = readFieldErrors(completeOnboardingMutation.error);
  const goalDomainOptions = useMemo(
    () => buildGoalDomainOptions(goalsConfigQuery.data?.domains),
    [goalsConfigQuery.data?.domains],
  );
  const focusAreaSuggestions = goalDomainOptions
    .slice(0, 4)
    .map((domain) => domain.label);

  useEffect(() => {
    if (!defaults || hasSeededDefaults) {
      return;
    }

    const morningDefaults =
      defaults.routineTemplates.find((template) => template.period === "morning")?.items ?? [
        "Review top 3 priorities",
        "Drink water",
        "Check calendar",
      ];
    const eveningDefaults =
      defaults.routineTemplates.find((template) => template.period === "evening")?.items ?? [
        "Daily review",
        "Prep tomorrow",
        "Tidy key space",
      ];
    const habitDefaults =
      defaults.habitSuggestions.slice(0, 3);

    setValues({
      displayName: sessionQuery.data?.user?.displayName ?? "",
      weekStartsOn: String(defaults.weekStartsOn ?? 1),
      dailyReviewTime: defaults.dailyReviewStartTime ?? "20:00",
      dailyWaterTargetMl: String(defaults.dailyWaterTargetMl ?? 2500),
      focusAreas: [createTextListEntry("")],
      goals: [createGoalDraft(goalDomainOptions[0]?.key ?? "other")],
      morningRoutine: buildRoutineEntries(morningDefaults),
      eveningRoutine: buildRoutineEntries(eveningDefaults),
      habits: habitDefaults.length > 0
        ? habitDefaults.map((habit) => createTextListEntry(habit))
        : [createTextListEntry("")],
    });
    setHasSeededDefaults(true);
  }, [
    defaults,
    goalDomainOptions,
    hasSeededDefaults,
    sessionQuery.data?.user?.displayName,
  ]);

  const focusAreas = useMemo(
    () => sanitizeTextEntries(values.focusAreas).slice(0, 5),
    [values.focusAreas],
  );
  const goals = useMemo(
    () =>
      values.goals
        .map((goal) => ({
          title: goal.title.trim(),
          domain: goal.domain,
        }))
        .filter((goal) => goal.title)
        .slice(0, 3),
    [values.goals],
  );
  const habits = useMemo(
    () =>
      sanitizeTextEntries(values.habits)
        .slice(0, 5)
        .map((title) => ({
          title,
          targetPerDay: 1,
        })),
    [values.habits],
  );
  const routines = useMemo(
    () =>
      [
        sanitizeRoutine("Morning routine", "morning", values.morningRoutine),
        sanitizeRoutine("Evening routine", "evening", values.eveningRoutine),
      ].filter((routine): routine is NonNullable<typeof routine> => Boolean(routine)),
    [values.eveningRoutine, values.morningRoutine],
  );
  const summaryItems = useMemo(
    () => ({
      displayName: values.displayName.trim() || sessionQuery.data?.user?.displayName || "Owner",
      weekStartsOn:
        weekDayOptions.find((option) => option.value === values.weekStartsOn)?.label ?? "Monday",
      dailyReviewTime: values.dailyReviewTime || defaults?.dailyReviewStartTime || "20:00",
      dailyWaterTargetMl: parseWaterTarget(values.dailyWaterTargetMl, defaults?.dailyWaterTargetMl ?? 2500),
      focusAreas,
      goals,
      routines,
      habits,
      timezone: defaults?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
      currencyCode: defaults?.currencyCode ?? "USD",
    }),
    [
      defaults?.currencyCode,
      defaults?.dailyReviewStartTime,
      defaults?.dailyWaterTargetMl,
      defaults?.timezone,
      focusAreas,
      goals,
      habits,
      routines,
      sessionQuery.data?.user?.displayName,
      values.dailyReviewTime,
      values.dailyWaterTargetMl,
      values.displayName,
      values.weekStartsOn,
    ],
  );

  async function handleComplete() {
    await completeOnboardingMutation.mutateAsync({
      displayName: summaryItems.displayName,
      timezone: summaryItems.timezone,
      currencyCode: summaryItems.currencyCode,
      weekStartsOn: Number.parseInt(values.weekStartsOn || String(defaults?.weekStartsOn ?? 1), 10),
      dailyWaterTargetMl: summaryItems.dailyWaterTargetMl,
      dailyReviewStartTime: summaryItems.dailyReviewTime,
      dailyReviewEndTime: defaults?.dailyReviewEndTime ?? null,
      lifePriorities: focusAreas.length > 0 ? focusAreas : undefined,
      goals,
      habits,
      routines,
      firstWeekStartDate: getWeekStartDate(today),
      firstMonthStartDate: getMonthStartDate(today),
    });

    navigate("/", { replace: true });
  }

  if (onboardingQuery.isLoading && !onboardingQuery.data) {
    return (
      <PageLoadingState
        title="Loading starter setup"
        description="Pulling in your defaults so the setup can stay lightweight."
      />
    );
  }

  if (onboardingQuery.isError || !onboardingQuery.data) {
    return (
      <PageErrorState
        title="Onboarding unavailable"
        message={
          onboardingQuery.error instanceof Error
            ? onboardingQuery.error.message
            : undefined
        }
        onRetry={() => void onboardingQuery.refetch()}
      />
    );
  }

  const step = onboardingSteps[activeStep];

  return (
    <div className="auth-layout onboarding-shell">
      <div className="onboarding-shell__panel">
        <div className="onboarding-hero">
          <div className="onboarding-hero__mark">L</div>
          <div className="onboarding-hero__copy">
            <span className="page-eyebrow">Optional setup</span>
            <h1 className="onboarding-hero__title">Starter setup</h1>
            <p className="onboarding-hero__summary">
              This setup stays intentionally short. You can skip it entirely, or use it to seed just enough structure to make the app useful right away.
            </p>
          </div>
        </div>

        <div className="onboarding-note">
          Settings still owns preferences. Finance and meal setup now live in their own spaces, so onboarding only asks for the few things that help the first week feel guided.
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

        <div className="onboarding-step-meta">
          <span className="onboarding-step-meta__count">
            Step {activeStep + 1} of {onboardingSteps.length}
          </span>
          <span className="onboarding-step-meta__title">{step.title}</span>
        </div>

        <SectionCard title={step.title} subtitle={step.summary}>
          {activeStep === 0 ? (
            <div className="stack-form onboarding-section">
              <label className="field">
                <span>Display name</span>
                <input
                  placeholder="Owner"
                  type="text"
                  value={values.displayName}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      displayName: event.target.value,
                    }))
                  }
                />
              </label>

              <div className="onboarding-defaults-grid">
                <div className="onboarding-default-card">
                  <span className="page-eyebrow">Timezone</span>
                  <strong>{summaryItems.timezone}</strong>
                </div>
                <div className="onboarding-default-card">
                  <span className="page-eyebrow">Currency</span>
                  <strong>{summaryItems.currencyCode}</strong>
                </div>
                <div className="onboarding-default-card">
                  <span className="page-eyebrow">Today</span>
                  <strong>{today}</strong>
                </div>
              </div>

              <div className="onboarding-inline-grid">
                <label className="field">
                  <span>Week starts on</span>
                  <select
                    value={values.weekStartsOn}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        weekStartsOn: event.target.value,
                      }))
                    }
                  >
                    {weekDayOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Daily review time</span>
                  <input
                    type="time"
                    value={values.dailyReviewTime}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        dailyReviewTime: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <label className="field">
                <span>Daily water target</span>
                <input
                  placeholder="2500"
                  type="number"
                  min="250"
                  step="50"
                  value={values.dailyWaterTargetMl}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      dailyWaterTargetMl: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
          ) : null}

          {activeStep === 1 ? (
            <div className="stack-form onboarding-section">
              <TextListEditor
                entries={values.focusAreas}
                label="Focus areas"
                hint="Optional, up to 5"
                emptyPlaceholder="Health, work growth, money..."
                addLabel="Add focus area"
                suggestions={focusAreaSuggestions}
                onChange={(entries) =>
                  setValues((current) => ({
                    ...current,
                    focusAreas: entries,
                  }))
                }
              />

              <GoalListEditor
                goals={values.goals}
                domainOptions={goalDomainOptions}
                onChange={(nextGoals) =>
                  setValues((current) => ({
                    ...current,
                    goals: nextGoals,
                  }))
                }
              />

              {goalsConfigQuery.isError ? (
                <p className="list__subtle">
                  Goal domains could not load, so onboarding is using the default domain set for now.
                </p>
              ) : null}
            </div>
          ) : null}

          {activeStep === 2 ? (
            <div className="stack-form onboarding-section">
              <div className="onboarding-routine-block">
                <div className="onboarding-routine-block__header">
                  <span className="onboarding-routine-block__title">Morning routine</span>
                  <span className="onboarding-routine-block__hint">
                    Keep only the steps you want.
                  </span>
                </div>
                <RoutineItemEditor
                  items={values.morningRoutine}
                  onChange={(items) =>
                    setValues((current) => ({
                      ...current,
                      morningRoutine: items,
                    }))
                  }
                />
              </div>

              <div className="onboarding-routine-block">
                <div className="onboarding-routine-block__header">
                  <span className="onboarding-routine-block__title">Evening routine</span>
                  <span className="onboarding-routine-block__hint">
                    These can be edited later from Habits.
                  </span>
                </div>
                <RoutineItemEditor
                  items={values.eveningRoutine}
                  onChange={(items) =>
                    setValues((current) => ({
                      ...current,
                      eveningRoutine: items,
                    }))
                  }
                />
              </div>

              <TextListEditor
                entries={values.habits}
                label="Starter habits"
                hint="Optional, up to 5"
                emptyPlaceholder="Workout"
                addLabel="Add habit"
                suggestions={defaults?.habitSuggestions ?? []}
                onChange={(entries) =>
                  setValues((current) => ({
                    ...current,
                    habits: entries,
                  }))
                }
              />
            </div>
          ) : null}

          {activeStep === 3 ? (
            <div className="stack-form onboarding-section">
              <div className="onboarding-summary-grid">
                <div className="onboarding-summary-card">
                  <span className="page-eyebrow">Profile</span>
                  <strong>{summaryItems.displayName}</strong>
                  <span>{summaryItems.timezone}</span>
                  <span>{summaryItems.currencyCode}</span>
                </div>
                <div className="onboarding-summary-card">
                  <span className="page-eyebrow">Review rhythm</span>
                  <strong>{summaryItems.dailyReviewTime}</strong>
                  <span>Week starts {summaryItems.weekStartsOn}</span>
                  <span>{summaryItems.dailyWaterTargetMl} ml water target</span>
                </div>
                <div className="onboarding-summary-card">
                  <span className="page-eyebrow">Setup counts</span>
                  <strong>{summaryItems.goals.length} goals</strong>
                  <span>{summaryItems.habits.length} habits</span>
                  <span>{summaryItems.routines.length} routines</span>
                </div>
              </div>

              <div className="onboarding-review-block">
                <span className="onboarding-review-block__title">Focus areas</span>
                {summaryItems.focusAreas.length > 0 ? (
                  <div className="onboarding-review-tags">
                    {summaryItems.focusAreas.map((focusArea) => (
                      <span key={focusArea} className="onboarding-review-tag">
                        {focusArea}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="list__subtle">No focus areas added yet.</p>
                )}
              </div>

              <div className="onboarding-review-block">
                <span className="onboarding-review-block__title">Starter goals</span>
                {summaryItems.goals.length > 0 ? (
                  <ul className="onboarding-review-list">
                    {summaryItems.goals.map((goal) => {
                      const domainLabel =
                        goalDomainOptions.find((option) => option.key === goal.domain)?.label ?? goal.domain;

                      return (
                        <li key={`${goal.title}-${goal.domain}`}>
                          <strong>{goal.title}</strong>
                          <span>{domainLabel}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="list__subtle">No starter goals will be created.</p>
                )}
              </div>

              <div className="onboarding-review-block">
                <span className="onboarding-review-block__title">Daily rhythm</span>
                <ul className="onboarding-review-list">
                  <li>
                    <strong>Morning routine</strong>
                    <span>
                      {summaryItems.routines.find((routine) => routine.period === "morning")?.items.length ?? 0} steps
                    </span>
                  </li>
                  <li>
                    <strong>Evening routine</strong>
                    <span>
                      {summaryItems.routines.find((routine) => routine.period === "evening")?.items.length ?? 0} steps
                    </span>
                  </li>
                  <li>
                    <strong>Habits</strong>
                    <span>{summaryItems.habits.length} starter habits</span>
                  </li>
                </ul>
              </div>
            </div>
          ) : null}
        </SectionCard>

        {completeOnboardingMutation.error ? (
          <div className="onboarding-error">
            <p className="list__subtle onboarding-error__message">
              {completeOnboardingMutation.error instanceof Error
                ? completeOnboardingMutation.error.message
                : "Unable to complete onboarding."}
            </p>
            {mutationFieldErrors.length > 0 ? (
              <ul className="list__subtle onboarding-error__list">
                {mutationFieldErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="button-row onboarding-actions">
          <div className="button-row">
            <button
              className="button button--ghost"
              type="button"
              disabled={activeStep === 0}
              onClick={() =>
                setActiveStep((currentStep) => Math.max(0, currentStep - 1))
              }
            >
              Back
            </button>
            <Link
              className="button button--ghost"
              to="/"
            >
              Skip to app
            </Link>
          </div>

          <div className="button-row">
            {activeStep < onboardingSteps.length - 1 ? (
              <button
                className="button button--primary"
                type="button"
                onClick={() =>
                  setActiveStep((currentStep) =>
                    Math.min(onboardingSteps.length - 1, currentStep + 1),
                  )
                }
              >
                Continue
              </button>
            ) : (
              <button
                className="button button--primary"
                type="button"
                onClick={() => void handleComplete()}
                disabled={completeOnboardingMutation.isPending}
              >
                {completeOnboardingMutation.isPending ? "Creating workspace..." : "Start with this setup"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
