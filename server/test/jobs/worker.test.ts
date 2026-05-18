import { describe, expect, it, vi } from "vitest";

import {
  parseWorkerScheduleFilter,
  selectJobsForWorkerRun,
  startWorker,
} from "../../src/jobs/worker.js";
import type { JobDefinition } from "../../src/jobs/registry.js";
import type { AppEnv } from "../../src/app/env.js";

const jobs: JobDefinition[] = [
  {
    name: "reminder-executor",
    schedule: "every-15-minutes",
    description: "Run reminders",
    run: async () => ({ summary: "ok" }),
  },
  {
    name: "session-cleanup",
    schedule: "daily",
    description: "Clean sessions",
    run: async () => ({ summary: "ok" }),
  },
  {
    name: "notification-cleanup",
    schedule: "weekly",
    description: "Clean notifications",
    run: async () => ({ summary: "ok" }),
  },
];

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

describe("worker scheduling", () => {
  it("filters jobs to the requested production timer schedule", () => {
    expect(selectJobsForWorkerRun(jobs, "every-15-minutes").map((job) => job.name)).toEqual([
      "reminder-executor",
    ]);
    expect(selectJobsForWorkerRun(jobs, "daily").map((job) => job.name)).toEqual([
      "session-cleanup",
    ]);
    expect(selectJobsForWorkerRun(jobs, "weekly").map((job) => job.name)).toEqual([
      "notification-cleanup",
    ]);
  });

  it("runs every registered job when no schedule is requested", () => {
    expect(selectJobsForWorkerRun(jobs, "all")).toHaveLength(3);
    expect(parseWorkerScheduleFilter([])).toBe("all");
  });

  it("parses timer schedule arguments and rejects unknown schedules", () => {
    expect(parseWorkerScheduleFilter(["--schedule", "daily"])).toBe("daily");
    expect(parseWorkerScheduleFilter(["--schedule=weekly"])).toBe("weekly");
    expect(() => parseWorkerScheduleFilter(["--schedule", "hourly"])).toThrow(
      /Unsupported --schedule value/,
    );
    expect(() => parseWorkerScheduleFilter(["--schedule"])).toThrow(
      /Unsupported --schedule value/,
    );
  });

  it("prepares runtime dependencies and runs only jobs matching the requested schedule", async () => {
    const prepareRuntimeDatabase = vi.fn(async () => undefined);
    const disconnect = vi.fn(async () => undefined);
    const prisma = { $disconnect: disconnect };
    const dailyRun = vi.fn(async () => ({ summary: "daily complete" }));
    const frequentRun = vi.fn(async () => ({ summary: "frequent complete" }));
    const logger = {
      info: vi.fn(),
      error: vi.fn(),
    } as unknown as Console;

    await startWorker(["--schedule", "daily"], {
      getEnv: () => env,
      prepareRuntimeDatabase,
      createPrisma: (databaseUrl) => {
        expect(databaseUrl).toBe(env.DATABASE_URL);
        return prisma as never;
      },
      getRegisteredJobs: () => [
        {
          name: "daily-job",
          schedule: "daily",
          description: "Daily",
          run: dailyRun,
        },
        {
          name: "frequent-job",
          schedule: "every-15-minutes",
          description: "Frequent",
          run: frequentRun,
        },
      ],
      logger,
      now: () => new Date("2026-05-03T12:00:00.000Z"),
    });

    expect(prepareRuntimeDatabase).toHaveBeenCalledWith(env);
    expect(dailyRun).toHaveBeenCalledWith({
      prisma,
      now: new Date("2026-05-03T12:00:00.000Z"),
      logger,
    });
    expect(frequentRun).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      "[life-os-worker] ready: 1 registered job for schedule daily",
    );
  });

  it("disconnects Prisma when a selected job fails", async () => {
    const disconnect = vi.fn(async () => undefined);
    const failure = new Error("job failed");

    await expect(
      startWorker(["--schedule=weekly"], {
        getEnv: () => env,
        prepareRuntimeDatabase: vi.fn(async () => undefined),
        createPrisma: () => ({ $disconnect: disconnect }) as never,
        getRegisteredJobs: () => [
          {
            name: "weekly-job",
            schedule: "weekly",
            description: "Weekly",
            run: vi.fn(async () => {
              throw failure;
            }),
          },
        ],
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        } as unknown as Console,
      }),
    ).rejects.toThrow("job failed");

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
