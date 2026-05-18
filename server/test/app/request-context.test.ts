import { beforeEach, describe, expect, it, vi } from "vitest";

const authServiceMock = vi.hoisted(() => ({
  getAuthenticatedSession: vi.fn(),
  toSessionUser: vi.fn(),
  touchSession: vi.fn(),
}));

vi.mock("../../src/modules/auth/service.js", () => ({
  getAuthenticatedSession: authServiceMock.getAuthenticatedSession,
  toSessionUser: authServiceMock.toSessionUser,
  touchSession: authServiceMock.touchSession,
}));

import type { AppEnv } from "../../src/app/env.js";
import { registerRequestContext } from "../../src/app/plugins/request-context.js";

const env: AppEnv = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: 3004,
  APP_ORIGIN: "http://localhost:5174",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/life_os_test",
  DEV_DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/life_os_dev",
  PROD_DATABASE_URL: undefined,
  DATABASE_SEPARATION_STRICT: false,
  AUTO_CREATE_DATABASE: false,
  AUTO_APPLY_MIGRATIONS: false,
  SESSION_COOKIE_NAME: "life_os_session",
  SESSION_SECRET: "dev-only-change-me",
  SESSION_TTL_DAYS: 14,
  CSRF_COOKIE_NAME: "life_os_csrf",
  AUTH_RATE_LIMIT_WINDOW_MINUTES: 15,
  AUTH_RATE_LIMIT_MAX_ATTEMPTS: 5,
  BOOTSTRAP_USER_EMAIL: undefined,
  BOOTSTRAP_USER_PASSWORD: undefined,
  BOOTSTRAP_USER_DISPLAY_NAME: undefined,
  OWNER_EMAIL: undefined,
  OWNER_PASSWORD: undefined,
  OWNER_DISPLAY_NAME: "Owner",
};

const createAppStub = () => {
  const hooks: Array<(request: any) => Promise<void>> = [];
  const app = {
    prisma: {},
    decorateRequest: vi.fn(),
    addHook: vi.fn((_name: string, hook: (request: any) => Promise<void>) => {
      hooks.push(hook);
    }),
  };

  return { app, hooks };
};

beforeEach(() => {
  authServiceMock.getAuthenticatedSession.mockReset();
  authServiceMock.toSessionUser.mockReset();
  authServiceMock.touchSession.mockReset();
});

describe("registerRequestContext", () => {
  it("attaches an anonymous auth context when no session cookie exists", async () => {
    const { app, hooks } = createAppStub();
    await registerRequestContext(app as never, { env });
    const request = { cookies: {} };

    await hooks[0]?.(request);

    expect(app.decorateRequest).toHaveBeenCalledWith("auth");
    expect(request.auth).toEqual({
      sessionToken: null,
      sessionId: null,
      userId: null,
      user: null,
    });
    expect(authServiceMock.getAuthenticatedSession).not.toHaveBeenCalled();
  });

  it("keeps the token but anonymous context when the session is invalid", async () => {
    authServiceMock.getAuthenticatedSession.mockResolvedValue(null);
    const { app, hooks } = createAppStub();
    await registerRequestContext(app as never, { env });
    const request = {
      cookies: {
        life_os_session: "session-token",
      },
    };

    await hooks[0]?.(request);

    expect(authServiceMock.getAuthenticatedSession).toHaveBeenCalledWith(app.prisma, "session-token");
    expect(request.auth).toEqual({
      sessionToken: "session-token",
      sessionId: null,
      userId: null,
      user: null,
    });
    expect(authServiceMock.touchSession).not.toHaveBeenCalled();
  });

  it("hydrates authenticated session context and touches the session", async () => {
    const sessionUser = {
      id: "user-1",
      email: "owner@example.com",
      displayName: "Owner",
    };
    authServiceMock.getAuthenticatedSession.mockResolvedValue({
      id: "session-1",
      userId: "user-1",
      user: {
        id: "user-1",
        email: "owner@example.com",
        displayName: "Owner",
      },
    });
    authServiceMock.toSessionUser.mockReturnValue(sessionUser);
    authServiceMock.touchSession.mockResolvedValue(undefined);
    const { app, hooks } = createAppStub();
    await registerRequestContext(app as never, { env });
    const request = {
      cookies: {
        life_os_session: "session-token",
      },
    };

    await hooks[0]?.(request);

    expect(request.auth).toEqual({
      sessionToken: "session-token",
      sessionId: "session-1",
      userId: "user-1",
      user: sessionUser,
    });
    expect(authServiceMock.touchSession).toHaveBeenCalledWith(app.prisma, env, "session-1");
  });
});
