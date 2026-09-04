import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";

import { getEnv } from "../app/env.js";
import { prepareRuntimeDatabase } from "../app/runtime-database.js";
import { getRegisteredJobs, type JobDefinition } from "./registry.js";

type WorkerScheduleFilter = "all" | "every-15-minutes" | "daily" | "weekly";

type WorkerRuntimeDependencies = {
  getEnv?: typeof getEnv;
  prepareRuntimeDatabase?: typeof prepareRuntimeDatabase;
  createPrisma?: (databaseUrl: string) => PrismaClient;
  getRegisteredJobs?: typeof getRegisteredJobs;
  logger?: Console;
  now?: () => Date;
};

type FailedWorkerJob = {
  name: string;
  error: unknown;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function buildWorkerFailureMessage(failures: FailedWorkerJob[], selectedJobCount: number) {
  const summaries = failures
    .map((failure) => `${failure.name}: ${getErrorMessage(failure.error)}`)
    .join("; ");

  return `[life-os-worker] ${failures.length} of ${selectedJobCount} selected job(s) failed: ${summaries}`;
}

export function parseWorkerScheduleFilter(args: string[]): WorkerScheduleFilter {
  const scheduleIndex = args.findIndex((arg) => arg === "--schedule");
  const inlineSchedule = args.find((arg) => arg.startsWith("--schedule="));
  const schedule = inlineSchedule
    ? inlineSchedule.slice("--schedule=".length)
    : scheduleIndex >= 0
      ? args[scheduleIndex + 1]
      : "all";

  if (
    schedule === "all" ||
    schedule === "every-15-minutes" ||
    schedule === "daily" ||
    schedule === "weekly"
  ) {
    return schedule;
  }

  throw new Error(
    `[life-os-worker] Unsupported --schedule value "${schedule}". Expected all, every-15-minutes, daily, or weekly.`,
  );
}

export function selectJobsForWorkerRun(
  jobs: JobDefinition[],
  scheduleFilter: WorkerScheduleFilter,
) {
  if (scheduleFilter === "all") {
    return jobs;
  }

  return jobs.filter((job) => job.schedule === scheduleFilter);
}

export async function startWorker(
  args = process.argv.slice(2),
  dependencies: WorkerRuntimeDependencies = {},
) {
  const scheduleFilter = parseWorkerScheduleFilter(args);
  const env = (dependencies.getEnv ?? getEnv)();
  await (dependencies.prepareRuntimeDatabase ?? prepareRuntimeDatabase)(env);
  const prisma = dependencies.createPrisma
    ? dependencies.createPrisma(env.DATABASE_URL)
    : new PrismaClient({
        datasources: {
          db: {
            url: env.DATABASE_URL,
          },
        },
      });
  const jobs = selectJobsForWorkerRun(
    (dependencies.getRegisteredJobs ?? getRegisteredJobs)(),
    scheduleFilter,
  );
  const logger = dependencies.logger ?? console;

  logger.info(
    `[life-os-worker] ready: ${jobs.length} registered job${jobs.length === 1 ? "" : "s"} for schedule ${scheduleFilter}`,
  );

  const failures: FailedWorkerJob[] = [];
  try {
    for (const job of jobs) {
      logger.info(`[life-os-worker] running: ${job.name} (${job.schedule})`);
      const startedAt = Date.now();
      try {
        const result = await job.run({
          prisma,
          now: dependencies.now ? dependencies.now() : new Date(),
          logger,
        });
        logger.info(
          `[life-os-worker] completed: ${job.name} in ${Date.now() - startedAt}ms - ${result.summary}`,
        );
      } catch (error) {
        failures.push({
          name: job.name,
          error,
        });
        logger.error(
          `[life-os-worker] failed: ${job.name} in ${Date.now() - startedAt}ms - ${getErrorMessage(error)}`,
        );
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  if (failures.length > 0) {
    throw new Error(buildWorkerFailureMessage(failures, jobs.length));
  }
}

const currentEntryPoint = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : null;

if (currentEntryPoint === import.meta.url) {
  void startWorker();
}
