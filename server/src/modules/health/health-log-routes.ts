import type { FastifyPluginAsync } from "fastify";
import type {
  CreateMealLogRequest,
  CreateWaterLogRequest,
  CreateWeightLogRequest,
  DeleteMealLogResponse,
  DeleteWaterLogResponse,
  DeleteWeightLogResponse,
  IsoDateString,
  MealLogMutationResponse,
  MealLogsResponse,
  UpdateMealLogRequest,
  UpdateWaterLogRequest,
  UpdateWeightLogRequest,
  UpdateWorkoutDayRequest,
  WaterLogMutationResponse,
  WaterLogsResponse,
  WeightLogMutationResponse,
  WorkoutDayMutationResponse,
} from "@life-os/contracts";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { AppError } from "../../lib/errors/app-error.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { parseIsoDate } from "../../lib/time/cycle.js";
import { getDayWindowUtc, getUserLocalDate } from "../../lib/time/user-time.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import {
  createMealLogSchema,
  createWaterLogSchema,
  createWeightLogSchema,
  healthLogByDateQuerySchema,
  healthLogIsoDateSchema,
  updateMealLogSchema,
  updateWaterLogSchema,
  updateWeightLogSchema,
  updateWorkoutDaySchema,
} from "./health-log-schemas.js";
import {
  fromPrismaMealSlot,
  serializeMealLog,
  serializeWaterLog,
  serializeWeightLog,
  serializeWorkoutDay,
  toPrismaMealLoggingQuality,
  toPrismaMealSlot,
  toPrismaWaterLogSource,
  toPrismaWorkoutActualStatus,
  toPrismaWorkoutPlanType,
} from "./health-mappers.js";

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

async function findOwnedMealPlanEntry(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  mealPlanEntryId: string | null | undefined,
) {
  if (!mealPlanEntryId) {
    return null;
  }

  const mealPlanEntry = await app.prisma.mealPlanEntry.findFirst({
    where: {
      id: mealPlanEntryId,
      mealPlanWeek: {
        userId,
      },
    },
  });

  if (!mealPlanEntry) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Planned meal not found",
    });
  }

  return mealPlanEntry;
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

export const registerHealthLogRoutes: FastifyPluginAsync = async (app) => {
  app.get("/water-logs", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(healthLogByDateQuerySchema, request.query);
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

  app.get("/meal-logs", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(healthLogByDateQuerySchema, request.query);
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
    const [mealPlanEntry] = await Promise.all([
      findOwnedMealPlanEntry(app, user.id, payload.mealPlanEntryId),
      assertOwnedMealTemplate(app, user.id, payload.mealTemplateId),
    ]);

    if (mealPlanEntry && payload.mealTemplateId && payload.mealTemplateId !== mealPlanEntry.mealTemplateId) {
      throw new AppError({
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Planned meal template does not match the selected template",
      });
    }

    const mealLog = await app.prisma.mealLog.create({
      data: {
        userId: user.id,
        occurredAt: payload.occurredAt ? new Date(payload.occurredAt) : new Date(),
        mealSlot: toPrismaMealSlot(payload.mealSlot ?? fromPrismaMealSlot(mealPlanEntry?.mealSlot ?? null) ?? undefined),
        mealTemplateId: payload.mealTemplateId ?? mealPlanEntry?.mealTemplateId ?? null,
        mealPlanEntryId: payload.mealPlanEntryId ?? null,
        description: payload.description.trim(),
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

    const [existingMealLog, , mealPlanEntry] = await Promise.all([
      findOwnedMealLog(app, user.id, mealLogId),
      assertOwnedMealTemplate(app, user.id, payload.mealTemplateId),
      findOwnedMealPlanEntry(app, user.id, payload.mealPlanEntryId),
    ]);

    const effectiveMealTemplateId = payload.mealTemplateId !== undefined
      ? payload.mealTemplateId
      : mealPlanEntry
        ? mealPlanEntry.mealTemplateId
        : undefined;

    if (mealPlanEntry && effectiveMealTemplateId && effectiveMealTemplateId !== mealPlanEntry.mealTemplateId) {
      throw new AppError({
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Planned meal template does not match the selected template",
      });
    }

    const mealLog = await app.prisma.mealLog.update({
      where: {
        id: mealLogId,
      },
      data: {
        occurredAt: payload.occurredAt ? new Date(payload.occurredAt) : undefined,
        mealSlot: payload.mealSlot === undefined
          ? mealPlanEntry
            ? mealPlanEntry.mealSlot
            : undefined
          : toPrismaMealSlot(payload.mealSlot),
        mealTemplateId: effectiveMealTemplateId,
        mealPlanEntryId: payload.mealPlanEntryId === undefined
          ? undefined
          : payload.mealPlanEntryId,
        description: payload.description?.trim() ?? existingMealLog.description,
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
    const targetDate = parseIsoDate(parseOrThrow(healthLogIsoDateSchema, date));
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
