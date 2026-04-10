import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  apiRequest,
  queryKeys,
} from "./core";
import type { HomeAction } from "./home";

export type NotificationCategory = "task" | "inbox" | "review" | "finance" | "health" | "habit" | "routine";
export type NotificationMinSeverity = "info" | "warning" | "critical";
export type NotificationRepeatCadence = "off" | "hourly" | "every_3_hours";

export type NotificationCategoryPreference = {
  enabled: boolean;
  minSeverity: NotificationMinSeverity;
  repeatCadence: NotificationRepeatCadence;
};

export type NotificationCategoryPreferences = Record<
  NotificationCategory,
  NotificationCategoryPreference
>;

export type NotificationItem = {
  id: string;
  notificationType: NotificationCategory;
  severity: "info" | "warning" | "critical";
  title: string;
  body: string;
  action: HomeAction | null;
  entityType: string | null;
  entityId: string | null;
  ruleKey: string;
  visibleFrom: string | null;
  expiresAt: string | null;
  read: boolean;
  readAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
};

type NotificationsResponse = {
  generatedAt: string;
  notifications: NotificationItem[];
};

type NotificationMutationResponse = {
  generatedAt: string;
  notification: NotificationItem;
};

type NotificationBulkDismissResponse = {
  generatedAt: string;
  dismissedCount: number;
};

export type SnoozePreset = "one_hour" | "tonight" | "tomorrow";

export const useNotificationsQuery = () =>
  useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => apiRequest<NotificationsResponse>("/api/notifications"),
    refetchInterval: 60_000,
    retry: false,
  });

export const useMarkNotificationReadMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      apiRequest<NotificationMutationResponse>(`/api/notifications/${notificationId}/read`, {
        method: "POST",
      }),
    meta: {
      successMessage: "Notification marked as read.",
      errorMessage: "Could not mark notification as read.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
};

export const useDismissNotificationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      apiRequest<NotificationMutationResponse>(`/api/notifications/${notificationId}/dismiss`, {
        method: "POST",
      }),
    meta: {
      successMessage: "Notification dismissed.",
      errorMessage: "Could not dismiss notification.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
};

export const useDismissAllNotificationsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiRequest<NotificationBulkDismissResponse>("/api/notifications/dismiss-all", {
        method: "POST",
      }),
    meta: {
      successMessage: "All notifications cleared.",
      errorMessage: "Could not clear notifications.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
};

export const useSnoozeNotificationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ notificationId, preset }: { notificationId: string; preset: SnoozePreset }) =>
      apiRequest<NotificationMutationResponse>(`/api/notifications/${notificationId}/snooze`, {
        method: "POST",
        body: { preset },
      }),
    meta: {
      successMessage: "Notification snoozed.",
      errorMessage: "Could not snooze notification.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
};
