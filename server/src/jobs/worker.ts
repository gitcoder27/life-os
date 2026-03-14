import { getRegisteredJobs } from "./registry.js";

async function startWorker() {
  const jobs = getRegisteredJobs();

  console.info(
    `[life-os-worker] ready: ${jobs.length} registered job${jobs.length === 1 ? "" : "s"}`,
  );

  for (const job of jobs) {
    console.info(`[life-os-worker] job registered: ${job.name} (${job.schedule})`);
  }
}

void startWorker();
