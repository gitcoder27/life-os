import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";

import { registerPlanningRoutes } from "../../../src/modules/planning/routes.js";
import { createMockPrisma } from "../../utils/mock-prisma.js";

const applyRecurringTaskCarryForward = vi.fn();

vi.mock("../../../src/lib/recurrence/tasks.js", () => ({
  materializeRecurringTasksInRange: vi.fn().mockResolvedValue(undefined),
  materializeNextRecurringTaskOccurrence: vi.fn().mockResolvedValue(null),
  applyRecurringTaskCarryForward: (...args: unknown[]) =>
    applyRecurringTaskCarryForward(...args),
}));

vi.mock("../../../src/modules/planning/inbox-zero.js", () => ({
  countStaleInboxTasks: vi.fn().mockResolvedValue(0),
  recordInboxZeroIfEarned: vi.fn().mockResolvedValue(undefined),
}));

type TaskRecord = {
  id: string;
  userId: string;
  title: string;
  notes: string | null;
  kind: "TASK";
  reminderAt: Date | null;
  reminderTriggeredAt: Date | null;
  status: "PENDING" | "DROPPED";
  scheduledForDate: Date | null;
  dueAt: Date | null;
  goalId: string | null;
  goal: null;
  originType: "MANUAL" | "RECURRING";
  carriedFromTaskId: string | null;
  recurrenceRuleId: string | null;
  recurrenceRule: null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const SOURCE_TASK_ID = "11111111-1111-4111-8111-111111111111";
const TARGET_TASK_ID = "22222222-2222-4222-8222-222222222222";

function buildTaskRecord(
  overrides: Partial<TaskRecord> & Pick<TaskRecord, "id" | "title">,
): TaskRecord {
  return {
    id: overrides.id,
    userId: "user-1",
    title: overrides.title,
    notes: null,
    kind: "TASK",
    reminderAt: null,
    reminderTriggeredAt: null,
    status: "PENDING",
    scheduledForDate: new Date("2026-03-14T00:00:00.000Z"),
    dueAt: new Date("2026-03-14T09:00:00.000Z"),
    goalId: null,
    goal: null,
    originType: "RECURRING",
    carriedFromTaskId: null,
    recurrenceRuleId: "rule-1",
    recurrenceRule: null,
    completedAt: null,
    createdAt: new Date("2026-03-14T08:00:00.000Z"),
    updatedAt: new Date("2026-03-14T08:00:00.000Z"),
    ...overrides,
  };
}

describe("task carry-forward history preservation", () => {
  let app: Awaited<ReturnType<typeof Fastify>> | undefined;
  let prisma: Record<string, unknown>;
  let tasksById: Map<string, TaskRecord>;

  beforeEach(async () => {
    if (app) {
      await app.close();
    }

    vi.clearAllMocks();
    prisma = createMockPrisma();
    tasksById = new Map([
      [
        SOURCE_TASK_ID,
        buildTaskRecord({
          id: SOURCE_TASK_ID,
          title: "Recurring deep work",
        }),
      ],
    ]);

    prisma.$transaction = vi.fn(async (callback: (tx: Record<string, unknown>) => Promise<unknown>) => {
      return callback(prisma);
    }) as any;
    prisma.userPreference = {
      findUnique: vi.fn().mockResolvedValue({ timezone: "UTC", weekStartsOn: 1 }),
    } as any;
    prisma.task = {
      findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
        if (!where?.id) {
          return null;
        }

        const task = tasksById.get(where.id);
        return task ? { ...task } : null;
      }),
      update: vi.fn().mockImplementation(async ({ where, data }: any) => {
        const task = tasksById.get(where.id);
        if (!task) {
          throw new Error("Task not found");
        }

        const updatedTask = {
          ...task,
          dueAt: data.dueAt === undefined ? task.dueAt : data.dueAt,
          status: data.status === undefined ? task.status : data.status,
          updatedAt: new Date("2026-03-14T09:30:00.000Z"),
        } satisfies TaskRecord;
        tasksById.set(task.id, updatedTask);
        return { ...updatedTask };
      }),
    } as any;
    prisma.dayPlannerBlockTask = {
      findUnique: vi.fn().mockImplementation(async ({ where }: any) => {
        if (where?.taskId !== SOURCE_TASK_ID) {
          return null;
        }

        return {
          id: "link-1",
          blockId: "block-1",
          taskId: SOURCE_TASK_ID,
        };
      }),
      delete: vi.fn(),
    } as any;

    app = Fastify({ logger: false });
    app.decorate("prisma", prisma);
    app.decorateRequest("auth", null);
    app.addHook("onRequest", async (request) => {
      request.auth = {
        sessionToken: "session-token",
        sessionId: "session-id",
        userId: "user-1",
        user: {
          id: "user-1",
          email: "owner@example.com",
          displayName: "Owner",
        },
      };
    });

    await app.register(registerPlanningRoutes, { prefix: "/api" });
    await app.ready();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it("keeps the source-day planner assignment when recurring carry-forward returns a new task", async () => {
    const targetTask = buildTaskRecord({
      id: TARGET_TASK_ID,
      title: "Recurring deep work",
      scheduledForDate: new Date("2026-03-15T00:00:00.000Z"),
      dueAt: new Date("2026-03-15T09:00:00.000Z"),
      carriedFromTaskId: SOURCE_TASK_ID,
    });
    tasksById.set(TARGET_TASK_ID, targetTask);
    applyRecurringTaskCarryForward.mockResolvedValue({ ...targetTask });

    const response = await app!.inject({
      method: "POST",
      url: `/api/tasks/${SOURCE_TASK_ID}/carry-forward`,
      payload: {
        targetDate: "2026-03-15",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(applyRecurringTaskCarryForward).toHaveBeenCalled();
    expect((prisma.dayPlannerBlockTask as any).delete).not.toHaveBeenCalled();
    expect(tasksById.get(SOURCE_TASK_ID)?.dueAt?.toISOString()).toBe("2026-03-14T09:00:00.000Z");
    expect(tasksById.get(TARGET_TASK_ID)?.dueAt).toBeNull();
    expect(JSON.parse(response.body).task).toEqual(
      expect.objectContaining({
        id: TARGET_TASK_ID,
        dueAt: null,
      }),
    );
  });
});
