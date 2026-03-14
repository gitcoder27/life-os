import type { ApiMeta, ApiSuccess, IsoDateString } from "./common.js";

export type OnboardingStep =
  | "account"
  | "preferences"
  | "habits"
  | "routines"
  | "goals"
  | "finance";

export interface OnboardingDefaults {
  timezone: string;
  currencyCode: string;
  weekStartsOn: number;
  dailyWaterTargetMl: number;
}

export interface OnboardingStateResponse extends ApiMeta {
  isComplete: boolean;
  completedAt: string | null;
  nextStep: OnboardingStep | null;
  defaults: OnboardingDefaults;
}

export interface OnboardingCompleteRequest {
  displayName: string;
  timezone: string;
  currencyCode: string;
  weekStartsOn: number;
  dailyWaterTargetMl: number;
  firstWeekStartDate: IsoDateString;
}

export interface OnboardingCompleteResponse extends ApiSuccess, ApiMeta {
  completedAt: string;
}
