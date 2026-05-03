import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";

import { registerPlanningRoutes } from "../../../src/modules/planning/routes.js";
import { createMockPrisma } from "../../utils/mock-prisma.js";

vi.mock("../../../src/lib/recurrence/tasks.js", () => ({
  materializeRecurringTasksInRange: vi.fn().mockResolvedValue(undefined),
  materializeNextRecurringTaskOccurrence: vi.fn().mockResolvedValue(null),
  applyRecurringTaskCarryForward: vi.fn().mockResolvedValue(null),
}));

type TaskRecord = {
  id: string;
  userId: string;
  title: string;
  notes: string | null;
  kind: "TASK";
  reminderAt: Date | null;
  reminderTriggeredAt: Date | null;
  status: "PENDING";
  scheduledForDate: Date | null;
  dueAt: Date | null;
  goalId: string | null;
  goal: null;
  originType: "MANUAL";
  carriedFromTaskId: string | null;
  recurrenceRuleId: string | null;
  recurrenceRule: null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type PlannerBlockRecord = {
  id: string;
  planningCycleId: string;
  title: string | null;
  startsAt: Date;
  endsAt: Date;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

type PlannerLinkRecord = {
  id: string;
  blockId: string;
  taskId: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

type PlanningCycleRecord = {
  id: string;
  userId: string;
  cycleType: "DAY";
  cycleStartDate: Date;
  cycleEndDate: Date;
  plannerBlocksClearedAt: Date | null;
  theme: null;
  priorities: [];
};

type CyclePriorityRecord = {
  id: string;
  planningCycleId: string;
  slot: 1 | 2 | 3;
  title: string;
  status: "PENDING";
  goalId: string | null;
  goal: null;
  completedAt: Date | null;
};

const DAY_ISO = "2026-03-14";
const DAY_START = new Date("2026-03-14T00:00:00.000Z");
const PREVIOUS_DAY_START = new Date("2026-03-13T00:00:00.000Z");
const NEXT_DAY_ISO = "2026-03-15";
const NEXT_DAY_START = new Date("2026-03-15T00:00:00.000Z");
const TASK_ONE_ID = "11111111-1111-4111-8111-111111111111";
const TASK_TWO_ID = "22222222-2222-4222-8222-222222222222";

function buildTask(id: string, title: string): TaskRecord {
  return {
    id,
    userId: "user-1",
    title,
    notes: null,
    kind: "TASK",
    reminderAt: null,
    reminderTriggeredAt: null,
    status: "PENDING",
    scheduledForDate: DAY_START,
    dueAt: null,
    goalId: null,
    goal: null,
    originType: "MANUAL",
    carriedFromTaskId: null,
    recurrenceRuleId: null,
    recurrenceRule: null,
    completedAt: null,
    createdAt: new Date("2026-03-14T08:00:00.000Z"),
    updatedAt: new Date("2026-03-14T08:00:00.000Z"),
  };
}

describe("day planner planning routes", () => {
  let app: Awaited<ReturnType<typeof Fastify>> | undefined;
  let prisma: Record<string, unknown>;
  let tasksById: Map<string, TaskRecord>;
  let planningCyclesByDate: Map<string, PlanningCycleRecord>;
  let plannerBlocks: PlannerBlockRecord[];
  let plannerLinks: PlannerLinkRecord[];
  let cyclePriorities: CyclePriorityRecord[];
  let blockCounter: number;
  let linkCounter: number;
  let cycleCounter: number;
  let priorityCounter: number;

  const authenticatedUser = {
    id: "user-1",
    email: "owner@example.com",
    displayName: "Owner",
  };

  function getHydratedTask(taskId: string) {
    const task = tasksById.get(taskId);
    if (!task) {
      throw new Error(`Missing task ${taskId}`);
    }

    return { ...task };
  }

  function getCycleDateKey(date: Date) {
    return date.toISOString();
  }

  function getPlanningCycleById(planningCycleId: string) {
    return [...planningCyclesByDate.values()].find((entry) => entry.id === planningCycleId) ?? null;
  }

  function ensurePlanningCycleRecord(cycleStartDate: Date) {
    const key = getCycleDateKey(cycleStartDate);
    const existing = planningCyclesByDate.get(key);
    if (existing) {
      return existing;
    }

    const created: PlanningCycleRecord = {
      id: `cycle-${cycleCounter++}`,
      userId: "user-1",
      cycleType: "DAY",
      cycleStartDate,
      cycleEndDate: cycleStartDate,
      plannerBlocksClearedAt: null,
      theme: null,
      priorities: [],
    };
    planningCyclesByDate.set(key, created);

    return created;
  }

  function getHydratedBlock(blockId: string) {
    const block = plannerBlocks.find((entry) => entry.id === blockId);
    if (!block) {
      return null;
    }

    const taskLinks = plannerLinks
      .filter((entry) => entry.blockId === blockId)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((entry) => ({
        ...entry,
        task: getHydratedTask(entry.taskId),
      }));

    const planningCycle = getPlanningCycleById(block.planningCycleId);
    if (!planningCycle) {
      throw new Error(`Missing planning cycle ${block.planningCycleId}`);
    }

    return {
      ...block,
      planningCycle,
      taskLinks,
    };
  }

  beforeEach(async () => {
    if (app) {
      await app.close();
    }

    vi.clearAllMocks();
    prisma = createMockPrisma();
    tasksById = new Map([
      [TASK_ONE_ID, buildTask(TASK_ONE_ID, "Write report")],
      [TASK_TWO_ID, buildTask(TASK_TWO_ID, "Prepare slides")],
    ]);
    planningCyclesByDate = new Map();
    plannerBlocks = [];
    plannerLinks = [];
    cyclePriorities = [];
    blockCounter = 1;
    linkCounter = 1;
    cycleCounter = 1;
    priorityCounter = 1;
    ensurePlanningCycleRecord(DAY_START);

    prisma.$transaction = vi.fn(async (callback: (tx: Record<string, unknown>) => Promise<unknown>) => {
      return callback(prisma);
    }) as any;
    prisma.userPreference = {
      findUnique: vi.fn().mockResolvedValue({ timezone: "UTC", weekStartsOn: 1 }),
    } as any;
    prisma.planningCycle = {
      upsert: vi.fn().mockImplementation(async ({ where, create }: any) => {
        const cycleStartDate =
          where?.userId_cycleType_cycleStartDate?.cycleStartDate ?? create.cycleStartDate;

        return ensurePlanningCycleRecord(cycleStartDate);
      }),
      update: vi.fn().mockImplementation(async ({ where, data }: any) => {
        const cycle = getPlanningCycleById(where.id);
        if (!cycle) {
          throw new Error("Planning cycle not found");
        }

        const updatedCycle = {
          ...cycle,
          cycleEndDate: data.cycleEndDate ?? cycle.cycleEndDate,
          plannerBlocksClearedAt:
            data.plannerBlocksClearedAt === undefined
              ? cycle.plannerBlocksClearedAt
              : data.plannerBlocksClearedAt,
        };
        planningCyclesByDate.set(getCycleDateKey(updatedCycle.cycleStartDate), updatedCycle);
        return { ...updatedCycle };
      }),
      findFirst: vi.fn().mockImplementation(async ({ where, orderBy, select }: any) => {
        let cycles = [...planningCyclesByDate.values()].filter((entry) => {
          if (where?.userId && entry.userId !== where.userId) {
            return false;
          }

          if (where?.cycleType && entry.cycleType !== where.cycleType) {
            return false;
          }

          if (where?.cycleStartDate?.lt && !(entry.cycleStartDate < where.cycleStartDate.lt)) {
            return false;
          }

          if (where?.plannerBlocks?.some) {
            return plannerBlocks.some((block) => block.planningCycleId === entry.id);
          }

          return true;
        });

        if (orderBy?.cycleStartDate === "desc") {
          cycles = cycles.sort(
            (left, right) => right.cycleStartDate.getTime() - left.cycleStartDate.getTime(),
          );
        }

        const cycle = cycles[0];
        if (!cycle) {
          return null;
        }

        if (select?.id) {
          return { id: cycle.id };
        }

        return cycle;
      }),
    } as any;
    prisma.goal = {
      findMany: vi.fn().mockResolvedValue([]),
    } as any;
    prisma.cyclePriority = {
      findMany: vi.fn().mockImplementation(async ({ where }: any = {}) =>
        cyclePriorities
          .filter((priority) => where?.planningCycleId ? priority.planningCycleId === where.planningCycleId : true)
          .sort((left, right) => left.slot - right.slot)
          .map((priority) => ({ ...priority })),
      ),
      deleteMany: vi.fn().mockImplementation(async ({ where }: any) => {
        const ids = new Set((where?.id?.in ?? []) as string[]);
        const before = cyclePriorities.length;
        cyclePriorities = cyclePriorities.filter((priority) => !ids.has(priority.id));
        return { count: before - cyclePriorities.length };
      }),
      create: vi.fn().mockImplementation(async ({ data }: any) => {
        const created: CyclePriorityRecord = {
          id: `priority-${priorityCounter++}`,
          planningCycleId: data.planningCycleId,
          slot: data.slot,
          title: data.title,
          status: "PENDING",
          goalId: data.goalId ?? null,
          goal: null,
          completedAt: null,
        };
        cyclePriorities.push(created);
        return { ...created };
      }),
      update: vi.fn().mockImplementation(async ({ where, data }: any) => {
        const priorityIndex = cyclePriorities.findIndex((priority) => priority.id === where.id);
        if (priorityIndex === -1) {
          throw new Error("Priority not found");
        }

        cyclePriorities[priorityIndex] = {
          ...cyclePriorities[priorityIndex]!,
          slot: data.slot ?? cyclePriorities[priorityIndex]!.slot,
          title: data.title ?? cyclePriorities[priorityIndex]!.title,
          goalId: data.goalId === undefined ? cyclePriorities[priorityIndex]!.goalId : data.goalId,
        };

        return { ...cyclePriorities[priorityIndex]! };
      }),
    } as any;
    prisma.habit = {
      findMany: vi.fn().mockResolvedValue([]),
    } as any;
    prisma.task = {
      findMany: vi.fn().mockImplementation(async (args: any) => {
        const ids = args?.where?.id?.in as string[] | undefined;
        const scheduledForDate = args?.where?.scheduledForDate as Date | undefined;
        const selectedTasks = [...tasksById.values()].filter((task) => {
          if (ids && !ids.includes(task.id)) {
            return false;
          }

          if (scheduledForDate) {
            return task.scheduledForDate?.getTime() === scheduledForDate.getTime();
          }

          return true;
        });

        if (args?.select) {
          return selectedTasks.map((task) => ({
            id: task.id,
            kind: task.kind,
            scheduledForDate: task.scheduledForDate,
          }));
        }

        return selectedTasks.map((task) => ({ ...task }));
      }),
      updateMany: vi.fn().mockImplementation(async ({ where, data }: any) => {
        const ids = (where?.id?.in ?? []) as string[];
        ids.forEach((taskId) => {
          const task = tasksById.get(taskId);
          if (!task) {
            return;
          }

          tasksById.set(taskId, {
            ...task,
            dueAt: data.dueAt ?? null,
            updatedAt: new Date("2026-03-14T09:00:00.000Z"),
          });
        });

        return { count: ids.length };
      }),
      update: vi.fn().mockImplementation(async ({ where, data }: any) => {
        const task = tasksById.get(where.id);
        if (!task) {
          throw new Error("Task not found");
        }

        const updatedTask: TaskRecord = {
          ...task,
          dueAt: data.dueAt === undefined ? task.dueAt : data.dueAt,
          updatedAt: new Date("2026-03-14T09:00:00.000Z"),
        };
        tasksById.set(task.id, updatedTask);
        return { ...updatedTask };
      }),
    } as any;
    prisma.dayPlannerBlock = {
      count: vi.fn().mockImplementation(async ({ where }: any = {}) => {
        if (!where?.planningCycleId) {
          return plannerBlocks.length;
        }

        return plannerBlocks.filter((entry) => entry.planningCycleId === where.planningCycleId).length;
      }),
      create: vi.fn().mockImplementation(async ({ data }: any) => {
        const createdBlock: PlannerBlockRecord = {
          id: `00000000-0000-4000-8000-${String(blockCounter++).padStart(12, "0")}`,
          planningCycleId: data.planningCycleId,
          title: data.title ?? null,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
          sortOrder: data.sortOrder,
          createdAt: new Date("2026-03-14T08:30:00.000Z"),
          updatedAt: new Date("2026-03-14T08:30:00.000Z"),
        };
        plannerBlocks.push(createdBlock);
        return { ...createdBlock };
      }),
      findMany: vi.fn().mockImplementation(async (args: any) => {
        const cycleId = args?.where?.planningCycleId as string | undefined;
        let blocks = plannerBlocks
          .filter((entry) => (cycleId ? entry.planningCycleId === cycleId : true))
          .sort((left, right) => left.sortOrder - right.sortOrder);

        if (args?.select) {
          return blocks.map((entry) => ({
            id: args.select.id ? entry.id : undefined,
            title: args.select.title ? entry.title : undefined,
            startsAt: args.select.startsAt ? entry.startsAt : undefined,
            endsAt: args.select.endsAt ? entry.endsAt : undefined,
            sortOrder: args.select.sortOrder ? entry.sortOrder : undefined,
          }));
        }

        return blocks
          .map((entry) => getHydratedBlock(entry.id))
          .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
      }),
      findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
        const block = plannerBlocks.find((entry) => {
          const planningCycle = getPlanningCycleById(entry.planningCycleId);
          if (!planningCycle) {
            return false;
          }

          if (typeof where?.id === "string" && entry.id !== where.id) {
            return false;
          }

          if (where?.planningCycleId && entry.planningCycleId !== where.planningCycleId) {
            return false;
          }

          if (where?.planningCycle?.userId && where.planningCycle.userId !== "user-1") {
            return false;
          }

          if (
            where?.planningCycle?.cycleStartDate &&
            planningCycle.cycleStartDate.getTime() !== where.planningCycle.cycleStartDate.getTime()
          ) {
            return false;
          }

          if (
            where?.planningCycle?.cycleType &&
            planningCycle.cycleType !== where.planningCycle.cycleType
          ) {
            return false;
          }

          if (where?.startsAt?.lt && !(entry.startsAt < where.startsAt.lt)) {
            return false;
          }

          if (where?.endsAt?.gt && !(entry.endsAt > where.endsAt.gt)) {
            return false;
          }

          if (typeof where?.id === "object" && where.id?.not && entry.id === where.id.not) {
            return false;
          }

          return true;
        });

        if (!block) {
          return null;
        }

        if (where?.planningCycle) {
          return getHydratedBlock(block.id);
        }

        return { id: block.id };
      }),
      findUniqueOrThrow: vi.fn().mockImplementation(async ({ where }: any) => {
        const block = getHydratedBlock(where.id);
        if (!block) {
          throw new Error("Planner block not found");
        }

        return block;
      }),
      update: vi.fn().mockImplementation(async ({ where, data }: any) => {
        const blockIndex = plannerBlocks.findIndex((entry) => entry.id === where.id);
        if (blockIndex === -1) {
          throw new Error("Planner block not found");
        }

        plannerBlocks[blockIndex] = {
          ...plannerBlocks[blockIndex]!,
          title: data.title === undefined ? plannerBlocks[blockIndex]!.title : data.title,
          startsAt: data.startsAt ?? plannerBlocks[blockIndex]!.startsAt,
          endsAt: data.endsAt ?? plannerBlocks[blockIndex]!.endsAt,
          sortOrder: data.sortOrder ?? plannerBlocks[blockIndex]!.sortOrder,
          updatedAt: new Date("2026-03-14T09:30:00.000Z"),
        };

        return getHydratedBlock(where.id);
      }),
      deleteMany: vi.fn().mockImplementation(async ({ where }: any) => {
        const ids = new Set((where?.id?.in ?? []) as string[]);
        const before = plannerBlocks.length;
        plannerBlocks = plannerBlocks.filter((entry) => !ids.has(entry.id));
        plannerLinks = plannerLinks.filter((entry) => !ids.has(entry.blockId));
        return { count: before - plannerBlocks.length };
      }),
      delete: vi.fn().mockImplementation(async ({ where }: any) => {
        plannerBlocks = plannerBlocks.filter((entry) => entry.id !== where.id);
        plannerLinks = plannerLinks.filter((entry) => entry.blockId !== where.id);
        return { id: where.id };
      }),
    } as any;
    prisma.dayPlannerBlockTask = {
      findMany: vi.fn().mockImplementation(async ({ where }: any) => {
        let links = plannerLinks;

        if (where?.blockId) {
          if (where.blockId.in) {
            links = links.filter((entry) => where.blockId.in.includes(entry.blockId));
          } else {
            links = links.filter((entry) => entry.blockId === where.blockId);
          }
        }

        if (where?.taskId?.in) {
          links = links.filter((entry) => where.taskId.in.includes(entry.taskId));
        }

        return links
          .sort((left, right) => left.sortOrder - right.sortOrder)
          .map((entry) => ({ ...entry }));
      }),
      findUnique: vi.fn().mockImplementation(async ({ where }: any) => {
        const link = plannerLinks.find((entry) => entry.taskId === where.taskId);
        return link ? { ...link } : null;
      }),
      deleteMany: vi.fn().mockImplementation(async ({ where }: any) => {
        const before = plannerLinks.length;
        plannerLinks = plannerLinks.filter((entry) => {
          const matchesBlock = where?.OR?.[0]?.blockId === entry.blockId;
          const matchesTaskIds = where?.OR?.[1]?.taskId?.in?.includes(entry.taskId) ?? false;
          return !(matchesBlock || matchesTaskIds);
        });

        return { count: before - plannerLinks.length };
      }),
      createMany: vi.fn().mockImplementation(async ({ data }: any) => {
        data.forEach((entry: { blockId: string; taskId: string; sortOrder: number }) => {
          plannerLinks.push({
            id: `link-${linkCounter++}`,
            blockId: entry.blockId,
            taskId: entry.taskId,
            sortOrder: entry.sortOrder,
            createdAt: new Date("2026-03-14T08:45:00.000Z"),
            updatedAt: new Date("2026-03-14T08:45:00.000Z"),
          });
        });

        return { count: data.length };
      }),
      update: vi.fn().mockImplementation(async ({ where, data }: any) => {
        const linkIndex = plannerLinks.findIndex((entry) => entry.id === where.id);
        if (linkIndex === -1) {
          throw new Error("Planner link not found");
        }

        plannerLinks[linkIndex] = {
          ...plannerLinks[linkIndex]!,
          sortOrder: data.sortOrder,
          updatedAt: new Date("2026-03-14T09:30:00.000Z"),
        };

        return { ...plannerLinks[linkIndex]! };
      }),
      delete: vi.fn().mockImplementation(async ({ where }: any) => {
        const linkIndex = plannerLinks.findIndex((entry) => entry.taskId === where.taskId);
        if (linkIndex === -1) {
          throw new Error("Planner link not found");
        }

        const [removedLink] = plannerLinks.splice(linkIndex, 1);
        return removedLink;
      }),
    } as any;

    app = Fastify({ logger: false });
    app.decorate("prisma", prisma);
    app.decorateRequest("auth", null);
    app.addHook("onRequest", async (request) => {
      request.auth = {
        sessionToken: "session-token",
        sessionId: "session-id",
        userId: authenticatedUser.id,
        user: authenticatedUser,
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

  it("accepts three day priorities", async () => {
    const response = await app!.inject({
      method: "PUT",
      url: `/api/planning/days/${DAY_ISO}/priorities`,
      payload: {
        priorities: [
          { slot: 1, title: "Ship the review", goalId: null },
          { slot: 2, title: "Exercise", goalId: null },
          { slot: 3, title: "Plan dinner", goalId: null },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).priorities).toEqual([
      expect.objectContaining({ slot: 1, title: "Ship the review" }),
      expect.objectContaining({ slot: 2, title: "Exercise" }),
      expect.objectContaining({ slot: 3, title: "Plan dinner" }),
    ]);
  });

  it("rejects more than three day priorities", async () => {
    const response = await app!.inject({
      method: "PUT",
      url: `/api/planning/days/${DAY_ISO}/priorities`,
      payload: {
        priorities: [
          { slot: 1, title: "One", goalId: null },
          { slot: 2, title: "Two", goalId: null },
          { slot: 3, title: "Three", goalId: null },
          { slot: 3, title: "Four", goalId: null },
        ],
      },
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toBe("Request validation failed");
  });

  it("creates, updates, reorders, and clears day planner blocks while syncing task times", async () => {
    const createBlock = await app!.inject({
      method: "POST",
      url: `/api/planning/days/${DAY_ISO}/planner-blocks`,
      payload: {
        title: "Deep work",
        startsAt: "2026-03-14T09:00:00.000Z",
        endsAt: "2026-03-14T10:30:00.000Z",
        taskIds: [TASK_ONE_ID],
      },
    });

    expect(createBlock.statusCode).toBe(201);
    const createdBlock = JSON.parse(createBlock.body).plannerBlock;
    expect(createdBlock).toEqual(
      expect.objectContaining({
        title: "Deep work",
        tasks: [
          expect.objectContaining({
            taskId: TASK_ONE_ID,
            task: expect.objectContaining({
              id: TASK_ONE_ID,
              dueAt: "2026-03-14T09:00:00.000Z",
            }),
          }),
        ],
      }),
    );
    expect(tasksById.get(TASK_ONE_ID)?.dueAt?.toISOString()).toBe("2026-03-14T09:00:00.000Z");

    const updateBlock = await app!.inject({
      method: "PATCH",
      url: `/api/planning/days/${DAY_ISO}/planner-blocks/${createdBlock.id}`,
      payload: {
        title: "Focus session",
        startsAt: "2026-03-14T11:00:00.000Z",
        endsAt: "2026-03-14T12:00:00.000Z",
      },
    });

    expect(updateBlock.statusCode).toBe(200);
    expect(JSON.parse(updateBlock.body).plannerBlock).toEqual(
      expect.objectContaining({
        title: "Focus session",
        startsAt: "2026-03-14T11:00:00.000Z",
        endsAt: "2026-03-14T12:00:00.000Z",
      }),
    );
    expect(tasksById.get(TASK_ONE_ID)?.dueAt?.toISOString()).toBe("2026-03-14T11:00:00.000Z");

    const createSecondBlock = await app!.inject({
      method: "POST",
      url: `/api/planning/days/${DAY_ISO}/planner-blocks`,
      payload: {
        title: "Admin",
        startsAt: "2026-03-14T13:00:00.000Z",
        endsAt: "2026-03-14T13:30:00.000Z",
      },
    });

    expect(createSecondBlock.statusCode).toBe(201);
    const secondBlockId = JSON.parse(createSecondBlock.body).plannerBlock.id;

    const reorderBlocks = await app!.inject({
      method: "PUT",
      url: `/api/planning/days/${DAY_ISO}/planner-blocks/order`,
      payload: {
        blockIds: [secondBlockId, createdBlock.id],
      },
    });

    expect(reorderBlocks.statusCode).toBe(200);
    expect(JSON.parse(reorderBlocks.body).plannerBlocks.map((block: { id: string }) => block.id)).toEqual([
      secondBlockId,
      createdBlock.id,
    ]);

    const replaceTasks = await app!.inject({
      method: "PUT",
      url: `/api/planning/days/${DAY_ISO}/planner-blocks/${createdBlock.id}/tasks`,
      payload: {
        taskIds: [TASK_TWO_ID],
      },
    });

    expect(replaceTasks.statusCode).toBe(200);
    expect(JSON.parse(replaceTasks.body).plannerBlock.tasks).toEqual([
      expect.objectContaining({
        taskId: TASK_TWO_ID,
      }),
    ]);
    expect(tasksById.get(TASK_ONE_ID)?.dueAt).toBeNull();
    expect(tasksById.get(TASK_TWO_ID)?.dueAt?.toISOString()).toBe("2026-03-14T11:00:00.000Z");

    const removeTask = await app!.inject({
      method: "DELETE",
      url: `/api/planning/days/${DAY_ISO}/planner-blocks/${createdBlock.id}/tasks/${TASK_TWO_ID}`,
    });

    expect(removeTask.statusCode).toBe(200);
    expect(JSON.parse(removeTask.body).plannerBlock.tasks).toEqual([]);
    expect(tasksById.get(TASK_TWO_ID)?.dueAt).toBeNull();

    const overlappingBlock = await app!.inject({
      method: "POST",
      url: `/api/planning/days/${DAY_ISO}/planner-blocks`,
      payload: {
        title: "Overlap",
        startsAt: "2026-03-14T13:15:00.000Z",
        endsAt: "2026-03-14T14:00:00.000Z",
      },
    });

    expect(overlappingBlock.statusCode).toBe(400);

    const deleteFirstBlock = await app!.inject({
      method: "DELETE",
      url: `/api/planning/days/${DAY_ISO}/planner-blocks/${createdBlock.id}`,
    });

    expect(deleteFirstBlock.statusCode).toBe(204);

    const dayPlan = await app!.inject({
      method: "GET",
      url: `/api/planning/days/${DAY_ISO}`,
    });

    expect(dayPlan.statusCode).toBe(200);
    expect(JSON.parse(dayPlan.body).plannerBlocks).toEqual([
      expect.objectContaining({
        id: secondBlockId,
        title: "Admin",
        tasks: [],
      }),
    ]);
  });

  it("clears every planner block without completing or deleting assigned tasks", async () => {
    const previousCycle = ensurePlanningCycleRecord(PREVIOUS_DAY_START);
    plannerBlocks.push({
      id: "previous-template-block",
      planningCycleId: previousCycle.id,
      title: "Previous template",
      startsAt: new Date("2026-03-13T08:00:00.000Z"),
      endsAt: new Date("2026-03-13T09:00:00.000Z"),
      sortOrder: 1,
      createdAt: new Date("2026-03-13T07:00:00.000Z"),
      updatedAt: new Date("2026-03-13T07:00:00.000Z"),
    });

    const createFirstBlock = await app!.inject({
      method: "POST",
      url: `/api/planning/days/${DAY_ISO}/planner-blocks`,
      payload: {
        title: "Deep work",
        startsAt: "2026-03-14T09:00:00.000Z",
        endsAt: "2026-03-14T10:30:00.000Z",
        taskIds: [TASK_ONE_ID],
      },
    });
    const createSecondBlock = await app!.inject({
      method: "POST",
      url: `/api/planning/days/${DAY_ISO}/planner-blocks`,
      payload: {
        title: "Admin",
        startsAt: "2026-03-14T13:00:00.000Z",
        endsAt: "2026-03-14T13:30:00.000Z",
        taskIds: [TASK_TWO_ID],
      },
    });

    expect(createFirstBlock.statusCode).toBe(201);
    expect(createSecondBlock.statusCode).toBe(201);
    expect(tasksById.get(TASK_ONE_ID)?.dueAt?.toISOString()).toBe("2026-03-14T09:00:00.000Z");
    expect(tasksById.get(TASK_TWO_ID)?.dueAt?.toISOString()).toBe("2026-03-14T13:00:00.000Z");

    const clearTimeline = await app!.inject({
      method: "DELETE",
      url: `/api/planning/days/${DAY_ISO}/planner-blocks`,
    });

    expect(clearTimeline.statusCode).toBe(200);
    expect(JSON.parse(clearTimeline.body).plannerBlocks).toEqual([]);
    expect(plannerBlocks.filter((block) => block.planningCycleId !== previousCycle.id)).toEqual([]);
    expect(planningCyclesByDate.get(DAY_START.toISOString())?.plannerBlocksClearedAt).toBeInstanceOf(Date);
    expect(plannerLinks).toEqual([]);
    expect(tasksById.get(TASK_ONE_ID)).toEqual(expect.objectContaining({
      dueAt: null,
      status: "PENDING",
    }));
    expect(tasksById.get(TASK_TWO_ID)).toEqual(expect.objectContaining({
      dueAt: null,
      status: "PENDING",
    }));

    const dayPlan = await app!.inject({
      method: "GET",
      url: `/api/planning/days/${DAY_ISO}`,
    });

    expect(dayPlan.statusCode).toBe(200);
    expect(JSON.parse(dayPlan.body)).toEqual(expect.objectContaining({
      plannerBlocks: [],
      tasks: expect.arrayContaining([
        expect.objectContaining({ id: TASK_ONE_ID, status: "pending" }),
        expect.objectContaining({ id: TASK_TWO_ID, status: "pending" }),
      ]),
    }));
  });

  it("seeds a new day with the most recent planner block structure without carrying tasks", async () => {
    const previousCycle = ensurePlanningCycleRecord(DAY_START);
    plannerBlocks.push({
      id: "seed-block-1",
      planningCycleId: previousCycle.id,
      title: "Morning routine",
      startsAt: new Date("2026-03-14T07:00:00.000Z"),
      endsAt: new Date("2026-03-14T08:30:00.000Z"),
      sortOrder: 1,
      createdAt: new Date("2026-03-14T06:00:00.000Z"),
      updatedAt: new Date("2026-03-14T06:00:00.000Z"),
    });
    plannerBlocks.push({
      id: "seed-block-2",
      planningCycleId: previousCycle.id,
      title: "Deep work",
      startsAt: new Date("2026-03-14T10:00:00.000Z"),
      endsAt: new Date("2026-03-14T12:00:00.000Z"),
      sortOrder: 2,
      createdAt: new Date("2026-03-14T06:05:00.000Z"),
      updatedAt: new Date("2026-03-14T06:05:00.000Z"),
    });
    plannerLinks.push({
      id: "seed-link-1",
      blockId: "seed-block-1",
      taskId: TASK_ONE_ID,
      sortOrder: 1,
      createdAt: new Date("2026-03-14T06:10:00.000Z"),
      updatedAt: new Date("2026-03-14T06:10:00.000Z"),
    });

    const dayPlan = await app!.inject({
      method: "GET",
      url: `/api/planning/days/${NEXT_DAY_ISO}`,
    });

    expect(dayPlan.statusCode).toBe(200);
    const parsedBody = JSON.parse(dayPlan.body);

    expect(parsedBody.tasks).toEqual([]);
    expect(parsedBody.plannerBlocks).toEqual([
      expect.objectContaining({
        title: "Morning routine",
        startsAt: "2026-03-15T07:00:00.000Z",
        endsAt: "2026-03-15T08:30:00.000Z",
        tasks: [],
      }),
      expect.objectContaining({
        title: "Deep work",
        startsAt: "2026-03-15T10:00:00.000Z",
        endsAt: "2026-03-15T12:00:00.000Z",
        tasks: [],
      }),
    ]);

    const nextDayCycle = ensurePlanningCycleRecord(NEXT_DAY_START);
    expect(plannerBlocks.filter((entry) => entry.planningCycleId === nextDayCycle.id)).toHaveLength(2);
    expect(plannerLinks.filter((entry) => entry.blockId.startsWith("seed-block"))).toHaveLength(1);
  });
});
