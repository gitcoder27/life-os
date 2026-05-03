import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify from "fastify";
import type { ApiError, HealthCheckResponse } from "@life-os/contracts";
import { PrismaClient } from "@prisma/client";

import type { AppEnv } from "./env.js";
import { registerRequestContext } from "./plugins/request-context.js";
import { isAppError } from "../lib/errors/app-error.js";
import { withGeneratedAt } from "../lib/http/response.js";
import {
  createLoggerOptions,
  registerDevelopmentRequestLogging,
} from "../lib/logger/dev-logger.js";
import { enforceCsrfProtection } from "../lib/security/csrf.js";
import { ensureBootstrapUserAccount } from "../modules/auth/service.js";
import { registerModules } from "../modules/index.js";

function getErrorStatusCode(error: unknown) {
  if (isAppError(error)) {
    return error.statusCode;
  }

  return typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number" &&
    error.statusCode >= 400
    ? error.statusCode
    : 500;
}

export function buildApiErrorResponse(
  error: unknown,
  statusCode: number,
  generatedAt = new Date().toISOString(),
): ApiError {
  const isKnownAppError = isAppError(error);
  const message = isKnownAppError
    ? error.message
    : statusCode >= 500
      ? "Unexpected server error"
      : error instanceof Error
        ? error.message
        : "Unexpected server error";

  return {
    success: false,
    code: isKnownAppError ? error.code : "INTERNAL_ERROR",
    message,
    fieldErrors: isKnownAppError ? error.fieldErrors : undefined,
    generatedAt,
  };
}

export async function buildApp(env: AppEnv) {
  const app = Fastify({
    logger: createLoggerOptions(env),
    disableRequestLogging: env.NODE_ENV !== "production",
  });

  await app.register(cors, {
    credentials: true,
    origin: env.APP_ORIGIN,
  });

  await app.register(cookie, {
    hook: "onRequest",
    secret: env.SESSION_SECRET,
  });

  const prisma = new PrismaClient();
  app.decorate("prisma", prisma);

  app.addHook("onClose", async (instance) => {
    await instance.prisma.$disconnect();
  });

  await ensureBootstrapUserAccount(prisma, env, app.log);
  await registerRequestContext(app, { env });
  registerDevelopmentRequestLogging(app, env);

  app.addHook("preHandler", async (request) => {
    enforceCsrfProtection(request, env);
  });

  app.get("/healthz", async (): Promise<HealthCheckResponse> =>
    withGeneratedAt({
      ok: true,
      service: "life-os-server",
      version: "0.1.0",
    }),
  );

  await app.register(registerModules, {
    env,
    prefix: "/api",
  });

  app.setNotFoundHandler(async (_request, reply) => {
    const response: ApiError = {
      success: false,
      code: "NOT_FOUND",
      message: "Route not found",
      generatedAt: new Date().toISOString(),
    };

    return reply.status(404).send(response);
  });

  app.setErrorHandler((error, _request, reply) => {
    const statusCode = getErrorStatusCode(error);

    if (statusCode >= 500) {
      reply.log.error(error);
    }

    const response = buildApiErrorResponse(error, statusCode);

    void reply.status(statusCode).send(response);
  });

  return app;
}
