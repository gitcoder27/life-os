import type { FastifyPluginAsync } from "fastify";

import type {
  LoginResponse,
  LogoutAllResponse,
  LogoutResponse,
  SessionResponse,
} from "@life-os/contracts";
import { z } from "zod";

import type { AppEnv } from "../../app/env.js";
import { AppError } from "../../lib/errors/app-error.js";
import { withWriteSuccess } from "../../lib/http/response.js";
import { clearCsrfCookie, createCsrfToken, setCsrfCookie } from "../../lib/security/csrf.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import {
  clearSessionCookie,
  writeSessionCookie,
} from "./session-placeholder.js";
import { assertLoginRateLimit, clearLoginFailures, recordLoginFailure } from "./rate-limit.js";
import {
  createAuditEvent,
  createUserSession,
  toSessionUser,
  validateOwnerCredentials,
  revokeAllUserSessions,
  revokeSessionByToken,
} from "./service.js";

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

interface AuthRouteOptions {
  env: AppEnv;
}

export const registerAuthRoutes: FastifyPluginAsync<AuthRouteOptions> = async (
  app,
  options,
) => {
  app.post("/login", async (request, reply) => {
    const payload = parseOrThrow(loginBodySchema, request.body);
    assertLoginRateLimit(options.env, {
      ipAddress: request.ip,
      email: payload.email,
    });
    const user = await validateOwnerCredentials(app.prisma, payload.email, payload.password);

    if (!user) {
      recordLoginFailure(options.env, {
        ipAddress: request.ip,
        email: payload.email,
      });
      await createAuditEvent(app.prisma, {
        eventType: "auth.login_failed",
        eventPayloadJson: {
          email: payload.email,
          ipAddress: request.ip,
        },
      });

      throw new AppError({
        statusCode: 401,
        code: "UNAUTHENTICATED",
        message: "Invalid email or password",
      });
    }

    const { sessionToken } = await createUserSession(app.prisma, options.env, user.id, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null,
    });

    await app.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        lastLoginAt: new Date(),
      },
    });

    await createAuditEvent(app.prisma, {
      userId: user.id,
      eventType: "auth.login_succeeded",
      eventPayloadJson: {
        email: user.email,
        ipAddress: request.ip,
      },
    });

    writeSessionCookie(reply, options.env, sessionToken);
    setCsrfCookie(reply, options.env, createCsrfToken());
    clearLoginFailures({
      ipAddress: request.ip,
      email: payload.email,
    });

    const response: LoginResponse = {
      ...withWriteSuccess({
        user: toSessionUser(user),
      }),
    };

    return reply.send(response);
  });

  app.post("/logout", async (request, reply) => {
    if (request.auth.sessionToken) {
      await revokeSessionByToken(app.prisma, request.auth.sessionToken);
    }

    if (request.auth.userId) {
      await createAuditEvent(app.prisma, {
        userId: request.auth.userId,
        eventType: "auth.logout",
        eventPayloadJson: {},
      });
    }

    clearSessionCookie(reply, options.env);
    clearCsrfCookie(reply, options.env);
    const response: LogoutResponse = withWriteSuccess();

    return reply.send(response);
  });

  app.post("/logout-all", async (request, reply) => {
    if (!request.auth.userId) {
      throw new AppError({
        statusCode: 401,
        code: "UNAUTHENTICATED",
        message: "Authentication required",
      });
    }

    const revokedSessions = await revokeAllUserSessions(app.prisma, request.auth.userId);
    await createAuditEvent(app.prisma, {
      userId: request.auth.userId,
      eventType: "auth.logout_all",
      eventPayloadJson: {
        revokedSessions,
      },
    });

    clearSessionCookie(reply, options.env);
    clearCsrfCookie(reply, options.env);
    const response: LogoutAllResponse = withWriteSuccess({
      revokedSessions,
    });

    return reply.send(response);
  });

  app.get("/session", async (request, reply) => {
    if (request.auth.user && !request.cookies[options.env.CSRF_COOKIE_NAME]) {
      setCsrfCookie(reply, options.env, createCsrfToken());
    }

    const response: SessionResponse = {
      authenticated: Boolean(request.auth.user),
      generatedAt: new Date().toISOString(),
      user: request.auth.user,
    };

    return reply.send(response);
  });
};
