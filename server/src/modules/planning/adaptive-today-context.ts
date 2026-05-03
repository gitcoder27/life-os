import type {
  DailyLaunchItem,
  DayPlannerBlockItem,
  IsoDateString,
  PlanningPriorityItem,
  PlanningTaskItem,
} from "@life-os/contracts";

import { materializeRecurringTasksInRange } from "../../lib/recurrence/tasks.js";
import { parseIsoDate } from "../../lib/time/cycle.js";
import { getUserTimezone } from "./planning-context.js";
import {
  serializeDailyLaunch,
  serializePriority,
  serializeTask,
} from "./planning-mappers.js";
import { planningTaskInclude } from "./planning-record-shapes.js";
import {
  ensurePlanningCycle,
  loadPlannerBlocks,
  seedPlannerBlocksFromMostRecentDay,
} from "./planning-repository.js";
import type { PlanningApp } from "./planning-types.js";

export type AdaptiveTodayContext = {
  userId: string;
  date: IsoDateString;
  cycleId: string;
  timezone: string | null;
  launch: DailyLaunchItem | null;
  mustWinTask: PlanningTaskItem | null;
  priorities: PlanningPriorityItem[];
  tasks: PlanningTaskItem[];
  plannerBlocks: DayPlannerBlockItem[];
};

export async function loadAdaptiveTodayContext(
  app: PlanningApp,
  input: {
    userId: string;
    date: IsoDateString;
  },
): Promise<AdaptiveTodayContext> {
  const cycleStartDate = parseIsoDate(input.date);
  const timezone = await getUserTimezone(app, input.userId);
  await materializeRecurringTasksInRange(app.prisma, input.userId, cycleStartDate, cycleStartDate);
  const cycle = await ensurePlanningCycle(app, {
    userId: input.userId,
    cycleType: "DAY",
    cycleStartDate,
    cycleEndDate: cycleStartDate,
  });

  if (!cycle.plannerBlocksClearedAt) {
    await seedPlannerBlocksFromMostRecentDay(app.prisma, {
      userId: input.userId,
      date: input.date,
      planningCycleId: cycle.id,
      timezone,
    });
  }

  const [taskRecords, plannerBlocks, launchRecord] = await Promise.all([
    app.prisma.task.findMany({
      where: {
        userId: input.userId,
        scheduledForDate: cycleStartDate,
      },
      orderBy: [{ status: "asc" }, { todaySortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      include: planningTaskInclude,
    }),
    loadPlannerBlocks(app.prisma, cycle.id),
    app.prisma.dailyLaunch?.findUnique?.({
      where: {
        planningCycleId: cycle.id,
      },
    }) ?? Promise.resolve(null),
  ]);

  const tasks = taskRecords.map(serializeTask);
  const launch = launchRecord ? serializeDailyLaunch(launchRecord) : null;
  const mustWinTask =
    launch?.mustWinTaskId
      ? tasks.find((task) => task.id === launch.mustWinTaskId) ?? null
      : null;

  return {
    userId: input.userId,
    date: input.date,
    cycleId: cycle.id,
    timezone,
    launch,
    mustWinTask,
    priorities: cycle.priorities.map(serializePriority),
    tasks,
    plannerBlocks,
  };
}
