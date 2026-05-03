import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";

import { getEnv } from "../app/env.js";
import { prepareRuntimeDatabase } from "../app/runtime-database.js";
import { backfillTaskReminders } from "../modules/planning/reminder-backfill.js";

async function main() {
  const env = getEnv();
  await prepareRuntimeDatabase(env);

  const prisma = new PrismaClient();

  try {
    const result = await backfillTaskReminders(prisma);
    console.info(`Backfilled ${result.updated} task reminder record(s); skipped ${result.skipped}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

const currentEntryPoint = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : null;

if (currentEntryPoint === import.meta.url) {
  void main();
}
