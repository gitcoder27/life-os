import type { FastifyPluginAsync } from "fastify";
import type { BehaviorStateResponse, IsoDateString } from "@life-os/contracts";
import { z } from "zod";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { getUserLocalDate, normalizeTimezone } from "../../lib/time/user-time.js";
import { isoDateStringSchema } from "../../lib/validation/date-range.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import { getBehaviorStateForUserDate } from "./behavior-state-service.js";

const behaviorStateQuerySchema = z.object({
  date: (isoDateStringSchema as z.ZodType<IsoDateString>).optional(),
});

export const registerBehaviorRoutes: FastifyPluginAsync = async (app) => {
  app.get("/state", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(behaviorStateQuerySchema, request.query);
    const preferences = await app.prisma.userPreference.findUnique({
      where: {
        userId: user.id,
      },
      select: {
        timezone: true,
      },
    });
    const now = new Date();
    const date = query.date ?? getUserLocalDate(now, normalizeTimezone(preferences?.timezone));
    const behaviorState = await getBehaviorStateForUserDate(app, {
      userId: user.id,
      date,
      now,
    });
    const response: BehaviorStateResponse = withGeneratedAt({
      date,
      behaviorState,
    });

    return reply.send(response);
  });
};
