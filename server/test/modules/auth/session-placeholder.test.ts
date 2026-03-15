import { describe, expect, it, vi } from "vitest";

import { clearSessionCookie, writeSessionCookie } from "../../../src/modules/auth/session-placeholder.js";

const env = {
  SESSION_TTL_DAYS: 14,
  SESSION_COOKIE_NAME: "life_os_session",
  NODE_ENV: "test",
  CSRF_COOKIE_NAME: "life_os_csrf",
  APP_ORIGIN: "http://localhost:5173",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/life_os",
  HOST: "127.0.0.1",
  PORT: 3001,
  SESSION_SECRET: "test-secret-123456",
  AUTH_RATE_LIMIT_WINDOW_MINUTES: 15,
  AUTH_RATE_LIMIT_MAX_ATTEMPTS: 5,
} as const;

describe("session cookie placeholder", () => {
  it("writes session cookie with secure session options", () => {
    const reply = { setCookie: vi.fn() } as any;

    writeSessionCookie(reply, env as any, "token-123");

    expect(reply.setCookie).toHaveBeenCalledWith(
      "life_os_session",
      "token-123",
      expect.objectContaining({ httpOnly: true, path: "/", sameSite: "strict" }),
    );
  });

  it("clears session cookie with secure session options", () => {
    const reply = { clearCookie: vi.fn() } as any;

    clearSessionCookie(reply, env as any);

    expect(reply.clearCookie).toHaveBeenCalledWith(
      "life_os_session",
      expect.objectContaining({ httpOnly: true, path: "/", sameSite: "strict" }),
    );
  });
});
