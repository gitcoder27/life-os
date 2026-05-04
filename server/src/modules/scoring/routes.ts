import type { FastifyPluginAsync } from "fastify";
import type { IsoDateString } from "@life-os/contracts";
import { z } from "zod";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { parseIsoDate } from "../../lib/time/cycle.js";
import { isoDateStringSchema } from "../../lib/validation/date-range.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import { calculateDailyScore, getScoreHistory, getWeeklyMomentum } from "./service.js";

const isoDateSchema = isoDateStringSchema as z.ZodType<IsoDateString>;

export const registerScoringRoutes: FastifyPluginAsync = async (app) => {
  app.get("/scores/daily/:date", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { date } = request.params as { date: IsoDateString };
    const querySchema = z.object({
      mode: z.enum(["stored", "live"]).optional(),
    });
    const parsedDate = parseOrThrow(isoDateSchema, date);
    const query = parseOrThrow(querySchema, request.query);
    const score = await calculateDailyScore(app.prisma, user.id, parseIsoDate(parsedDate), {
      mode: query.mode ?? "stored",
    });

    return reply.send(score);
  });

  app.get("/scores/weekly-momentum", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const querySchema = z.object({
      endingOn: isoDateSchema,
    });
    const query = parseOrThrow(querySchema, request.query);
    const momentum = await getWeeklyMomentum(app.prisma, user.id, parseIsoDate(query.endingOn));

    return reply.send(momentum);
  });

  app.get("/scores/history", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const querySchema = z.object({
      endingOn: isoDateSchema,
      days: z.coerce.number().int().min(7).max(90).default(30),
    });
    const query = parseOrThrow(querySchema, request.query);
    const history = await getScoreHistory(app.prisma, user.id, parseIsoDate(query.endingOn), query.days ?? 30);

    return reply.send(history);
  });
};
