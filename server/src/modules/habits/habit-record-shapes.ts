import type { IsoDateString } from "@life-os/contracts";
import type { HabitCheckin, Prisma, Routine, RoutineItem, RoutineItemCheckin } from "@prisma/client";

import { addIsoDays, parseIsoDate } from "../../lib/time/cycle.js";
import { goalSummaryInclude } from "../planning/planning-record-shapes.js";

export const habitRelationsInclude = {
  goal: {
    include: goalSummaryInclude,
  },
  pauseWindows: {
    orderBy: {
      startsOn: "asc",
    },
  },
  recurrenceRule: {
    include: {
      exceptions: {
        orderBy: {
          occurrenceDate: "asc",
        },
      },
    },
  },
} as const;

export const buildHabitDetailInclude = (targetIsoDate: IsoDateString) =>
  ({
    ...habitRelationsInclude,
    checkins: {
      where: {
        occurredOn: {
          gte: parseIsoDate(addIsoDays(targetIsoDate, -30)),
          lte: parseIsoDate(targetIsoDate),
        },
      },
    },
  }) satisfies Prisma.HabitInclude;

export const buildRoutineWithCheckinsInclude = (onDate: Date) =>
  ({
    items: {
      include: {
        checkins: {
          where: {
            occurredOn: onDate,
          },
        },
      },
    },
  }) satisfies Prisma.RoutineInclude;

export type HabitRelationsRecord = Prisma.HabitGetPayload<{
  include: typeof habitRelationsInclude;
}>;

export type HabitDetailRecord = HabitRelationsRecord & {
  checkins: HabitCheckin[];
};

export type RoutineDetailRecord = Routine & {
  items: Array<RoutineItem & { checkins: RoutineItemCheckin[] }>;
};
