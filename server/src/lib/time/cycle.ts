import type { IsoDateString } from "@life-os/contracts";

import { toIsoDateString } from "./date.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseIsoDate(date: IsoDateString) {
  return new Date(`${date}T00:00:00.000Z`);
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

export function getWeekEndDate(startDate: Date) {
  return addDays(startDate, 6);
}

export function getMonthEndDate(startDate: Date) {
  return new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 0));
}

export function normalizeIsoDate(date: Date) {
  return toIsoDateString(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())));
}
