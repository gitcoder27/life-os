import type { FastifyPluginAsync } from "fastify";
import type {
  CreateHabitPauseWindowRequest,
  CreateHabitRequest,
  HabitCheckinRequest,
  UpdateHabitRequest,
} from "@life-os/contracts";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import {
  createHabitPauseWindowSchema,
  createHabitSchema,
  habitCheckinSchema,
  updateHabitSchema,
} from "./habits-schemas.js";
import {
  createHabit,
  createHabitCheckin,
  createHabitPauseWindow,
  deleteHabitPauseWindow,
  listHabits,
  updateHabit,
} from "./habit-service.js";

export const registerHabitRoutes: FastifyPluginAsync = async (app) => {
  app.get("/habits", async (request, reply) => {
    const user = requireAuthenticatedUser(request);

    return reply.send(await listHabits(app, user.id));
  });

  app.post("/habits", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createHabitSchema, request.body as CreateHabitRequest);

    return reply.status(201).send(await createHabit(app, user.id, payload));
  });

  app.patch("/habits/:habitId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { habitId } = request.params as { habitId: string };
    const payload = parseOrThrow(updateHabitSchema, request.body as UpdateHabitRequest);

    return reply.send(await updateHabit(app, user.id, habitId, payload));
  });

  app.post("/habits/:habitId/pause-windows", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { habitId } = request.params as { habitId: string };
    const payload = parseOrThrow(
      createHabitPauseWindowSchema,
      request.body as CreateHabitPauseWindowRequest,
    );

    return reply.status(201).send(await createHabitPauseWindow(app, user.id, habitId, payload));
  });

  app.delete("/habits/:habitId/pause-windows/:pauseWindowId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { habitId, pauseWindowId } = request.params as {
      habitId: string;
      pauseWindowId: string;
    };

    return reply.send(await deleteHabitPauseWindow(app, user.id, habitId, pauseWindowId));
  });

  app.post("/habits/:habitId/checkins", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { habitId } = request.params as { habitId: string };
    const payload = parseOrThrow(habitCheckinSchema, request.body as HabitCheckinRequest);

    return reply.send(await createHabitCheckin(app, user.id, habitId, payload));
  });
};
