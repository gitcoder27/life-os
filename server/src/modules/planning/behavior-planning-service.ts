import type {
  AdaptiveNextMove,
  DayCapacityAssessment,
  FocusSessionItem,
  IsoDateString,
} from "@life-os/contracts";

import { parseIsoDate } from "../../lib/time/cycle.js";
import { getUserLocalDate } from "../../lib/time/user-time.js";
import { buildAdaptiveNextMove } from "./adaptive-today-guidance.js";
import {
  loadAdaptiveTodayContext,
  type AdaptiveTodayContext,
} from "./adaptive-today-context.js";
import { assessDayCapacity } from "./day-capacity.js";
import { detectMissedDayPattern } from "./day-mode.js";
import type { PlanningApp } from "./planning-types.js";

export type BehaviorPlanningApp = PlanningApp;
export type BehaviorPlanningContext = AdaptiveTodayContext;

export type BehaviorPlanningState = {
  context: BehaviorPlanningContext;
  capacity: DayCapacityAssessment;
  isLiveDate: boolean;
  hasMissedDayPattern: boolean;
};

export async function loadBehaviorPlanningState(
  app: BehaviorPlanningApp,
  input: {
    userId: string;
    date: IsoDateString;
    now: Date;
    overdueTaskCount: number;
  },
): Promise<BehaviorPlanningState> {
  const context = await loadAdaptiveTodayContext(app, {
    userId: input.userId,
    date: input.date,
  });
  const isLiveDate = input.date === getUserLocalDate(input.now, context.timezone);
  const hasMissedDayPattern = await detectMissedDayPattern(app.prisma, {
    userId: input.userId,
    targetDate: parseIsoDate(input.date),
    overdueTaskCount: input.overdueTaskCount,
  });
  const capacity = assessDayCapacity({
    tasks: context.tasks,
    plannerBlocks: context.plannerBlocks,
    launch: context.launch,
    mustWinTask: context.mustWinTask,
    now: input.now,
    isLiveDate,
  });

  return {
    context,
    capacity,
    isLiveDate,
    hasMissedDayPattern,
  };
}

export function buildBehaviorPlanningNextMove(input: {
  context: BehaviorPlanningContext;
  capacity: DayCapacityAssessment;
  activeFocusSession?: FocusSessionItem | null;
  now?: Date;
}): AdaptiveNextMove {
  return buildAdaptiveNextMove(input);
}
