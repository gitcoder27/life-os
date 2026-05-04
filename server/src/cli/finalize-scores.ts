import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";

import { getEnv } from "../app/env.js";
import { prepareRuntimeDatabase } from "../app/runtime-database.js";
import { finalizeClosedDayScores } from "../modules/scoring/service.js";

export type FinalizeScoresOptions = {
  now: Date;
};

type FinalizeScoresResult = {
  finalizedCount: number;
};

type ScoreFinalizer = (
  prisma: PrismaClient,
  now: Date,
) => Promise<FinalizeScoresResult>;

function parseDateArgument(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid --now value "${value}". Use an ISO date or timestamp.`);
  }

  return parsed;
}

export function parseFinalizeScoresArgs(
  args: string[],
  getCurrentDate = () => new Date(),
): FinalizeScoresOptions {
  let now: Date | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--now") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("Missing value for --now.");
      }

      now = parseDateArgument(value);
      index += 1;
      continue;
    }

    if (arg.startsWith("--now=")) {
      now = parseDateArgument(arg.slice("--now=".length));
      continue;
    }

    throw new Error(`Unsupported argument "${arg}". Expected --now <iso-date>.`);
  }

  return {
    now: now ?? getCurrentDate(),
  };
}

export async function runScoreFinalization(
  prisma: PrismaClient,
  options: FinalizeScoresOptions,
  finalizer: ScoreFinalizer = finalizeClosedDayScores,
) {
  return finalizer(prisma, options.now);
}

async function main(args = process.argv.slice(2)) {
  const options = parseFinalizeScoresArgs(args);
  const env = getEnv();
  await prepareRuntimeDatabase(env);

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
  });

  try {
    const result = await runScoreFinalization(prisma, options);
    console.info(
      `Finalized ${result.finalizedCount} closed-day score(s) as of ${options.now.toISOString()}.`,
    );
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
