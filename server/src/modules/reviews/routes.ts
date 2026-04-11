import type { FastifyPluginAsync } from "fastify";
import type { IsoDateString, ReviewHistoryCadenceFilter, ReviewHistoryRange } from "@life-os/contracts";
import { z } from "zod";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { parseIsoDate } from "../../lib/time/cycle.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import {
  getDailyReviewModel,
  getReviewHistory,
  getMonthlyReviewModel,
  getWeeklyReviewModel,
  submitDailyReview,
  submitMonthlyReview,
  submitWeeklyReview,
} from "./service.js";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/) as unknown as z.ZodType<IsoDateString>;
const reviewHistoryQuerySchema = z.object({
  cadence: z.enum(["all", "daily", "weekly", "monthly"]).optional() as z.ZodType<ReviewHistoryCadenceFilter | undefined>,
  range: z.enum(["30d", "90d", "365d", "all"]).optional() as z.ZodType<ReviewHistoryRange | undefined>,
  q: z.string().trim().max(200).optional(),
  cursor: z.string().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
const priorityInputSchema = z.object({
  slot: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  title: z.string().min(1).max(200),
  goalId: z.string().uuid().nullable().optional(),
});

const dailyPriorityInputSchema = z.object({
  slot: z.union([z.literal(1), z.literal(2)]),
  title: z.string().min(1).max(200),
  goalId: z.string().uuid().nullable().optional(),
});

const dailyReviewSchema = z.object({
  biggestWin: z.string().min(1).max(500),
  frictionTag: z.enum([
    "low energy",
    "poor planning",
    "distraction",
    "interruptions",
    "overcommitment",
    "avoidance",
    "unclear task",
    "travel or schedule disruption",
  ]),
  frictionNote: z.string().max(2000).nullable().optional(),
  energyRating: z.number().int().min(1).max(5),
  optionalNote: z.string().max(4000).nullable().optional(),
  carryForwardTaskIds: z.array(z.string().uuid()),
  droppedTaskIds: z.array(z.string().uuid()),
  rescheduledTasks: z.array(
    z.object({
      taskId: z.string().uuid(),
      targetDate: isoDateSchema,
    }),
  ),
  tomorrowPriorities: z.array(dailyPriorityInputSchema).max(2),
});

const weeklyReviewSchema = z.object({
  biggestWin: z.string().min(1).max(500),
  biggestMiss: z.string().min(1).max(500),
  mainLesson: z.string().min(1).max(500),
  keepText: z.string().min(1).max(500),
  improveText: z.string().min(1).max(500),
  nextWeekPriorities: z.array(priorityInputSchema).length(3),
  focusHabitId: z.string().uuid().nullable().optional(),
  healthTargetText: z.string().max(500).nullable().optional(),
  spendingWatchCategoryId: z.string().uuid().nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
});

const monthlyReviewSchema = z.object({
  monthVerdict: z.string().min(1).max(500),
  biggestWin: z.string().min(1).max(500),
  biggestLeak: z.string().min(1).max(500),
  ratings: z.record(z.string(), z.number().int().min(1).max(5)),
  nextMonthTheme: z.string().min(1).max(200),
  nextMonthOutcomes: z.array(priorityInputSchema).length(3),
  habitChanges: z.array(z.string().min(1).max(200)).min(1),
  simplifyText: z.string().min(1).max(500),
  notes: z.string().max(4000).nullable().optional(),
});

export const registerReviewRoutes: FastifyPluginAsync = async (app) => {
  app.get("/reviews/history", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(reviewHistoryQuerySchema, request.query ?? {});
    const response = await getReviewHistory(app.prisma, user.id, {
      cadence: query.cadence,
      range: query.range,
      q: query.q,
      cursor: query.cursor,
      limit: query.limit,
    });

    return reply.send(response);
  });

  app.get("/reviews/daily/:date", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { date } = request.params as { date: IsoDateString };
    const parsedDate = parseOrThrow(isoDateSchema, date);
    const response = await getDailyReviewModel(app.prisma, user.id, parseIsoDate(parsedDate));

    return reply.send(response);
  });

  app.post("/reviews/daily/:date", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { date } = request.params as { date: IsoDateString };
    const parsedDate = parseOrThrow(isoDateSchema, date);
    const payload = parseOrThrow(dailyReviewSchema, request.body);
    const response = await submitDailyReview(app.prisma, user.id, parseIsoDate(parsedDate), payload);

    return reply.send(response);
  });

  app.get("/reviews/weekly/:startDate", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { startDate } = request.params as { startDate: IsoDateString };
    const parsedDate = parseOrThrow(isoDateSchema, startDate);
    const response = await getWeeklyReviewModel(app.prisma, user.id, parseIsoDate(parsedDate));

    return reply.send(response);
  });

  app.post("/reviews/weekly/:startDate", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { startDate } = request.params as { startDate: IsoDateString };
    const parsedDate = parseOrThrow(isoDateSchema, startDate);
    const payload = parseOrThrow(weeklyReviewSchema, request.body);
    const response = await submitWeeklyReview(app.prisma, user.id, parseIsoDate(parsedDate), payload);

    return reply.send(response);
  });

  app.get("/reviews/monthly/:startDate", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { startDate } = request.params as { startDate: IsoDateString };
    const parsedDate = parseOrThrow(isoDateSchema, startDate);
    const response = await getMonthlyReviewModel(app.prisma, user.id, parseIsoDate(parsedDate));

    return reply.send(response);
  });

  app.post("/reviews/monthly/:startDate", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { startDate } = request.params as { startDate: IsoDateString };
    const parsedDate = parseOrThrow(isoDateSchema, startDate);
    const payload = parseOrThrow(monthlyReviewSchema, request.body);
    const response = await submitMonthlyReview(app.prisma, user.id, parseIsoDate(parsedDate), payload);

    return reply.send(response);
  });
};
