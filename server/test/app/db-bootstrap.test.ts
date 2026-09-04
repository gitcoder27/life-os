import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const execFileMock = vi.hoisted(() => vi.fn());
const existsSyncMock = vi.hoisted(() => vi.fn());
const prismaConstructorMock = vi.hoisted(() => vi.fn());
const prismaInstances = vi.hoisted(() => [] as Array<{
  options: unknown;
  instance: {
    $executeRawUnsafe: ReturnType<typeof vi.fn>;
    $disconnect: ReturnType<typeof vi.fn>;
  };
}>);

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();

  return {
    ...actual,
    existsSync: existsSyncMock,
  };
});

vi.mock("@prisma/client", () => ({
  PrismaClient: prismaConstructorMock,
}));

import type { AppEnv } from "../../src/app/env.js";
import {
  ensureDatabaseExists,
  ensureDatabaseMigrations,
} from "../../src/app/db-bootstrap.js";

const env: AppEnv = {
  NODE_ENV: "production",
  HOST: "0.0.0.0",
  PORT: 3004,
  APP_ORIGIN: "https://example.com",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/life_os",
  DEV_DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/life_os_dev",
  PROD_DATABASE_URL: undefined,
  ENV_FILE_OVERRIDE: false,
  DATABASE_SEPARATION_STRICT: true,
  AUTO_CREATE_DATABASE: true,
  AUTO_APPLY_MIGRATIONS: true,
  TRUST_PROXY: false,
  SESSION_COOKIE_NAME: "life_os_session",
  SESSION_SECRET: "prod-secret-with-at-least-thirty-two-chars",
  SESSION_TTL_DAYS: 14,
  CSRF_COOKIE_NAME: "life_os_csrf",
  AUTH_RATE_LIMIT_WINDOW_MINUTES: 15,
  AUTH_RATE_LIMIT_MAX_ATTEMPTS: 5,
  BOOTSTRAP_USER_EMAIL: undefined,
  BOOTSTRAP_USER_PASSWORD: undefined,
  BOOTSTRAP_USER_DISPLAY_NAME: undefined,
  ALLOW_PRODUCTION_BOOTSTRAP: false,
  OWNER_EMAIL: undefined,
  OWNER_PASSWORD: undefined,
  OWNER_DISPLAY_NAME: "Owner",
};

const setupPrismaConstructor = () => {
  prismaConstructorMock.mockImplementation((options: unknown) => {
    const instance = {
      $executeRawUnsafe: vi.fn(async () => undefined),
      $disconnect: vi.fn(async () => undefined),
    };

    prismaInstances.push({ options, instance });
    return instance;
  });
};

