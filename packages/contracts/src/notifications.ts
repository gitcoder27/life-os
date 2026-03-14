import type { ApiMeta, EntityId } from "./common.js";

export type NotificationSeverity = "info" | "warning" | "critical";

export interface NotificationItem {
  id: EntityId;
  notificationType: string;
  severity: NotificationSeverity;
  title: string;
  body: string;
  entityType: string | null;
  entityId: EntityId | null;
  ruleKey: string;
  visibleFrom: string | null;
  expiresAt: string | null;
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
