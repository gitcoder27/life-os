import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@prisma/client";
import type { AppEnv } from "../../src/app/env.js";
import argon2 from "argon2";

import {
  createAuditEvent,
  createUserAccount,
  createUserSession,
  ensureBootstrapUserAccount,
  getAuthenticatedSession,
  hashSessionToken,
  listUserAccounts,
  revokeAllUserSessions,
  revokeSessionByToken,
  setUserPassword,
  toSessionUser,
  touchSession,
  updateUserAccountStatus,
  validateUserCredentials,
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
  BOOTSTRAP_USER_EMAIL: undefined,
  BOOTSTRAP_USER_PASSWORD: undefined,
  BOOTSTRAP_USER_DISPLAY_NAME: undefined,
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

  it("creates bootstrap user only when credentials are present and DB is empty", async () => {
    const create = vi.fn().mockResolvedValue({});
    const findUnique = vi.fn().mockResolvedValue(null);
    const count = vi.fn().mockResolvedValue(0);
    const prisma = { user: { findUnique, count, create } } as unknown as PrismaClient;
    const logger = { warn: vi.fn(), info: vi.fn() } as unknown as Console;

    (argon2.hash as any).mockResolvedValue("hashed");
    await ensureBootstrapUserAccount(prisma, env, logger);

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

  it("prefers BOOTSTRAP_USER env vars over legacy owner env vars", async () => {
    const create = vi.fn().mockResolvedValue({});
    const findUnique = vi.fn().mockResolvedValue(null);
    const count = vi.fn().mockResolvedValue(0);
    const prisma = { user: { findUnique, count, create } } as unknown as PrismaClient;
    const logger = { warn: vi.fn(), info: vi.fn() } as unknown as Console;

    (argon2.hash as any).mockResolvedValue("hashed");
    await ensureBootstrapUserAccount(
      prisma,
      {
        ...env,
        BOOTSTRAP_USER_EMAIL: "bootstrap@example.com",
        BOOTSTRAP_USER_PASSWORD: "bootstrap-password",
        BOOTSTRAP_USER_DISPLAY_NAME: "Bootstrap User",
      },
      logger,
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "bootstrap@example.com",
          displayName: "Bootstrap User",
        }),
      }),
    );
  });

  it("skips bootstrap when records already exist", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "existing" });
    const create = vi.fn();
    const prisma = { user: { findUnique, count: vi.fn(), create } } as unknown as PrismaClient;
    const logger = { warn: vi.fn(), info: vi.fn() } as unknown as Console;

    await ensureBootstrapUserAccount(prisma, env, logger);
    expect(create).not.toHaveBeenCalled();
  });

  it("validates active credentials correctly across different users", async () => {
    const firstUser = {
      id: "u1",
      email: env.OWNER_EMAIL,
      status: "ACTIVE",
      passwordHash: "hash-1",
    };
    const secondUser = {
      id: "u2",
      email: "second@example.com",
      status: "ACTIVE",
      passwordHash: "hash-2",
    };
    const findUnique = vi.fn(async ({ where }: { where: { email: string } }) => {
      if (where.email === firstUser.email) {
        return firstUser;
      }

      if (where.email === secondUser.email) {
        return secondUser;
      }

      return null;
    });
    const prisma = { user: { findUnique } } as unknown as PrismaClient;
    (argon2.verify as any).mockResolvedValue(false);

    expect(await validateUserCredentials(prisma, env.OWNER_EMAIL.toUpperCase(), "bad")).toBeNull();
    expect(await validateUserCredentials(prisma, "missing@example.com", "bad")).toBeNull();

    (argon2.verify as any).mockResolvedValue(true);
    expect(await validateUserCredentials(prisma, env.OWNER_EMAIL.toUpperCase(), "good")).toEqual(firstUser);
    expect(await validateUserCredentials(prisma, secondUser.email, "good")).toEqual(secondUser);
  });

  it("creates users with default preferences", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const create = vi.fn().mockResolvedValue({ id: "u-created", email: "new@example.com" });
    const prisma = { user: { findUnique, create } } as unknown as PrismaClient;

    (argon2.hash as any).mockResolvedValue("hashed");

    await createUserAccount(prisma, {
      email: "new@example.com",
      password: "password123",
      displayName: "New User",
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "new@example.com",
          passwordHash: "hashed",
          displayName: "New User",
          preferences: {
            create: {},
          },
        }),
      }),
    );
  });

  it("normalizes emails when creating users", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const create = vi.fn().mockResolvedValue({ id: "u-created", email: "mixed@example.com" });
    const prisma = { user: { findUnique, create } } as unknown as PrismaClient;

    (argon2.hash as any).mockResolvedValue("hashed");

    await createUserAccount(prisma, {
      email: "Mixed@Example.COM",
      password: "password123",
    });

    expect(findUnique).toHaveBeenCalledWith({
      where: {
        email: "mixed@example.com",
      },
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "mixed@example.com",
        }),
      }),
    );
  });

  it("updates user password and revokes existing sessions", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "u1",
      email: "owner@example.com",
    });
    const update = vi.fn().mockResolvedValue({
      id: "u1",
      email: "owner@example.com",
    });
    const updateMany = vi.fn().mockResolvedValue({ count: 2 });
    const prisma = {
      user: { findUnique, update },
      session: { updateMany },
    } as unknown as PrismaClient;

    (argon2.hash as any).mockResolvedValue("next-hash");

    const result = await setUserPassword(prisma, {
      email: "owner@example.com",
      password: "next-password",
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          passwordHash: "next-hash",
        }),
      }),
    );
    expect(updateMany).toHaveBeenCalled();
    expect(result.revokedSessions).toBe(2);
  });

  it("disables users and revokes existing sessions", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "u1",
      email: "owner@example.com",
    });
    const update = vi.fn().mockResolvedValue({
      id: "u1",
      email: "owner@example.com",
      status: "DISABLED",
    });
    const updateMany = vi.fn().mockResolvedValue({ count: 3 });
    const prisma = {
      user: { findUnique, update },
      session: { updateMany },
    } as unknown as PrismaClient;

    const result = await updateUserAccountStatus(prisma, {
      email: "owner@example.com",
      status: "DISABLED",
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: "DISABLED",
        },
      }),
    );
    expect(result.revokedSessions).toBe(3);
  });

  it("lists existing users for admin tooling", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "u1",
        email: "owner@example.com",
        displayName: "Owner",
        status: "ACTIVE",
        createdAt: new Date(),
        onboardedAt: null,
        lastLoginAt: null,
      },
    ]);
    const prisma = { user: { findMany } } as unknown as PrismaClient;

    const users = await listUserAccounts(prisma);

    expect(findMany).toHaveBeenCalledOnce();
    expect(users).toHaveLength(1);
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
      user: { ...user, status: "DISABLED" },
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
