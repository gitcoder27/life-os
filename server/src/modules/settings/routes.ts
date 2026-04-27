import type { FastifyPluginAsync } from "fastify";
import type { Prisma } from "@prisma/client";
import type {
  ResetWorkspaceRequest,
  ResetWorkspaceResponse,
  SettingsProfileMutationResponse,
  SettingsProfileResponse,
  UpdateSettingsProfileRequest,
} from "@life-os/contracts";
import { z } from "zod";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { resolveDisplayTimezone } from "../../lib/time/user-time.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import { parseTimezoneCandidate, timezoneSchema } from "../../lib/validation/timezone.js";
import {
  mergeNotificationPreferences,
  normalizeNotificationPreferences,
} from "../notifications/policy.js";
import { resetWorkspaceData } from "./workspace-reset.js";

const reviewTimeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/)
  .nullable();

const intlWithSupportedValues = Intl as typeof Intl & {
  supportedValuesOf?: (kind: "currency") => string[];
};

const supportedCurrencyCodes = new Set(
  intlWithSupportedValues.supportedValuesOf?.("currency") ?? [],
);

const CLIENT_TIMEZONE_HEADER = "x-client-timezone";
const landingPageSchema = z.enum(["home", "today", "planner", "meals"]);

const notificationPreferenceUpdateSchema = z
  .object({
    enabled: z.boolean().optional(),
    minSeverity: z.enum(["info", "warning", "critical"]).optional(),
    repeatCadence: z.enum(["off", "hourly", "every_3_hours"]).optional(),
  })
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

function getRequestTimezone(request: { headers: Record<string, unknown> }) {
  const headerValue = request.headers[CLIENT_TIMEZONE_HEADER];
  const candidate = Array.isArray(headerValue) ? headerValue[0] : headerValue;

  return parseTimezoneCandidate(candidate);
}

