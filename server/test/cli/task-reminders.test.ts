import { describe, expect, it, vi } from "vitest";

import type { AppEnv } from "../../src/app/env.js";
import { runTaskReminderBackfillCli } from "../../src/cli/task-reminders.js";

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

describe("task reminder backfill CLI", () => {
  it("prepares the runtime database, reports the backfill result, and disconnects", async () => {
    const prepareRuntimeDatabase = vi.fn(async () => undefined);
    const disconnect = vi.fn(async () => undefined);
    const prisma = { $disconnect: disconnect };
    const backfillTaskReminders = vi.fn(async () => ({
      updated: 4,
      skipped: 2,
    }));
    const logger = {
      info: vi.fn(),
      error: vi.fn(),
    };

    await runTaskReminderBackfillCli({
      getEnv: () => env,
      prepareRuntimeDatabase,
      createPrisma: () => prisma as never,
      backfillTaskReminders,
      logger,
    });

    expect(prepareRuntimeDatabase).toHaveBeenCalledWith(env);
    expect(backfillTaskReminders).toHaveBeenCalledWith(prisma);
    expect(logger.info).toHaveBeenCalledWith("Backfilled 4 task reminder record(s); skipped 2.");
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("logs failures, exits nonzero, and still disconnects", async () => {
    const disconnect = vi.fn(async () => undefined);
    const exit = vi.fn();
    const logger = {
      info: vi.fn(),
      error: vi.fn(),
    };

    await runTaskReminderBackfillCli({
      getEnv: () => env,
      prepareRuntimeDatabase: vi.fn(async () => undefined),
      createPrisma: () => ({ $disconnect: disconnect }) as never,
      backfillTaskReminders: vi.fn(async () => {
        throw new Error("backfill failed");
      }),
      logger,
      exit,
    });

    expect(logger.error).toHaveBeenCalledWith("backfill failed");
    expect(exit).toHaveBeenCalledWith(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
