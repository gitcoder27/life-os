import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";

import { registerFocusRoutes } from "../../src/modules/focus/routes.js";
import { createMockPrisma } from "../utils/mock-prisma.js";

type TaskRecord = {
  id: string;
  userId: string;
  title: string;
  notes: string | null;
  kind: "TASK" | "NOTE";
  reminderAt: Date | null;
  status: "PENDING" | "COMPLETED" | "DROPPED";
  scheduledForDate: Date | null;
  dueAt: Date | null;
  goalId: string | null;
  goal: null;
  originType: "MANUAL";
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

type FocusSessionRecord = {
  id: string;
  userId: string;
  taskId: string;
  depth: "DEEP" | "SHALLOW";
  plannedMinutes: number;
  startedAt: Date;
  endedAt: Date | null;
  status: "ACTIVE" | "COMPLETED" | "ABORTED";
  exitReason: "INTERRUPTED" | "LOW_ENERGY" | "UNCLEAR" | "SWITCHED_CONTEXT" | "DONE_ENOUGH" | null;
  distractionNotes: string | null;
  completionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const TASK_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_TASK_ID = "22222222-2222-4222-8222-222222222222";
const SESSION_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_SESSION_ID = "44444444-4444-4444-8444-444444444444";

function parseBody<T>(body: string) {
  return JSON.parse(body) as T;
}

function buildTask(id: string, userId = "user-1"): TaskRecord {
  return {
    id,
    userId,
    title: id === OTHER_TASK_ID ? "Deep work follow-up" : "Write the milestone summary",
    notes: null,
    kind: "TASK",
    reminderAt: null,
    status: "PENDING",
    scheduledForDate: new Date("2026-04-13T00:00:00.000Z"),
    dueAt: null,
    goalId: null,
    goal: null,
    originType: "MANUAL",
    carriedFromTaskId: null,
    recurrenceRuleId: null,
    recurrenceRule: null,
    nextAction: "Open the draft and finish the first pass",
    fiveMinuteVersion: null,
    estimatedDurationMinutes: null,
    likelyObstacle: null,
    focusLengthMinutes: 30,
    progressState: "NOT_STARTED",
    startedAt: null,
    lastStuckAt: null,
    completedAt: null,
    createdAt: new Date("2026-04-13T08:00:00.000Z"),
    updatedAt: new Date("2026-04-13T08:00:00.000Z"),
  };
}

describe("focus routes", () => {
  let app: Awaited<ReturnType<typeof Fastify>> | undefined;
  let prisma: Record<string, unknown>;
  let tasksById: Map<string, TaskRecord>;
  let sessionsById: Map<string, FocusSessionRecord>;
  let currentUserId: string;

  function hydrateTask(taskId: string) {
    const task = tasksById.get(taskId);
    if (!task) {
      throw new Error(`Missing task ${taskId}`);
    }

    return { ...task };
  }

  function hydrateSession(sessionId: string) {
    const session = sessionsById.get(sessionId);
    if (!session) {
      throw new Error(`Missing session ${sessionId}`);
    }

    return {
      ...session,
      task: hydrateTask(session.taskId),
    };
  }

  beforeEach(async () => {
    if (app) {
      await app.close();
    }

    prisma = createMockPrisma();
    tasksById = new Map([
      [TASK_ID, buildTask(TASK_ID)],
      [OTHER_TASK_ID, buildTask(OTHER_TASK_ID, "user-2")],
    ]);
    sessionsById = new Map();
    currentUserId = "user-1";

    prisma.$transaction = vi.fn(async (callback: (tx: Record<string, unknown>) => Promise<unknown>) => {
      return callback(prisma);
    }) as never;
    prisma.task = {
      findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
        return [...tasksById.values()].find((task) => {
          if (where?.id && task.id !== where.id) {
            return false;
          }

          if (where?.userId && task.userId !== where.userId) {
            return false;
          }

          return true;
        }) ?? null;
      }),
      update: vi.fn().mockImplementation(async ({ where, data }: any) => {
        const existing = tasksById.get(where.id);
        if (!existing) {
          throw new Error(`Missing task ${where.id}`);
        }

        const updated: TaskRecord = {
          ...existing,
          startedAt: data.startedAt === undefined ? existing.startedAt : data.startedAt,
          progressState: data.progressState ?? existing.progressState,
          status: data.status ?? existing.status,
          completedAt: data.completedAt === undefined ? existing.completedAt : data.completedAt,
          updatedAt: new Date(),
        };
        tasksById.set(updated.id, updated);
        return { ...updated };
      }),
    } as never;
    prisma.focusSession = {
      findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
        const sessions = [...sessionsById.values()].filter((session) => {
          if (where?.id && session.id !== where.id) {
            return false;
          }

          if (where?.userId && session.userId !== where.userId) {
            return false;
          }

          if (where?.status && session.status !== where.status) {
            return false;
          }

          return true;
        });

        if (sessions.length === 0) {
          return null;
        }

        sessions.sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime());
        return hydrateSession(sessions[0]!.id);
      }),
      create: vi.fn().mockImplementation(async ({ data }: any) => {
        const created: FocusSessionRecord = {
          id: SESSION_ID,
          userId: data.userId,
          taskId: data.taskId,
          depth: data.depth,
          plannedMinutes: data.plannedMinutes,
          startedAt: data.startedAt,
          endedAt: null,
          status: "ACTIVE",
          exitReason: null,
          distractionNotes: null,
          completionNote: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        sessionsById.set(created.id, created);
        return hydrateSession(created.id);
      }),
      update: vi.fn().mockImplementation(async ({ where, data }: any) => {
        const existing = sessionsById.get(where.id);
        if (!existing) {
          throw new Error(`Missing session ${where.id}`);
        }

        const updated: FocusSessionRecord = {
          ...existing,
          endedAt: data.endedAt === undefined ? existing.endedAt : data.endedAt,
          status: data.status ?? existing.status,
          exitReason: data.exitReason === undefined ? existing.exitReason : data.exitReason,
          distractionNotes:
            data.distractionNotes === undefined ? existing.distractionNotes : data.distractionNotes,
          completionNote:
            data.completionNote === undefined ? existing.completionNote : data.completionNote,
          updatedAt: new Date(),
        };
        sessionsById.set(updated.id, updated);
        return hydrateSession(updated.id);
      }),
    } as never;

    app = Fastify({ logger: false });
    app.decorate("prisma", prisma);
    app.decorateRequest("auth", null);
    app.addHook("onRequest", async (request) => {
      request.auth = {
        sessionToken: "session-token",
        sessionId: "session-id",
        userId: currentUserId,
        user: {
          id: currentUserId,
          email: `${currentUserId}@example.com`,
          displayName: currentUserId,
        },
      };
    });

    await app.register(registerFocusRoutes, { prefix: "/api/focus" });
    await app.ready();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }

    vi.clearAllMocks();
  });

  it("creates a focus session and marks the task started", async () => {
    const response = await app!.inject({
      method: "POST",
      url: "/api/focus/sessions",
      payload: {
        taskId: TASK_ID,
        depth: "deep",
        plannedMinutes: 30,
      },
    });

    expect(response.statusCode).toBe(201);
    const payload = parseBody<{ session: { taskId: string; task: { progressState: string }; plannedMinutes: number } }>(response.body);
    expect(payload.session.taskId).toBe(TASK_ID);
    expect(payload.session.task.progressState).toBe("started");
    expect(payload.session.plannedMinutes).toBe(30);
    expect(tasksById.get(TASK_ID)?.progressState).toBe("STARTED");
  });

  it("rejects starting a second active session", async () => {
    sessionsById.set(SESSION_ID, {
      id: SESSION_ID,
      userId: "user-1",
      taskId: TASK_ID,
      depth: "DEEP",
      plannedMinutes: 25,
      startedAt: new Date("2026-04-13T09:00:00.000Z"),
      endedAt: null,
      status: "ACTIVE",
      exitReason: null,
      distractionNotes: null,
      completionNote: null,
      createdAt: new Date("2026-04-13T09:00:00.000Z"),
      updatedAt: new Date("2026-04-13T09:00:00.000Z"),
    });

    const response = await app!.inject({
      method: "POST",
      url: "/api/focus/sessions",
      payload: {
        taskId: TASK_ID,
        plannedMinutes: 30,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(parseBody<{ message: string }>(response.body).message).toBe(
      "Finish the current focus session before starting another one.",
    );
  });

  it("captures distractions and exposes the active session", async () => {
    sessionsById.set(SESSION_ID, {
      id: SESSION_ID,
      userId: "user-1",
      taskId: TASK_ID,
      depth: "DEEP",
      plannedMinutes: 25,
      startedAt: new Date("2026-04-13T09:00:00.000Z"),
      endedAt: null,
      status: "ACTIVE",
      exitReason: null,
      distractionNotes: null,
      completionNote: null,
      createdAt: new Date("2026-04-13T09:00:00.000Z"),
      updatedAt: new Date("2026-04-13T09:00:00.000Z"),
    });

    const save = await app!.inject({
      method: "POST",
      url: `/api/focus/sessions/${SESSION_ID}/distraction`,
      payload: {
        note: "Slack message pulled me out.",
      },
    });
    const active = await app!.inject({
      method: "GET",
      url: "/api/focus/active",
    });

    expect(save.statusCode).toBe(200);
    expect(active.statusCode).toBe(200);
    expect(parseBody<{ session: { distractionNotes: string | null } }>(active.body).session.distractionNotes).toBe(
      "Slack message pulled me out.",
    );
  });

  it("completes a focus session and can mark the task completed", async () => {
    tasksById.set(TASK_ID, {
      ...buildTask(TASK_ID),
      progressState: "STARTED",
      startedAt: new Date("2026-04-13T09:00:00.000Z"),
    });
    sessionsById.set(SESSION_ID, {
      id: SESSION_ID,
      userId: "user-1",
      taskId: TASK_ID,
      depth: "DEEP",
      plannedMinutes: 25,
      startedAt: new Date("2026-04-13T09:00:00.000Z"),
      endedAt: null,
      status: "ACTIVE",
      exitReason: null,
      distractionNotes: null,
      completionNote: null,
      createdAt: new Date("2026-04-13T09:00:00.000Z"),
      updatedAt: new Date("2026-04-13T09:00:00.000Z"),
    });

    const response = await app!.inject({
      method: "POST",
      url: `/api/focus/sessions/${SESSION_ID}/complete`,
      payload: {
        taskOutcome: "completed",
        completionNote: "Finished the first deliverable.",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(parseBody<{ session: { status: string; completionNote: string | null } }>(response.body).session.status).toBe("completed");
    expect(tasksById.get(TASK_ID)?.status).toBe("COMPLETED");
    expect(tasksById.get(TASK_ID)?.progressState).toBe("ADVANCED");
  });

  it("aborts a focus session with a required exit reason", async () => {
    sessionsById.set(SESSION_ID, {
      id: SESSION_ID,
      userId: "user-1",
      taskId: TASK_ID,
      depth: "DEEP",
      plannedMinutes: 25,
      startedAt: new Date("2026-04-13T09:00:00.000Z"),
      endedAt: null,
      status: "ACTIVE",
      exitReason: null,
      distractionNotes: "Slack message pulled me out.",
      completionNote: null,
      createdAt: new Date("2026-04-13T09:00:00.000Z"),
      updatedAt: new Date("2026-04-13T09:00:00.000Z"),
    });

    const response = await app!.inject({
      method: "POST",
      url: `/api/focus/sessions/${SESSION_ID}/abort`,
      payload: {
        exitReason: "interrupted",
        note: "Had to jump onto a production issue.",
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = parseBody<{ session: { status: string; exitReason: string | null; distractionNotes: string | null } }>(response.body);
    expect(payload.session.status).toBe("aborted");
    expect(payload.session.exitReason).toBe("interrupted");
    expect(payload.session.distractionNotes).toContain("Exit note: Had to jump onto a production issue.");
    expect(tasksById.get(TASK_ID)?.status).toBe("PENDING");
  });

  it("rejects complete, abort, and distraction writes for another user's session", async () => {
    sessionsById.set(OTHER_SESSION_ID, {
      id: OTHER_SESSION_ID,
      userId: "user-1",
      taskId: TASK_ID,
      depth: "DEEP",
      plannedMinutes: 25,
      startedAt: new Date("2026-04-13T09:00:00.000Z"),
      endedAt: null,
      status: "ACTIVE",
      exitReason: null,
      distractionNotes: null,
      completionNote: null,
      createdAt: new Date("2026-04-13T09:00:00.000Z"),
      updatedAt: new Date("2026-04-13T09:00:00.000Z"),
    });
    currentUserId = "user-2";

    const [completeResponse, abortResponse, distractionResponse] = await Promise.all([
      app!.inject({
        method: "POST",
        url: `/api/focus/sessions/${OTHER_SESSION_ID}/complete`,
        payload: { taskOutcome: "advanced" },
      }),
      app!.inject({
        method: "POST",
        url: `/api/focus/sessions/${OTHER_SESSION_ID}/abort`,
        payload: { exitReason: "unclear" },
      }),
      app!.inject({
        method: "POST",
        url: `/api/focus/sessions/${OTHER_SESSION_ID}/distraction`,
        payload: { note: "Email interruption" },
      }),
    ]);

    expect(completeResponse.statusCode).toBe(404);
    expect(abortResponse.statusCode).toBe(404);
    expect(distractionResponse.statusCode).toBe(404);
  });
});
