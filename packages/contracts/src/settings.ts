import { z } from "zod";

import type { ApiMeta, ApiSuccess } from "./common.js";
import {
  notificationCategoryPreferenceSchema,
  type NotificationCategoryPreferences,
} from "./notifications.js";

export const landingPagePreferenceSchema = z.enum(["home", "today", "planner", "meals"]);
export type LandingPagePreference = z.infer<typeof landingPagePreferenceSchema>;

const reviewTimeStringSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/)
  .nullable();

const notificationPreferenceUpdateSchema = notificationCategoryPreferenceSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one notification preference field must be updated",
  );

const notificationPreferencesUpdateSchema = z
  .object({
    task: notificationPreferenceUpdateSchema.optional(),
    inbox: notificationPreferenceUpdateSchema.optional(),
    review: notificationPreferenceUpdateSchema.optional(),
    finance: notificationPreferenceUpdateSchema.optional(),
    health: notificationPreferenceUpdateSchema.optional(),
    habit: notificationPreferenceUpdateSchema.optional(),
    routine: notificationPreferenceUpdateSchema.optional(),
  })
  .refine(
    (value) => Object.values(value).some(Boolean),
    "At least one notification category must be updated",
  );

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
    defaultLandingPage: LandingPagePreference;
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
  defaultLandingPage?: LandingPagePreference;
  notificationPreferences?: Partial<{
    [K in keyof NotificationCategoryPreferences]: Partial<NotificationCategoryPreferences[K]>;
  }>;
}

export const updateSettingsProfileRequestSchema = z
  .object({
    displayName: z.string().trim().min(1).max(200).nullable().optional(),
    timezone: z.string().optional(),
    currencyCode: z
      .string()
      .length(3)
      .transform((value) => value.toUpperCase())
      .optional(),
    weekStartsOn: z.number().int().min(0).max(6).optional(),
    dailyWaterTargetMl: z.number().int().positive().max(20000).optional(),
    dailyReviewStartTime: reviewTimeStringSchema.optional(),
    dailyReviewEndTime: reviewTimeStringSchema.optional(),
    defaultLandingPage: landingPagePreferenceSchema.optional(),
    notificationPreferences: notificationPreferencesUpdateSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated") as z.ZodType<UpdateSettingsProfileRequest>;

export interface SettingsProfileMutationResponse extends ApiMeta, SettingsProfile {}

export interface ResetWorkspaceRequest {
  confirmationText: string;
}

export const resetWorkspaceRequestSchema = z.object({
  confirmationText: z
    .string()
    .trim()
    .refine((value) => value === "RESET", "Type RESET to confirm workspace reset"),
}) satisfies z.ZodType<ResetWorkspaceRequest>;

export interface ResetWorkspaceResponse extends ApiMeta, ApiSuccess {
  resetAt: string;
}
