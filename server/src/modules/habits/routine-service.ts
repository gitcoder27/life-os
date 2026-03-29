import type {
  CreateRoutineRequest,
  RoutineItemCheckinRequest,
  RoutineMutationResponse,
  RoutinesResponse,
  UpdateRoutineRequest,
} from "@life-os/contracts";

import { withGeneratedAt } from "../../lib/http/response.js";
import { parseIsoDate } from "../../lib/time/cycle.js";
import {
  findOwnedRoutine,
  findOwnedRoutineItem,
  getTodayContext,
  listRoutinesForUser,
  loadRoutineById,
} from "./habits-repository.js";
import type { HabitsApp } from "./module-types.js";
import { serializeRoutine, toPrismaRoutinePeriod, toPrismaRoutineStatus } from "./routine-mappers.js";

export const listRoutines = async (app: HabitsApp, userId: string): Promise<RoutinesResponse> => {
  const { targetIsoDate } = await getTodayContext(app, userId);
  const targetDate = parseIsoDate(targetIsoDate);
  const routines = await listRoutinesForUser(app.prisma, userId, targetDate);

  return withGeneratedAt({
    date: targetIsoDate,
    routines: routines.map(serializeRoutine),
  });
};

export const createRoutine = async (
  app: HabitsApp,
  userId: string,
  payload: CreateRoutineRequest,
): Promise<RoutineMutationResponse> => {
  const routine = await app.prisma.routine.create({
    data: {
      userId,
      name: payload.name,
      period: toPrismaRoutinePeriod(payload.period),
      items: {
        create: payload.items.map((item) => ({
          title: item.title,
          sortOrder: item.sortOrder,
          isRequired: item.isRequired ?? true,
        })),
      },
    },
  });
  const { targetIsoDate } = await getTodayContext(app, userId);

  return withGeneratedAt({
    routine: serializeRoutine(await loadRoutineById(app.prisma, routine.id, parseIsoDate(targetIsoDate))),
  });
};

export const updateRoutine = async (
  app: HabitsApp,
  userId: string,
  routineId: string,
  payload: UpdateRoutineRequest,
): Promise<RoutineMutationResponse> => {
  await findOwnedRoutine(app.prisma, userId, routineId);

  await app.prisma.$transaction(async (tx) => {
    await tx.routine.update({
      where: {
        id: routineId,
      },
      data: {
        name: payload.name,
        status: payload.status ? toPrismaRoutineStatus(payload.status) : undefined,
      },
    });

    if (!payload.items) {
      return;
    }

    await tx.routineItem.deleteMany({
      where: {
        routineId,
      },
    });

    if (payload.items.length === 0) {
      return;
    }

    await tx.routineItem.createMany({
      data: payload.items.map((item) => ({
        routineId,
        title: item.title,
        sortOrder: item.sortOrder,
        isRequired: item.isRequired ?? true,
      })),
    });
  });

  const { targetIsoDate } = await getTodayContext(app, userId);

  return withGeneratedAt({
    routine: serializeRoutine(await loadRoutineById(app.prisma, routineId, parseIsoDate(targetIsoDate))),
  });
};

export const createRoutineItemCheckin = async (
  app: HabitsApp,
  userId: string,
  itemId: string,
  payload: RoutineItemCheckinRequest,
): Promise<RoutineMutationResponse> => {
  const item = await findOwnedRoutineItem(app.prisma, userId, itemId);
  const targetDate = parseIsoDate(payload.date ?? (await getTodayContext(app, userId)).targetIsoDate);

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
    routine: serializeRoutine(await loadRoutineById(app.prisma, item.routineId, targetDate)),
  });
};
