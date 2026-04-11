type TimingStatus =
  | "none"
  | "upcoming"
  | "due_now"
  | "late"
  | "complete_on_time"
  | "complete_late";

const STATUS_ORDER: Record<TimingStatus, number> = {
  late: 0,
  due_now: 1,
  upcoming: 2,
  none: 3,
  complete_late: 4,
  complete_on_time: 5,
};

export function parseTimeInputToMinutes(value: string) {
  if (!value) {
    return null;
  }

  const [hourString = "", minuteString = ""] = value.split(":");
  const hour = Number(hourString);
  const minute = Number(minuteString);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return null;
  }

  return hour * 60 + minute;
}

export function formatMinutesToTimeInput(minutes: number | null | undefined) {
  if (minutes == null) {
    return "";
  }

  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function timingStatusLabel(status: TimingStatus) {
  switch (status) {
    case "due_now":
      return "Now";
    case "late":
      return "Late";
    case "upcoming":
      return "Later";
    case "complete_on_time":
      return "On time";
    case "complete_late":
      return "Done late";
    default:
      return null;
  }
}

export function timingStatusTagClass(status: TimingStatus) {
  switch (status) {
    case "late":
    case "complete_late":
      return "tag tag--warning";
    case "due_now":
      return "tag tag--negative";
    case "complete_on_time":
      return "tag tag--positive";
    case "upcoming":
      return "tag tag--neutral";
    default:
      return "tag tag--neutral";
  }
}

export function sortByTimingStatus<T extends { timingStatusToday: TimingStatus; title?: string; name?: string }>(
  items: T[],
) {
  return [...items].sort((left, right) => {
    const delta = STATUS_ORDER[left.timingStatusToday] - STATUS_ORDER[right.timingStatusToday];
    if (delta !== 0) {
      return delta;
    }

    const leftLabel = left.title ?? left.name ?? "";
    const rightLabel = right.title ?? right.name ?? "";

    return leftLabel.localeCompare(rightLabel);
  });
}
