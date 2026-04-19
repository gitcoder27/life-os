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
import type { LandingPagePreference } from "../landing-page";
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
    defaultLandingPage: LandingPagePreference;
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
  defaultLandingPage?: LandingPagePreference;
  notificationPreferences?: Partial<Record<NotificationCategory, Partial<NotificationCategoryPreference>>>;
};

type ResetWorkspaceRequest = {
  confirmationText: string;
};

type ResetWorkspaceResponse = {
  success: true;
  generatedAt: string;
  resetAt: string;
};

type SessionResponse = {
  authenticated: boolean;
  generatedAt: string;
  user: {
    id: string;
    email: string;
    displayName: string;
  } | null;
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

export const useResetWorkspaceMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ResetWorkspaceRequest) =>
      apiRequest<ResetWorkspaceResponse>("/api/settings/reset-workspace", {
        method: "POST",
        body: payload,
      }),
    meta: {
      successMessage: "Workspace cleared.",
      errorMessage: "Workspace reset failed.",
    },
    onSuccess: () => {
      const sessionSnapshot = queryClient.getQueryData<SessionResponse>(queryKeys.session);

      queryClient.clear();

      if (sessionSnapshot?.authenticated) {
        queryClient.setQueryData<SessionResponse>(queryKeys.session, {
          ...sessionSnapshot,
          generatedAt: new Date().toISOString(),
        });
      }

      void queryClient.invalidateQueries({ queryKey: queryKeys.session });
      void queryClient.invalidateQueries({ queryKey: queryKeys.onboarding });
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    },
  });
};
