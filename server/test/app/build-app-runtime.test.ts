import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaDisconnect = vi.hoisted(() => vi.fn());
const prismaConstructorMock = vi.hoisted(() => vi.fn());
const ensureBootstrapUserAccount = vi.hoisted(() => vi.fn());
const registerRequestContext = vi.hoisted(() => vi.fn());
const registerDevelopmentRequestLogging = vi.hoisted(() => vi.fn());
const registerModules = vi.hoisted(() => vi.fn());

vi.mock("@prisma/client", () => ({
  PrismaClient: prismaConstructorMock,
}));

vi.mock("../../src/modules/auth/service.js", () => ({
  ensureBootstrapUserAccount,
}));

vi.mock("../../src/app/plugins/request-context.js", () => ({
  registerRequestContext,
}));

vi.mock("../../src/lib/logger/dev-logger.js", () => ({
  createLoggerOptions: () => false,
  registerDevelopmentRequestLogging,
}));

vi.mock("../../src/modules/index.js", () => ({
  registerModules,
}));

import type { AppEnv } from "../../src/app/env.js";
import { buildApp } from "../../src/app/build-app.js";

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

beforeEach(() => {
  prismaDisconnect.mockReset();
  prismaConstructorMock.mockReset();
  ensureBootstrapUserAccount.mockReset();
  registerRequestContext.mockReset();
  registerDevelopmentRequestLogging.mockReset();
  registerModules.mockReset();
  prismaConstructorMock.mockReturnValue({
    $disconnect: prismaDisconnect,
  });
  ensureBootstrapUserAccount.mockResolvedValue(undefined);
  registerRequestContext.mockResolvedValue(undefined);
  registerModules.mockImplementation(async (app: any) => {
    app.get("/stub", async () => ({ ok: true }));
    app.get("/known-error", async () => {
      throw Object.assign(new Error("Known route error"), { statusCode: 418 });
    });
    app.get("/internal-error", async () => {
      throw new Error("database secret leaked");
    });
  });
});

describe("buildApp runtime wiring", () => {
  it("registers core plugins, modules, health checks, and cleanup hooks", async () => {
    const app = await buildApp(env);

    try {
      const healthResponse = await app.inject({
        method: "GET",
        url: "/healthz",
      });
      const stubResponse = await app.inject({
        method: "GET",
        url: "/api/stub",
      });
      const missingResponse = await app.inject({
        method: "GET",
        url: "/missing",
      });

      expect(healthResponse.statusCode).toBe(200);
      expect(healthResponse.json()).toMatchObject({
        ok: true,
        service: "life-os-server",
        version: "0.1.0",
      });
      expect(stubResponse.statusCode).toBe(200);
      expect(stubResponse.json()).toEqual({ ok: true });
      expect(missingResponse.statusCode).toBe(404);
      expect(missingResponse.json()).toMatchObject({
        success: false,
        code: "NOT_FOUND",
        message: "Route not found",
      });
      expect(ensureBootstrapUserAccount.mock.calls[0]?.[0]).toBe(app.prisma);
      expect(ensureBootstrapUserAccount.mock.calls[0]?.[1]).toBe(env);
      expect(ensureBootstrapUserAccount.mock.calls[0]?.[2]).toBe(app.log);
      expect(registerRequestContext.mock.calls[0]?.[0]).toBe(app);
      expect(registerRequestContext.mock.calls[0]?.[1]).toEqual({ env });
      expect(registerDevelopmentRequestLogging.mock.calls[0]?.[0]).toBe(app);
      expect(registerDevelopmentRequestLogging.mock.calls[0]?.[1]).toBe(env);
      expect(registerModules.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
        env,
        prefix: "/api",
      }));
    } finally {
      await app.close();
    }

    expect(prismaDisconnect).toHaveBeenCalledTimes(1);
  });

  it("returns safe error payloads for known and unexpected route errors", async () => {
    const app = await buildApp(env);

    try {
      const knownResponse = await app.inject({
        method: "GET",
        url: "/api/known-error",
      });
      const internalResponse = await app.inject({
        method: "GET",
        url: "/api/internal-error",
      });

      expect(knownResponse.statusCode).toBe(418);
      expect(knownResponse.json()).toMatchObject({
        success: false,
        code: "INTERNAL_ERROR",
        message: "Known route error",
      });
      expect(internalResponse.statusCode).toBe(500);
      expect(internalResponse.json()).toMatchObject({
        success: false,
        code: "INTERNAL_ERROR",
        message: "Unexpected server error",
      });
    } finally {
      await app.close();
    }
  });
});
