import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";

import { registerHealthRoutes } from "../../src/modules/health/routes.js";
import { createMockPrisma } from "../utils/mock-prisma.js";

type MealTemplateRecord = {
  id: string;
  userId: string;
  name: string;
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK" | null;
  templatePayloadJson: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

type MealPlanWeekRecord = {
  id: string;
  userId: string;
  startDate: Date;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type MealPlanEntryRecord = {
  id: string;
  mealPlanWeekId: string;
  date: Date;
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
  mealTemplateId: string;
  servings: number | null;
  note: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

type TaskRecord = {
  id: string;
  userId: string;
  title: string;
  notes: string | null;
  kind: "TASK";
  reminderAt: Date | null;
  reminderTriggeredAt: Date | null;
  status: "PENDING" | "COMPLETED" | "DROPPED";
  scheduledForDate: Date | null;
  dueAt: Date | null;
  goalId: string | null;
  originType: "MEAL_PLAN" | "MANUAL";
  carriedFromTaskId: string | null;
  recurrenceRuleId: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type MealPrepSessionRecord = {
  id: string;
  mealPlanWeekId: string;
  scheduledForDate: Date;
  title: string;
  notes: string | null;
  taskId: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

type MealPlanGroceryItemRecord = {
  id: string;
  mealPlanWeekId: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  section: string | null;
  note: string | null;
  sourceType: "PLANNED" | "MANUAL";
  isChecked: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

type MealLogRecord = {
  id: string;
  userId: string;
  occurredAt: Date;
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK" | null;
  mealTemplateId: string | null;
  mealPlanEntryId: string | null;
  description: string;
  loggingQuality: "PARTIAL" | "MEANINGFUL" | "FULL";
  createdAt: Date;
};

const USER_ID = "user-1";
const WEEK_START = "2026-03-09";
const TUESDAY = "2026-03-10";

describe("health routes meal planning", () => {
  let app: Awaited<ReturnType<typeof Fastify>> | undefined;
  let prisma: Record<string, unknown>;
  let mealTemplatesById: Map<string, MealTemplateRecord>;
  let mealPlanWeek: MealPlanWeekRecord | null;
  let mealPlanEntries: MealPlanEntryRecord[];
  let tasksById: Map<string, TaskRecord>;
  let prepSessions: MealPrepSessionRecord[];
  let groceryItems: MealPlanGroceryItemRecord[];
  let mealLogs: MealLogRecord[];
  let sequence: number;

  const authenticatedUser = {
    id: USER_ID,
    email: "owner@example.com",
    displayName: "Owner",
  };

  function nextId(prefix: string) {
    sequence += 1;
    const suffix = String(sequence).padStart(12, "0");
    return `00000000-0000-4000-8000-${suffix}`;
  }

  function parseDay(value: string) {
    return new Date(`${value}T00:00:00.000Z`);
  }

  function hydrateWeek(includeEntries = true) {
    if (!mealPlanWeek) {
      return null;
    }

    return {
      ...mealPlanWeek,
      entries: includeEntries
        ? mealPlanEntries
            .filter((entry) => entry.mealPlanWeekId === mealPlanWeek!.id)
            .map((entry) => ({
              ...entry,
              servings: entry.servings,
              mealTemplate: mealTemplatesById.get(entry.mealTemplateId)!,
              mealLogs: mealLogs
                .filter((mealLog) => mealLog.mealPlanEntryId === entry.id)
                .map((mealLog) => ({ id: mealLog.id })),
            }))
        : [],
      prepSessions: prepSessions
        .filter((session) => session.mealPlanWeekId === mealPlanWeek!.id)
        .map((session) => ({
          ...session,
          task: session.taskId ? { id: session.taskId, status: tasksById.get(session.taskId)!.status } : null,
        })),
      groceryItems: groceryItems.filter((item) => item.mealPlanWeekId === mealPlanWeek!.id),
    };
  }

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-03-10T12:00:00.000Z"));

    if (app) {
      await app.close();
    }

    sequence = 0;
    prisma = createMockPrisma();
    mealTemplatesById = new Map([
      [
        "11111111-1111-4111-8111-111111111111",
        {
          id: "11111111-1111-4111-8111-111111111111",
          userId: USER_ID,
          name: "Protein oats",
          mealSlot: "BREAKFAST",
          templatePayloadJson: {
            description: "Oats and fruit",
            servings: 2,
            prepMinutes: 10,
            cookMinutes: 5,
            ingredients: [
              { name: "Oats", quantity: 100, unit: "g", section: "Pantry", note: null },
              { name: "Milk", quantity: 2, unit: "cup", section: "Dairy", note: null },
            ],
            instructions: ["Mix", "Cook"],
            tags: ["quick"],
            notes: "Best warm",
          },
          createdAt: new Date("2026-03-01T08:00:00.000Z"),
          updatedAt: new Date("2026-03-01T08:00:00.000Z"),
          archivedAt: null,
        },
      ],
    ]);
    mealPlanWeek = null;
    mealPlanEntries = [];
    tasksById = new Map();
    prepSessions = [];
    groceryItems = [];
    mealLogs = [];

    prisma.$transaction = vi.fn(async (callback: (tx: Record<string, unknown>) => Promise<unknown>) => {
      return callback(prisma);
    }) as any;

    prisma.userPreference = {
      findUnique: vi.fn().mockResolvedValue({
        timezone: "UTC",
        dailyWaterTargetMl: 2500,
        weekStartsOn: 1,
      }),
    } as any;

    prisma.mealTemplate = {
      findMany: vi.fn().mockImplementation(async (args: any) => {
        const ids = args?.where?.id?.in as string[] | undefined;
        return [...mealTemplatesById.values()].filter((template) => {
          if (template.userId !== USER_ID) return false;
          if (template.archivedAt !== null && args?.where?.archivedAt === null) return false;
          if (ids && !ids.includes(template.id)) return false;
          return true;
        });
      }),
      findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
        const template = where?.id ? mealTemplatesById.get(where.id) ?? null : null;
        if (!template || template.userId !== USER_ID) return null;
        if (where?.archivedAt === null && template.archivedAt !== null) return null;
        return template;
      }),
    } as any;

    prisma.mealPlanWeek = {
      findUnique: vi.fn().mockImplementation(async ({ where }: any) => {
        const key = where?.userId_startDate;
        if (!mealPlanWeek) return null;
        if (key?.userId !== USER_ID) return null;
        if (mealPlanWeek.startDate.getTime() !== key.startDate.getTime()) return null;
        return hydrateWeek();
      }),
      create: vi.fn().mockImplementation(async ({ data }: any) => {
        const now = new Date("2026-03-10T12:00:00.000Z");
        mealPlanWeek = {
          id: nextId("week"),
          userId: data.userId,
          startDate: data.startDate,
          notes: data.notes ?? null,
          createdAt: now,
          updatedAt: now,
        };
        return mealPlanWeek;
      }),
      update: vi.fn().mockImplementation(async ({ where, data }: any) => {
        if (!mealPlanWeek || mealPlanWeek.id !== where.id) {
          throw new Error("Missing week");
        }
        mealPlanWeek = {
          ...mealPlanWeek,
          notes: data.notes ?? mealPlanWeek.notes,
          updatedAt: new Date("2026-03-10T12:05:00.000Z"),
        };
        return mealPlanWeek;
      }),
    } as any;

    prisma.mealPlanEntry = {
      findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
        const entry = mealPlanEntries.find((candidate) => candidate.id === where.id) ?? null;
        if (!entry || !mealPlanWeek) return null;
        return mealPlanWeek.userId === where.mealPlanWeek.userId ? entry : null;
      }),
      create: vi.fn().mockImplementation(async ({ data }: any) => {
        const now = new Date("2026-03-10T12:00:00.000Z");
        const entry: MealPlanEntryRecord = {
          id: nextId("entry"),
          mealPlanWeekId: data.mealPlanWeekId,
          date: data.date,
          mealSlot: data.mealSlot,
          mealTemplateId: data.mealTemplateId,
          servings: data.servings ?? null,
          note: data.note ?? null,
          sortOrder: data.sortOrder,
          createdAt: now,
          updatedAt: now,
        };
        mealPlanEntries.push(entry);
        return entry;
      }),
      update: vi.fn().mockImplementation(async ({ where, data }: any) => {
        const index = mealPlanEntries.findIndex((entry) => entry.id === where.id);
        if (index < 0) throw new Error("Missing entry");
        mealPlanEntries[index] = {
          ...mealPlanEntries[index]!,
          ...data,
          updatedAt: new Date("2026-03-10T12:05:00.000Z"),
        };
        return mealPlanEntries[index];
      }),
      deleteMany: vi.fn().mockImplementation(async ({ where }: any) => {
        const ids = (where?.id?.in ?? []) as string[];
        mealPlanEntries = mealPlanEntries.filter((entry) => !ids.includes(entry.id));
        mealLogs = mealLogs.map((mealLog) => (
          ids.includes(mealLog.mealPlanEntryId ?? "") ? { ...mealLog, mealPlanEntryId: null } : mealLog
        ));
        return { count: ids.length };
      }),
    } as any;

    prisma.task = {
      create: vi.fn().mockImplementation(async ({ data }: any) => {
        const now = new Date("2026-03-10T12:00:00.000Z");
        const task: TaskRecord = {
          id: nextId("task"),
          userId: data.userId,
          title: data.title,
          notes: data.notes ?? null,
          kind: data.kind,
          reminderAt: null,
          reminderTriggeredAt: null,
          status: "PENDING",
          scheduledForDate: data.scheduledForDate ?? null,
          dueAt: null,
          goalId: null,
          originType: data.originType,
          carriedFromTaskId: null,
          recurrenceRuleId: null,
          completedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        tasksById.set(task.id, task);
        return task;
      }),
      updateMany: vi.fn().mockImplementation(async ({ where, data }: any) => {
        const task = tasksById.get(where.id);
        if (!task || task.userId !== where.userId) {
          return { count: 0 };
        }

        tasksById.set(task.id, {
          ...task,
          ...data,
          updatedAt: new Date("2026-03-10T12:05:00.000Z"),
        });
        return { count: 1 };
      }),
    } as any;

    prisma.mealPrepSession = {
      create: vi.fn().mockImplementation(async ({ data }: any) => {
        const now = new Date("2026-03-10T12:00:00.000Z");
        const session: MealPrepSessionRecord = {
          id: nextId("prep"),
          mealPlanWeekId: data.mealPlanWeekId,
          scheduledForDate: data.scheduledForDate,
          title: data.title,
          notes: data.notes ?? null,
          taskId: data.taskId ?? null,
          sortOrder: data.sortOrder,
          createdAt: now,
          updatedAt: now,
        };
        prepSessions.push(session);
        return session;
      }),
      update: vi.fn().mockImplementation(async ({ where, data }: any) => {
        const index = prepSessions.findIndex((session) => session.id === where.id);
        if (index < 0) throw new Error("Missing prep session");
        prepSessions[index] = {
          ...prepSessions[index]!,
          ...data,
          updatedAt: new Date("2026-03-10T12:05:00.000Z"),
        };
        return prepSessions[index];
      }),
      deleteMany: vi.fn().mockImplementation(async ({ where }: any) => {
        const ids = (where?.id?.in ?? []) as string[];
        prepSessions = prepSessions.filter((session) => !ids.includes(session.id));
        return { count: ids.length };
      }),
    } as any;

    prisma.mealPlanGroceryItem = {
      create: vi.fn().mockImplementation(async ({ data }: any) => {
        const now = new Date("2026-03-10T12:00:00.000Z");
        const item: MealPlanGroceryItemRecord = {
          id: nextId("grocery"),
          mealPlanWeekId: data.mealPlanWeekId,
          name: data.name,
          quantity: data.quantity ?? null,
          unit: data.unit ?? null,
          section: data.section ?? null,
          note: data.note ?? null,
          sourceType: data.sourceType,
          isChecked: data.isChecked ?? false,
          sortOrder: data.sortOrder,
          createdAt: now,
          updatedAt: now,
        };
        groceryItems.push(item);
        return item;
      }),
      update: vi.fn().mockImplementation(async ({ where, data }: any) => {
        const index = groceryItems.findIndex((item) => item.id === where.id);
        if (index < 0) throw new Error("Missing grocery item");
        groceryItems[index] = {
          ...groceryItems[index]!,
          ...data,
          updatedAt: new Date("2026-03-10T12:05:00.000Z"),
        };
        return groceryItems[index];
      }),
      createMany: vi.fn().mockImplementation(async ({ data }: any) => {
        data.forEach((item: any) => {
          groceryItems.push({
            id: nextId("grocery"),
            mealPlanWeekId: item.mealPlanWeekId,
            name: item.name,
            quantity: item.quantity ?? null,
            unit: item.unit ?? null,
            section: item.section ?? null,
            note: item.note ?? null,
            sourceType: item.sourceType,
            isChecked: item.isChecked ?? false,
            sortOrder: item.sortOrder,
            createdAt: new Date("2026-03-10T12:00:00.000Z"),
            updatedAt: new Date("2026-03-10T12:00:00.000Z"),
          });
        });
        return { count: data.length };
      }),
      deleteMany: vi.fn().mockImplementation(async ({ where }: any) => {
        if (where?.mealPlanWeekId && where?.sourceType) {
          groceryItems = groceryItems.filter(
            (item) => !(item.mealPlanWeekId === where.mealPlanWeekId && item.sourceType === where.sourceType),
          );
          return { count: 0 };
        }

        const ids = (where?.id?.in ?? []) as string[];
        groceryItems = groceryItems.filter((item) => !ids.includes(item.id));
        return { count: ids.length };
      }),
    } as any;

    prisma.mealLog = {
      findMany: vi.fn().mockImplementation(async (args: any) => {
        const occurredAt = args?.where?.occurredAt;
        return mealLogs.filter((mealLog) => {
          if (mealLog.userId !== USER_ID) return false;
          if (occurredAt?.gte && mealLog.occurredAt < occurredAt.gte) return false;
          if (occurredAt?.lt && mealLog.occurredAt >= occurredAt.lt) return false;
          return true;
        });
      }),
      findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
        return mealLogs.find((mealLog) => mealLog.id === where.id && mealLog.userId === where.userId) ?? null;
      }),
      create: vi.fn().mockImplementation(async ({ data }: any) => {
        const now = new Date("2026-03-10T12:00:00.000Z");
        const mealLog: MealLogRecord = {
          id: nextId("meal-log"),
          userId: data.userId,
          occurredAt: data.occurredAt,
          mealSlot: data.mealSlot ?? null,
          mealTemplateId: data.mealTemplateId ?? null,
          mealPlanEntryId: data.mealPlanEntryId ?? null,
          description: data.description,
          loggingQuality: data.loggingQuality,
          createdAt: now,
        };
        mealLogs.push(mealLog);
        return mealLog;
      }),
    } as any;

    prisma.waterLog = {
      findMany: vi.fn().mockResolvedValue([]),
    } as any;
    prisma.workoutDay = {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    } as any;
    prisma.weightLog = {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
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

    await app.register(registerHealthRoutes, { prefix: "/api/health" });
    await app.ready();
  });

  afterEach(async () => {
    vi.useRealTimers();
    if (app) {
      await app.close();
    }
  });

  it("saves a meal-planning week, creates prep tasks, and generates groceries", async () => {
    const response = await app!.inject({
      method: "PUT",
      url: `/api/health/meal-plans/weeks/${WEEK_START}`,
      payload: {
        notes: "Prep the week on Monday night.",
        entries: [
          {
            date: TUESDAY,
            mealSlot: "breakfast",
            mealTemplateId: "11111111-1111-4111-8111-111111111111",
            servings: 4,
            note: "Add berries",
          },
        ],
        prepSessions: [
          {
            scheduledForDate: "2026-03-09",
            title: "Prep overnight oats",
            notes: "Use the large container",
          },
        ],
        manualGroceryItems: [
          {
            name: "Bananas",
            quantity: 6,
            unit: null,
            section: "Produce",
            isChecked: true,
          },
        ],
        plannedGroceryItems: [
          {
            name: "Oats",
            unit: "g",
            isChecked: true,
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);

    expect(body).toEqual(
      expect.objectContaining({
        startDate: WEEK_START,
        endDate: "2026-03-15",
        notes: "Prep the week on Monday night.",
        entries: [
          expect.objectContaining({
            date: TUESDAY,
            mealTemplateId: "11111111-1111-4111-8111-111111111111",
            mealTemplateName: "Protein oats",
            servings: 4,
            isLogged: false,
          }),
        ],
        prepSessions: [
          expect.objectContaining({
            title: "Prep overnight oats",
            taskStatus: "pending",
          }),
        ],
        summary: expect.objectContaining({
          totalPlannedMeals: 1,
          prepSessionsCount: 1,
          groceryItemCount: 3,
        }),
      }),
    );

    const createdTask = [...tasksById.values()][0];
    expect(createdTask).toMatchObject({
      originType: "MEAL_PLAN",
      scheduledForDate: parseDay("2026-03-09"),
      title: "Prep overnight oats",
    });

    expect(body.groceryItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Oats",
          quantity: 200,
          unit: "g",
          sourceType: "planned",
          isChecked: true,
        }),
        expect.objectContaining({
          name: "Milk",
          quantity: 4,
          unit: "cup",
          sourceType: "planned",
        }),
        expect.objectContaining({
          name: "Bananas",
          sourceType: "manual",
          isChecked: true,
        }),
      ]),
    );
  });

  it("logs a planned meal and exposes it through the health summary", async () => {
    const saveWeek = await app!.inject({
      method: "PUT",
      url: `/api/health/meal-plans/weeks/${WEEK_START}`,
      payload: {
        notes: null,
        entries: [
          {
            date: TUESDAY,
            mealSlot: "breakfast",
            mealTemplateId: "11111111-1111-4111-8111-111111111111",
          },
        ],
        prepSessions: [],
        manualGroceryItems: [],
      },
    });
    const savedWeek = JSON.parse(saveWeek.body);
    const entryId = savedWeek.entries[0].id as string;

    const postMealLog = await app!.inject({
      method: "POST",
      url: "/api/health/meal-logs",
      payload: {
        mealPlanEntryId: entryId,
        description: "Protein oats",
        loggingQuality: "full",
      },
    });

    expect(postMealLog.statusCode).toBe(201);
    expect(JSON.parse(postMealLog.body).mealLog).toEqual(
      expect.objectContaining({
        mealPlanEntryId: entryId,
        mealTemplateId: "11111111-1111-4111-8111-111111111111",
        mealSlot: "breakfast",
      }),
    );

    const summary = await app!.inject({
      method: "GET",
      url: "/api/health/summary?from=2026-03-09&to=2026-03-10",
    });

    expect(summary.statusCode).toBe(200);
    expect(JSON.parse(summary.body)).toEqual(
      expect.objectContaining({
        currentDay: expect.objectContaining({
          plannedMeals: [
            expect.objectContaining({
              mealPlanEntryId: entryId,
              title: "Protein oats",
              isLogged: true,
            }),
          ],
        }),
      }),
    );
  });
});
