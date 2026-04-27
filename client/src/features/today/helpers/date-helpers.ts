import { daysUntil, toIsoDate } from "../../../shared/lib/api";

export function getTomorrowDate(fromDate: string) {
  const tomorrow = new Date(`${fromDate}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toIsoDate(tomorrow);
}

export function getOffsetDate(fromDate: string, offsetDays: number) {
  const nextDate = new Date(`${fromDate}T12:00:00`);
  nextDate.setDate(nextDate.getDate() + offsetDays);
  return toIsoDate(nextDate);
}

export function formatRecoveryDate(isoDate: string) {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function getRecoveryTaskDetail(isoDate: string) {
  const difference = daysUntil(isoDate);
  const overdueDays = Math.max(Math.abs(difference), 1);
  return `Scheduled ${formatRecoveryDate(isoDate)} · overdue by ${overdueDays} day${overdueDays === 1 ? "" : "s"}`;
}

export function getRecoveryTaskCompactMeta(isoDate: string) {
  const difference = daysUntil(isoDate);
  const overdueDays = Math.max(Math.abs(difference), 1);

  return {
    scheduledLabel: formatRecoveryDate(isoDate),
    overdueLabel: overdueDays === 1 ? "1d overdue" : `${overdueDays}d overdue`,
  };
}

let draftKeyCounter = 0;
export function nextDraftKey() {
  return `draft-${++draftKeyCounter}`;
}
