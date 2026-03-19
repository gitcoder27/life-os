import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  setPreferredTimezone,
  setPreferredWeekStart,
  useOnboardingStateQuery,
  useSettingsProfileQuery,
  useUpdateSettingsProfileMutation,
} from "../../shared/lib/api";
import { PageHeader } from "../../shared/ui/PageHeader";
import {
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";
import { SectionCard } from "../../shared/ui/SectionCard";

const weekDayOptions = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export function SettingsPage() {
  const settingsQuery = useSettingsProfileQuery();
  const updateMutation = useUpdateSettingsProfileMutation();
  const onboardingQuery = useOnboardingStateQuery();

  const [form, setForm] = useState({
    displayName: "",
    timezone: "",
    currencyCode: "",
    weekStartsOn: 1,
    dailyWaterTargetMl: 2000,
    dailyReviewStartTime: "",
    dailyReviewEndTime: "",
  });

  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!settingsQuery.data) return;
    const { user, preferences } = settingsQuery.data;
    setForm({
      displayName: user.displayName,
      timezone: preferences.timezone,
      currencyCode: preferences.currencyCode,
      weekStartsOn: preferences.weekStartsOn,
      dailyWaterTargetMl: preferences.dailyWaterTargetMl,
      dailyReviewStartTime: preferences.dailyReviewStartTime ?? "",
      dailyReviewEndTime: preferences.dailyReviewEndTime ?? "",
    });
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

  async function handleSave() {
    await updateMutation.mutateAsync({
      displayName: form.displayName,
      timezone: form.timezone,
      currencyCode: form.currencyCode,
      weekStartsOn: form.weekStartsOn,
      dailyWaterTargetMl: form.dailyWaterTargetMl,
      dailyReviewStartTime: form.dailyReviewStartTime || null,
      dailyReviewEndTime: form.dailyReviewEndTime || null,
    });
    setPreferredWeekStart(form.weekStartsOn);
    if (form.timezone) {
      setPreferredTimezone(form.timezone);
    }
    setDirty(false);
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
                  Import habits, routines, goals, and tracking defaults in one pass — or keep configuring things manually.
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
              <input
                type="text"
                value={form.timezone}
                placeholder="e.g. America/New_York"
                onChange={(e) => handleChange("timezone", e.target.value)}
              />
            </label>
            <label className="field">
              <span>Currency code</span>
              <input
                type="text"
                value={form.currencyCode}
                placeholder="e.g. USD"
                maxLength={3}
                onChange={(e) =>
                  handleChange("currencyCode", e.target.value.toUpperCase())
                }
              />
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
