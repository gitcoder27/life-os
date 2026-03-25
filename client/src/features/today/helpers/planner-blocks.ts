import type { DayPlannerBlockItem } from "../../../shared/lib/api";

export const QUICK_BLOCK_PRESETS = [
  { label: "Morning focus", icon: "🌅", start: "08:00", end: "10:00" },
  { label: "Lunch", icon: "🍽", start: "12:00", end: "13:00" },
  { label: "Deep work", icon: "🎯", start: "14:00", end: "16:00" },
  { label: "Gym", icon: "💪", start: "17:00", end: "18:00" },
  { label: "Wind down", icon: "🌙", start: "20:00", end: "21:00" },
] as const;

export const toTimeInputValue = (isoDateTime: string): string => {
  try {
    const date = new Date(isoDateTime);
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  } catch {
    return "09:00";
  }
};

export const getLocalTimezoneOffset = (): string => {
  const offset = new Date().getTimezoneOffset();
  const sign = offset <= 0 ? "+" : "-";
  const absOffset = Math.abs(offset);
  const h = String(Math.floor(absOffset / 60)).padStart(2, "0");
  const m = String(absOffset % 60).padStart(2, "0");
  return `${sign}${h}:${m}`;
};

export const buildPlannerDateTime = (date: string, time: string, timezoneOffset: string) =>
  `${date}T${time}:00${timezoneOffset}`;

export const addMinutes = (timeStr: string, minutes: number): string => {
  const [h, m] = timeStr.split(":").map(Number);
  const totalMinutes = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  const newH = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const newM = String(totalMinutes % 60).padStart(2, "0");
  return `${newH}:${newM}`;
};

export const getNextAvailableTime = (blocks: DayPlannerBlockItem[]): string => {
  if (blocks.length === 0) {
    const now = new Date();
    const h = String(Math.max(now.getHours(), 8)).padStart(2, "0");
    return `${h}:00`;
  }

  const latestBlock = [...blocks].sort(
    (left, right) => new Date(right.endsAt).getTime() - new Date(left.endsAt).getTime(),
  )[0];

  return latestBlock ? toTimeInputValue(latestBlock.endsAt) : "09:00";
};

export const validatePlannerBlockDraft = (input: {
  date: string;
  startTime: string;
  endTime: string;
  timezoneOffset: string;
  existingBlocks: DayPlannerBlockItem[];
  ignoreBlockId?: string;
}) => {
  const startsAt = buildPlannerDateTime(input.date, input.startTime, input.timezoneOffset);
  const endsAt = buildPlannerDateTime(input.date, input.endTime, input.timezoneOffset);

  if (!input.startTime || !input.endTime) {
    return { startsAt, endsAt, error: "Start and end times are required." };
  }

  if (input.startTime >= input.endTime) {
    return { startsAt, endsAt, error: "End time must be after start time." };
  }

  const nextStart = new Date(startsAt);
  const nextEnd = new Date(endsAt);
  if (Number.isNaN(nextStart.getTime()) || Number.isNaN(nextEnd.getTime())) {
    return { startsAt, endsAt, error: "Block time is invalid." };
  }

  const overlappingBlock = input.existingBlocks.find((block) => {
    if (block.id === input.ignoreBlockId) {
      return false;
    }

    const blockStart = new Date(block.startsAt);
    const blockEnd = new Date(block.endsAt);
    return blockStart < nextEnd && blockEnd > nextStart;
  });

  if (overlappingBlock) {
    return {
      startsAt,
      endsAt,
      error: `Overlaps ${overlappingBlock.title || "another block"}.`,
    };
  }

  return { startsAt, endsAt, error: null };
};
