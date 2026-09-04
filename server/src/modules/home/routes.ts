import type { FastifyPluginAsync } from "fastify";
import type { HomeQuoteResponse, IsoDateString } from "@life-os/contracts";
import { z } from "zod";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { parseIsoDate } from "../../lib/time/cycle.js";
import {
  getUserLocalDate,
  isValidTimezone,
  resolveDisplayTimezone,
} from "../../lib/time/user-time.js";
import { isoDateStringSchema } from "../../lib/validation/date-range.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import { buildHomeOverview } from "./home-overview-service.js";
import { createHomeQuoteService } from "./quote-service.js";

const isoDateSchema = isoDateStringSchema as z.ZodType<IsoDateString>;
const dateQuerySchema = z.object({
  date: isoDateSchema.optional(),
});

const CLIENT_TIMEZONE_HEADER = "x-client-timezone";

function getRequestTimezone(request: { headers: Record<string, unknown> }) {
  const headerValue = request.headers[CLIENT_TIMEZONE_HEADER];
  const candidate = Array.isArray(headerValue) ? headerValue[0] : headerValue;

  if (typeof candidate !== "string") {
    return null;
  }

  const timezone = candidate.trim();
  return isValidTimezone(timezone) ? timezone : null;
}

async function resolveHomeOverviewDate(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  queryDate: IsoDateString | undefined,
  fallbackTimezone: string | null,
) {
  if (queryDate) {
    return parseIsoDate(queryDate);
  }

  const savedTimezone = (
    await app.prisma.userPreference.findUnique({
      where: {
        userId,
      },
      select: {
        timezone: true,
      },
    })
  )?.timezone;

  return parseIsoDate(
    getUserLocalDate(
      new Date(),
      resolveDisplayTimezone(savedTimezone, fallbackTimezone),
    ),
  );
}

export const registerHomeRoutes: FastifyPluginAsync = async (app) => {
  const quoteService = createHomeQuoteService();

  app.get("/overview", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(dateQuerySchema, request.query);
    const fallbackTimezone = getRequestTimezone(request);
    const targetDate = await resolveHomeOverviewDate(
      app,
      user.id,
      query.date,
      fallbackTimezone,
    );

    return reply.send(await buildHomeOverview(app, user.id, targetDate, fallbackTimezone));
  });

  app.get("/quote", async (request, reply): Promise<HomeQuoteResponse> => {
    requireAuthenticatedUser(request);

    return reply.send(
      withGeneratedAt({
        quote: await quoteService.getQuote(),
      }),
    );
  });

  app.get("/overview/history/:date", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { date } = request.params as { date: IsoDateString };
    const targetDate = parseIsoDate(parseOrThrow(isoDateSchema, date));
    const fallbackTimezone = getRequestTimezone(request);

    return reply.send(await buildHomeOverview(app, user.id, targetDate, fallbackTimezone));
  });
};
