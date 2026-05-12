import { beforeEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";

import { registerBehaviorRoutes } from "../../../src/modules/behavior/routes.js";
import { makeTask, TEST_DATE } from "../planning/adaptive-today-test-fixtures.js";

vi.mock("../../../src/modules/behavior/behavior-state-service.js", () => ({
  getBehaviorStateForUserDate: vi.fn(),
}));

const { getBehaviorStateForUserDate } = await import("../../../src/modules/behavior/behavior-state-service.js");

describe("behavior routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function buildApp() {
    const app = Fastify({ logger: false });
    app.decorate("prisma", {
      userPreference: {
        findUnique: vi.fn().mockResolvedValue({ timezone: "UTC" }),
      },
    });
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

    await app.register(registerBehaviorRoutes, { prefix: "/api/behavior" });
    await app.ready();
    return app;
  }

  it("returns a behavior state snapshot for the requested date", async () => {
    const task = makeTask({ id: "task-1", title: "Write memo" });
    vi.mocked(getBehaviorStateForUserDate).mockResolvedValue({
      date: TEST_DATE,
      state: "clear",
      severity: "helpful",
      label: "Clear",
      title: "Write memo",
      reason: "Must-win is ready.",
      signals: [],
      nextMove: {
        state: "start_must_win",
        title: task.title,
        reason: "Must-win is ready.",
        primaryAction: {
          type: "start_task",
          label: "Start this",
          targetId: task.id,
        },
        secondaryAction: null,
        taskId: task.id,
        plannerBlockId: null,
        severity: "helpful",
      },
      homeAction: {
        type: "open_route",
        route: "/today",
      },
    });
    const app = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: `/api/behavior/state?date=${TEST_DATE}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      date: TEST_DATE,
      behaviorState: {
        state: "clear",
        nextMove: {
          state: "start_must_win",
        },
      },
    });
    expect(getBehaviorStateForUserDate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: "user-1",
        date: TEST_DATE,
      }),
    );
    await app.close();
  });
});
