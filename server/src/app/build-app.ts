import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify from "fastify";

import type { AppEnv } from "./env.js";
import { registerModules } from "../modules/index.js";

export async function buildApp(env: AppEnv) {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
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

  app.get("/healthz", async () => ({
    ok: true,
    service: "life-os-server",
    version: "0.1.0",
  }));

  await app.register(registerModules, {
    env,
    prefix: "/api",
  });

  app.setErrorHandler((error, _request, reply) => {
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number" &&
      error.statusCode >= 400
        ? error.statusCode
        : 500;
    const message = error instanceof Error ? error.message : "Unexpected server error";

    if (statusCode >= 500) {
      reply.log.error(error);
    }

    void reply.status(statusCode).send({
      success: false,
      message,
    });
  });

  return app;
}
