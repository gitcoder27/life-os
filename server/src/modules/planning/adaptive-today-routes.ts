import type { FastifyPluginAsync } from "fastify";
import type {
  AdaptiveTodayGuidanceResponse,
  ApplyShapeDayRequest,
  DayCapacityAssessmentResponse,
  DriftRecoveryRequest,
  IsoDateString,
  ShapeDayPreviewRequest,
} from "@life-os/contracts";

import { getActiveFocusSession } from "../focus/service.js";
import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import { buildAdaptiveNextMove } from "./adaptive-today-guidance.js";
import { loadAdaptiveTodayContext } from "./adaptive-today-context.js";
import {
  applyShapeDaySchema,
  driftRecoverySchema,
  shapeDayPreviewSchema,
} from "./adaptive-today-schemas.js";
import { assessDayCapacity } from "./day-capacity.js";
import {
  applyShapeDayPlan,
  buildShapeDayPreview,
} from "./day-shaping-service.js";
import {
  applyDriftRecovery,
  previewDriftRecovery,
} from "./drift-recovery-service.js";
import { isoDateSchema } from "./planning-schemas.js";

export const registerAdaptiveTodayRoutes: FastifyPluginAsync = async (app) => {
  app.get("/planning/days/:date/adaptive-guidance", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { date } = request.params as { date: IsoDateString };
    const parsedDate = parseOrThrow(isoDateSchema, date);
    const now = new Date();
    const context = await loadAdaptiveTodayContext(app, {
      userId: user.id,
      date: parsedDate,
    });
    const [activeFocusSession] = await Promise.all([
      getActiveFocusSession(app.prisma, user.id),
    ]);
    const capacity = assessDayCapacity({
      tasks: context.tasks,
      plannerBlocks: context.plannerBlocks,
      launch: context.launch,
      mustWinTask: context.mustWinTask,
      now,
      isLiveDate: true,
    });

    const response: AdaptiveTodayGuidanceResponse = withGeneratedAt({
      date: parsedDate,
      nextMove: buildAdaptiveNextMove({
        context,
        capacity,
        activeFocusSession,
        now,
      }),
      capacity,
    });

    return reply.send(response);
  });

  app.get("/planning/days/:date/capacity", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { date } = request.params as { date: IsoDateString };
    const parsedDate = parseOrThrow(isoDateSchema, date);
    const now = new Date();
    const context = await loadAdaptiveTodayContext(app, {
      userId: user.id,
      date: parsedDate,
    });
    const response: DayCapacityAssessmentResponse = withGeneratedAt({
      date: parsedDate,
      capacity: assessDayCapacity({
        tasks: context.tasks,
        plannerBlocks: context.plannerBlocks,
        launch: context.launch,
        mustWinTask: context.mustWinTask,
        now,
        isLiveDate: true,
      }),
    });

    return reply.send(response);
  });

  app.post("/planning/days/:date/shape-preview", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { date } = request.params as { date: IsoDateString };
    const parsedDate = parseOrThrow(isoDateSchema, date);
    parseOrThrow(shapeDayPreviewSchema, (request.body ?? {}) as ShapeDayPreviewRequest);
    const context = await loadAdaptiveTodayContext(app, {
      userId: user.id,
      date: parsedDate,
    });

    return reply.send(buildShapeDayPreview({ context }));
  });

  app.post("/planning/days/:date/shape-apply", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { date } = request.params as { date: IsoDateString };
    const parsedDate = parseOrThrow(isoDateSchema, date);
    const payload = parseOrThrow(applyShapeDaySchema, request.body as ApplyShapeDayRequest);
    const context = await loadAdaptiveTodayContext(app, {
      userId: user.id,
      date: parsedDate,
    });

    return reply.send(await applyShapeDayPlan(app, { context, payload }));
  });

  app.post("/planning/days/:date/drift-recovery", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { date } = request.params as { date: IsoDateString };
    const parsedDate = parseOrThrow(isoDateSchema, date);
    const payload = parseOrThrow(driftRecoverySchema, request.body as DriftRecoveryRequest);
    const context = await loadAdaptiveTodayContext(app, {
      userId: user.id,
      date: parsedDate,
    });

    if (payload.mode === "preview") {
      return reply.send(previewDriftRecovery({ context, payload }));
    }

    return reply.send(await applyDriftRecovery(app, { context, payload }));
  });
};
