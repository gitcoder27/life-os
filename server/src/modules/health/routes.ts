import type { FastifyPluginAsync } from "fastify";
import type {
  CreateMealTemplateRequest,
  CreateMealLogRequest,
  CreateWaterLogRequest,
  CreateWeightLogRequest,
  DeleteMealLogResponse,
  DeleteWaterLogResponse,
  DeleteWeightLogResponse,
  HealthSummaryResponse,
  IsoDateString,
  MealLogItem,
  MealLogsResponse,
  MealLogMutationResponse,
  MealLoggingQuality,
  MealTemplateMutationResponse,
  MealTemplateItem,
  MealTemplatesResponse,
  MealSlot,
  UpdateMealLogRequest,
  UpdateMealTemplateRequest,
  UpdateWaterLogRequest,
  UpdateWeightLogRequest,
  UpdateWorkoutDayRequest,
  WaterLogItem,
  WaterLogsResponse,
  WaterLogMutationResponse,
  WaterLogSource,
  WeightLogItem,
  WeightLogMutationResponse,
  WorkoutActualStatus,
  WorkoutDayItem,
  WorkoutDayMutationResponse,
  WorkoutPlanType,
} from "@life-os/contracts";
import type {
  MealLog,
  MealLoggingQuality as PrismaMealLoggingQuality,
  MealSlot as PrismaMealSlot,
  WaterLog,
  WaterLogSource as PrismaWaterLogSource,
  WeightLog,
  WorkoutActualStatus as PrismaWorkoutActualStatus,
  WorkoutDay,
  WorkoutPlanType as PrismaWorkoutPlanType,
} from "@prisma/client";
import { z } from "zod";

import { AppError } from "../../lib/errors/app-error.js";
import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { parseIsoDate } from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import {
  getDateRangeWindowUtc,
  getDayWindowUtc,
  getUserLocalDate,
  getUserLocalHour,
} from "../../lib/time/user-time.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import { buildHealthSummaryEnhancements } from "./summary-builder.js";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/) as unknown as z.ZodType<IsoDateString>;
const isoDateTimeSchema = z.string().datetime({ offset: true });
const waterLogSourceSchema = z.enum(["tap", "quick_capture", "manual"]);
const mealSlotSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);
const mealLoggingQualitySchema = z.enum(["partial", "meaningful", "full"]);
const workoutPlanTypeSchema = z.enum(["workout", "recovery", "none"]);
const workoutActualStatusSchema = z.enum([
  "completed",
  "recovery_respected",
  "fallback",
  "missed",
  "none",
]);

const healthSummaryQuerySchema = z.object({
  from: isoDateSchema,
  to: isoDateSchema,
});

const byDateQuerySchema = z.object({
  date: isoDateSchema,
});

const createWaterLogSchema = z.object({
  occurredAt: isoDateTimeSchema.optional(),
  amountMl: z.number().int().positive().max(10000),
  source: waterLogSourceSchema.optional(),
});

