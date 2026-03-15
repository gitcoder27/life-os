import type { FastifyInstance } from "fastify";

import type { SessionUser } from "@life-os/contracts";
import type { AppEnv } from "../env.js";
import { getAuthenticatedSession, toSessionUser, touchSession } from "../../modules/auth/service.js";

export interface RequestAuthContext {
  sessionToken: string | null;
  sessionId: string | null;
  userId: string | null;
  user: SessionUser | null;
}

declare module "fastify" {
  interface FastifyRequest {
    auth: RequestAuthContext;
  }
}

interface RequestContextPluginOptions {
  env: AppEnv;
}

export async function registerRequestContext(
  app: FastifyInstance,
  options: RequestContextPluginOptions,
) {
  app.decorateRequest("auth", null);

  app.addHook("onRequest", async (request) => {
    const sessionToken = request.cookies[options.env.SESSION_COOKIE_NAME] ?? null;

    request.auth = {
      sessionToken,
      sessionId: null,
      userId: null,
      user: null,
    };

    if (!sessionToken) {
      return;
    }

    const session = await getAuthenticatedSession(app.prisma, sessionToken);

    if (!session) {
      return;
    }

    request.auth = {
      sessionToken,
      sessionId: session.id,
      userId: session.userId,
      user: toSessionUser(session.user),
    };

    await touchSession(app.prisma, options.env, session.id);
  });
}
