import type { AccountabilityRadar, IsoDateString } from "@life-os/contracts";
import type {
  TaskKind as PrismaTaskKind,
  TaskOriginType as PrismaTaskOriginType,
} from "@prisma/client";

import { parseIsoDate } from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import { getUserLocalDate } from "../../lib/time/user-time.js";
import { toHomeTaskKind, toHomeTaskOriginType } from "./home-mappers.js";

const ACCOUNTABILITY_SURFACED_ITEMS = 5;

type AccountabilityTaskRecord = {
  id: string;
  title: string;
  scheduledForDate: Date | null;
  createdAt: Date;
  notes: string | null;
  kind: PrismaTaskKind;
  reminderAt: Date | null;
  originType: PrismaTaskOriginType;
};

const getIsoDayDifference = (startIsoDate: IsoDateString, endIsoDate: IsoDateString) =>
  Math.round((parseIsoDate(endIsoDate).getTime() - parseIsoDate(startIsoDate).getTime()) / 86_400_000);

const formatOverdueLabel = (ageDays: number) => `Overdue by ${ageDays} day${ageDays === 1 ? "" : "s"}`;

const formatStaleInboxLabel = (ageDays: number) => `Inbox for ${ageDays} day${ageDays === 1 ? "" : "s"}`;

export const buildAccountabilityRadar = (input: {
  overdueTasks: AccountabilityTaskRecord[];
  staleInboxTasks: AccountabilityTaskRecord[];
  targetIsoDate: IsoDateString;
  timezone: string;
}): AccountabilityRadar => {
  const accountabilityItems = [
    ...input.overdueTasks.map((task) => {
      const scheduledForDate = task.scheduledForDate
        ? toIsoDateString(task.scheduledForDate)
        : input.targetIsoDate;
      const ageDays = getIsoDayDifference(scheduledForDate, input.targetIsoDate);

      return {
        id: task.id,
        kind: "overdue_task" as const,
        title: task.title,
        route: "/today",
        label: formatOverdueLabel(ageDays),
        ageDays,
        scheduledForDate,
        createdAt: task.createdAt.toISOString(),
        notes: task.notes,
        taskKind: toHomeTaskKind(task.kind),
        reminderAt: task.reminderAt?.toISOString() ?? null,
        originType: toHomeTaskOriginType(task.originType),
      };
    }),
    ...input.staleInboxTasks.map((task) => {
      const createdOnIsoDate = getUserLocalDate(task.createdAt, input.timezone);
      const ageDays = getIsoDayDifference(createdOnIsoDate, input.targetIsoDate);

      return {
        id: task.id,
        kind: "stale_inbox" as const,
        title: task.title,
        route: "/inbox",
        label: formatStaleInboxLabel(ageDays),
        ageDays,
        scheduledForDate: null,
        createdAt: task.createdAt.toISOString(),
        notes: task.notes,
        taskKind: toHomeTaskKind(task.kind),
        reminderAt: task.reminderAt?.toISOString() ?? null,
        originType: toHomeTaskOriginType(task.originType),
      };
    }),
  ];

  return {
    overdueTaskCount: input.overdueTasks.length,
    staleInboxCount: input.staleInboxTasks.length,
    totalCount: accountabilityItems.length,
    overflowCount: Math.max(accountabilityItems.length - ACCOUNTABILITY_SURFACED_ITEMS, 0),
    items: accountabilityItems.slice(0, ACCOUNTABILITY_SURFACED_ITEMS),
  };
};
