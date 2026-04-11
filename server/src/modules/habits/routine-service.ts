import type {
  CreateRoutineRequest,
  RoutineItemCheckinRequest,
  RoutineMutationResponse,
  RoutinesResponse,
  UpdateRoutineRequest,
} from "@life-os/contracts";

import { AppError } from "../../lib/errors/app-error.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { parseIsoDate } from "../../lib/time/cycle.js";
import {
  findOwnedRoutine,
  findOwnedRoutineItem,
  getTodayContext,
  listRoutinesForUser,
  loadRoutineById,
} from "./habits-repository.js";
import type { HabitsApp, HabitsPrisma } from "./module-types.js";
import { serializeRoutine, toPrismaRoutineStatus } from "./routine-mappers.js";

function resolveRoutineTimingFields(
  current: {
    timingMode?: "ANYTIME" | "PERIOD" | "CUSTOM_WINDOW";
    period?: "MORNING" | "EVENING" | null;
    windowStartMinutes?: number | null;
    windowEndMinutes?: number | null;
  } | null,
  payload: Pick<CreateRoutineRequest, "timingMode" | "period" | "windowStartMinutes" | "windowEndMinutes">,
) {
  const timingMode =
    payload.timingMode ??
    (current?.timingMode === "PERIOD"
      ? "period"
      : current?.timingMode === "CUSTOM_WINDOW"
        ? "custom_window"
        : "anytime");
  const period =
    payload.period ??
    (current?.period === "MORNING" ? "morning" : current?.period === "EVENING" ? "evening" : null);
  const windowStartMinutes = payload.windowStartMinutes ?? current?.windowStartMinutes ?? null;
  const windowEndMinutes = payload.windowEndMinutes ?? current?.windowEndMinutes ?? null;

  if (timingMode === "period") {
    if (!period) {
      throw new AppError({
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Period-timed routines require a period",
      });
    }

    return {
      timingMode: "PERIOD" as const,
      period: period === "morning" ? "MORNING" as const : "EVENING" as const,
      windowStartMinutes: null,
      windowEndMinutes: null,
    };
  }

  if (timingMode === "custom_window") {
    if (windowStartMinutes == null || windowEndMinutes == null || windowStartMinutes >= windowEndMinutes) {
      throw new AppError({
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Custom-window routines require a valid start and end time",
      });
    }

    return {
      timingMode: "CUSTOM_WINDOW" as const,
      period: null,
      windowStartMinutes,
      windowEndMinutes,
    };
  }

  return {
    timingMode: "ANYTIME" as const,
    period: null,
    windowStartMinutes: null,
    windowEndMinutes: null,
  };
}

const normalizeRoutineOrder = async (
  tx: HabitsPrisma,
  userId: string,
  targetRoutineId: string,
  nextSortOrder: number,
) => {
  const routines = await tx.routine.findMany({
    where: {
      userId,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
    },
  });

  const orderedIds = routines
    .map((routine) => routine.id)
    .filter((routineId) => routineId !== targetRoutineId);
  const insertAt = Math.max(0, Math.min(nextSortOrder, orderedIds.length));

  orderedIds.splice(insertAt, 0, targetRoutineId);

  await Promise.all(
    orderedIds.map((routineId, index) =>
      tx.routine.update({
        where: {
          id: routineId,
        },
        data: {
          sortOrder: index,
        },
      }),
    ),
  );
};

export const listRoutines = async (app: HabitsApp, userId: string): Promise<RoutinesResponse> => {
  const { targetIsoDate, timezone } = await getTodayContext(app, userId);
  const targetDate = parseIsoDate(targetIsoDate);
  const routines = await listRoutinesForUser(app.prisma, userId, targetDate);

  return withGeneratedAt({
    date: targetIsoDate,
    routines: routines.map((routine) => serializeRoutine(routine, { targetIsoDate, now: new Date(), timezone })),
  });
};

export const createRoutine = async (
  app: HabitsApp,
  userId: string,
  payload: CreateRoutineRequest,
): Promise<RoutineMutationResponse> => {
  const { targetIsoDate, timezone } = await getTodayContext(app, userId);
  const timing = resolveRoutineTimingFields(null, payload);
  const lastRoutine = await app.prisma.routine.findFirst({
    where: {
      userId,
    },
    orderBy: {
      sortOrder: "desc",
    },
    select: {
      sortOrder: true,
    },
  });
  const routine = await app.prisma.routine.create({
    data: {
      userId,
      name: payload.name,
      sortOrder: (lastRoutine?.sortOrder ?? -1) + 1,
      timingMode: timing.timingMode,
      period: timing.period,
      windowStartMinutes: timing.windowStartMinutes,
      windowEndMinutes: timing.windowEndMinutes,
      items: {
        create: payload.items.map((item) => ({
          title: item.title,
          sortOrder: item.sortOrder,
          isRequired: item.isRequired ?? true,
        })),
      },
    },
  });

  return withGeneratedAt({
    routine: serializeRoutine(await loadRoutineById(app.prisma, routine.id, parseIsoDate(targetIsoDate)), {
      targetIsoDate,
      now: new Date(),
      timezone,
    }),
  });
};

