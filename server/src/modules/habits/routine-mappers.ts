import type {
  RoutineRecord,
  RoutineStatus,
  UpdateRoutineRequest,
} from "@life-os/contracts";
import type { RoutineStatus as PrismaRoutineStatus } from "@prisma/client";

import type { RoutineDetailRecord } from "./habit-record-shapes.js";

export const toPrismaRoutineStatus = (
  status: NonNullable<UpdateRoutineRequest["status"]>,
): PrismaRoutineStatus => {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "archived":
      return "ARCHIVED";
  }
};

const fromPrismaRoutineStatus = (status: PrismaRoutineStatus): RoutineStatus => {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "ARCHIVED":
      return "archived";
  }
};

export const serializeRoutine = (routine: RoutineDetailRecord): RoutineRecord => {
  const items = routine.items
    .map((item) => ({
      id: item.id,
      title: item.title,
      sortOrder: item.sortOrder,
      isRequired: item.isRequired,
      completedToday: item.checkins.length > 0,
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder);

  return {
    id: routine.id,
    name: routine.name,
    sortOrder: routine.sortOrder,
    status: fromPrismaRoutineStatus(routine.status),
    completedItems: items.filter((item) => item.completedToday).length,
    totalItems: items.length,
    items,
  };
};
