import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";

import { isAppError } from "../../../src/lib/errors/app-error.js";
import { registerPlanningTaskRoutes } from "../../../src/modules/planning/task-routes.js";
import { createMockPrisma } from "../../utils/mock-prisma.js";

vi.mock("../../../src/lib/recurrence/tasks.js", () => ({
  materializeRecurringTasksInRange: vi.fn().mockResolvedValue(undefined),
  materializeNextRecurringTaskOccurrence: vi.fn().mockResolvedValue(null),
  applyRecurringTaskCarryForward: vi.fn().mockResolvedValue(null),
}));

const TASK_ID = "11111111-1111-4111-8111-111111111111";

type TaskRecord = {
  id: string;
  userId: string;
  title: string;
  notes: string | null;
  kind: "TASK" | "NOTE" | "REMINDER";
  reminderAt: Date | null;
  reminderTriggeredAt: Date | null;
  status: "PENDING" | "COMPLETED" | "DROPPED";
  scheduledForDate: Date | null;
  dueAt: Date | null;
  goalId: string | null;
  goal: null;
  originType: "QUICK_CAPTURE";
  carriedFromTaskId: string | null;
  recurrenceRuleId: string | null;
  recurrenceRule: null;
  nextAction: string | null;
  fiveMinuteVersion: string | null;
  estimatedDurationMinutes: number | null;
  likelyObstacle: string | null;
  focusLengthMinutes: number | null;
  progressState: "NOT_STARTED" | "STARTED" | "ADVANCED";
  startedAt: Date | null;
  lastStuckAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function buildTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: TASK_ID,
    userId: "user-1",
    title: "Finish draft",
    notes: null,
    kind: "TASK",
    reminderAt: null,
    reminderTriggeredAt: null,
    status: "PENDING",
    scheduledForDate: null,
    dueAt: null,
    goalId: null,
    goal: null,
    originType: "QUICK_CAPTURE",
    carriedFromTaskId: null,
    recurrenceRuleId: null,
    recurrenceRule: null,
    nextAction: null,
    fiveMinuteVersion: null,
    estimatedDurationMinutes: null,
    likelyObstacle: null,
    focusLengthMinutes: null,
    progressState: "NOT_STARTED",
    startedAt: null,
    lastStuckAt: null,
    completedAt: null,
    createdAt: new Date("2026-04-18T08:00:00.000Z"),
    updatedAt: new Date("2026-04-18T08:00:00.000Z"),
    ...overrides,
  };
}

function parseBody<T>(body: string) {
  return JSON.parse(body) as T;
}

