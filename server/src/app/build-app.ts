import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify from "fastify";
import type { ApiError, HealthCheckResponse } from "@life-os/contracts";

import type { AppEnv } from "./env.js";
import { registerPrismaPlugin } from "./plugins/prisma.js";
import { registerRequestContextPlugin } from "./plugins/request-context.js";
import { isAppError } from "../lib/errors/app-error.js";
import { withGeneratedAt } from "../lib/http/response.js";
import { enforceCsrfProtection } from "../lib/security/csrf.js";
import { ensureOwnerAccount } from "../modules/auth/service.js";
import { registerModules } from "../modules/index.js";

export async function buildApp(env: AppEnv) {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
      redact: {
        paths: ["req.headers.cookie", "req.headers.authorization", "res.headers.set-cookie"],
      },
    },
  });

  await app.register(cors, {
    credentials: true,
    origin: env.APP_ORIGIN,
  });

  await app.register(cookie, {
    hook: "onRequest",
    secret: env.SESSION_SECRET,
  });

  await app.register(registerPrismaPlugin);
  await ensureOwnerAccount(app.prisma, env, console);
  await app.register(registerRequestContextPlugin, { env });

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
    const statusCode = isAppError(error)
      ? error.statusCode
      : typeof error === "object" &&
          error !== null &&
          "statusCode" in error &&
          typeof error.statusCode === "number" &&
          error.statusCode >= 400
        ? error.statusCode
        : 500;

    if (statusCode >= 500) {
      reply.log.error(error);
    }

    const response: ApiError = {
      success: false,
      code: isAppError(error) ? error.code : "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "Unexpected server error",
      fieldErrors: isAppError(error) ? error.fieldErrors : undefined,
      generatedAt: new Date().toISOString(),
    };

    void reply.status(statusCode).send(response);
  });

  return app;
}
