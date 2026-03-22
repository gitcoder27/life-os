import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import cookie from "@fastify/cookie";
import Fastify from "fastify";

import type { AppEnv } from "../../../src/app/env.js";
import argon2 from "argon2";

import { registerAuthRoutes } from "../../../src/modules/auth/routes.js";
import { createMockPrisma } from "../../utils/mock-prisma.js";

vi.mock("argon2", () => ({
  default: {
    hash: vi.fn(),
    verify: vi.fn(),
  },
}));

const env: AppEnv = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: 3001,
  APP_ORIGIN: "http://localhost:5173",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/life_os",
  SESSION_COOKIE_NAME: "life_os_session",
  SESSION_SECRET: "dev-only-change-me",
  SESSION_TTL_DAYS: 14,
  CSRF_COOKIE_NAME: "life_os_csrf",
  AUTH_RATE_LIMIT_WINDOW_MINUTES: 15,
  AUTH_RATE_LIMIT_MAX_ATTEMPTS: 5,
  BOOTSTRAP_USER_EMAIL: undefined,
  BOOTSTRAP_USER_PASSWORD: undefined,
  BOOTSTRAP_USER_DISPLAY_NAME: undefined,
  OWNER_EMAIL: "owner@example.com",
  OWNER_PASSWORD: "password123",
  OWNER_DISPLAY_NAME: "Owner",
};

describe("auth routes", () => {
  let app: ReturnType<typeof Fastify> | undefined;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    app = Fastify({ logger: false });
    app.decorate("prisma", prisma as any);
    app.decorateRequest("auth", null);
    app.addHook("onRequest", async (request) => {
      request.auth = {
        sessionToken: null,
        sessionId: null,
        userId: null,
        user: null,
      };
    });
    await app.register(cookie, {
      secret: env.SESSION_SECRET,
    });
    await app.register(registerAuthRoutes, {
      env,
      prefix: "/auth",
    });
    await app.ready();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it("allows different users to log in with separate email/password credentials", async () => {
    const firstUser = {
      id: "user-1",
      email: "first@example.com",
      displayName: "First User",
      passwordHash: "hash-1",
      status: "ACTIVE",
    };
    const secondUser = {
      id: "user-2",
      email: "second@example.com",
      displayName: "Second User",
      passwordHash: "hash-2",
      status: "ACTIVE",
    };

    prisma.user.findUnique.mockImplementation(async ({ where }: { where: { email: string } }) => {
      if (where.email === firstUser.email) {
        return firstUser;
      }

      if (where.email === secondUser.email) {
        return secondUser;
      }

      return null;
    });
    prisma.user.update.mockResolvedValue({});
    prisma.session.create
      .mockResolvedValueOnce({ id: "session-1" })
      .mockResolvedValueOnce({ id: "session-2" });
    prisma.auditEvent.create.mockResolvedValue({});
    (argon2.verify as any).mockResolvedValue(true);

    const firstResponse = await app!.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: firstUser.email,
        password: "password-1",
      },
    });
    const secondResponse = await app!.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: secondUser.email,
        password: "password-2",
      },
    });

    expect(firstResponse.statusCode).toBe(200);
    expect(secondResponse.statusCode).toBe(200);
    expect(firstResponse.cookies).toHaveLength(2);
    expect(secondResponse.cookies).toHaveLength(2);
    expect(JSON.parse(firstResponse.body).user).toEqual({
      id: "user-1",
      email: "first@example.com",
      displayName: "First User",
    });
    expect(JSON.parse(secondResponse.body).user).toEqual({
      id: "user-2",
      email: "second@example.com",
      displayName: "Second User",
    });
    expect(prisma.session.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
        }),
      }),
    );
    expect(prisma.session.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-2",
        }),
      }),
    );
  });
});
