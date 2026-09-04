import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify from "fastify";
import type { ApiError, ApiErrorCode, HealthCheckResponse } from "@life-os/contracts";

import type { AppEnv } from "./env.js";
import { registerPrismaPlugin } from "./plugins/prisma.js";
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

type NormalizedKnownError = {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
};

function getPrismaErrorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    /^P\d{4}$/.test(error.code)
  ) {
    return error.code;
  }

  return null;
}

function getKnownPrismaError(error: unknown): NormalizedKnownError | null {
  switch (getPrismaErrorCode(error)) {
    case "P2002":
      return {
        statusCode: 409,
        code: "CONFLICT",
        message: "A record with that value already exists",
      };
    case "P2025":
      return {
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Record not found",
      };
    case "P2003":
      return {
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Request references a record that does not exist",
      };
    default:
      return null;
  }
}

function getFallbackPublicError(statusCode: number): NormalizedKnownError {
  if (statusCode === 404) {
    return {
      statusCode,
      code: "NOT_FOUND",
      message: "Record not found",
    };
  }

  if (statusCode >= 400 && statusCode < 500) {
    return {
      statusCode,
      code: "BAD_REQUEST",
      message: "Request could not be processed",
    };
  }

  return {
    statusCode,
    code: "INTERNAL_ERROR",
    message: "Unexpected server error",
  };
}

function getErrorStatusCode(error: unknown) {
  if (isAppError(error)) {
    return error.statusCode;
  }

  const knownPrismaError = getKnownPrismaError(error);
  if (knownPrismaError) {
    return knownPrismaError.statusCode;
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
  const knownPrismaError = getKnownPrismaError(error);
  const fallbackPublicError = getFallbackPublicError(statusCode);

  return {
    success: false,
    code: isKnownAppError
      ? error.code
      : knownPrismaError?.code ?? fallbackPublicError.code,
    message: isKnownAppError
      ? error.message
      : knownPrismaError?.message ?? fallbackPublicError.message,
    fieldErrors: isKnownAppError ? error.fieldErrors : undefined,
    generatedAt,
  };
}

export async function buildApp(env: AppEnv) {
  const app = Fastify({
    logger: createLoggerOptions(env),
    disableRequestLogging: env.NODE_ENV !== "production",
    trustProxy: env.TRUST_PROXY ? 1 : false,
  });

  await app.register(cors, {
    credentials: true,
    origin: env.APP_ORIGIN,
  });

  await app.register(cookie, {
    hook: "onRequest",
    secret: env.SESSION_SECRET,
  });

  await registerPrismaPlugin(app, {});
  await ensureBootstrapUserAccount(app.prisma, env, app.log);
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

  await app.register(registerModules, {
    env,
    prefix: "/api",
  });

  return app;
}
