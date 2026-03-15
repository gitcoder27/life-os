import type { ApiMeta } from "./common.js";

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
}

export interface SettingsProfileMutationResponse extends ApiMeta, SettingsProfile {}
