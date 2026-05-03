import { getTodayDate } from "../../shared/lib/date";

const MS_PER_DAY = 86_400_000;

const toLocalNoon = (isoDate: string) => new Date(`${isoDate.slice(0, 10)}T12:00:00`);

const daysBetween = (fromIsoDate: string, toIsoDate: string) =>
  Math.round((toLocalNoon(toIsoDate).getTime() - toLocalNoon(fromIsoDate).getTime()) / MS_PER_DAY);

export const formatGoalDate = (iso: string | null) => {
  if (!iso) {
    return "";
  }

  return toLocalNoon(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

export const isGoalMilestoneOverdue = (
  targetDate: string | null,
  contextDate = getTodayDate(),
) => Boolean(targetDate && targetDate < contextDate);

export const getGoalMilestoneDueLabel = (
  targetDate: string | null,
  contextDate = getTodayDate(),
) => {
  if (!targetDate) {
    return null;
  }

  const diffDays = daysBetween(contextDate, targetDate);

  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  return `Due in ${diffDays} days`;
};
