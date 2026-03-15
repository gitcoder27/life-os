import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../../src/lib/errors/app-error.js";
import { clearCsrfCookie, createCsrfToken, enforceCsrfProtection, setCsrfCookie } from "../../src/lib/security/csrf.js";

const env = {
  NODE_ENV: "test" as const,
  SESSION_TTL_DAYS: 14,
  CSRF_COOKIE_NAME: "life_os_csrf",
  APP_ORIGIN: "http://localhost:5173",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/life_os",
  HOST: "127.0.0.1",
  PORT: 3001,
  SESSION_COOKIE_NAME: "life_os_session",
  SESSION_SECRET: "test-secret-123456",
  AUTH_RATE_LIMIT_WINDOW_MINUTES: 15,
  AUTH_RATE_LIMIT_MAX_ATTEMPTS: 5,
};

describe("CSRF helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates token-like values", () => {
    const token = createCsrfToken();

    expect(token).toMatch(/^[a-f0-9]{48}$/);
  });

  it("writes and clears csrf cookie", () => {
    const reply = { setCookie: vi.fn(), clearCookie: vi.fn() } as any;

    setCsrfCookie(reply, env as any, "token");
    clearCsrfCookie(reply, env as any);

    expect(reply.setCookie).toHaveBeenCalledWith(
      "life_os_csrf",
      "token",
      expect.objectContaining({ path: "/", sameSite: "strict" }),
    );
    expect(reply.clearCookie).toHaveBeenCalledWith(
      "life_os_csrf",
      expect.objectContaining({ path: "/" }),
    );
  });

  it("skips CSRF validation for safe methods and login", () => {
    const request = {
      method: "GET",
      url: "/api/something",
      cookies: {},
      headers: {},
    } as any;
    const loginRequest = {
      method: "POST",
      url: "/api/auth/login",
      cookies: {},
      headers: {},
    } as any;

    expect(() => enforceCsrfProtection(request, env as any)).not.toThrow();
    expect(() => enforceCsrfProtection(loginRequest, env as any)).not.toThrow();
  });

  it("throws for missing token or mismatch", () => {
    const request = {
      method: "POST",
      url: "/api/notes",
      cookies: {},
      headers: {},
    } as any;

    try {
      enforceCsrfProtection(request, env as any);
      expect.fail("Expected CSRF check to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("FORBIDDEN");
    }
  });

  it("allows matching tokens", () => {
    expect(() =>
      enforceCsrfProtection(
        {
          method: "POST",
          url: "/api/notes",
          cookies: { life_os_csrf: "abc" },
          headers: { "x-csrf-token": "abc" },
        } as any,
        env as any,
      ),
    ).not.toThrow();
  });
});
