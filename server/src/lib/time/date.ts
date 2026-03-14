import type { IsoDateString } from "@life-os/contracts";

export function toIsoDateString(date: Date): IsoDateString {
  return date.toISOString().slice(0, 10) as IsoDateString;
}

export function getUtcGreeting(date: Date) {
  const hour = date.getUTCHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}
