import type { FastifyPluginAsync } from "fastify";
import type {
  CreateRoutineRequest,
  RoutineItemCheckinRequest,
  UpdateRoutineRequest,
} from "@life-os/contracts";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import {
  createRoutineSchema,
  routineItemCheckinSchema,
  updateRoutineSchema,
} from "./habits-schemas.js";
import {
  createRoutine,
  createRoutineItemCheckin,
  listRoutines,
  updateRoutine,
} from "./routine-service.js";

export const registerRoutineRoutes: FastifyPluginAsync = async (app) => {
  app.get("/routines", async (request, reply) => {
    const user = requireAuthenticatedUser(request);

    return reply.send(await listRoutines(app, user.id));
  });

  app.post("/routines", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createRoutineSchema, request.body as CreateRoutineRequest);

    return reply.status(201).send(await createRoutine(app, user.id, payload));
  });

  app.patch("/routines/:routineId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { routineId } = request.params as { routineId: string };
    const payload = parseOrThrow(updateRoutineSchema, request.body as UpdateRoutineRequest);

    return reply.send(await updateRoutine(app, user.id, routineId, payload));
  });

  app.post("/routine-items/:itemId/checkins", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { itemId } = request.params as { itemId: string };
    const payload = parseOrThrow(
      routineItemCheckinSchema,
      request.body as RoutineItemCheckinRequest,
    );

    return reply.send(await createRoutineItemCheckin(app, user.id, itemId, payload));
  });
};
