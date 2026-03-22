import type {
  NotificationCategory,
  NotificationCategoryPreference,
  NotificationCategoryPreferences,
  NotificationRepeatCadence,
  NotificationSeverity,
  NotificationSnoozePreset,
  UpdateSettingsProfileRequest,
} from "@life-os/contracts";

import { addIsoDays } from "../../lib/time/cycle.js";
import {
  getDayWindowUtc,
  getTimeWindowUtc,
  getUserLocalDate,
  getUserLocalHour,
  normalizeTimezone,
} from "../../lib/time/user-time.js";

const notificationSeverityRank: Record<NotificationSeverity, number> = {
  info: 0,
  warning: 1,
  critical: 2,
};

const notificationCategoryDefaults: NotificationCategoryPreferences = {
  task: {
    enabled: true,
    minSeverity: "warning",
    repeatCadence: "off",
  },
  review: {
    enabled: true,
    minSeverity: "info",
    repeatCadence: "hourly",
  },
  finance: {
    enabled: true,
    minSeverity: "warning",
    repeatCadence: "every_3_hours",
  },
  health: {
    enabled: true,
    minSeverity: "warning",
    repeatCadence: "off",
  },
  habit: {
    enabled: true,
    minSeverity: "warning",
    repeatCadence: "off",
  },
  routine: {
    enabled: true,
    minSeverity: "warning",
    repeatCadence: "off",
  },
};

const repeatEligibleCategories = new Set<NotificationCategory>([
  "review",
  "finance",
]);

export const notificationCategories = Object.keys(
  notificationCategoryDefaults,
) as NotificationCategory[];

type NotificationPreferencesUpdate = NonNullable<
  UpdateSettingsProfileRequest["notificationPreferences"]
>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeCategoryPreference(
  category: NotificationCategory,
  input: unknown,
): NotificationCategoryPreference {
  const defaults = notificationCategoryDefaults[category];

  if (!isPlainObject(input)) {
    return defaults;
  }

  const enabled =
    typeof input.enabled === "boolean" ? input.enabled : defaults.enabled;
  const minSeverity =
    input.minSeverity === "info" ||
    input.minSeverity === "warning" ||
    input.minSeverity === "critical"
      ? input.minSeverity
      : defaults.minSeverity;
  const repeatCadence =
    input.repeatCadence === "off" ||
    input.repeatCadence === "hourly" ||
    input.repeatCadence === "every_3_hours"
      ? input.repeatCadence
      : defaults.repeatCadence;

  return {
    enabled,
    minSeverity,
    repeatCadence,
  };
}

export function normalizeNotificationPreferences(
  input?: unknown,
): NotificationCategoryPreferences {
  const source = isPlainObject(input) ? input : {};

  return notificationCategories.reduce((result, category) => {
    result[category] = normalizeCategoryPreference(category, source[category]);
    return result;
  }, {} as NotificationCategoryPreferences);
}

export function mergeNotificationPreferences(
  current: unknown,
  update?: NotificationPreferencesUpdate,
): NotificationCategoryPreferences {
  const resolved = normalizeNotificationPreferences(current);

  if (!update) {
    return resolved;
  }

  return notificationCategories.reduce((result, category) => {
    result[category] = {
      ...resolved[category],
      ...(update[category] ?? {}),
    };
    return result;
  }, {} as NotificationCategoryPreferences);
}

export function getDefaultNotificationPreferences() {
  return normalizeNotificationPreferences(notificationCategoryDefaults);
}

export function getEffectiveRepeatCadence(
  preferences: NotificationCategoryPreferences,
  category: NotificationCategory,
): NotificationRepeatCadence {
  if (!repeatEligibleCategories.has(category)) {
    return "off";
  }

  return preferences[category].repeatCadence;
}

export function shouldGenerateNotification(input: {
  preferences: NotificationCategoryPreferences;
  category: NotificationCategory;
  severity: NotificationSeverity;
}) {
  const preference = input.preferences[input.category];

  if (!preference.enabled) {
    return false;
  }

  return (
    notificationSeverityRank[input.severity] >=
    notificationSeverityRank[preference.minSeverity]
  );
}

export function buildNotificationNaturalKey(input: {
  ruleKey: string;
  entityType: string;
  entityId: string;
}) {
  return `${input.ruleKey}|${input.entityType}|${input.entityId}`;
}

function buildRepeatBucket(
  now: Date,
  timezone: string,
  repeatCadence: NotificationRepeatCadence,
) {
  if (repeatCadence === "off") {
    return null;
  }

  const localDate = getUserLocalDate(now, timezone);
  const localHour = getUserLocalHour(now, timezone);

  if (repeatCadence === "hourly") {
    return `${localDate}|h${String(localHour).padStart(2, "0")}`;
  }

  const bucketStartHour = Math.floor(localHour / 3) * 3;
  return `${localDate}|h${String(bucketStartHour).padStart(2, "0")}`;
}

export function buildNotificationDeliveryKey(input: {
  naturalKey: string;
  now: Date;
  timezone?: string | null;
  repeatCadence: NotificationRepeatCadence;
}) {
  const timezone = normalizeTimezone(input.timezone);
  const repeatBucket = buildRepeatBucket(
    input.now,
    timezone,
    input.repeatCadence,
  );

  if (!repeatBucket) {
    return input.naturalKey;
  }

  return `${input.naturalKey}|${repeatBucket}`;
}

export function resolveNotificationSnoozeTime(input: {
  now: Date;
  timezone?: string | null;
  preset: NotificationSnoozePreset;
}) {
  const timezone = normalizeTimezone(input.timezone);

  if (input.preset === "one_hour") {
    return new Date(input.now.getTime() + 60 * 60 * 1000);
  }

  const todayIso = getUserLocalDate(input.now, timezone);

  if (input.preset === "tonight") {
    if (getUserLocalHour(input.now, timezone) >= 18) {
      return null;
    }

    return getTimeWindowUtc(todayIso, "18:00", timezone);
  }

  return getTimeWindowUtc(addIsoDays(todayIso, 1), "09:00", timezone);
}

export function resolveSnoozedNotificationExpiry(input: {
  currentExpiresAt: Date | null;
  visibleFrom: Date;
  timezone?: string | null;
}) {
  if (!input.currentExpiresAt || input.currentExpiresAt > input.visibleFrom) {
    return input.currentExpiresAt;
  }

  const timezone = normalizeTimezone(input.timezone);
  const snoozedLocalDate = getUserLocalDate(input.visibleFrom, timezone);

  return getDayWindowUtc(snoozedLocalDate, timezone).end;
}
