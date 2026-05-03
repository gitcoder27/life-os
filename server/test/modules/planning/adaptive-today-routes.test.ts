import { beforeEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";

import { registerAdaptiveTodayRoutes } from "../../../src/modules/planning/adaptive-today-routes.js";
import {
  makeContext,
  makeLaunch,
  makeTask,
  TEST_DATE,
} from "./adaptive-today-test-fixtures.js";

vi.mock("../../../src/lib/recurrence/tasks.js", () => ({
  materializeRecurringTasksInRange: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../src/modules/focus/service.js", () => ({
  getActiveFocusSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../src/modules/planning/adaptive-today-context.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/planning/adaptive-today-context.js")>(
    "../../../src/modules/planning/adaptive-today-context.js",
  );

  return {
    ...actual,
    loadAdaptiveTodayContext: vi.fn(),
  };
});

vi.mock("../../../src/modules/planning/day-shaping-service.js", () => ({
  buildShapeDayPreview: vi.fn(),
  applyShapeDayPlan: vi.fn(),
}));

vi.mock("../../../src/modules/planning/drift-recovery-service.js", () => ({
  previewDriftRecovery: vi.fn(),
  applyDriftRecovery: vi.fn(),
}));

const { loadAdaptiveTodayContext } = await import("../../../src/modules/planning/adaptive-today-context.js");
const { buildShapeDayPreview, applyShapeDayPlan } = await import("../../../src/modules/planning/day-shaping-service.js");
const { previewDriftRecovery, applyDriftRecovery } = await import("../../../src/modules/planning/drift-recovery-service.js");

describe("adaptive today planning routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function buildApp() {
    const app = Fastify({ logger: false });
    app.decorate("prisma", {});
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

    await app.register(registerAdaptiveTodayRoutes, { prefix: "/api" });
    await app.ready();
    return app;
  }

  it("returns adaptive guidance with capacity", async () => {
    const mustWin = makeTask({ id: "must-win", title: "Write memo" });
    vi.mocked(loadAdaptiveTodayContext).mockResolvedValue(makeContext({
      tasks: [mustWin],
      mustWinTask: mustWin,
      launch: makeLaunch({ mustWinTaskId: mustWin.id }),
    }));
    const app = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: `/api/planning/days/${TEST_DATE}/adaptive-guidance`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      date: TEST_DATE,
      nextMove: {
        state: "start_must_win",
      },
      capacity: {
        pendingTaskCount: 1,
      },
    });
    await app.close();
  });

  it("wires shape preview and apply through typed route bodies", async () => {
    vi.mocked(loadAdaptiveTodayContext).mockResolvedValue(makeContext());
    vi.mocked(buildShapeDayPreview).mockReturnValue({
      generatedAt: "2026-05-03T09:00:00.000Z",
      date: TEST_DATE,
      summary: "Adds 1 block, places 1 task.",
      capacity: {} as any,
      proposedBlocks: [],
      proposedAssignments: [],
      needsEstimateTasks: [],
      unplacedTasks: [],
      preservedBlocks: [],
    });
    vi.mocked(applyShapeDayPlan).mockResolvedValue({
      generatedAt: "2026-05-03T09:00:00.000Z",
      date: TEST_DATE,
      summary: "Applied.",
      plannerBlocks: [],
      capacity: {} as any,
    });
    const app = await buildApp();

    const previewResponse = await app.inject({
      method: "POST",
      url: `/api/planning/days/${TEST_DATE}/shape-preview`,
      payload: {},
    });
    const applyResponse = await app.inject({
      method: "POST",
      url: `/api/planning/days/${TEST_DATE}/shape-apply`,
      payload: {
        proposedBlocks: [
          {
            tempId: "shape-1",
            title: "Focus block",
            startsAt: "2026-05-03T09:00:00.000Z",
            endsAt: "2026-05-03T09:25:00.000Z",
            taskIds: ["task-1"],
            tasks: [
              {
                taskId: "task-1",
                title: "Task",
                estimatedMinutes: 25,
                assumedMinutes: false,
              },
            ],
          },
        ],
      },
    });

    expect(previewResponse.statusCode).toBe(200);
    expect(applyResponse.statusCode).toBe(200);
    expect(buildShapeDayPreview).toHaveBeenCalledOnce();
    expect(applyShapeDayPlan).toHaveBeenCalledOnce();
    await app.close();
  });

  it("previews and applies drift recovery through one endpoint", async () => {
    vi.mocked(loadAdaptiveTodayContext).mockResolvedValue(makeContext());
    vi.mocked(previewDriftRecovery).mockReturnValue({
      generatedAt: "2026-05-03T09:00:00.000Z",
      date: TEST_DATE,
      action: "unplan",
      mode: "preview",
      summary: "Return 1 slipped task to unplanned.",
      affectedTaskIds: ["task-1"],
      changes: [],
    });
    vi.mocked(applyDriftRecovery).mockResolvedValue({
      generatedAt: "2026-05-03T09:00:00.000Z",
      date: TEST_DATE,
      action: "unplan",
      mode: "apply",
      summary: "Unplanned 1 slipped task.",
      affectedTaskIds: ["task-1"],
      changes: [],
      plannerBlocks: [],
      capacity: {} as any,
    });
    const app = await buildApp();

    const previewResponse = await app.inject({
      method: "POST",
      url: `/api/planning/days/${TEST_DATE}/drift-recovery`,
      payload: {
        mode: "preview",
        action: "unplan",
        taskIds: ["task-1"],
      },
    });
    const applyResponse = await app.inject({
      method: "POST",
      url: `/api/planning/days/${TEST_DATE}/drift-recovery`,
      payload: {
        mode: "apply",
        action: "unplan",
        taskIds: ["task-1"],
      },
    });

    expect(previewResponse.statusCode).toBe(200);
    expect(applyResponse.statusCode).toBe(200);
    expect(previewDriftRecovery).toHaveBeenCalledOnce();
    expect(applyDriftRecovery).toHaveBeenCalledOnce();
    await app.close();
  });
});
