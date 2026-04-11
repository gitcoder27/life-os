import type {
  IsoDateString,
  RoutineRecord,
  RoutineTimingMode,
  RoutineStatus,
  UpdateRoutineRequest,
} from "@life-os/contracts";
import type { RoutineStatus as PrismaRoutineStatus } from "@prisma/client";

import {
  buildRoutineTimingLabel,
  getRoutineTimingStatusToday,
} from "../../lib/habits/timing.js";
import { toIsoDateString } from "../../lib/time/date.js";
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

export const serializeRoutine = (
  routine: RoutineDetailRecord,
  options?: {
    targetIsoDate?: IsoDateString;
    now?: Date;
    timezone?: string | null;
  },
): RoutineRecord => {
  const items = routine.items
    .map((item) => ({
      id: item.id,
      title: item.title,
      sortOrder: item.sortOrder,
      isRequired: item.isRequired,
      completedToday: item.checkins.length > 0,
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const requiredItems = routine.items.filter((item) => item.isRequired);
  const completedRequiredCheckins = requiredItems
    .flatMap((item) => item.checkins)
    .sort((left, right) => left.completedAt!.getTime() - right.completedAt!.getTime());
  const completedAtToday =
    requiredItems.length > 0 &&
    requiredItems.every((item) => item.checkins.length > 0)
      ? completedRequiredCheckins.at(-1)?.completedAt?.toISOString() ?? null
      : null;
  const timingMode: RoutineTimingMode =
    routine.timingMode === "PERIOD"
      ? "period"
      : routine.timingMode === "CUSTOM_WINDOW"
        ? "custom_window"
        : "anytime";
  const period =
    routine.period === "MORNING"
      ? "morning"
      : routine.period === "EVENING"
        ? "evening"
        : null;
  const targetIsoDate = options?.targetIsoDate ?? toIsoDateString(new Date());
  const now = options?.now ?? new Date();
  const timezone = options?.timezone;

  return {
    id: routine.id,
    name: routine.name,
    sortOrder: routine.sortOrder,
    status: fromPrismaRoutineStatus(routine.status),
    timingMode,
    period,
    windowStartMinutes: routine.windowStartMinutes ?? null,
    windowEndMinutes: routine.windowEndMinutes ?? null,
    timingStatusToday: getRoutineTimingStatusToday({
      timingMode,
      period,
      completedAt: completedAtToday ? new Date(completedAtToday) : null,
      now,
      targetIsoDate,
      timezone,
      windowStartMinutes: routine.windowStartMinutes ?? null,
      windowEndMinutes: routine.windowEndMinutes ?? null,
    }),
    timingLabel: buildRoutineTimingLabel({
      timingMode,
      period,
      windowStartMinutes: routine.windowStartMinutes ?? null,
      windowEndMinutes: routine.windowEndMinutes ?? null,
    }),
    completedAtToday,
    completedItems: items.filter((item) => item.completedToday).length,
    totalItems: items.length,
    items,
  };
};
