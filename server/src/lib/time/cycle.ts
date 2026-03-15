import type { IsoDateString } from "@life-os/contracts";

import { toIsoDateString } from "./date.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseIsoDate(date: IsoDateString) {
  return new Date(`${date}T00:00:00.000Z`);
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

export function addIsoDays(isoDate: IsoDateString, days: number): IsoDateString {
  return toIsoDateString(addDays(parseIsoDate(isoDate), days));
}

export function getWeekEndDate(startDate: Date) {
  return addDays(startDate, 6);
}

export function getMonthEndDate(startDate: Date) {
  return new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 0));
}

export function getWeekStartIsoDate(isoDate: IsoDateString, weekStartsOn: number) {
  const date = parseIsoDate(isoDate);
  const day = date.getUTCDay();
  const delta = (day - weekStartsOn + 7) % 7;

  return addIsoDays(isoDate, -delta);
}

export function getMonthStartIsoDate(isoDate: IsoDateString): IsoDateString {
  const date = parseIsoDate(isoDate);

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01` as IsoDateString;
}

export function normalizeIsoDate(date: Date) {
  return toIsoDateString(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())));
}