const updateSettingsProfileSchema = z
  .object({
    displayName: z.string().min(1).max(200).nullable().optional(),
    timezone: timezoneSchema.optional(),
    currencyCode: z
      .string()
      .length(3)
      .transform((value) => value.toUpperCase())
      .refine((value) => supportedCurrencyCodes.has(value), "Invalid currency code")
      .optional(),
    weekStartsOn: z.number().int().min(0).max(6).optional(),
    dailyWaterTargetMl: z.number().int().positive().max(20000).optional(),
    dailyReviewStartTime: reviewTimeSchema.optional(),
    dailyReviewEndTime: reviewTimeSchema.optional(),
    defaultLandingPage: landingPageSchema.optional(),
    notificationPreferences: notificationPreferencesUpdateSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

const resetWorkspaceSchema = z.object({
  confirmationText: z
    .string()
    .trim()
    .refine((value) => value === "RESET", "Type RESET to confirm workspace reset"),
});

function toSettingsProfileResponse(input: {
  user: {
    id: string;
    email: string;
    displayName: string | null;
  };
  preferences: {
    timezone: string | null;
    currencyCode: string | null;
    weekStartsOn: number | null;
    dailyWaterTargetMl: number | null;
    dailyReviewStartTime: string | null;
    dailyReviewEndTime: string | null;
    defaultLandingPage: string | null;
    notificationPreferences: unknown;
  } | null;
  fallbackTimezone?: string | null;
}): SettingsProfileResponse {
  return withGeneratedAt({
    user: input.user,
    preferences: {
      timezone: resolveDisplayTimezone(input.preferences?.timezone, input.fallbackTimezone),
      currencyCode: input.preferences?.currencyCode ?? "USD",
      weekStartsOn: input.preferences?.weekStartsOn ?? 1,
      dailyWaterTargetMl: input.preferences?.dailyWaterTargetMl ?? 2500,
      dailyReviewStartTime: input.preferences?.dailyReviewStartTime ?? null,
      dailyReviewEndTime: input.preferences?.dailyReviewEndTime ?? null,
      defaultLandingPage: landingPageSchema.catch("home").parse(input.preferences?.defaultLandingPage),
      notificationPreferences: normalizeNotificationPreferences(
        input.preferences?.notificationPreferences,
      ),
    },
  });
}

export const registerSettingsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/profile", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const fallbackTimezone = getRequestTimezone(request);

    const [userRecord, preferences] = await Promise.all([
      app.prisma.user.findUniqueOrThrow({
        where: {
          id: user.id,
        },
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      }),
      app.prisma.userPreference.findUnique({
        where: {
          userId: user.id,
        },
        select: {
          timezone: true,
          currencyCode: true,
          weekStartsOn: true,
          dailyWaterTargetMl: true,
          dailyReviewStartTime: true,
          dailyReviewEndTime: true,
          defaultLandingPage: true,
          notificationPreferences: true,
        },
      }),
    ]);

    return reply.send(
      toSettingsProfileResponse({
        user: userRecord,
        preferences,
        fallbackTimezone,
      }),
    );
  });

  app.put("/profile", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(updateSettingsProfileSchema, request.body as UpdateSettingsProfileRequest);
    const fallbackTimezone = getRequestTimezone(request);

    const { updatedUser, updatedPreferences } = await app.prisma.$transaction(async (tx) => {
      const currentPreferences = await tx.userPreference.findUnique({
        where: {
          userId: user.id,
        },
        select: {
          notificationPreferences: true,
          defaultLandingPage: true,
        },
      });
      const nextUser = await tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          displayName: payload.displayName,
        },
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      });
      const nextPreferences = await tx.userPreference.upsert({
        where: {
          userId: user.id,
        },
        create: {
          userId: user.id,
          timezone: payload.timezone ?? fallbackTimezone ?? "UTC",
          currencyCode: payload.currencyCode ?? "USD",
          weekStartsOn: payload.weekStartsOn ?? 1,
          dailyWaterTargetMl: payload.dailyWaterTargetMl ?? 2500,
          dailyReviewStartTime: payload.dailyReviewStartTime ?? null,
          dailyReviewEndTime: payload.dailyReviewEndTime ?? null,
          defaultLandingPage: payload.defaultLandingPage ?? "home",
          notificationPreferences: mergeNotificationPreferences(
            currentPreferences?.notificationPreferences,
            payload.notificationPreferences,
          ) as unknown as Prisma.InputJsonValue,
        },
        update: {
          timezone: payload.timezone,
          currencyCode: payload.currencyCode,
          weekStartsOn: payload.weekStartsOn,
          dailyWaterTargetMl: payload.dailyWaterTargetMl,
          dailyReviewStartTime: payload.dailyReviewStartTime,
          dailyReviewEndTime: payload.dailyReviewEndTime,
          defaultLandingPage: payload.defaultLandingPage,
          notificationPreferences: payload.notificationPreferences
            ? mergeNotificationPreferences(
                currentPreferences?.notificationPreferences,
                payload.notificationPreferences,
              ) as unknown as Prisma.InputJsonValue
            : undefined,
        },
        select: {
          timezone: true,
          currencyCode: true,
          weekStartsOn: true,
          dailyWaterTargetMl: true,
          dailyReviewStartTime: true,
          dailyReviewEndTime: true,
          defaultLandingPage: true,
          notificationPreferences: true,
        },
      });

      return {
        updatedUser: nextUser,
        updatedPreferences: nextPreferences,
      };
    });

    const response: SettingsProfileMutationResponse = withGeneratedAt({
      user: updatedUser,
      preferences: {
        timezone: updatedPreferences.timezone,
        currencyCode: updatedPreferences.currencyCode,
        weekStartsOn: updatedPreferences.weekStartsOn,
        dailyWaterTargetMl: updatedPreferences.dailyWaterTargetMl,
        dailyReviewStartTime: updatedPreferences.dailyReviewStartTime,
        dailyReviewEndTime: updatedPreferences.dailyReviewEndTime,
        defaultLandingPage: landingPageSchema.catch("home").parse(updatedPreferences.defaultLandingPage),
        notificationPreferences: normalizeNotificationPreferences(
          updatedPreferences.notificationPreferences,
        ),
      },
    });

    return reply.send(response);
  });

  app.post("/reset-workspace", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    parseOrThrow(
      resetWorkspaceSchema,
      request.body as ResetWorkspaceRequest,
    );
    const resetAt = new Date().toISOString();

    await app.prisma.$transaction(async (tx) => {
      await resetWorkspaceData(tx, {
        userId: user.id,
        resetAt,
      });
    });

    const response: ResetWorkspaceResponse = withGeneratedAt({
      success: true,
      resetAt,
    });

    return reply.send(response);
  });
};
