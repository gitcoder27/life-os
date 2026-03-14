import { randomBytes, timingSafeEqual } from "node:crypto";

import type { FastifyReply, FastifyRequest } from "fastify";

import type { AppEnv } from "../../app/env.js";
import { AppError } from "../errors/app-error.js";

const CSRF_HEADER_NAME = "x-csrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function getCookieOptions(env: AppEnv) {
  return {
    httpOnly: false,
    path: "/",
    sameSite: "strict" as const,
    secure: env.NODE_ENV === "production",
    maxAge: env.SESSION_TTL_DAYS * 24 * 60 * 60,
  };
}

export function createCsrfToken() {
  return randomBytes(24).toString("hex");
}

export function setCsrfCookie(reply: FastifyReply, env: AppEnv, csrfToken: string) {
  reply.setCookie(env.CSRF_COOKIE_NAME, csrfToken, getCookieOptions(env));
}

export function clearCsrfCookie(reply: FastifyReply, env: AppEnv) {
  reply.clearCookie(env.CSRF_COOKIE_NAME, getCookieOptions(env));
}

function tokensMatch(csrfCookie: string, csrfHeader: string) {
  const cookieBuffer = Buffer.from(csrfCookie);
  const headerBuffer = Buffer.from(csrfHeader);

  if (cookieBuffer.length !== headerBuffer.length) {
    return false;
  }

  return timingSafeEqual(cookieBuffer, headerBuffer);
}

export function enforceCsrfProtection(request: FastifyRequest, env: AppEnv) {
  if (SAFE_METHODS.has(request.method)) {
    return;
  }

  if (request.url.startsWith("/api/auth/login")) {
    return;
  }

  const csrfCookie = request.cookies[env.CSRF_COOKIE_NAME];
  const csrfHeader = request.headers[CSRF_HEADER_NAME];

  if (!csrfCookie || typeof csrfHeader !== "string" || !tokensMatch(csrfCookie, csrfHeader)) {
    throw new AppError({
      statusCode: 403,
      code: "FORBIDDEN",
      message: "CSRF validation failed",
    });
  }
}