const updateWaterLogSchema = z
  .object({
    occurredAt: isoDateTimeSchema.optional(),
    amountMl: z.number().int().positive().max(10000).optional(),
    source: waterLogSourceSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

const createMealLogSchema = z.object({
  occurredAt: isoDateTimeSchema.optional(),
  mealSlot: mealSlotSchema.nullable().optional(),
  mealTemplateId: z.string().uuid().nullable().optional(),
  description: z.string().min(1).max(4000),
  loggingQuality: mealLoggingQualitySchema,
});

const updateMealLogSchema = z
  .object({
    occurredAt: isoDateTimeSchema.optional(),
    mealSlot: mealSlotSchema.nullable().optional(),
    mealTemplateId: z.string().uuid().nullable().optional(),
    description: z.string().min(1).max(4000).optional(),
    loggingQuality: mealLoggingQualitySchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

const createMealTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  mealSlot: mealSlotSchema.nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
});

const updateMealTemplateSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    mealSlot: mealSlotSchema.nullable().optional(),
    description: z.string().max(4000).nullable().optional(),
    archived: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

const updateWorkoutDaySchema = z
  .object({
    planType: workoutPlanTypeSchema.optional(),
    plannedLabel: z.string().max(200).nullable().optional(),
    actualStatus: workoutActualStatusSchema.optional(),
    note: z.string().max(4000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

const createWeightLogSchema = z.object({
  measuredOn: isoDateSchema.optional(),
  weightValue: z.number().positive().max(1000),
  unit: z.string().min(1).max(16).optional(),
  note: z.string().max(4000).nullable().optional(),
});

const updateWeightLogSchema = z
  .object({
    measuredOn: isoDateSchema.optional(),
    weightValue: z.number().positive().max(1000).optional(),
    unit: z.string().min(1).max(16).optional(),
    note: z.string().max(4000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

async function getTodayIsoDate(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
) {
  const preferences = await app.prisma.userPreference.findUnique({
    where: {
      userId,
    },
    select: {
      timezone: true,
    },
  });

  return getUserLocalDate(new Date(), preferences?.timezone);
}

function toPrismaWaterLogSource(source: WaterLogSource): PrismaWaterLogSource {
  switch (source) {
    case "tap":
      return "TAP";
    case "quick_capture":
      return "QUICK_CAPTURE";
    case "manual":
      return "MANUAL";
  }
}

function fromPrismaWaterLogSource(source: PrismaWaterLogSource): WaterLogSource {
  switch (source) {
    case "TAP":
      return "tap";
    case "QUICK_CAPTURE":
      return "quick_capture";
    case "MANUAL":
      return "manual";
  }
}

function toPrismaMealSlot(slot: MealSlot | null | undefined): PrismaMealSlot | null | undefined {
  if (slot === undefined) {
    return undefined;
  }
  if (slot === null) {
    return null;
  }

  switch (slot) {
    case "breakfast":
      return "BREAKFAST";
    case "lunch":
      return "LUNCH";
    case "dinner":
      return "DINNER";
    case "snack":
      return "SNACK";
  }
}

function fromPrismaMealSlot(slot: PrismaMealSlot | null): MealSlot | null {
  switch (slot) {
    case "BREAKFAST":
      return "breakfast";
    case "LUNCH":
      return "lunch";
    case "DINNER":
      return "dinner";
    case "SNACK":
      return "snack";
    case null:
      return null;
  }
}

function toPrismaMealLoggingQuality(
  quality: MealLoggingQuality,
): PrismaMealLoggingQuality {
  switch (quality) {
    case "partial":
      return "PARTIAL";
    case "meaningful":
      return "MEANINGFUL";
    case "full":
      return "FULL";
  }
}

function fromPrismaMealLoggingQuality(
  quality: PrismaMealLoggingQuality,
): MealLoggingQuality {
  switch (quality) {
    case "PARTIAL":
      return "partial";
    case "MEANINGFUL":
      return "meaningful";
    case "FULL":
      return "full";
  }
}

function toPrismaWorkoutPlanType(type: WorkoutPlanType): PrismaWorkoutPlanType {
  switch (type) {
    case "workout":
      return "WORKOUT";
    case "recovery":
      return "RECOVERY";
    case "none":
      return "NONE";
  }
}

function fromPrismaWorkoutPlanType(type: PrismaWorkoutPlanType): WorkoutPlanType {
  switch (type) {
    case "WORKOUT":
      return "workout";
    case "RECOVERY":
      return "recovery";
    case "NONE":
      return "none";
  }
}

function toPrismaWorkoutActualStatus(status: WorkoutActualStatus): PrismaWorkoutActualStatus {
  switch (status) {
    case "completed":
      return "COMPLETED";
    case "recovery_respected":
      return "RECOVERY_RESPECTED";
    case "fallback":
      return "FALLBACK";
    case "missed":
      return "MISSED";
    case "none":
      return "NONE";
  }
}

function fromPrismaWorkoutActualStatus(status: PrismaWorkoutActualStatus): WorkoutActualStatus {
  switch (status) {
    case "COMPLETED":
      return "completed";
    case "RECOVERY_RESPECTED":
      return "recovery_respected";
    case "FALLBACK":
      return "fallback";
    case "MISSED":
      return "missed";
    case "NONE":
      return "none";
  }
}

function serializeWaterLog(waterLog: WaterLog): WaterLogItem {
  return {
    id: waterLog.id,
    occurredAt: waterLog.occurredAt.toISOString(),
    amountMl: waterLog.amountMl,
    source: fromPrismaWaterLogSource(waterLog.source),
    createdAt: waterLog.createdAt.toISOString(),
  };
}

function serializeMealLog(mealLog: MealLog): MealLogItem {
  return {
    id: mealLog.id,
    occurredAt: mealLog.occurredAt.toISOString(),
    mealSlot: fromPrismaMealSlot(mealLog.mealSlot),
    mealTemplateId: mealLog.mealTemplateId,
    description: mealLog.description,
    loggingQuality: fromPrismaMealLoggingQuality(mealLog.loggingQuality),
    createdAt: mealLog.createdAt.toISOString(),
  };
}

function serializeMealTemplate(mealTemplate: {
  id: string;
  name: string;
  mealSlot: PrismaMealSlot | null;
  templatePayloadJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}): MealTemplateItem {
  const description =
    mealTemplate.templatePayloadJson &&
    typeof mealTemplate.templatePayloadJson === "object" &&
    !Array.isArray(mealTemplate.templatePayloadJson) &&
    "description" in mealTemplate.templatePayloadJson &&
    typeof mealTemplate.templatePayloadJson.description === "string"
      ? mealTemplate.templatePayloadJson.description
      : null;

  return {
    id: mealTemplate.id,
    name: mealTemplate.name,
    mealSlot: fromPrismaMealSlot(mealTemplate.mealSlot),
    description,
    createdAt: mealTemplate.createdAt.toISOString(),
    updatedAt: mealTemplate.updatedAt.toISOString(),
  };
}

function serializeWorkoutDay(workoutDay: WorkoutDay): WorkoutDayItem {
  return {
    id: workoutDay.id,
    date: toIsoDateString(workoutDay.date),
    planType: fromPrismaWorkoutPlanType(workoutDay.planType),
    plannedLabel: workoutDay.plannedLabel,
    actualStatus: fromPrismaWorkoutActualStatus(workoutDay.actualStatus),
    note: workoutDay.note,
    updatedAt: workoutDay.updatedAt.toISOString(),
  };
}

function serializeWeightLog(weightLog: WeightLog): WeightLogItem {
  return {
    id: weightLog.id,
    measuredOn: toIsoDateString(weightLog.measuredOn),
    weightValue: Number(weightLog.weightValue),
    unit: weightLog.unit,
    note: weightLog.note,
    createdAt: weightLog.createdAt.toISOString(),
  };
}

async function assertOwnedMealTemplate(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  mealTemplateId: string | null | undefined,
) {
  if (!mealTemplateId) {
    return;
  }

  const mealTemplate = await app.prisma.mealTemplate.findFirst({
    where: {
      id: mealTemplateId,
      userId,
      archivedAt: null,
    },
  });

  if (!mealTemplate) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Meal template not found",
    });
  }
}

async function findOwnedMealTemplate(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  mealTemplateId: string,
) {
  const mealTemplate = await app.prisma.mealTemplate.findFirst({
    where: {
      id: mealTemplateId,
      userId,
    },
  });

  if (!mealTemplate) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Meal template not found",
    });
  }

  return mealTemplate;
}

async function findOwnedWaterLog(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  waterLogId: string,
) {
  const waterLog = await app.prisma.waterLog.findFirst({
    where: {
      id: waterLogId,
      userId,
    },
  });

  if (!waterLog) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Water log not found",
    });
  }

  return waterLog;
}

