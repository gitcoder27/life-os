import type { FastifyPluginAsync } from "fastify";
import type {
  AbortFocusSessionRequest,
  CaptureFocusDistractionRequest,
  CompleteFocusSessionRequest,
  CreateFocusSessionRequest,
  ActiveFocusSessionResponse,
  FocusSessionMutationResponse,
} from "@life-os/contracts";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import {
  abortFocusSession,
  captureFocusDistraction,
  completeFocusSession,
  createFocusSession,
  getActiveFocusSession,
} from "./service.js";
import {
  abortFocusSessionSchema,
  captureFocusDistractionSchema,
  completeFocusSessionSchema,
  createFocusSessionSchema,
} from "./focus-schemas.js";

export const registerFocusRoutes: FastifyPluginAsync = async (app) => {
  app.get("/active", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const session = await getActiveFocusSession(app.prisma, user.id);
    const response: ActiveFocusSessionResponse = withGeneratedAt({
      session,
    });

    return reply.send(response);
  });

  app.post("/sessions", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createFocusSessionSchema, request.body as CreateFocusSessionRequest);
    const session = await app.prisma.$transaction((tx) =>
      createFocusSession(tx, {
        userId: user.id,
        taskId: payload.taskId,
        depth: payload.depth ?? "deep",
        plannedMinutes: payload.plannedMinutes,
      }),
    );
    const response: FocusSessionMutationResponse = withGeneratedAt({
      session,
    });

    return reply.status(201).send(response);
  });

  app.post("/sessions/:sessionId/distraction", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(
      captureFocusDistractionSchema,
      request.body as CaptureFocusDistractionRequest,
    );
    const { sessionId } = request.params as { sessionId: string };
    const session = await app.prisma.$transaction((tx) =>
      captureFocusDistraction(tx, {
        userId: user.id,
        sessionId,
        note: payload.note,
      }),
    );
    const response: FocusSessionMutationResponse = withGeneratedAt({
      session,
    });

    return reply.send(response);
  });

  app.post("/sessions/:sessionId/complete", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(
      completeFocusSessionSchema,
      request.body as CompleteFocusSessionRequest,
    );
    const { sessionId } = request.params as { sessionId: string };
    const session = await app.prisma.$transaction((tx) =>
      completeFocusSession(tx, {
        userId: user.id,
        sessionId,
        taskOutcome: payload.taskOutcome,
        completionNote: payload.completionNote,
      }),
    );
    const response: FocusSessionMutationResponse = withGeneratedAt({
      session,
    });

    return reply.send(response);
  });

  app.post("/sessions/:sessionId/abort", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(abortFocusSessionSchema, request.body as AbortFocusSessionRequest);
    const { sessionId } = request.params as { sessionId: string };
    const session = await app.prisma.$transaction((tx) =>
      abortFocusSession(tx, {
        userId: user.id,
        sessionId,
        exitReason: payload.exitReason,
        note: payload.note,
      }),
    );
    const response: FocusSessionMutationResponse = withGeneratedAt({
      session,
    });

    return reply.send(response);
  });
};
