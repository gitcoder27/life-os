import type { FastifyPluginAsync } from "fastify";
import type { HealthSummaryResponse } from "@life-os/contracts";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { parseIsoDate } from "../../lib/time/cycle.js";
import {
  getDateRangeWindowUtc,
  getDayWindowUtc,
  getUserLocalDate,
  getUserLocalHour,
} from "../../lib/time/user-time.js";
import { createIsoDateRangeQuerySchema } from "../../lib/validation/date-range.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import { getTodayPlannedMeals } from "./health-meal-plan-service.js";
import {
  serializeMealLog,
  serializeWaterLog,
  serializeWeightLog,
  serializeWorkoutDay,
} from "./health-mappers.js";
import { buildHealthSummaryEnhancements } from "./summary-builder.js";

const healthSummaryQuerySchema = createIsoDateRangeQuerySchema({ maxDays: 93 });

export const registerHealthSummaryRoutes: FastifyPluginAsync = async (app) => {
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
      todayPlannedMeals,
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
      getTodayPlannedMeals(app, user.id, todayIsoDate, preferences?.weekStartsOn ?? 1),
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
        plannedMeals: todayPlannedMeals,
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
};
