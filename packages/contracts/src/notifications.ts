import type { ApiMeta, EntityId } from "./common.js";

export type NotificationCategory =
  | "task"
  | "inbox"
  | "review"
  | "finance"
  | "health"
  | "habit"
  | "routine";

export type NotificationSeverity = "info" | "warning" | "critical";
export type NotificationMinSeverity = NotificationSeverity;
export type NotificationRepeatCadence = "off" | "hourly" | "every_3_hours";
export type NotificationSnoozePreset = "one_hour" | "tonight" | "tomorrow";

export interface NotificationCategoryPreference {
  enabled: boolean;
  minSeverity: NotificationMinSeverity;
  repeatCadence: NotificationRepeatCadence;
}

export type NotificationCategoryPreferences = Record<
  NotificationCategory,
  NotificationCategoryPreference
>;

export interface NotificationItem {
  id: EntityId;
  notificationType: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  body: string;
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
