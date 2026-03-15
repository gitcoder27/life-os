import type { IsoDateString } from "@life-os/contracts";

import { getUserLocalDate, normalizeTimezone } from "../time/user-time.js";

interface WaterLogLike {
  occurredAt: Date;
  amountMl: number;
}

export function buildWaterTotalsByLocalDate(
  waterLogs: WaterLogLike[],
  timezone?: string | null,
) {
  const totals = new Map<IsoDateString, number>();
  const normalizedTimezone = normalizeTimezone(timezone);

  for (const waterLog of waterLogs) {
    const date = getUserLocalDate(waterLog.occurredAt, normalizedTimezone);
    totals.set(date, (totals.get(date) ?? 0) + waterLog.amountMl);
  }

  return totals;
}

export function getWaterTotalForDate(
  waterLogs: WaterLogLike[],
  isoDate: IsoDateString,
  timezone?: string | null,
) {
  return buildWaterTotalsByLocalDate(waterLogs, timezone).get(isoDate) ?? 0;
}

export function countWaterTargetHits(
  waterLogs: WaterLogLike[],
  timezone: string | null | undefined,
  targetMl: number,
) {
  if (targetMl <= 0) {
    return 0;
  }

  return [...buildWaterTotalsByLocalDate(waterLogs, timezone).values()].filter(
    (amountMl) => amountMl >= targetMl,
  ).length;
}
