import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@prisma/client";
import type { AppEnv } from "../../src/app/env.js";
import argon2 from "argon2";

import {
  createAuditEvent,
  createUserSession,
  ensureOwnerAccount,
  getAuthenticatedSession,
  hashSessionToken,
  revokeAllUserSessions,
  revokeSessionByToken,
  toSessionUser,
  touchSession,
  validateOwnerCredentials,
} from "../../../src/modules/auth/service.js";
import {
  clearLoginFailures,
  recordLoginFailure,
  assertLoginRateLimit,
} from "../../../src/modules/auth/rate-limit.js";

vi.mock("argon2", () => ({
  default: {
    hash: vi.fn(),
    verify: vi.fn(),
  },
}));

const env: AppEnv = {
  NODE_ENV: "test",
  HOST: "localhost",
  PORT: 3001,
  APP_ORIGIN: "http://localhost:5173",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/life_os",
  SESSION_COOKIE_NAME: "life_os_session",
  SESSION_SECRET: "dev-only-change-me",
  SESSION_TTL_DAYS: 14,
  CSRF_COOKIE_NAME: "life_os_csrf",
  AUTH_RATE_LIMIT_WINDOW_MINUTES: 15,
  AUTH_RATE_LIMIT_MAX_ATTEMPTS: 5,
  OWNER_EMAIL: "owner@example.com",
  OWNER_PASSWORD: "password123",
  OWNER_DISPLAY_NAME: "Owner",
};

describe("auth service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hashes session tokens deterministically", () => {
    expect(hashSessionToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("projects user row into session user", () => {
    expect(
      toSessionUser({
        id: "u1",
        email: "u@example.com",
        displayName: "User",
      }),
    ).toEqual({
      id: "u1",
      email: "u@example.com",
      displayName: "User",
    });
  });

  it("creates owner account only when credentials are present and DB is empty", async () => {
    const create = vi.fn().mockResolvedValue({});
    const findUnique = vi.fn().mockResolvedValue(null);
    const count = vi.fn().mockResolvedValue(0);
    const prisma = { user: { findUnique, count, create } } as unknown as PrismaClient;
    const logger = { warn: vi.fn(), info: vi.fn() } as unknown as Console;

    (argon2.hash as any).mockResolvedValue("hashed");
    await ensureOwnerAccount(prisma, env, logger);

    expect((argon2.hash as any)).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: env.OWNER_EMAIL,
          passwordHash: "hashed",
          displayName: "Owner",
        }),
      }),
    );
  });

  it("skips owner bootstrap when owner records already exist", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "existing" });
    const create = vi.fn();
    const prisma = { user: { findUnique, count: vi.fn(), create } } as unknown as PrismaClient;
    const logger = { warn: vi.fn(), info: vi.fn() } as unknown as Console;

    await ensureOwnerAccount(prisma, env, logger);
    expect(create).not.toHaveBeenCalled();
  });

  it("validates active credentials correctly", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "u1",
      email: env.OWNER_EMAIL,
      status: "ACTIVE",
      passwordHash: "hash",
    });
    const prisma = { user: { findUnique } } as unknown as PrismaClient;
    (argon2.verify as any).mockResolvedValue(false);

    expect(await validateOwnerCredentials(prisma, env.OWNER_EMAIL, "bad")).toBeNull();
    expect(await validateOwnerCredentials(prisma, "missing@example.com", "bad")).toBeNull();

    (argon2.verify as any).mockResolvedValue(true);
    expect(await validateOwnerCredentials(prisma, env.OWNER_EMAIL, "good")).toEqual({
      id: "u1",
      email: env.OWNER_EMAIL,
      status: "ACTIVE",
      passwordHash: "hash",
    });
  });

  it("creates sessions with calculated expiry", async () => {
    const sessionCreate = vi.fn().mockResolvedValue({ id: "s1" });
    const prisma = { session: { create: sessionCreate } } as unknown as PrismaClient;

    const created = await createUserSession(
      prisma,
      env,
      "u1",
      { ipAddress: "127.0.0.1", userAgent: "agent" },
    );

    expect(sessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "u1",
          ipAddress: "127.0.0.1",
          userAgent: "agent",
          sessionTokenHash: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      }),
    );
    expect(created.sessionToken).toHaveLength(64);
  });

  it("checks session token activity against revocation and expiry", async () => {
    const user = { id: "u1", status: "ACTIVE" };
    const now = new Date();
    const prisma = {
      session: {
        findUnique: vi.fn().mockResolvedValue({
          id: "s1",
          sessionTokenHash: "hash",
          userId: "u1",
          expiresAt: new Date(now.getTime() + 100_000),
          revokedAt: null,
          user,
        }),
      },
    } as unknown as PrismaClient;

    expect(await getAuthenticatedSession(prisma, "abc")).toEqual(
      expect.objectContaining({
        id: "s1",
        userId: "u1",
      }),
    );

    (prisma.session.findUnique as any).mockResolvedValue({
      id: "s2",
      user,
      revokedAt: new Date(now.getTime() - 1000),
      expiresAt: new Date(now.getTime() + 100_000),
      sessionTokenHash: "hash",
    });
    expect(await getAuthenticatedSession(prisma, "abc")).toBeNull();

    (prisma.session.findUnique as any).mockResolvedValue({
      id: "s3",
      user: { ...user, status: "INACTIVE" },
      revokedAt: null,
      expiresAt: new Date(now.getTime() + 100_000),
      sessionTokenHash: "hash",
    });
    expect(await getAuthenticatedSession(prisma, "abc")).toBeNull();
  });

  it("touches, revokes, and audits session updates", async () => {
    const update = vi.fn().mockResolvedValue({});
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const create = vi.fn().mockResolvedValue({});
    const prisma = {
      session: {
        update,
        updateMany,
      },
      auditEvent: {
        create,
      },
    } as unknown as PrismaClient;

    await touchSession(prisma, env, "s1");
    await revokeSessionByToken(prisma, "token");
    await revokeAllUserSessions(prisma, "u1");
    await createAuditEvent(prisma, {
      userId: "u1",
      eventType: "auth.test",
      eventPayloadJson: { ok: true } as never,
    });

    expect(update).toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalled();
    expect(create).toHaveBeenCalled();
  });

  it("implements login rate-limiting checks", () => {
    const base = { ipAddress: "127.0.0.1", email: "x@example.com" };

    expect(() => assertLoginRateLimit(env, base)).not.toThrow();
    recordLoginFailure(env, base);
    recordLoginFailure(env, base);
    recordLoginFailure(env, base);
    recordLoginFailure(env, base);
    recordLoginFailure(env, base);
    expect(() => assertLoginRateLimit(env, base)).toThrow();
    clearLoginFailures(base);
    expect(() => assertLoginRateLimit(env, base)).not.toThrow();
  });
});
