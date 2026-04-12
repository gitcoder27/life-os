import type { ApiMeta, ApiSuccess } from "./common.js";
import type { NotificationCategoryPreferences } from "./notifications.js";

export interface SettingsProfile {
  user: {
    id: string;
    email: string;
    displayName: string | null;
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
}

export interface SettingsProfileResponse extends ApiMeta, SettingsProfile {}

export interface UpdateSettingsProfileRequest {
  displayName?: string | null;
  timezone?: string;
  currencyCode?: string;
  weekStartsOn?: number;
  dailyWaterTargetMl?: number;
  dailyReviewStartTime?: string | null;
  dailyReviewEndTime?: string | null;
  notificationPreferences?: Partial<{
    [K in keyof NotificationCategoryPreferences]: Partial<NotificationCategoryPreferences[K]>;
  }>;
}

export interface SettingsProfileMutationResponse extends ApiMeta, SettingsProfile {}

export interface ResetWorkspaceRequest {
  confirmationText: string;
}

export interface ResetWorkspaceResponse extends ApiMeta, ApiSuccess {
  resetAt: string;
}
