import type { FastifyPluginAsync } from "fastify";

import type { LoginResponse, LogoutResponse, SessionResponse } from "@life-os/contracts";
import { z } from "zod";

import type { AppEnv } from "../../app/env.js";
import {
  clearPlaceholderSession,
  getPlaceholderSessionUser,
  writePlaceholderSession,
} from "./session-placeholder.js";

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
    const parsed = loginBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        message: "Invalid login payload",
      });
    }

    writePlaceholderSession(reply, options.env.SESSION_COOKIE_NAME);

    const response: LoginResponse = {
      generatedAt: new Date().toISOString(),
      user: {
        id: "usr_owner",
        email: parsed.data.email,
        displayName: "Owner",
      },
    };

    return reply.send(response);
  });

  app.post("/logout", async (_request, reply) => {
    clearPlaceholderSession(reply, options.env.SESSION_COOKIE_NAME);

    const response: LogoutResponse = {
      success: true,
      generatedAt: new Date().toISOString(),
    };

    return reply.send(response);
  });

  app.get("/session", async (request, reply) => {
    const user = getPlaceholderSessionUser(request, options.env.SESSION_COOKIE_NAME);
    const response: SessionResponse = {
      authenticated: Boolean(user),
      generatedAt: new Date().toISOString(),
      user,
    };

    return reply.send(response);
  });
};
