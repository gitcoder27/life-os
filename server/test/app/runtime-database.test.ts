import { describe, expect, it, vi } from "vitest";

import type { AppEnv } from "../../src/app/env.js";
import { prepareRuntimeDatabase } from "../../src/app/runtime-database.js";

const env: AppEnv = {
  NODE_ENV: "production",
  HOST: "0.0.0.0",
  PORT: 3004,
  APP_ORIGIN: "https://example.com",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/life_os",
  DEV_DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/life_os_dev",
  PROD_DATABASE_URL: undefined,
  DATABASE_SEPARATION_STRICT: true,
  AUTO_CREATE_DATABASE: true,
  AUTO_APPLY_MIGRATIONS: true,
  SESSION_COOKIE_NAME: "life_os_session",
  SESSION_SECRET: "prod-secret-with-at-least-thirty-two-chars",
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

describe("prepareRuntimeDatabase", () => {
  it("checks database separation before creation or migrations", async () => {
    const calls: string[] = [];

    await prepareRuntimeDatabase(env, {
      assertSeparation: vi.fn(() => calls.push("assert")),
      ensureExists: vi.fn(async () => {
        calls.push("exists");
      }),
      ensureMigrations: vi.fn(async () => {
        calls.push("migrations");
      }),
    });

    expect(calls).toEqual(["assert", "exists", "migrations"]);
  });

  it("does not create or migrate when separation fails", async () => {
    const ensureExists = vi.fn(async () => undefined);
    const ensureMigrations = vi.fn(async () => undefined);

    await expect(
      prepareRuntimeDatabase(env, {
        assertSeparation: () => {
          throw new Error("database collision");
        },
        ensureExists,
        ensureMigrations,
      }),
    ).rejects.toThrow("database collision");

    expect(ensureExists).not.toHaveBeenCalled();
    expect(ensureMigrations).not.toHaveBeenCalled();
  });
});