export const updateRoutine = async (
  app: HabitsApp,
  userId: string,
  routineId: string,
  payload: UpdateRoutineRequest,
): Promise<RoutineMutationResponse> => {
  const routine = await findOwnedRoutine(app.prisma, userId, routineId);
  const { targetIsoDate, timezone } = await getTodayContext(app, userId);
  const timing = resolveRoutineTimingFields(routine, payload);

  await app.prisma.$transaction(async (tx) => {
    await tx.routine.update({
      where: {
        id: routineId,
      },
      data: {
        name: payload.name,
        status: payload.status ? toPrismaRoutineStatus(payload.status) : undefined,
        timingMode: timing.timingMode,
        period: timing.period,
        windowStartMinutes: timing.windowStartMinutes,
        windowEndMinutes: timing.windowEndMinutes,
      },
    });

    if (payload.sortOrder !== undefined && payload.sortOrder !== routine.sortOrder) {
      await normalizeRoutineOrder(tx, userId, routineId, payload.sortOrder);
    }

    if (!payload.items) {
      return;
    }

    const existingItems = await tx.routineItem.findMany({
      where: { routineId },
      select: { id: true },
    });
    const existingIds = new Set(existingItems.map((i) => i.id));

    const incomingIds = new Set(
      payload.items.filter((i) => i.id).map((i) => i.id!),
    );

    // Delete items that are no longer present
    const toDelete = [...existingIds].filter((id) => !incomingIds.has(id));
    if (toDelete.length > 0) {
      await tx.routineItem.deleteMany({
        where: { id: { in: toDelete }, routineId },
      });
    }

    // Upsert each item: update existing, create new
    for (const item of payload.items) {
      if (item.id && existingIds.has(item.id)) {
        await tx.routineItem.update({
          where: { id: item.id },
          data: {
            title: item.title,
            sortOrder: item.sortOrder,
            isRequired: item.isRequired ?? true,
          },
        });
      } else {
        await tx.routineItem.create({
          data: {
            routineId,
            title: item.title,
            sortOrder: item.sortOrder,
            isRequired: item.isRequired ?? true,
          },
        });
      }
    }
  });

  return withGeneratedAt({
    routine: serializeRoutine(await loadRoutineById(app.prisma, routineId, parseIsoDate(targetIsoDate)), {
      targetIsoDate,
      now: new Date(),
      timezone,
    }),
  });
};

export const createRoutineItemCheckin = async (
  app: HabitsApp,
  userId: string,
  itemId: string,
  payload: RoutineItemCheckinRequest,
): Promise<RoutineMutationResponse> => {
  const item = await findOwnedRoutineItem(app.prisma, userId, itemId);
  const context = await getTodayContext(app, userId);
  const targetDate = parseIsoDate(payload.date ?? context.targetIsoDate);

  await app.prisma.routineItemCheckin.upsert({
    where: {
      routineItemId_occurredOn: {
        routineItemId: item.id,
        occurredOn: targetDate,
      },
    },
    update: {
      completedAt: new Date(),
    },
    create: {
      routineItemId: item.id,
      occurredOn: targetDate,
      completedAt: new Date(),
    },
  });

  return withGeneratedAt({
    routine: serializeRoutine(await loadRoutineById(app.prisma, item.routineId, targetDate), {
      targetIsoDate: payload.date ?? context.targetIsoDate,
      now: new Date(),
      timezone: context.timezone,
    }),
  });
};

export const deleteRoutineItemCheckin = async (
  app: HabitsApp,
  userId: string,
  itemId: string,
  payload: RoutineItemCheckinRequest,
): Promise<RoutineMutationResponse> => {
  const item = await findOwnedRoutineItem(app.prisma, userId, itemId);
  const context = await getTodayContext(app, userId);
  const targetDate = parseIsoDate(payload.date ?? context.targetIsoDate);

  await app.prisma.routineItemCheckin.deleteMany({
    where: {
      routineItemId: item.id,
      occurredOn: targetDate,
    },
  });

  return withGeneratedAt({
    routine: serializeRoutine(await loadRoutineById(app.prisma, item.routineId, targetDate), {
      targetIsoDate: payload.date ?? context.targetIsoDate,
      now: new Date(),
      timezone: context.timezone,
    }),
  });
};
