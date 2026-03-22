import type { FastifyPluginAsync } from "fastify";
import type { Prisma } from "@prisma/client";
import type {
  SettingsProfileMutationResponse,
  SettingsProfileResponse,
  UpdateSettingsProfileRequest,
} from "@life-os/contracts";
import { z } from "zod";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import {
  mergeNotificationPreferences,
  normalizeNotificationPreferences,
} from "../notifications/policy.js";

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

function isValidTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const updateSettingsProfileSchema = z
  .object({
    displayName: z.string().min(1).max(200).nullable().optional(),
    timezone: z
      .string()
      .min(1)
      .max(120)
      .refine(isValidTimezone, "Invalid timezone")
      .optional(),
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
    notificationPreferences: notificationPreferencesUpdateSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

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
    notificationPreferences: unknown;
  } | null;
}): SettingsProfileResponse {
  return withGeneratedAt({
    user: input.user,
    preferences: {
      timezone: input.preferences?.timezone ?? "UTC",
      currencyCode: input.preferences?.currencyCode ?? "USD",
      weekStartsOn: input.preferences?.weekStartsOn ?? 1,
      dailyWaterTargetMl: input.preferences?.dailyWaterTargetMl ?? 2500,
      dailyReviewStartTime: input.preferences?.dailyReviewStartTime ?? null,
      dailyReviewEndTime: input.preferences?.dailyReviewEndTime ?? null,
      notificationPreferences: normalizeNotificationPreferences(
        input.preferences?.notificationPreferences,
      ),
    },
  });
}

export const registerSettingsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/profile", async (request, reply) => {
    const user = requireAuthenticatedUser(request);

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
          notificationPreferences: true,
        },
      }),
    ]);

    return reply.send(
      toSettingsProfileResponse({
        user: userRecord,
        preferences,
      }),
    );
  });

  app.put("/profile", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(updateSettingsProfileSchema, request.body as UpdateSettingsProfileRequest);

    const { updatedUser, updatedPreferences } = await app.prisma.$transaction(async (tx) => {
      const currentPreferences = await tx.userPreference.findUnique({
        where: {
          userId: user.id,
        },
        select: {
          notificationPreferences: true,
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
          timezone: payload.timezone ?? "UTC",
          currencyCode: payload.currencyCode ?? "USD",
          weekStartsOn: payload.weekStartsOn ?? 1,
          dailyWaterTargetMl: payload.dailyWaterTargetMl ?? 2500,
          dailyReviewStartTime: payload.dailyReviewStartTime ?? null,
          dailyReviewEndTime: payload.dailyReviewEndTime ?? null,
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
        notificationPreferences: normalizeNotificationPreferences(
          updatedPreferences.notificationPreferences,
        ),
      },
    });

    return reply.send(response);
  });
};
