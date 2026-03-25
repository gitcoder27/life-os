import type { DayPlannerBlockItem } from "../../../shared/lib/api";

export const QUICK_BLOCK_PRESETS = [
  { label: "Morning focus", icon: "🌅", start: "08:00", end: "10:00" },
  { label: "Lunch", icon: "🍽", start: "12:00", end: "13:00" },
  { label: "Deep work", icon: "🎯", start: "14:00", end: "16:00" },
  { label: "Gym", icon: "💪", start: "17:00", end: "18:00" },
  { label: "Wind down", icon: "🌙", start: "20:00", end: "21:00" },
] as const;

const PLANNER_QUICK_ACTION_INCREMENT_MINUTES = 15;
const DAY_END_MINUTES = 23 * 60 + 59;

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
  const totalMinutes = Math.min(Math.max(h * 60 + m + minutes, 0), 23 * 60 + 59);
  const newH = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const newM = String(totalMinutes % 60).padStart(2, "0");
  return `${newH}:${newM}`;
};

export const timeStringToMinutes = (timeStr: string): number => {
  const [h, m] = timeStr.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) {
    return 0;
  }

  return h * 60 + m;
};

export const minutesToTimeString = (minutes: number): string => {
  const bounded = Math.min(Math.max(minutes, 0), 23 * 60 + 59);
  const h = String(Math.floor(bounded / 60)).padStart(2, "0");
  const m = String(bounded % 60).padStart(2, "0");
  return `${h}:${m}`;
};

export const formatDurationMinutes = (minutes: number): string => {
  const rounded = Math.max(0, minutes);
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;

  if (hours === 0) {
    return `${remainder}m`;
  }

  if (remainder === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainder}m`;
};

export const getDurationMinutes = (startsAt: string, endsAt: string): number => {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const diff = Math.round((end.getTime() - start.getTime()) / 60000);
  return Math.max(diff, 0);
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

export const getPlannerBlockDate = (block: DayPlannerBlockItem) => block.startsAt.slice(0, 10);

export const getPlannerBlockTimezoneOffset = (block: DayPlannerBlockItem) =>
  block.startsAt.slice(-6);

export const getDuplicateBlockWindow = (input: {
  block: DayPlannerBlockItem;
  existingBlocks: DayPlannerBlockItem[];
}) => {
  const durationMinutes = getDurationMinutes(input.block.startsAt, input.block.endsAt);
  if (durationMinutes <= 0) {
    return null;
  }

  const blockId = input.block.id;
  const candidateStartMinutes = timeStringToMinutes(toTimeInputValue(input.block.endsAt));
  let nextStartMinutes = candidateStartMinutes;
  const orderedBlocks = [...input.existingBlocks]
    .filter((block) => block.id !== blockId)
    .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());

  for (const block of orderedBlocks) {
    const blockStartMinutes = timeStringToMinutes(toTimeInputValue(block.startsAt));
    const blockEndMinutes = timeStringToMinutes(toTimeInputValue(block.endsAt));

    if (blockEndMinutes <= nextStartMinutes) {
      continue;
    }

    if (nextStartMinutes + durationMinutes <= blockStartMinutes) {
      return {
        startTime: minutesToTimeString(nextStartMinutes),
        endTime: minutesToTimeString(nextStartMinutes + durationMinutes),
      };
    }

    nextStartMinutes = blockEndMinutes;
  }

  if (nextStartMinutes + durationMinutes <= DAY_END_MINUTES) {
    return {
      startTime: minutesToTimeString(nextStartMinutes),
      endTime: minutesToTimeString(nextStartMinutes + durationMinutes),
    };
  }

  return null;
};

export const getSplitBlockTime = (block: DayPlannerBlockItem) => {
  const startMinutes = timeStringToMinutes(toTimeInputValue(block.startsAt));
  const endMinutes = timeStringToMinutes(toTimeInputValue(block.endsAt));
  const durationMinutes = endMinutes - startMinutes;

  if (durationMinutes < PLANNER_QUICK_ACTION_INCREMENT_MINUTES * 2) {
    return null;
  }

  const roundedMidpoint =
    Math.round(((startMinutes + endMinutes) / 2) / PLANNER_QUICK_ACTION_INCREMENT_MINUTES) *
    PLANNER_QUICK_ACTION_INCREMENT_MINUTES;
  const boundedMidpoint = Math.min(
    Math.max(roundedMidpoint, startMinutes + PLANNER_QUICK_ACTION_INCREMENT_MINUTES),
    endMinutes - PLANNER_QUICK_ACTION_INCREMENT_MINUTES,
  );

  return minutesToTimeString(boundedMidpoint);
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
