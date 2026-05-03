import type { IsoDateString, UpdateTaskRequest } from "@life-os/contracts";
import type { TaskKind as PrismaTaskKind } from "@prisma/client";

import { AppError } from "../../lib/errors/app-error.js";
import { getMonthStartIsoDate, getWeekStartIsoDate, parseIsoDate } from "../../lib/time/cycle.js";
import { getUserLocalDate, getUtcDateForLocalTime } from "../../lib/time/user-time.js";
import { isoDateStringSchema } from "../../lib/validation/date-range.js";
import { toPrismaTaskKind } from "./planning-mappers.js";
import type { PlanningApp } from "./planning-types.js";

const isIsoDateInput = (value: string): value is IsoDateString => isoDateStringSchema.safeParse(value).success;

export function toTaskReminderAt(reminderAt: string | null | undefined, timezone?: string | null) {
  if (reminderAt === undefined) {
    return undefined;
  }

  if (reminderAt === null) {
    return null;
  }

  if (isIsoDateInput(reminderAt)) {
    return getUtcDateForLocalTime(reminderAt, "00:00", timezone);
  }

  return new Date(reminderAt);
}

export async function getUserTimezone(app: PlanningApp, userId: string) {
  const preferences = await app.prisma.userPreference.findUnique({
    where: {
      userId,
    },
    select: {
      timezone: true,
    },
  });

  return preferences?.timezone ?? null;
}

export function resolveReminderAtForUpdate(
  payload: Pick<UpdateTaskRequest, "kind" | "reminderAt">,
  existingKind: PrismaTaskKind,
  timezone?: string | null,
) {
  const nextKind = payload.kind ? toPrismaTaskKind(payload.kind) : existingKind;

  if (nextKind !== "REMINDER") {
    return payload.kind !== undefined || payload.reminderAt !== undefined ? null : undefined;
  }

  return toTaskReminderAt(payload.reminderAt, timezone);
}

export function validatePlannerBlockWindow(
  date: IsoDateString,
  timezone: string | null | undefined,
  startsAtInput: string,
  endsAtInput: string,
) {
  const startsAt = new Date(startsAtInput);
  const endsAt = new Date(endsAtInput);

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Planner block times must be valid datetimes",
    });
  }

  if (startsAt >= endsAt) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Planner block end time must be after start time",
    });
  }

  const startsAtDay = getUserLocalDate(startsAt, timezone);
  const endsAtDay = getUserLocalDate(endsAt, timezone);
  if (startsAtDay !== date || endsAtDay !== date) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Planner block times must stay within the requested day",
    });
  }

  return { startsAt, endsAt };
}

export async function resolveGoalContext(
  app: PlanningApp,
  userId: string,
  requestedDate?: IsoDateString,
) {
  const preferences = await app.prisma.userPreference.findUnique({
    where: {
      userId,
    },
    select: {
      timezone: true,
      weekStartsOn: true,
    },
  });
  const contextIsoDate = requestedDate ?? getUserLocalDate(new Date(), preferences?.timezone);

  return {
    contextIsoDate,
    contextDate: parseIsoDate(contextIsoDate),
    weekStartsOn: preferences?.weekStartsOn ?? 1,
  };
}

export type GoalContext = Awaited<ReturnType<typeof resolveGoalContext>>;

export function getCurrentGoalCycleFilters(contextIsoDate: IsoDateString, weekStartsOn: number) {
  return {
    dayStartDate: parseIsoDate(contextIsoDate),
    weekStartDate: parseIsoDate(getWeekStartIsoDate(contextIsoDate, weekStartsOn)),
    monthStartDate: parseIsoDate(getMonthStartIsoDate(contextIsoDate)),
  };
}
