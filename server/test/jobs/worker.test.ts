import { describe, expect, it } from "vitest";

import {
  parseWorkerScheduleFilter,
  selectJobsForWorkerRun,
} from "../../src/jobs/worker.js";
import type { JobDefinition } from "../../src/jobs/registry.js";

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
});
