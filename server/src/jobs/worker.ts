import { PrismaClient } from "@prisma/client";

import { getEnv } from "../app/env.js";
import { getRegisteredJobs } from "./registry.js";

async function startWorker() {
  const env = getEnv();
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
  });
  const jobs = getRegisteredJobs();

  console.info(
    `[life-os-worker] ready: ${jobs.length} registered job${jobs.length === 1 ? "" : "s"}`,
  );

  try {
    for (const job of jobs) {
      console.info(`[life-os-worker] running: ${job.name} (${job.schedule})`);
      const startedAt = Date.now();
      const result = await job.run({
        prisma,
        now: new Date(),
        logger: console,
      });
      console.info(
        `[life-os-worker] completed: ${job.name} in ${Date.now() - startedAt}ms - ${result.summary}`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

void startWorker();