describe("task commitment routes", () => {
  let app: Awaited<ReturnType<typeof Fastify>> | undefined;
  let prisma: Record<string, unknown>;
  let tasksById: Map<string, TaskRecord>;

  function hydrateTask(taskId: string) {
    const task = tasksById.get(taskId);
    if (!task) {
      throw new Error(`Missing task ${taskId}`);
    }

    return {
      ...task,
      goal: null,
      recurrenceRule: null,
    };
  }

  beforeEach(async () => {
    if (app) {
      await app.close();
    }

    prisma = createMockPrisma();
    tasksById = new Map([[TASK_ID, buildTask()]]);

    prisma.$transaction = vi.fn(async (callback: (tx: Record<string, unknown>) => Promise<unknown>) => {
      return callback(prisma);
    }) as never;
    prisma.userPreference = {
      findUnique: vi.fn().mockResolvedValue({ timezone: "UTC", notificationPreferences: null }),
    } as never;
    prisma.task = {
      findMany: vi.fn().mockImplementation(async ({ where }: any) => {
        const tasks = [...tasksById.values()].filter((task) => {
          if (where?.userId && task.userId !== where.userId) {
            return false;
          }

          if (where?.status && task.status !== where.status) {
            return false;
          }

          if (where?.originType && task.originType !== where.originType) {
            return false;
          }

          if (where?.scheduledForDate !== undefined && task.scheduledForDate !== where.scheduledForDate) {
            return false;
          }

          return true;
        });

        return tasks.map((task) => hydrateTask(task.id));
      }),
      findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
        const task = tasksById.get(where.id);
        if (!task || task.userId !== where.userId) {
          return null;
        }

        return hydrateTask(task.id);
      }),
      findUniqueOrThrow: vi.fn().mockImplementation(async ({ where }: any) => hydrateTask(where.id)),
      update: vi.fn().mockImplementation(async ({ where, data }: any) => {
        const existing = tasksById.get(where.id);
        if (!existing) {
          throw new Error(`Missing task ${where.id}`);
        }

        const updated: TaskRecord = {
          ...existing,
          scheduledForDate:
            data.scheduledForDate === undefined ? existing.scheduledForDate : data.scheduledForDate,
          dueAt: data.dueAt === undefined ? existing.dueAt : data.dueAt,
          reminderAt: data.reminderAt === undefined ? existing.reminderAt : data.reminderAt,
          reminderTriggeredAt:
            data.reminderTriggeredAt === undefined
              ? existing.reminderTriggeredAt
              : data.reminderTriggeredAt,
          nextAction: data.nextAction === undefined ? existing.nextAction : data.nextAction,
          fiveMinuteVersion:
            data.fiveMinuteVersion === undefined
              ? existing.fiveMinuteVersion
              : data.fiveMinuteVersion,
          estimatedDurationMinutes:
            data.estimatedDurationMinutes === undefined
              ? existing.estimatedDurationMinutes
              : data.estimatedDurationMinutes,
          likelyObstacle:
            data.likelyObstacle === undefined ? existing.likelyObstacle : data.likelyObstacle,
          focusLengthMinutes:
            data.focusLengthMinutes === undefined
              ? existing.focusLengthMinutes
              : data.focusLengthMinutes,
          updatedAt: new Date("2026-04-18T09:00:00.000Z"),
        };

        tasksById.set(updated.id, updated);
        return hydrateTask(updated.id);
      }),
      count: vi.fn().mockResolvedValue(0),
    } as never;
    prisma.dayPlannerBlockTask = {
      findUnique: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(null),
    } as never;
    prisma.auditEvent = {
      create: vi.fn().mockResolvedValue(null),
    } as never;
    prisma.notification = {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(null),
    } as never;

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
          email: "user@example.com",
          displayName: "User",
        },
      };
    });
    app.setErrorHandler((error, _request, reply) => {
      void reply.status(isAppError(error) ? error.statusCode : 500).send({
        success: false,
        code: isAppError(error) ? error.code : "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Unexpected server error",
        fieldErrors: isAppError(error) ? error.fieldErrors : undefined,
        generatedAt: new Date().toISOString(),
      });
    });

    await app.register(registerPlanningTaskRoutes, { prefix: "/api" });
    await app.ready();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }

    vi.clearAllMocks();
  });

  it("returns commitment guidance on inbox task responses", async () => {
    const response = await app!.inject({
      method: "GET",
      url: "/api/tasks?status=pending&originType=quick_capture&scheduledState=unscheduled",
    });

    expect(response.statusCode).toBe(200);
    const payload = parseBody<{
      tasks: Array<{
        commitmentGuidance: {
          readiness: string;
          blockingReasons: string[];
          suggestedReasons: string[];
          primaryMessage: string;
        };
      }>;
    }>(response.body);
    expect(payload.tasks[0]?.commitmentGuidance).toEqual({
      readiness: "needs_clarification",
      blockingReasons: ["missing_next_action"],
      suggestedReasons: [
        "missing_five_minute_version",
        "missing_estimate",
        "missing_obstacle",
        "missing_focus_length",
      ],
      primaryMessage: "Add the first visible step before scheduling this task.",
    });
  });

  it("rejects commit when next action is still missing", async () => {
    const response = await app!.inject({
      method: "POST",
      url: `/api/tasks/${TASK_ID}/commit`,
      payload: {
        scheduledForDate: "2026-04-19",
      },
    });

    expect(response.statusCode).toBe(400);
    const payload = parseBody<{
      code: string;
      message: string;
      fieldErrors?: Array<{ field: string; message: string }>;
    }>(response.body);
    expect(payload.code).toBe("VALIDATION_ERROR");
    expect(payload.message).toBe("Add the first visible step before scheduling this task.");
    expect(payload.fieldErrors).toEqual([
      {
        field: "nextAction",
        message: "Add the first visible step before scheduling this task.",
      },
    ]);
  });

  it("commits and schedules a clarified inbox task", async () => {
    const response = await app!.inject({
      method: "POST",
      url: `/api/tasks/${TASK_ID}/commit`,
      payload: {
        scheduledForDate: "2026-04-19",
        nextAction: "Open the draft and finish the first paragraph",
        fiveMinuteVersion: "Write three bullets",
        estimatedDurationMinutes: 40,
        likelyObstacle: "I may avoid the blank page",
        focusLengthMinutes: 25,
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = parseBody<{
      task: {
        scheduledForDate: string | null;
        nextAction: string | null;
        commitmentGuidance: {
          readiness: string;
          blockingReasons: string[];
          suggestedReasons: string[];
          primaryMessage: string;
        };
      };
    }>(response.body);
    expect(payload.task.scheduledForDate).toBe("2026-04-19");
    expect(payload.task.nextAction).toBe("Open the draft and finish the first paragraph");
    expect(payload.task.commitmentGuidance).toEqual({
      readiness: "ready",
      blockingReasons: [],
      suggestedReasons: [],
      primaryMessage: "Ready to schedule.",
    });
  });
});