beforeEach(() => {
  execFileMock.mockReset();
  existsSyncMock.mockReset();
  prismaConstructorMock.mockReset();
  prismaInstances.length = 0;
  setupPrismaConstructor();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ensureDatabaseMigrations", () => {
  it("skips migration deployment for test envs and disabled auto-migrate settings", async () => {
    await ensureDatabaseMigrations({
      ...env,
      NODE_ENV: "test",
    });
    await ensureDatabaseMigrations({
      ...env,
      AUTO_APPLY_MIGRATIONS: false,
    });

    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("runs prisma migrate deploy against the resolved schema path", async () => {
    existsSyncMock.mockImplementation((candidate: string) => candidate.endsWith("schema.prisma"));
    execFileMock.mockImplementation((_file, _args, _options, callback) => {
      callback(null, "", "");
    });

    await ensureDatabaseMigrations(env);

    expect(execFileMock).toHaveBeenCalledWith(
      "prisma",
      [
        "migrate",
        "deploy",
        "--schema",
        expect.stringContaining("server/prisma/schema.prisma"),
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
      expect.any(Function),
    );
  });

  it("fails fast when the Prisma schema is missing", async () => {
    existsSyncMock.mockReturnValue(false);

    await expect(ensureDatabaseMigrations(env)).rejects.toThrow(/Missing Prisma schema/);
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("wraps prisma migrate failures with bootstrap context", async () => {
    existsSyncMock.mockImplementation((candidate: string) => candidate.endsWith("schema.prisma"));
    execFileMock.mockImplementation((_file, _args, _options, callback) => {
      callback(new Error("migration failed"));
    });

    await expect(ensureDatabaseMigrations(env)).rejects.toThrow(
      "[db-bootstrap] Prisma migrate failed: migration failed",
    );
  });
});

describe("ensureDatabaseExists", () => {
  it("skips creation for test envs, disabled settings, and the maintenance database", async () => {
    await ensureDatabaseExists({
      ...env,
      NODE_ENV: "test",
    });
    await ensureDatabaseExists({
      ...env,
      AUTO_CREATE_DATABASE: false,
    });
    await ensureDatabaseExists({
      ...env,
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/postgres",
    });

    expect(prismaConstructorMock).not.toHaveBeenCalled();
  });

  it("creates the target database with a quoted identifier and disconnects", async () => {
    await ensureDatabaseExists({
      ...env,
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/life_os_tenant",
    });

    expect(prismaInstances).toHaveLength(1);
    expect(prismaInstances[0]?.instance.$executeRawUnsafe).toHaveBeenCalledWith(
      "CREATE DATABASE \"life_os_tenant\"",
    );
    expect(prismaInstances[0]?.instance.$disconnect).toHaveBeenCalledTimes(1);
  });

  it("treats an already-existing database as success", async () => {
    setupPrismaConstructor();
    prismaConstructorMock.mockImplementation((options: unknown) => {
      const instance = {
        $executeRawUnsafe: vi.fn(async () => {
          throw new Error("database already exists");
        }),
        $disconnect: vi.fn(async () => undefined),
      };

      prismaInstances.push({ options, instance });
      return instance;
    });

    await ensureDatabaseExists(env);

    expect(prismaInstances).toHaveLength(1);
    expect(prismaInstances[0]?.instance.$disconnect).toHaveBeenCalledTimes(1);
  });

  it("falls back to template1 when postgres is unavailable", async () => {
    prismaConstructorMock.mockImplementation((options: unknown) => {
      const callIndex = prismaInstances.length;
      const instance = {
        $executeRawUnsafe: vi.fn(async () => {
          if (callIndex === 0) {
            throw new Error("database \"postgres\" does not exist");
          }
          return undefined;
        }),
        $disconnect: vi.fn(async () => undefined),
      };

      prismaInstances.push({ options, instance });
      return instance;
    });

    await ensureDatabaseExists(env);

    expect(prismaInstances).toHaveLength(2);
    expect(prismaInstances[0]?.options).toMatchObject({
      datasources: {
        db: {
          url: expect.stringContaining("/postgres"),
        },
      },
    });
    expect(prismaInstances[1]?.options).toMatchObject({
      datasources: {
        db: {
          url: expect.stringContaining("/template1"),
        },
      },
    });
    expect(prismaInstances[0]?.instance.$disconnect).toHaveBeenCalledTimes(1);
    expect(prismaInstances[1]?.instance.$disconnect).toHaveBeenCalledTimes(1);
  });

  it("throws immediately for non-maintenance database failures", async () => {
    prismaConstructorMock.mockImplementation((options: unknown) => {
      const instance = {
        $executeRawUnsafe: vi.fn(async () => {
          throw new Error("permission denied");
        }),
        $disconnect: vi.fn(async () => undefined),
      };

      prismaInstances.push({ options, instance });
      return instance;
    });

    await expect(ensureDatabaseExists(env)).rejects.toThrow(
      /Could not ensure database "life_os" using admin database "postgres": permission denied/,
    );
    expect(prismaInstances).toHaveLength(1);
    expect(prismaInstances[0]?.instance.$disconnect).toHaveBeenCalledTimes(1);
  });
});
