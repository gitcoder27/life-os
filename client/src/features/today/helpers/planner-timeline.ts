import type { DayPlannerBlockItem } from "../../../shared/lib/api";
import {
  formatDurationMinutes,
  minutesToTimeString,
  timeStringToMinutes,
} from "./planner-blocks";

const PLANNER_VISIBLE_HOURS_STORAGE_KEY = "lifeos:today-planner-visible-hours";
const VISIBLE_HOURS_STORAGE_VERSION = 1;
const DEFAULT_VISIBLE_HOURS = {
  startTime: "06:00",
  endTime: "22:00",
} as const;
const MIN_VISIBLE_SPAN_MINUTES = 4 * 60;
const BLOCK_MIN_HEIGHT = 92;
const BLOCK_MIN_HEIGHT_WITH_TASKS = 128;
const GAP_MIN_HEIGHT = 52;
const SEGMENT_PIXELS_PER_MINUTE = 1.2;
const GAP_PIXELS_PER_MINUTE = 0.7;

export type PlannerVisibleHoursPreference = {
  startTime: string;
  endTime: string;
};

type StoredPlannerVisibleHours = {
  version: number;
  value: PlannerVisibleHoursPreference;
};

export type PlannerTimelineSegment = {
  id: string;
  kind: "block" | "gap";
  startsAt: string;
  endsAt: string;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  durationLabel: string;
  status: "past" | "current" | "upcoming";
  hourMarkers: number[];
  currentMarkerPercent: number | null;
  minHeight: number;
  block?: DayPlannerBlockItem;
};

export type PlannerTimelineModel = {
  segments: PlannerTimelineSegment[];
  totalFreeMinutes: number;
  currentBlockId: string | null;
  nextBlockId: string | null;
  visibleRangeLabel: string;
  renderedRange: {
    startMinutes: number;
    endMinutes: number;
    startTime: string;
    endTime: string;
  };
};

export const getDefaultPlannerVisibleHours = (): PlannerVisibleHoursPreference => ({
  ...DEFAULT_VISIBLE_HOURS,
});

export const readStoredPlannerVisibleHours = (): PlannerVisibleHoursPreference => {
  try {
    const rawValue = localStorage.getItem(PLANNER_VISIBLE_HOURS_STORAGE_KEY);
    if (!rawValue) {
      return getDefaultPlannerVisibleHours();
    }

    const parsed = JSON.parse(rawValue) as Partial<StoredPlannerVisibleHours>;
    if (
      parsed.version !== VISIBLE_HOURS_STORAGE_VERSION ||
      !parsed.value ||
      typeof parsed.value.startTime !== "string" ||
      typeof parsed.value.endTime !== "string"
    ) {
      localStorage.removeItem(PLANNER_VISIBLE_HOURS_STORAGE_KEY);
      return getDefaultPlannerVisibleHours();
    }

    return {
      startTime: parsed.value.startTime,
      endTime: parsed.value.endTime,
    };
  } catch {
    return getDefaultPlannerVisibleHours();
  }
};

