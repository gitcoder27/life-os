import { z } from "zod";

import type { ApiMeta, EntityId } from "./common.js";
import type { HomeAction } from "./home.js";

export const notificationCategorySchema = z.enum([
  "task",
  "inbox",
  "review",
  "finance",
  "health",
  "habit",
  "routine",
]);
export type NotificationCategory = z.infer<typeof notificationCategorySchema>;

export const notificationSeveritySchema = z.enum(["info", "warning", "critical"]);
export type NotificationSeverity = z.infer<typeof notificationSeveritySchema>;
export type NotificationMinSeverity = NotificationSeverity;
export const notificationRepeatCadenceSchema = z.enum(["off", "hourly", "every_3_hours"]);
export type NotificationRepeatCadence = z.infer<typeof notificationRepeatCadenceSchema>;
export const notificationSnoozePresetSchema = z.enum(["one_hour", "tonight", "tomorrow"]);
export type NotificationSnoozePreset = z.infer<typeof notificationSnoozePresetSchema>;

export const notificationCategoryPreferenceSchema = z.object({
  enabled: z.boolean(),
  minSeverity: notificationSeveritySchema,
  repeatCadence: notificationRepeatCadenceSchema,
});

export interface NotificationCategoryPreference {
  enabled: boolean;
  minSeverity: NotificationMinSeverity;
  repeatCadence: NotificationRepeatCadence;
}

export type NotificationCategoryPreferences = Record<
  NotificationCategory,
  NotificationCategoryPreference
>;

export const notificationCategoryPreferencesSchema = z.record(
  notificationCategorySchema,
  notificationCategoryPreferenceSchema,
) as z.ZodType<NotificationCategoryPreferences>;

export interface NotificationItem {
  id: EntityId;
  notificationType: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  body: string;
  action: HomeAction | null;
  entityType: string | null;
  entityId: EntityId | null;
  ruleKey: string;
  visibleFrom: string | null;
  expiresAt: string | null;
  read: boolean;
  readAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse extends ApiMeta {
  notifications: NotificationItem[];
}

export interface NotificationMutationResponse extends ApiMeta {
  notification: NotificationItem;
}

export interface NotificationSnoozeRequest {
  preset: NotificationSnoozePreset;
}

export const notificationSnoozeRequestSchema = z.object({
  preset: notificationSnoozePresetSchema,
}) satisfies z.ZodType<NotificationSnoozeRequest>;