async function findOwnedMealLog(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  mealLogId: string,
) {
  const mealLog = await app.prisma.mealLog.findFirst({
    where: {
      id: mealLogId,
      userId,
    },
  });

  if (!mealLog) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Meal log not found",
    });
  }

  return mealLog;
}

async function findOwnedWeightLog(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  weightLogId: string,
) {
  const weightLog = await app.prisma.weightLog.findFirst({
    where: {
      id: weightLogId,
      userId,
    },
  });

  if (!weightLog) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Weight log not found",
    });
  }

  return weightLog;
}

export const registerHealthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/water-logs", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(byDateQuerySchema, request.query);
    const preferences = await app.prisma.userPreference.findUnique({
      where: {
        userId: user.id,
      },
      select: {
        timezone: true,
      },
    });
    const dayWindow = getDayWindowUtc(query.date, preferences?.timezone);
    const waterLogs = await app.prisma.waterLog.findMany({
      where: {
        userId: user.id,
        occurredAt: {
          gte: dayWindow.start,
          lt: dayWindow.end,
        },
      },
      orderBy: {
        occurredAt: "asc",
      },
    });

    const response: WaterLogsResponse = withGeneratedAt({
      date: query.date,
      waterLogs: waterLogs.map(serializeWaterLog),
    });

    return reply.send(response);
  });

  app.get("/meal-templates", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const mealTemplates = await app.prisma.mealTemplate.findMany({
      where: {
        userId: user.id,
        archivedAt: null,
      },
      orderBy: [{ mealSlot: "asc" }, { name: "asc" }],
    });

    const response: MealTemplatesResponse = withGeneratedAt({
      mealTemplates: mealTemplates.map(serializeMealTemplate),
    });

    return reply.send(response);
  });

  app.post("/meal-templates", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(
      createMealTemplateSchema,
      request.body as CreateMealTemplateRequest,
    );
    const mealTemplate = await app.prisma.mealTemplate.create({
      data: {
        userId: user.id,
        name: payload.name,
        mealSlot: toPrismaMealSlot(payload.mealSlot),
        templatePayloadJson: {
          description: payload.description ?? null,
        },
      },
    });

    const response: MealTemplateMutationResponse = withGeneratedAt({
      mealTemplate: serializeMealTemplate(mealTemplate),
    });

    return reply.status(201).send(response);
  });

  app.patch("/meal-templates/:mealTemplateId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { mealTemplateId } = request.params as { mealTemplateId: string };
    const payload = parseOrThrow(
      updateMealTemplateSchema,
      request.body as UpdateMealTemplateRequest,
    );

    const existingTemplate = await findOwnedMealTemplate(app, user.id, mealTemplateId);
    const mealTemplate = await app.prisma.mealTemplate.update({
      where: {
        id: mealTemplateId,
      },
      data: {
        name: payload.name,
        mealSlot: toPrismaMealSlot(payload.mealSlot),
        templatePayloadJson:
          payload.description === undefined
            ? undefined
            : {
                description: payload.description ?? null,
              },
        archivedAt:
          payload.archived === undefined
            ? undefined
            : payload.archived
              ? new Date()
              : null,
      },
    });

    const response: MealTemplateMutationResponse = withGeneratedAt({
      mealTemplate: serializeMealTemplate(mealTemplate),
    });

    return reply.send(response);
  });

  app.get("/meal-logs", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(byDateQuerySchema, request.query);
    const preferences = await app.prisma.userPreference.findUnique({
      where: {
        userId: user.id,
      },
      select: {
        timezone: true,
      },
    });
    const dayWindow = getDayWindowUtc(query.date, preferences?.timezone);
    const mealLogs = await app.prisma.mealLog.findMany({
      where: {
        userId: user.id,
        occurredAt: {
          gte: dayWindow.start,
          lt: dayWindow.end,
        },
      },
      orderBy: {
        occurredAt: "asc",
      },
    });

    const response: MealLogsResponse = withGeneratedAt({
      date: query.date,
      mealLogs: mealLogs.map(serializeMealLog),
    });

    return reply.send(response);
  });

  app.get("/summary", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(healthSummaryQuerySchema, request.query);
    const preferences = await app.prisma.userPreference.findUnique({
      where: {
        userId: user.id,
      },
    });
    const rangeWindow = getDateRangeWindowUtc(query.from, query.to, preferences?.timezone);
    const now = new Date();
    const todayIsoDate = getUserLocalDate(now, preferences?.timezone);
    const currentHour = getUserLocalHour(now, preferences?.timezone);
    const todayDate = parseIsoDate(todayIsoDate);
    const todayWindow = getDayWindowUtc(todayIsoDate, preferences?.timezone);

    const [
      rangeWaterLogs,
      rangeMealLogs,
      workoutDays,
      rangeWeightHistory,
      currentWorkout,
      currentDayWaterLogs,
      currentDayMealLogs,
      latestWeight,
    ] = await Promise.all([
      app.prisma.waterLog.findMany({
        where: {
          userId: user.id,
          occurredAt: {
            gte: rangeWindow.start,
            lt: rangeWindow.end,
          },
        },
        orderBy: {
          occurredAt: "asc",
        },
      }),
      app.prisma.mealLog.findMany({
        where: {
          userId: user.id,
          occurredAt: {
            gte: rangeWindow.start,
            lt: rangeWindow.end,
          },
        },
        orderBy: {
          occurredAt: "desc",
        },
      }),
      app.prisma.workoutDay.findMany({
        where: {
          userId: user.id,
          date: {
            gte: parseIsoDate(query.from),
            lte: parseIsoDate(query.to),
          },
        },
        orderBy: {
          date: "desc",
        },
      }),
      app.prisma.weightLog.findMany({
        where: {
          userId: user.id,
          measuredOn: {
            gte: parseIsoDate(query.from),
            lte: parseIsoDate(query.to),
          },
        },
        orderBy: [{ measuredOn: "desc" }, { createdAt: "desc" }],
      }),
      app.prisma.workoutDay.findUnique({
        where: {
          userId_date: {
            userId: user.id,
            date: todayDate,
          },
        },
      }),
      app.prisma.waterLog.findMany({
        where: {
          userId: user.id,
          occurredAt: {
            gte: todayWindow.start,
            lt: todayWindow.end,
          },
        },
        orderBy: {
          occurredAt: "asc",
        },
      }),
      app.prisma.mealLog.findMany({
        where: {
          userId: user.id,
          occurredAt: {
            gte: todayWindow.start,
            lt: todayWindow.end,
          },
        },
        orderBy: {
          occurredAt: "asc",
        },
      }),
      app.prisma.weightLog.findFirst({
        where: {
          userId: user.id,
        },
        orderBy: [{ measuredOn: "desc" }, { createdAt: "desc" }],
      }),
    ]);

    const currentDayWaterMl = currentDayWaterLogs.reduce(
      (total, waterLog) => total + waterLog.amountMl,
      0,
    );
    const serializedRangeWaterLogs = rangeWaterLogs.map(serializeWaterLog);
    const serializedRangeMealLogs = rangeMealLogs.map(serializeMealLog);
    const serializedWorkoutDays = workoutDays.map(serializeWorkoutDay);
    const serializedRangeWeightHistory = rangeWeightHistory.map(serializeWeightLog);
    const enhancements = buildHealthSummaryEnhancements({
      currentIsoDate: todayIsoDate,
      currentHour,
      timezone: preferences?.timezone,
      waterTargetMl: preferences?.dailyWaterTargetMl ?? 2500,
      currentDayWaterMl,
      currentDayWaterLogs: currentDayWaterLogs.map(serializeWaterLog),
      currentDayMealLogs: currentDayMealLogs.map(serializeMealLog),
      currentWorkout: currentWorkout ? serializeWorkoutDay(currentWorkout) : null,
      latestWeight: latestWeight ? serializeWeightLog(latestWeight) : null,
      rangeWaterLogs: serializedRangeWaterLogs,
      rangeMealLogs: serializedRangeMealLogs,
      rangeWorkoutDays: serializedWorkoutDays,
      rangeWeightHistory: serializedRangeWeightHistory,
    });

    const response: HealthSummaryResponse = withGeneratedAt({
      from: query.from,
      to: query.to,
      currentDay: {
        date: todayIsoDate,
        phase: enhancements.currentDay.phase,
        waterMl: currentDayWaterMl,
        waterTargetMl: preferences?.dailyWaterTargetMl ?? 2500,
        mealCount: currentDayMealLogs.length,
        meaningfulMealCount: currentDayMealLogs.filter(
          (mealLog) => mealLog.loggingQuality === "MEANINGFUL" || mealLog.loggingQuality === "FULL",
        ).length,
        workoutDay: currentWorkout ? serializeWorkoutDay(currentWorkout) : null,
        latestWeight: latestWeight ? serializeWeightLog(latestWeight) : null,
        signals: enhancements.currentDay.signals,
        score: enhancements.currentDay.score,
        timeline: enhancements.currentDay.timeline,
      },
      range: {
        totalWaterMl: rangeWaterLogs.reduce((total, waterLog) => total + waterLog.amountMl, 0),
        totalMealsLogged: rangeMealLogs.length,
        workoutsCompleted: workoutDays.filter(
          (workoutDay) =>
            workoutDay.actualStatus === "COMPLETED" ||
            workoutDay.actualStatus === "RECOVERY_RESPECTED",
        ).length,
        workoutsPlanned: workoutDays.filter((workoutDay) => workoutDay.planType !== "NONE").length,
        insights: enhancements.range.insights,
      },
      guidance: enhancements.guidance,
      mealLogs: serializedRangeMealLogs,
      weightHistory: serializedRangeWeightHistory,
    });

    return reply.send(response);
  });

  app.post("/water-logs", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createWaterLogSchema, request.body as CreateWaterLogRequest);
    const waterLog = await app.prisma.waterLog.create({
      data: {
        userId: user.id,
        occurredAt: payload.occurredAt ? new Date(payload.occurredAt) : new Date(),
        amountMl: payload.amountMl,
        source: toPrismaWaterLogSource(payload.source ?? "tap"),
      },
    });
    const response: WaterLogMutationResponse = withGeneratedAt({
      waterLog: serializeWaterLog(waterLog),
    });

    return reply.status(201).send(response);
  });

  app.patch("/water-logs/:waterLogId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { waterLogId } = request.params as { waterLogId: string };
    const payload = parseOrThrow(updateWaterLogSchema, request.body as UpdateWaterLogRequest);

    await findOwnedWaterLog(app, user.id, waterLogId);

    const waterLog = await app.prisma.waterLog.update({
      where: {
        id: waterLogId,
      },
      data: {
        occurredAt: payload.occurredAt ? new Date(payload.occurredAt) : undefined,
        amountMl: payload.amountMl,
        source: payload.source ? toPrismaWaterLogSource(payload.source) : undefined,
      },
    });
    const response: WaterLogMutationResponse = withGeneratedAt({
      waterLog: serializeWaterLog(waterLog),
    });

    return reply.send(response);
  });

  app.delete("/water-logs/:waterLogId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { waterLogId } = request.params as { waterLogId: string };

    await findOwnedWaterLog(app, user.id, waterLogId);
    await app.prisma.waterLog.delete({
      where: {
        id: waterLogId,
      },
    });

    const response: DeleteWaterLogResponse = withGeneratedAt({
      deleted: true,
      waterLogId,
    });

    return reply.send(response);
  });

  app.post("/meal-logs", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createMealLogSchema, request.body as CreateMealLogRequest);
    await assertOwnedMealTemplate(app, user.id, payload.mealTemplateId);
    const mealLog = await app.prisma.mealLog.create({
      data: {
        userId: user.id,
        occurredAt: payload.occurredAt ? new Date(payload.occurredAt) : new Date(),
        mealSlot: toPrismaMealSlot(payload.mealSlot),
        mealTemplateId: payload.mealTemplateId ?? null,
        description: payload.description,
        loggingQuality: toPrismaMealLoggingQuality(payload.loggingQuality),
      },
    });
    const response: MealLogMutationResponse = withGeneratedAt({
      mealLog: serializeMealLog(mealLog),
    });

    return reply.status(201).send(response);
  });

  app.patch("/meal-logs/:mealLogId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { mealLogId } = request.params as { mealLogId: string };
    const payload = parseOrThrow(updateMealLogSchema, request.body as UpdateMealLogRequest);

    await Promise.all([
      findOwnedMealLog(app, user.id, mealLogId),
      assertOwnedMealTemplate(app, user.id, payload.mealTemplateId),
    ]);

    const mealLog = await app.prisma.mealLog.update({
      where: {
        id: mealLogId,
      },
      data: {
        occurredAt: payload.occurredAt ? new Date(payload.occurredAt) : undefined,
        mealSlot: toPrismaMealSlot(payload.mealSlot),
        mealTemplateId: payload.mealTemplateId,
        description: payload.description,
        loggingQuality: payload.loggingQuality
          ? toPrismaMealLoggingQuality(payload.loggingQuality)
          : undefined,
      },
    });
    const response: MealLogMutationResponse = withGeneratedAt({
      mealLog: serializeMealLog(mealLog),
    });

    return reply.send(response);
  });

  app.delete("/meal-logs/:mealLogId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { mealLogId } = request.params as { mealLogId: string };

    await findOwnedMealLog(app, user.id, mealLogId);
    await app.prisma.mealLog.delete({
      where: {
        id: mealLogId,
      },
    });

    const response: DeleteMealLogResponse = withGeneratedAt({
      deleted: true,
      mealLogId,
    });

    return reply.send(response);
  });

  app.put("/workout-days/:date", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(updateWorkoutDaySchema, request.body as UpdateWorkoutDayRequest);
    const { date } = request.params as { date: IsoDateString };
    const targetDate = parseIsoDate(parseOrThrow(isoDateSchema, date));
    const workoutDay = await app.prisma.workoutDay.upsert({
      where: {
        userId_date: {
          userId: user.id,
          date: targetDate,
        },
      },
      update: {
        planType: payload.planType ? toPrismaWorkoutPlanType(payload.planType) : undefined,
        plannedLabel: payload.plannedLabel,
        actualStatus: payload.actualStatus
          ? toPrismaWorkoutActualStatus(payload.actualStatus)
          : undefined,
        note: payload.note,
      },
      create: {
        userId: user.id,
        date: targetDate,
        planType: payload.planType ? toPrismaWorkoutPlanType(payload.planType) : "NONE",
        plannedLabel: payload.plannedLabel ?? null,
        actualStatus: payload.actualStatus
          ? toPrismaWorkoutActualStatus(payload.actualStatus)
          : "NONE",
        note: payload.note ?? null,
      },
    });
    const response: WorkoutDayMutationResponse = withGeneratedAt({
      workoutDay: serializeWorkoutDay(workoutDay),
    });

    return reply.send(response);
  });

  app.post("/weight-logs", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createWeightLogSchema, request.body as CreateWeightLogRequest);
    const weightLog = await app.prisma.weightLog.create({
      data: {
        userId: user.id,
        measuredOn: payload.measuredOn
          ? parseIsoDate(payload.measuredOn)
          : parseIsoDate(await getTodayIsoDate(app, user.id)),
        weightValue: payload.weightValue,
        unit: payload.unit ?? "kg",
        note: payload.note ?? null,
      },
    });
    const response: WeightLogMutationResponse = withGeneratedAt({
      weightLog: serializeWeightLog(weightLog),
    });

    return reply.status(201).send(response);
  });

  app.patch("/weight-logs/:weightLogId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { weightLogId } = request.params as { weightLogId: string };
    const payload = parseOrThrow(updateWeightLogSchema, request.body as UpdateWeightLogRequest);

    await findOwnedWeightLog(app, user.id, weightLogId);

    const weightLog = await app.prisma.weightLog.update({
      where: {
        id: weightLogId,
      },
      data: {
        measuredOn: payload.measuredOn ? parseIsoDate(payload.measuredOn) : undefined,
        weightValue: payload.weightValue,
        unit: payload.unit,
        note: payload.note,
      },
    });
    const response: WeightLogMutationResponse = withGeneratedAt({
      weightLog: serializeWeightLog(weightLog),
    });

    return reply.send(response);
  });

  app.delete("/weight-logs/:weightLogId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { weightLogId } = request.params as { weightLogId: string };

    await findOwnedWeightLog(app, user.id, weightLogId);
    await app.prisma.weightLog.delete({
      where: {
        id: weightLogId,
      },
    });

    const response: DeleteWeightLogResponse = withGeneratedAt({
      deleted: true,
      weightLogId,
    });

    return reply.send(response);
  });
};
