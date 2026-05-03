import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  NotificationCategory,
  NotificationCategoryPreference,
  NotificationCategoryPreferences,
  NotificationItem,
  NotificationMinSeverity,
  NotificationMutationResponse,
  NotificationRepeatCadence,
  NotificationsResponse,
  NotificationSnoozeRequest,
  NotificationSnoozePreset,
} from "@life-os/contracts";

import {
  apiRequest,
  queryKeys,
} from "./core";

type NotificationBulkDismissResponse = {
  generatedAt: string;
  dismissedCount: number;
};

export type {
  NotificationCategory,
  NotificationCategoryPreference,
  NotificationCategoryPreferences,
  NotificationItem,
  NotificationMinSeverity,
  NotificationRepeatCadence,
};
export type SnoozePreset = NotificationSnoozePreset;

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
        body: { preset } satisfies NotificationSnoozeRequest,
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
