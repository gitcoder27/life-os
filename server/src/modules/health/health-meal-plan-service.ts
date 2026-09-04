import type { FastifyPluginAsync } from "fastify";
import type {
  IsoDateString,
  MealPlanWeekResponse,
  PlannedMealTodayItem,
  SaveMealPlanWeekRequest,
  TaskOriginType,
  TaskStatus,
} from "@life-os/contracts";
import type {
  MealLog,
  MealPlanEntry,
  MealPlanGroceryItem as PrismaMealPlanGroceryItem,
  MealPlanGrocerySourceType as PrismaMealPlanGrocerySourceType,
  MealPlanWeek,
  MealTemplate as PrismaMealTemplate,
  MealPrepSession,
  Task,
} from "@prisma/client";

import { AppError } from "../../lib/errors/app-error.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { addIsoDays, getWeekEndDate, getWeekStartIsoDate, parseIsoDate } from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import {
  fromPrismaMealSlot,
  serializeMealTemplate,
  toPrismaMealSlot,
} from "./health-mappers.js";
import {
  parseMealTemplatePayload,
  trimToNull,
} from "./meal-template-payload.js";

type HealthApp = Parameters<FastifyPluginAsync>[0];

function normalizeKeyPart(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase();
}

function getGroceryCheckKey(name: string, unit: string | null | undefined) {
  return `${normalizeKeyPart(name)}::${normalizeKeyPart(unit)}`;
}

function assertIsoDateWithinWeek(date: IsoDateString, startDate: IsoDateString, endDate: IsoDateString, field: string) {
  if (date < startDate || date > endDate) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: `${field} must stay within the selected week`,
    });
  }
}

function toPrismaMealPlanGrocerySourceType(sourceType: "planned" | "manual"): PrismaMealPlanGrocerySourceType {
  switch (sourceType) {
    case "planned":
      return "PLANNED";
    case "manual":
      return "MANUAL";
  }
}

function fromPrismaMealPlanGrocerySourceType(sourceType: PrismaMealPlanGrocerySourceType): "planned" | "manual" {
  switch (sourceType) {
    case "PLANNED":
      return "planned";
    case "MANUAL":
      return "manual";
  }
}

const fromPrismaTaskStatus = (status: "PENDING" | "COMPLETED" | "DROPPED"): TaskStatus => {
  switch (status) {
    case "PENDING":
      return "pending";
    case "COMPLETED":
      return "completed";
    case "DROPPED":
      return "dropped";
  }
};

const toPrismaTaskStatus = (status: TaskStatus) => {
  switch (status) {
    case "pending":
      return "PENDING";
    case "completed":
      return "COMPLETED";
    case "dropped":
      return "DROPPED";
  }
};

const toPrismaTaskOriginType = (originType: TaskOriginType) => {
  switch (originType) {
    case "manual":
      return "MANUAL";
    case "quick_capture":
      return "QUICK_CAPTURE";
    case "carry_forward":
      return "CARRY_FORWARD";
    case "review_seed":
      return "REVIEW_SEED";
    case "recurring":
      return "RECURRING";
    case "template":
      return "TEMPLATE";
    case "meal_plan":
      return "MEAL_PLAN";
  }
};

type MealPlanEntryRecord = MealPlanEntry & {
  mealTemplate: Pick<PrismaMealTemplate, "id" | "name" | "templatePayloadJson">;
  mealLogs: Array<Pick<MealLog, "id">>;
};

type MealPrepSessionRecord = MealPrepSession & {
  task: Pick<Task, "id" | "status"> | null;
};

type MealPlanWeekRecord = MealPlanWeek & {
  entries: MealPlanEntryRecord[];
  prepSessions: MealPrepSessionRecord[];
  groceryItems: PrismaMealPlanGroceryItem[];
};

function roundToTwoDecimals(value: number) {
  return Math.round(value * 100) / 100;
}

