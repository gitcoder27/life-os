import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  setPreferredTimezone,
  setPreferredWeekStart,
  useLogoutMutation,
  useOnboardingStateQuery,
  useResetWorkspaceMutation,
  useSettingsProfileQuery,
  useUpdateSettingsProfileMutation,
} from "../../shared/lib/api";
import type {
  NotificationCategory,
  NotificationCategoryPreference,
  NotificationCategoryPreferences,
  NotificationMinSeverity,
  NotificationRepeatCadence,
} from "../../shared/lib/api";
import {
  getCurrencyOptions,
  getTimezoneOptions,
} from "../../shared/lib/localeOptions";
import { landingPageOptions, type LandingPagePreference } from "../../shared/lib/landing-page";
import { PageHeader } from "../../shared/ui/PageHeader";
import {
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";
import { SectionCard } from "../../shared/ui/SectionCard";
import { GoalDomainManager } from "./GoalDomainManager";
import { GoalHorizonManager } from "./GoalHorizonManager";

const weekDayOptions = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const defaultTimezoneOptions = getTimezoneOptions();
const defaultCurrencyOptions = getCurrencyOptions();

const NOTIF_CATEGORIES: {
  key: NotificationCategory;
  label: string;
  description: string;
  hasRepeatCadence: boolean;
}[] = [
  { key: "task", label: "Task", description: "Reminder tasks promoted into Today", hasRepeatCadence: false },
  { key: "inbox", label: "Inbox", description: "Inbox Zero updates and stale capture recovery feedback", hasRepeatCadence: false },
  { key: "review", label: "Review", description: "Daily, weekly, and monthly review reminders", hasRepeatCadence: true },
  { key: "finance", label: "Finance", description: "Bill due dates, budget warnings, spending alerts", hasRepeatCadence: true },
  { key: "health", label: "Health", description: "Hydration, workout, and meal tracking nudges", hasRepeatCadence: false },
  { key: "habit", label: "Habit", description: "Habit streak and completion reminders", hasRepeatCadence: false },
  { key: "routine", label: "Routine", description: "Morning and evening routine prompts", hasRepeatCadence: false },
];

const SEVERITY_OPTIONS: { value: NotificationMinSeverity; label: string }[] = [
  { value: "info", label: "All (info+)" },
  { value: "warning", label: "Warning+" },
  { value: "critical", label: "Critical only" },
];

const CADENCE_OPTIONS: { value: NotificationRepeatCadence; label: string }[] = [
  { value: "off", label: "No repeat" },
  { value: "hourly", label: "Hourly" },
  { value: "every_3_hours", label: "Every 3 hours" },
];

const DEFAULT_NOTIF_PREFS: NotificationCategoryPreferences = {
  task: { enabled: true, minSeverity: "warning", repeatCadence: "off" },
  inbox: { enabled: true, minSeverity: "info", repeatCadence: "off" },
  review: { enabled: true, minSeverity: "info", repeatCadence: "hourly" },
  finance: { enabled: true, minSeverity: "warning", repeatCadence: "every_3_hours" },
  health: { enabled: true, minSeverity: "warning", repeatCadence: "off" },
  habit: { enabled: true, minSeverity: "warning", repeatCadence: "off" },
  routine: { enabled: true, minSeverity: "warning", repeatCadence: "off" },
};

export function SettingsPage() {
  const navigate = useNavigate();
  const settingsQuery = useSettingsProfileQuery();
  const updateMutation = useUpdateSettingsProfileMutation();
  const logoutMutation = useLogoutMutation();
  const resetWorkspaceMutation = useResetWorkspaceMutation();
  const onboardingQuery = useOnboardingStateQuery();

  const [form, setForm] = useState({
    displayName: "",
    timezone: "",
    currencyCode: "",
    weekStartsOn: 1,
    dailyWaterTargetMl: 2000,
    dailyReviewStartTime: "",
    dailyReviewEndTime: "",
    defaultLandingPage: "home" as LandingPagePreference,
  });

  const [notifPrefs, setNotifPrefs] = useState<NotificationCategoryPreferences>(DEFAULT_NOTIF_PREFS);
  const [resetConfirmationText, setResetConfirmationText] = useState("");

  const [dirty, setDirty] = useState(false);
  const timezoneOptions = form.timezone
    ? getTimezoneOptions(form.timezone)
    : defaultTimezoneOptions;
  const currencyOptions = form.currencyCode
    ? getCurrencyOptions(form.currencyCode)
    : defaultCurrencyOptions;

  useEffect(() => {
    if (!settingsQuery.data) return;
    const { user, preferences } = settingsQuery.data;
    setForm({
      displayName: user.displayName ?? "",
      timezone: preferences.timezone,
      currencyCode: preferences.currencyCode,
      weekStartsOn: preferences.weekStartsOn,
      dailyWaterTargetMl: preferences.dailyWaterTargetMl,
      dailyReviewStartTime: preferences.dailyReviewStartTime ?? "",
      dailyReviewEndTime: preferences.dailyReviewEndTime ?? "",
      defaultLandingPage: preferences.defaultLandingPage,
    });
    if (preferences.notificationPreferences) {
      setNotifPrefs(preferences.notificationPreferences);
    }
    setPreferredWeekStart(preferences.weekStartsOn);
    if (preferences.timezone) {
      setPreferredTimezone(preferences.timezone);
    }
    setDirty(false);
  }, [settingsQuery.data]);

  function handleChange(
    field: keyof typeof form,
    value: string | number,
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  }

  function handleNotifPrefChange(
    category: NotificationCategory,
    field: keyof NotificationCategoryPreference,
    value: boolean | string,
  ) {
    setNotifPrefs((prev) => ({
      ...prev,
      [category]: { ...prev[category], [field]: value },
    }));
    setDirty(true);
  }

  async function handleSave() {
    await updateMutation.mutateAsync({
      displayName: form.displayName.trim() || null,
      timezone: form.timezone,
      currencyCode: form.currencyCode,
      weekStartsOn: form.weekStartsOn,
      dailyWaterTargetMl: form.dailyWaterTargetMl,
      dailyReviewStartTime: form.dailyReviewStartTime || null,
      dailyReviewEndTime: form.dailyReviewEndTime || null,
      defaultLandingPage: form.defaultLandingPage,
      notificationPreferences: notifPrefs,
    });
    setPreferredWeekStart(form.weekStartsOn);
    if (form.timezone) {
      setPreferredTimezone(form.timezone);
    }
    setDirty(false);
  }

  async function handleLogout() {
    await logoutMutation.mutateAsync();
    navigate("/login", { replace: true });
  }

  async function handleResetWorkspace() {
    await resetWorkspaceMutation.mutateAsync({
      confirmationText: resetConfirmationText,
    });
    setResetConfirmationText("");
    navigate("/onboarding", { replace: true });
  }

  if (settingsQuery.isLoading && !settingsQuery.data) {
    return (
      <PageLoadingState
        title="Loading settings"
        description="Fetching your current preferences."
      />
    );
  }

  if (settingsQuery.isError || !settingsQuery.data) {
    return (
      <PageErrorState
        title="Settings unavailable"
        message={
          settingsQuery.error instanceof Error
            ? settingsQuery.error.message
            : undefined
        }
        onRetry={() => void settingsQuery.refetch()}
      />
    );
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        description="Adjust your display name, timezone, currency, and daily targets."
      />

      <div className="settings-layout stagger">
        {onboardingQuery.data && !onboardingQuery.data.isComplete ? (
          <div className="settings-onboarding-cta">
            <div className="settings-onboarding-cta__content">
              <div className="settings-onboarding-cta__icon">✦</div>
              <div>
                <div className="settings-onboarding-cta__title">Starter setup available</div>
                <div className="settings-onboarding-cta__copy">
                  Import habits, routines, goals, and baseline tracking defaults in one pass. Domain setup still lives on each domain page.
                </div>
              </div>
            </div>
            <Link className="button button--ghost button--small" to="/onboarding">
              Open setup wizard
            </Link>
          </div>
        ) : null}

        <SectionCard title="Account" subtitle="Read-only email and display name">
          <div className="stack-form">
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={settingsQuery.data.user.email}
                readOnly
                aria-label="Email (read-only)"
                style={{ opacity: 0.6, cursor: "not-allowed" }}
              />
            </label>
            <label className="field">
              <span>Display name</span>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => handleChange("displayName", e.target.value)}
              />
            </label>
          </div>
        </SectionCard>

        <SectionCard title="Locale" subtitle="Timezone, currency, and week start">
          <div className="stack-form">
            <label className="field">
              <span>Timezone</span>
              <select
                value={form.timezone}
                onChange={(e) => handleChange("timezone", e.target.value)}
              >
                {timezoneOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Currency code</span>
              <select
                value={form.currencyCode}
                onChange={(e) =>
                  handleChange("currencyCode", e.target.value)
                }
              >
                {currencyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Week starts on</span>
              <select
                value={form.weekStartsOn}
                onChange={(e) =>
                  handleChange("weekStartsOn", Number(e.target.value))
                }
              >
                {weekDayOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </SectionCard>

        <SectionCard title="Health targets" subtitle="Daily water intake goal">
          <div className="stack-form">
            <label className="field">
              <span>Daily water target (ml)</span>
              <input
                type="number"
                min={0}
                step={250}
                value={form.dailyWaterTargetMl}
                onChange={(e) =>
                  handleChange(
                    "dailyWaterTargetMl",
                    Math.max(0, Number(e.target.value)),
                  )
                }
              />
            </label>
          </div>
        </SectionCard>

        <SectionCard
          title="Daily review window"
          subtitle="Optional start and end times"
        >
          <div className="stack-form">
            <label className="field">
              <span>Start time</span>
              <input
                type="time"
                value={form.dailyReviewStartTime}
                onChange={(e) =>
                  handleChange("dailyReviewStartTime", e.target.value)
                }
              />
            </label>
            <label className="field">
              <span>End time</span>
              <input
                type="time"
                value={form.dailyReviewEndTime}
                onChange={(e) =>
                  handleChange("dailyReviewEndTime", e.target.value)
                }
              />
            </label>
          </div>
        </SectionCard>

        <SectionCard title="Startup" subtitle="Choose where the app should land after sign-in">
          <div className="stack-form">
            <label className="field">
              <span>Default landing page</span>
              <select
                value={form.defaultLandingPage}
                onChange={(e) => handleChange("defaultLandingPage", e.target.value)}
              >
                {landingPageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} - {option.description}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </SectionCard>

        <SectionCard title="Domain setup" subtitle="Global preferences stay here. Finance structure stays on Finance.">
          <div className="button-row button-row--wrap">
            <span className="support-copy">
              Manage finance categories and recurring bills from the Finance page so the setup stays close to the workflow it powers.
            </span>
            <Link className="button button--ghost button--small" to="/finance?manage=categories">
              Manage categories
            </Link>
            <Link className="button button--ghost button--small" to="/finance?manage=recurring">
              Manage recurring bills
            </Link>
          </div>
        </SectionCard>

        <GoalDomainManager />
        <GoalHorizonManager />

        <SectionCard title="Notification behavior" subtitle="Control which alerts reach you and how often they repeat">
          <div className="notif-settings-grid">
            {NOTIF_CATEGORIES.map((cat) => {
              const pref = notifPrefs[cat.key];
              return (
                <div key={cat.key} className={`notif-settings-row${!pref.enabled ? " notif-settings-row--disabled" : ""}`}>
                  <div className="notif-settings-row__header">
                    <label className="notif-settings-toggle">
                      <input
                        type="checkbox"
                        checked={pref.enabled}
                        onChange={(e) => handleNotifPrefChange(cat.key, "enabled", e.target.checked)}
                        aria-label={`Enable ${cat.label} notifications`}
                      />
                      <span className="notif-settings-toggle__track">
                        <span className="notif-settings-toggle__thumb" />
                      </span>
                    </label>
                    <div className="notif-settings-row__info">
                      <span className="notif-settings-row__label">{cat.label}</span>
                      <span className="notif-settings-row__desc">{cat.description}</span>
                    </div>
                  </div>
                  <div className="notif-settings-row__controls">
                    <label className="field notif-settings-field">
                      <span>Min severity</span>
                      <select
                        value={pref.minSeverity}
                        disabled={!pref.enabled}
                        onChange={(e) => handleNotifPrefChange(cat.key, "minSeverity", e.target.value)}
                      >
                        {SEVERITY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </label>
                    {cat.hasRepeatCadence ? (
                      <label className="field notif-settings-field">
                        <span>Repeat</span>
                        <select
                          value={pref.repeatCadence}
                          disabled={!pref.enabled}
                          onChange={(e) => handleNotifPrefChange(cat.key, "repeatCadence", e.target.value)}
                        >
                          {CADENCE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <div className="field notif-settings-field">
                        <span>Repeat</span>
                        <span className="notif-settings-fixed">Off</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Session" subtitle="End the current session on this device">
          <div className="button-row button-row--wrap">
            <span className="support-copy">
              Log out and return to the sign-in screen.
            </span>
            <button
              className="button button--ghost"
              type="button"
              disabled={logoutMutation.isPending}
              onClick={() => void handleLogout()}
            >
              {logoutMutation.isPending ? "Logging out…" : "Log out"}
            </button>
          </div>
          {logoutMutation.error ? (
            <div className="inline-state inline-state--error" style={{ marginTop: "0.75rem" }}>
              {logoutMutation.error instanceof Error
                ? logoutMutation.error.message
                : "Log out failed."}
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          title="Danger Zone"
          subtitle="Clear this workspace and start over while keeping your account and preferences"
          className="settings-danger-zone"
        >
          <div className="stack-form">
            <div className="settings-danger-zone__copy">
              This removes all user data across inbox and today, habits and routines, goals, health, finance, reviews, scores, and notifications.
            </div>
            <ul className="settings-danger-zone__list">
              <li>Deletes all captured tasks, plans, launches, templates, and review history.</li>
              <li>Deletes all habits, routines, goals, health logs, finance data, and notifications.</li>
              <li>Keeps your login, display name, timezone, currency, week start, review window, landing page, and notification preferences.</li>
            </ul>
            <label className="field">
              <span>Type RESET to continue</span>
              <input
                type="text"
                value={resetConfirmationText}
                onChange={(event) => setResetConfirmationText(event.target.value)}
                placeholder="RESET"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <div className="button-row button-row--wrap">
              <span className="support-copy">
                After reset, you will be taken to onboarding to set the workspace up again.
              </span>
              <button
                className="button button--danger"
                type="button"
                disabled={resetConfirmationText !== "RESET" || resetWorkspaceMutation.isPending}
                onClick={() => void handleResetWorkspace()}
              >
                {resetWorkspaceMutation.isPending ? "Clearing workspace…" : "Clear all data"}
              </button>
            </div>
          </div>

          {resetWorkspaceMutation.error ? (
            <div className="inline-state inline-state--error" style={{ marginTop: "0.75rem" }}>
              {resetWorkspaceMutation.error instanceof Error
                ? resetWorkspaceMutation.error.message
                : "Workspace reset failed."}
            </div>
          ) : null}
        </SectionCard>
      </div>

      <div className="button-row" style={{ paddingTop: "0.75rem" }}>
        <span className="support-copy">
          {dirty ? "You have unsaved changes." : "All changes saved."}
        </span>
        <button
          className="button button--primary"
          type="button"
          disabled={!dirty || updateMutation.isPending}
          onClick={() => void handleSave()}
        >
          {updateMutation.isPending ? "Saving…" : "Save settings"}
        </button>
      </div>

      {updateMutation.error && (
        <div className="inline-state inline-state--error" style={{ marginTop: "0.5rem" }}>
          {updateMutation.error instanceof Error
            ? updateMutation.error.message
            : "Save failed."}
        </div>
      )}
    </div>
  );
}
