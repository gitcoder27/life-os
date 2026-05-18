import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";

import { getEnv } from "../app/env.js";
import { prepareRuntimeDatabase } from "../app/runtime-database.js";
import { backfillTaskReminders } from "../modules/planning/reminder-backfill.js";

type TaskReminderBackfillCliDependencies = {
  getEnv?: typeof getEnv;
  prepareRuntimeDatabase?: typeof prepareRuntimeDatabase;
  createPrisma?: () => PrismaClient;
  backfillTaskReminders?: typeof backfillTaskReminders;
  logger?: Pick<Console, "info" | "error">;
  exit?: (code: number) => never | void;
};

export async function runTaskReminderBackfillCli(
  dependencies: TaskReminderBackfillCliDependencies = {},
) {
  const env = (dependencies.getEnv ?? getEnv)();
  await (dependencies.prepareRuntimeDatabase ?? prepareRuntimeDatabase)(env);
  const logger = dependencies.logger ?? console;

  const prisma = dependencies.createPrisma
    ? dependencies.createPrisma()
    : new PrismaClient();

  try {
    const result = await (dependencies.backfillTaskReminders ?? backfillTaskReminders)(prisma);
    logger.info(`Backfilled ${result.updated} task reminder record(s); skipped ${result.skipped}.`);
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    (dependencies.exit ?? process.exit)(1);
  } finally {
    await prisma.$disconnect();
  }
}

const currentEntryPoint = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : null;

if (currentEntryPoint === import.meta.url) {
  void runTaskReminderBackfillCli();
}
