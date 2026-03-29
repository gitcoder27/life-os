import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type {
  NotificationCategory,
  NotificationCategoryPreference,
  NotificationCategoryPreferences,
} from "./notifications";
import {
  apiRequest,
  queryKeys,
} from "./core";

type SettingsProfileResponse = {
  generatedAt: string;
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  preferences: {
    timezone: string;
    currencyCode: string;
    weekStartsOn: number;
    dailyWaterTargetMl: number;
    dailyReviewStartTime: string | null;
    dailyReviewEndTime: string | null;
    notificationPreferences: NotificationCategoryPreferences;
  };
};

type UpdateSettingsProfileRequest = {
  displayName?: string;
  timezone?: string;
  currencyCode?: string;
  weekStartsOn?: number;
  dailyWaterTargetMl?: number;
  dailyReviewStartTime?: string | null;
  dailyReviewEndTime?: string | null;
  notificationPreferences?: Partial<Record<NotificationCategory, Partial<NotificationCategoryPreference>>>;
};

export const useSettingsProfileQuery = () =>
  useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => apiRequest<SettingsProfileResponse>("/api/settings/profile"),
    retry: false,
  });

export const useUpdateSettingsProfileMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateSettingsProfileRequest) =>
      apiRequest<SettingsProfileResponse>("/api/settings/profile", {
        method: "PUT",
        body: payload,
      }),
    meta: {
      successMessage: "Settings saved.",
      errorMessage: "Settings could not be saved.",
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings });
      void queryClient.invalidateQueries({ queryKey: queryKeys.session });
    },
  });
};
