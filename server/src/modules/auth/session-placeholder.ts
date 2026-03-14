import type { FastifyReply, FastifyRequest } from "fastify";

import type { AppEnv } from "../../app/env.js";

function getCookieOptions(env: AppEnv) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "strict" as const,
    secure: env.NODE_ENV === "production",
    maxAge: env.SESSION_TTL_DAYS * 24 * 60 * 60,
  };
}

export function writeSessionCookie(reply: FastifyReply, env: AppEnv, sessionToken: string) {
  reply.setCookie(env.SESSION_COOKIE_NAME, sessionToken, getCookieOptions(env));
}

export function clearSessionCookie(reply: FastifyReply, env: AppEnv) {
  reply.clearCookie(env.SESSION_COOKIE_NAME, getCookieOptions(env));
}