export const writeStoredPlannerVisibleHours = (
  value: PlannerVisibleHoursPreference,
) => {
  try {
    const payload: StoredPlannerVisibleHours = {
      version: VISIBLE_HOURS_STORAGE_VERSION,
      value,
    };
    localStorage.setItem(PLANNER_VISIBLE_HOURS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    return;
  }
};

export const clearStoredPlannerVisibleHours = () => {
  try {
    localStorage.removeItem(PLANNER_VISIBLE_HOURS_STORAGE_KEY);
  } catch {
    return;
  }
};

export const validatePlannerVisibleHours = (
  value: PlannerVisibleHoursPreference,
): string | null => {
  if (!value.startTime || !value.endTime) {
    return "Visible start and end times are required.";
  }

  const startMinutes = timeStringToMinutes(value.startTime);
  const endMinutes = timeStringToMinutes(value.endTime);

  if (startMinutes >= endMinutes) {
    return "Visible end time must be after the start time.";
  }

  if (endMinutes - startMinutes < MIN_VISIBLE_SPAN_MINUTES) {
    return "Visible hours must cover at least 4 hours.";
  }

  return null;
};

export const sortPlannerBlocksByTime = (blocks: DayPlannerBlockItem[]) =>
  [...blocks].sort((left, right) => {
    const timeDiff =
      new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();
    if (timeDiff !== 0) {
      return timeDiff;
    }

    return left.sortOrder - right.sortOrder;
  });

export const buildPlannerTimelineModel = (input: {
  blocks: DayPlannerBlockItem[];
  now: Date;
  preferredHours: PlannerVisibleHoursPreference;
}): PlannerTimelineModel => {
  const blocks = sortPlannerBlocksByTime(input.blocks);
  const currentBlock =
    blocks.find((block) => isNowWithinRange(block.startsAt, block.endsAt, input.now)) ?? null;
  const nextBlock =
    blocks.find((block) => new Date(block.startsAt).getTime() > input.now.getTime()) ?? null;

  const preferredStartMinutes = timeStringToMinutes(input.preferredHours.startTime);
  const preferredEndMinutes = timeStringToMinutes(input.preferredHours.endTime);
  const earliestBlockMinutes = blocks.length > 0 ? getFloorHour(blocks[0].startsAt) : preferredStartMinutes;
  const latestBlockMinutes =
    blocks.length > 0 ? getCeilHour(blocks[blocks.length - 1].endsAt) : preferredEndMinutes;
  const renderedStartMinutes = Math.min(preferredStartMinutes, earliestBlockMinutes);
  const renderedEndMinutes = Math.max(preferredEndMinutes, latestBlockMinutes);
  const renderedRange = {
    startMinutes: renderedStartMinutes,
    endMinutes: renderedEndMinutes,
    startTime: minutesToTimeString(renderedStartMinutes),
    endTime: minutesToTimeString(renderedEndMinutes),
  };

  const segments: PlannerTimelineSegment[] = [];
  let cursorMinutes = renderedStartMinutes;
  let cursorIso = buildIsoAtMinutes(blocks[0]?.startsAt ?? input.now.toISOString(), renderedStartMinutes);
  let totalFreeMinutes = 0;

  for (const block of blocks) {
    const blockStartMinutes = getMinutesFromIso(block.startsAt);
    const blockEndMinutes = getMinutesFromIso(block.endsAt);

    if (blockStartMinutes > cursorMinutes) {
      const gapStartsAt = cursorIso;
      const gapEndsAt = block.startsAt;
      const gapDuration = blockStartMinutes - cursorMinutes;
      totalFreeMinutes += gapDuration;
      segments.push(
        buildSegment({
          id: `gap-${cursorMinutes}-${blockStartMinutes}`,
          kind: "gap",
          startsAt: gapStartsAt,
          endsAt: gapEndsAt,
          startMinutes: cursorMinutes,
          endMinutes: blockStartMinutes,
          durationMinutes: gapDuration,
          now: input.now,
        }),
      );
    }

    segments.push(
      buildSegment({
        id: block.id,
        kind: "block",
        startsAt: block.startsAt,
        endsAt: block.endsAt,
        startMinutes: blockStartMinutes,
        endMinutes: blockEndMinutes,
        durationMinutes: Math.max(blockEndMinutes - blockStartMinutes, 0),
        now: input.now,
        block,
      }),
    );

    cursorMinutes = blockEndMinutes;
    cursorIso = block.endsAt;
  }

  if (cursorMinutes < renderedEndMinutes) {
    const gapEndsAt = buildIsoAtMinutes(cursorIso, renderedEndMinutes);
    const gapDuration = renderedEndMinutes - cursorMinutes;
    totalFreeMinutes += gapDuration;
    segments.push(
      buildSegment({
        id: `gap-${cursorMinutes}-${renderedEndMinutes}`,
        kind: "gap",
        startsAt: cursorIso,
        endsAt: gapEndsAt,
        startMinutes: cursorMinutes,
        endMinutes: renderedEndMinutes,
        durationMinutes: gapDuration,
        now: input.now,
      }),
    );
  }

  return {
    segments,
    totalFreeMinutes,
    currentBlockId: currentBlock?.id ?? null,
    nextBlockId: currentBlock ? null : nextBlock?.id ?? null,
    visibleRangeLabel: `${input.preferredHours.startTime} - ${input.preferredHours.endTime}`,
    renderedRange,
  };
};

const buildSegment = (input: {
  id: string;
  kind: "block" | "gap";
  startsAt: string;
  endsAt: string;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  now: Date;
  block?: DayPlannerBlockItem;
}): PlannerTimelineSegment => ({
  id: input.id,
  kind: input.kind,
  startsAt: input.startsAt,
  endsAt: input.endsAt,
  startMinutes: input.startMinutes,
  endMinutes: input.endMinutes,
  durationMinutes: input.durationMinutes,
  durationLabel: formatDurationMinutes(input.durationMinutes),
  status: getSegmentStatus(input.startsAt, input.endsAt, input.now),
  hourMarkers: getHourMarkers(input.startMinutes, input.endMinutes),
  currentMarkerPercent: getCurrentMarkerPercent(input.startsAt, input.endsAt, input.now),
  minHeight:
    input.kind === "block"
      ? Math.max(
          input.block && input.block.tasks.length > 0 ? BLOCK_MIN_HEIGHT_WITH_TASKS : BLOCK_MIN_HEIGHT,
          Math.round(input.durationMinutes * SEGMENT_PIXELS_PER_MINUTE),
        )
      : Math.max(GAP_MIN_HEIGHT, Math.round(input.durationMinutes * GAP_PIXELS_PER_MINUTE)),
  block: input.block,
});

const getSegmentStatus = (
  startsAt: string,
  endsAt: string,
  now: Date,
): "past" | "current" | "upcoming" => {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  const nowTime = now.getTime();

  if (nowTime >= end) {
    return "past";
  }

  if (nowTime >= start && nowTime < end) {
    return "current";
  }

  return "upcoming";
};

const getCurrentMarkerPercent = (
  startsAt: string,
  endsAt: string,
  now: Date,
): number | null => {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  const nowTime = now.getTime();

  if (nowTime < start || nowTime >= end || end <= start) {
    return null;
  }

  return ((nowTime - start) / (end - start)) * 100;
};

const getHourMarkers = (startMinutes: number, endMinutes: number): number[] => {
  const markers: number[] = [];
  const firstMarker = Math.ceil(startMinutes / 60) * 60;
  for (let marker = firstMarker; marker < endMinutes; marker += 60) {
    if (marker > startMinutes) {
      markers.push(marker);
    }
  }
  return markers;
};

const getMinutesFromIso = (isoDateTime: string): number => {
  const date = new Date(isoDateTime);
  return date.getHours() * 60 + date.getMinutes();
};

const getFloorHour = (isoDateTime: string) =>
  Math.floor(getMinutesFromIso(isoDateTime) / 60) * 60;

const getCeilHour = (isoDateTime: string) =>
  Math.min(Math.ceil(getMinutesFromIso(isoDateTime) / 60) * 60, 23 * 60 + 59);

const buildIsoAtMinutes = (referenceIso: string, minutes: number) => {
  const date = new Date(referenceIso);
  const next = new Date(date);
  next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return next.toISOString();
};

const isNowWithinRange = (startsAt: string, endsAt: string, now: Date) => {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  const nowTime = now.getTime();
  return nowTime >= start && nowTime < end;
};