function serializeMealPlanEntry(entry: MealPlanEntryRecord) {
  return {
    id: entry.id,
    date: toIsoDateString(entry.date),
    mealSlot: fromPrismaMealSlot(entry.mealSlot) ?? "breakfast",
    mealTemplateId: entry.mealTemplateId,
    mealTemplateName: entry.mealTemplate.name,
    servings: entry.servings ? Number(entry.servings) : null,
    note: entry.note,
    sortOrder: entry.sortOrder,
    isLogged: entry.mealLogs.length > 0,
    loggedMealCount: entry.mealLogs.length,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

function serializeMealPrepSession(session: MealPrepSessionRecord) {
  return {
    id: session.id,
    scheduledForDate: toIsoDateString(session.scheduledForDate),
    title: session.title,
    notes: session.notes,
    taskId: session.taskId,
    taskStatus: session.task ? fromPrismaTaskStatus(session.task.status) : null,
    sortOrder: session.sortOrder,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

function serializeMealPlanGroceryItem(groceryItem: PrismaMealPlanGroceryItem) {
  return {
    id: groceryItem.id,
    name: groceryItem.name,
    quantity: groceryItem.quantity ? Number(groceryItem.quantity) : null,
    unit: groceryItem.unit,
    section: groceryItem.section,
    note: groceryItem.note,
    sourceType: fromPrismaMealPlanGrocerySourceType(groceryItem.sourceType),
    isChecked: groceryItem.isChecked,
    sortOrder: groceryItem.sortOrder,
    createdAt: groceryItem.createdAt.toISOString(),
    updatedAt: groceryItem.updatedAt.toISOString(),
  };
}

function serializePlannedMealToday(entry: MealPlanEntryRecord): PlannedMealTodayItem {
  return {
    mealPlanEntryId: entry.id,
    date: toIsoDateString(entry.date),
    mealSlot: fromPrismaMealSlot(entry.mealSlot) ?? "breakfast",
    mealTemplateId: entry.mealTemplateId,
    title: entry.mealTemplate.name,
    servings: entry.servings ? Number(entry.servings) : null,
    note: entry.note,
    isLogged: entry.mealLogs.length > 0,
  };
}

function buildMealPlanWeekSummary(week: MealPlanWeekRecord | null) {
  const entries = week?.entries ?? [];
  const prepSessions = week?.prepSessions ?? [];
  const groceryItems = week?.groceryItems ?? [];

  return {
    totalPlannedMeals: entries.length,
    loggedPlannedMeals: entries.filter((entry) => entry.mealLogs.length > 0).length,
    prepSessionsCount: prepSessions.length,
    completedPrepSessionsCount: prepSessions.filter((session) => session.task?.status === "COMPLETED").length,
    groceryItemCount: groceryItems.length,
  };
}

function buildPlannedGroceryRows(
  entries: SaveMealPlanWeekRequest["entries"],
  templateById: Map<string, Pick<PrismaMealTemplate, "id" | "templatePayloadJson">>,
  checkedByKey: Map<string, boolean>,
) {
  const aggregate = new Map<string, {
    name: string;
    quantity: number | null;
    unit: string | null;
    section: string | null;
    note: string | null;
  }>();

  entries.forEach((entry) => {
    const template = templateById.get(entry.mealTemplateId);
    if (!template) {
      return;
    }

    const payload = parseMealTemplatePayload(template.templatePayloadJson);
    const multiplier = payload.servings && entry.servings
      ? entry.servings / payload.servings
      : 1;

    payload.ingredients.forEach((ingredient) => {
      const key = `${normalizeKeyPart(ingredient.name)}::${normalizeKeyPart(ingredient.unit)}`;
      const scaledQuantity = ingredient.quantity === null ? null : roundToTwoDecimals(ingredient.quantity * multiplier);
      const existing = aggregate.get(key);

      if (!existing) {
        aggregate.set(key, {
          name: ingredient.name,
          quantity: scaledQuantity,
          unit: ingredient.unit,
          section: ingredient.section,
          note: ingredient.note,
        });
        return;
      }

      existing.quantity = existing.quantity !== null && scaledQuantity !== null
        ? roundToTwoDecimals(existing.quantity + scaledQuantity)
        : null;

      if (normalizeKeyPart(existing.section) !== normalizeKeyPart(ingredient.section)) {
        existing.section = null;
      }

      if (normalizeKeyPart(existing.note) !== normalizeKeyPart(ingredient.note)) {
        existing.note = null;
      }
    });
  });

  return [...aggregate.values()]
    .sort((left, right) => {
      const sectionCompare = normalizeKeyPart(left.section).localeCompare(normalizeKeyPart(right.section));
      if (sectionCompare !== 0) {
        return sectionCompare;
      }

      return left.name.localeCompare(right.name);
    })
    .map((item, index) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      section: item.section,
      note: item.note,
      sourceType: "planned" as const,
      isChecked: checkedByKey.get(getGroceryCheckKey(item.name, item.unit)) ?? false,
      sortOrder: index,
    }));
}

export async function getTodayPlannedMeals(
  app: HealthApp,
  userId: string,
  todayIsoDate: IsoDateString,
  weekStartsOn: number,
) {
  const weekStartIsoDate = getWeekStartIsoDate(todayIsoDate, weekStartsOn);
  const mealPlanWeek = await app.prisma.mealPlanWeek.findUnique({
    where: {
      userId_startDate: {
        userId,
        startDate: parseIsoDate(weekStartIsoDate),
      },
    },
    include: {
      entries: {
        where: {
          date: parseIsoDate(todayIsoDate),
        },
        include: {
          mealTemplate: {
            select: {
              id: true,
              name: true,
              templatePayloadJson: true,
            },
          },
          mealLogs: {
            select: {
              id: true,
            },
          },
        },
        orderBy: [{ mealSlot: "asc" }, { sortOrder: "asc" }],
      },
    },
  });

  return (mealPlanWeek?.entries ?? []).map(serializePlannedMealToday);
}

export async function buildMealPlanWeekResponse(
  app: HealthApp,
  userId: string,
  startDate: IsoDateString,
): Promise<MealPlanWeekResponse> {
  const startDateValue = parseIsoDate(startDate);
  const mealPlanWeek = await app.prisma.mealPlanWeek.findUnique({
    where: {
      userId_startDate: {
        userId,
        startDate: startDateValue,
      },
    },
    include: {
      entries: {
        include: {
          mealTemplate: {
            select: {
              id: true,
              name: true,
              templatePayloadJson: true,
            },
          },
          mealLogs: {
            select: {
              id: true,
            },
          },
        },
        orderBy: [{ date: "asc" }, { mealSlot: "asc" }, { sortOrder: "asc" }],
      },
      prepSessions: {
        include: {
          task: {
            select: {
              id: true,
              status: true,
            },
          },
        },
        orderBy: [{ scheduledForDate: "asc" }, { sortOrder: "asc" }],
      },
      groceryItems: {
        orderBy: [{ sourceType: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });
  const mealTemplates = await app.prisma.mealTemplate.findMany({
    where: {
      userId,
      archivedAt: null,
    },
    orderBy: [{ mealSlot: "asc" }, { name: "asc" }],
  });

  return withGeneratedAt({
    startDate,
    endDate: toIsoDateString(getWeekEndDate(startDateValue)),
    notes: mealPlanWeek?.notes ?? null,
    entries: (mealPlanWeek?.entries ?? []).map(serializeMealPlanEntry),
    prepSessions: (mealPlanWeek?.prepSessions ?? []).map(serializeMealPrepSession),
    groceryItems: (mealPlanWeek?.groceryItems ?? []).map(serializeMealPlanGroceryItem),
    summary: buildMealPlanWeekSummary(mealPlanWeek),
    mealTemplates: mealTemplates.map(serializeMealTemplate),
  });
}

export async function saveMealPlanWeek(
  app: HealthApp,
  userId: string,
  startDate: IsoDateString,
  payload: SaveMealPlanWeekRequest,
) {
  const startDateValue = parseIsoDate(startDate);
  const endDate = addIsoDays(startDate, 6);
  const mealTemplateIds = [...new Set(payload.entries.map((entry) => entry.mealTemplateId))];

  payload.entries.forEach((entry) => {
    assertIsoDateWithinWeek(entry.date, startDate, endDate, "Meal entry date");
  });
  payload.prepSessions.forEach((session) => {
    assertIsoDateWithinWeek(session.scheduledForDate, startDate, endDate, "Prep session date");
  });

  const [mealTemplates, existingWeek] = await Promise.all([
    app.prisma.mealTemplate.findMany({
      where: {
        userId,
        archivedAt: null,
        id: {
          in: mealTemplateIds,
        },
      },
      select: {
        id: true,
        templatePayloadJson: true,
      },
    }),
    app.prisma.mealPlanWeek.findUnique({
      where: {
        userId_startDate: {
          userId,
          startDate: startDateValue,
        },
      },
      include: {
        entries: true,
        prepSessions: true,
        groceryItems: {
          where: {
            sourceType: "MANUAL",
          },
        },
      },
    }),
  ]);

  if (mealTemplates.length !== mealTemplateIds.length) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Meal template not found",
    });
  }

  const existingEntryById = new Map((existingWeek?.entries ?? []).map((entry) => [entry.id, entry]));
  const existingPrepById = new Map((existingWeek?.prepSessions ?? []).map((session) => [session.id, session]));
  const existingManualGroceryById = new Map((existingWeek?.groceryItems ?? []).map((item) => [item.id, item]));

  payload.entries.forEach((entry) => {
    if (entry.id && !existingEntryById.has(entry.id)) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Meal plan entry not found",
      });
    }
  });
  payload.prepSessions.forEach((session) => {
    if (session.id && !existingPrepById.has(session.id)) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Prep session not found",
      });
    }
  });
  payload.manualGroceryItems.forEach((item) => {
    if (item.id && !existingManualGroceryById.has(item.id)) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Manual grocery item not found",
      });
    }
  });

  const mealTemplateById = new Map(mealTemplates.map((template) => [template.id, template]));
  const plannedCheckedByKey = new Map(
    (payload.plannedGroceryItems ?? []).map((item) => [
      getGroceryCheckKey(item.name, item.unit),
      item.isChecked ?? false,
    ]),
  );
  const submittedEntryIds = new Set(payload.entries.map((entry) => entry.id).filter((id): id is string => Boolean(id)));
  const submittedPrepIds = new Set(payload.prepSessions.map((session) => session.id).filter((id): id is string => Boolean(id)));
  const submittedManualGroceryIds = new Set(
    payload.manualGroceryItems.map((item) => item.id).filter((id): id is string => Boolean(id)),
  );

  await app.prisma.$transaction(async (tx) => {
    const mealPlanWeek = existingWeek
      ? await tx.mealPlanWeek.update({
          where: {
            id: existingWeek.id,
          },
          data: {
            notes: trimToNull(payload.notes) ?? null,
          },
        })
      : await tx.mealPlanWeek.create({
          data: {
            userId,
            startDate: startDateValue,
            notes: trimToNull(payload.notes) ?? null,
          },
        });

    const mealPlanWeekId = mealPlanWeek.id;

    const entryIdsToDelete = (existingWeek?.entries ?? [])
      .filter((entry) => !submittedEntryIds.has(entry.id))
      .map((entry) => entry.id);
    if (entryIdsToDelete.length > 0) {
      await tx.mealPlanEntry.deleteMany({
        where: {
          id: {
            in: entryIdsToDelete,
          },
        },
      });
    }

    for (const [index, entry] of payload.entries.entries()) {
      const sortOrder = entry.sortOrder ?? index;
      const data = {
        date: parseIsoDate(entry.date),
        mealSlot: toPrismaMealSlot(entry.mealSlot) ?? "BREAKFAST",
        mealTemplateId: entry.mealTemplateId,
        servings: entry.servings ?? null,
        note: trimToNull(entry.note) ?? null,
        sortOrder,
      };

      if (entry.id) {
        await tx.mealPlanEntry.update({
          where: {
            id: entry.id,
          },
          data,
        });
      } else {
        await tx.mealPlanEntry.create({
          data: {
            mealPlanWeekId,
            ...data,
          },
        });
      }
    }

    const prepSessionsToDelete = (existingWeek?.prepSessions ?? []).filter(
      (session) => !submittedPrepIds.has(session.id),
    );
    for (const prepSession of prepSessionsToDelete) {
      if (prepSession.taskId) {
        await tx.task.updateMany({
          where: {
            id: prepSession.taskId,
            userId,
          },
          data: {
            status: toPrismaTaskStatus("dropped"),
          },
        });
      }
    }
    if (prepSessionsToDelete.length > 0) {
      await tx.mealPrepSession.deleteMany({
        where: {
          id: {
            in: prepSessionsToDelete.map((session) => session.id),
          },
        },
      });
    }

    for (const [index, session] of payload.prepSessions.entries()) {
      const sortOrder = session.sortOrder ?? index;
      const existingSession = session.id ? existingPrepById.get(session.id) ?? null : null;
      let taskId = existingSession?.taskId ?? null;

      if (taskId) {
        const updatedTask = await tx.task.updateMany({
          where: {
            id: taskId,
            userId,
          },
          data: {
            title: session.title.trim(),
            notes: trimToNull(session.notes) ?? null,
            kind: "TASK",
            originType: toPrismaTaskOriginType("meal_plan"),
            scheduledForDate: parseIsoDate(session.scheduledForDate),
          },
        });

        if (updatedTask.count === 0) {
          taskId = null;
        }
      }

      if (!taskId) {
        const createdTask = await tx.task.create({
          data: {
            userId,
            title: session.title.trim(),
            notes: trimToNull(session.notes) ?? null,
            kind: "TASK",
            originType: toPrismaTaskOriginType("meal_plan"),
            scheduledForDate: parseIsoDate(session.scheduledForDate),
          },
        });
        taskId = createdTask.id;
      }

      const sessionData = {
        scheduledForDate: parseIsoDate(session.scheduledForDate),
        title: session.title.trim(),
        notes: trimToNull(session.notes) ?? null,
        taskId,
        sortOrder,
      };

      if (session.id) {
        await tx.mealPrepSession.update({
          where: {
            id: session.id,
          },
          data: sessionData,
        });
      } else {
        await tx.mealPrepSession.create({
          data: {
            mealPlanWeekId,
            ...sessionData,
          },
        });
      }
    }

    await tx.mealPlanGroceryItem.deleteMany({
      where: {
        mealPlanWeekId,
        sourceType: "PLANNED",
      },
    });

    const manualGroceryIdsToDelete = (existingWeek?.groceryItems ?? [])
      .filter((item) => !submittedManualGroceryIds.has(item.id))
      .map((item) => item.id);
    if (manualGroceryIdsToDelete.length > 0) {
      await tx.mealPlanGroceryItem.deleteMany({
        where: {
          id: {
            in: manualGroceryIdsToDelete,
          },
        },
      });
    }

    for (const [index, item] of payload.manualGroceryItems.entries()) {
      const sortOrder = item.sortOrder ?? index;
      const groceryData = {
        name: item.name.trim(),
        quantity: item.quantity ?? null,
        unit: trimToNull(item.unit),
        section: trimToNull(item.section),
        note: trimToNull(item.note),
        sourceType: toPrismaMealPlanGrocerySourceType("manual"),
        isChecked: item.isChecked ?? false,
        sortOrder,
      };

      if (item.id) {
        await tx.mealPlanGroceryItem.update({
          where: {
            id: item.id,
          },
          data: groceryData,
        });
      } else {
        await tx.mealPlanGroceryItem.create({
          data: {
            mealPlanWeekId,
            ...groceryData,
          },
        });
      }
    }

    const plannedGroceryRows = buildPlannedGroceryRows(payload.entries, mealTemplateById, plannedCheckedByKey);
    if (plannedGroceryRows.length > 0) {
      await tx.mealPlanGroceryItem.createMany({
        data: plannedGroceryRows.map((item) => ({
          mealPlanWeekId,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          section: item.section,
          note: item.note,
          sourceType: toPrismaMealPlanGrocerySourceType(item.sourceType),
          isChecked: item.isChecked,
          sortOrder: item.sortOrder,
        })),
      });
    }
  });
}
