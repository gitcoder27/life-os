import { describe, expect, it, vi } from "vitest";

const materializeRecurringExpenseItems = vi.fn();
const executeDueReminders = vi.fn();
const generateRuleNotifications = vi.fn();
const cleanupOldNotifications = vi.fn();
const finalizeClosedDayScores = vi.fn();
const ensureCycle = vi.fn();

vi.mock("../../src/modules/finance/service.js", () => ({
  materializeRecurringExpenseItems: (...args: unknown[]) => materializeRecurringExpenseItems(...args),
}));
vi.mock("../../src/modules/notifications/service.js", () => ({
  generateRuleNotifications: (...args: unknown[]) => generateRuleNotifications(...args),
  cleanupOldNotifications: (...args: unknown[]) => cleanupOldNotifications(...args),
}));
vi.mock("../../src/modules/planning/reminder-execution.js", () => ({
  executeDueReminders: (...args: unknown[]) => executeDueReminders(...args),
}));
vi.mock("../../src/modules/scoring/service.js", () => ({
  ensureCycle: (...args: unknown[]) => ensureCycle(...args),
  finalizeClosedDayScores: (...args: unknown[]) => finalizeClosedDayScores(...args),
}));

import { getRegisteredJobs } from "../../src/jobs/registry.js";

describe("jobs registry", () => {
  it("registers all expected jobs", () => {
    const jobs = getRegisteredJobs();
    const jobNames = jobs.map((job) => job.name);

    expect(jobNames).toEqual([
      "session-cleanup",
      "cycle-seeding",
      "score-finalizer",
      "recurring-expense-materializer",
      "reminder-executor",
      "notification-evaluator",
      "notification-cleanup",
    ]);
    expect(jobs.every((job) => typeof job.run === "function")).toBe(true);
  });

  it("runs each job with mocked collaborators", async () => {
    materializeRecurringExpenseItems.mockResolvedValue({
      createdAdminItems: 1,
      advancedTemplates: 1,
      unsupportedTemplates: 0,
    });
    executeDueReminders.mockResolvedValue({
      promoted: 2,
      notified: 2,
      skippedNotifications: 0,
    });
    generateRuleNotifications.mockResolvedValue({
      created: 3,
      skippedExisting: 1,
    });
    cleanupOldNotifications.mockResolvedValue({ deleted: 2 });
    finalizeClosedDayScores.mockResolvedValue({ finalizedCount: 4 });
    ensureCycle.mockResolvedValue({ id: "cycle-id" });

    const sessionDeleteMany = vi.fn().mockResolvedValue({ count: 2 });
    const userFindMany = vi.fn().mockResolvedValue([
      {
        id: "user-1",
        preferences: { weekStartsOn: 1 },
      },
    ]);
    const prisma = {
      session: { deleteMany: sessionDeleteMany },
      user: { findMany: userFindMany },
      planningCycle: { upsert: vi.fn() },
    } as any;
    const now = new Date("2026-03-14T12:00:00.000Z");
    const jobs = getRegisteredJobs();

    for (const job of jobs) {
      await job.run({ prisma, now, logger: console });
    }

    expect(sessionDeleteMany).toHaveBeenCalled();
    expect(userFindMany).toHaveBeenCalled();
    expect(materializeRecurringExpenseItems).toHaveBeenCalled();
    expect(executeDueReminders).toHaveBeenCalled();
    expect(generateRuleNotifications).toHaveBeenCalled();
    expect(cleanupOldNotifications).toHaveBeenCalled();
    expect(finalizeClosedDayScores).toHaveBeenCalled();
  });
});
