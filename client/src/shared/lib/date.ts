let cachedWeekStartsOn: number | null = null;
let cachedTimezone: string | null = null;

export const padNumber = (value: number) => String(value).padStart(2, "0");

export const toIsoDate = (date: Date) =>
  `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;

const getResolvedTimezone = () => {
  const preferredTimezone = getPreferredTimezone();

  if (!preferredTimezone) {
    return undefined;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: preferredTimezone });
    return preferredTimezone;
  } catch {
    return undefined;
  }
};

const formatIsoDateInTimezone = (date: Date, timezone?: string) =>
  new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).format(date);

export const getTodayDate = () => {
  const timezone = getResolvedTimezone();
  return formatIsoDateInTimezone(new Date(), timezone);
};

export const getReminderDate = (reminderAt: string | null | undefined) => {
  if (!reminderAt) {
    return null;
  }

  const timezone = getResolvedTimezone();

  try {
    return formatIsoDateInTimezone(new Date(reminderAt), timezone);
  } catch {
    return reminderAt.slice(0, 10);
  }
};

export const getMonthString = (isoDate: string) => isoDate.slice(0, 7);

export const getWeekStartDate = (isoDate: string) => getPreferenceAwareWeekStartDate(isoDate);

export const getWeekEndDate = (isoDate: string) => {
  const date = new Date(`${getWeekStartDate(isoDate)}T12:00:00`);
  date.setDate(date.getDate() + 6);
  return toIsoDate(date);
};

export const getMonthStartDate = (isoDate: string) => {
  const date = new Date(`${isoDate}T12:00:00`);
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-01`;
};

export const getMonthEndDate = (isoDate: string) => {
  const date = new Date(`${getMonthStartDate(isoDate)}T12:00:00`);
  date.setMonth(date.getMonth() + 1);
  date.setDate(0);
  return toIsoDate(date);
};

export const formatLongDate = (isoDate: string) => {
  const timezone = getResolvedTimezone();

  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    ...(timezone ? { timeZone: timezone } : {}),
  });
};

export const formatShortDate = (isoDate: string) =>
  new Date(`${isoDate}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

export const formatMonthLabel = (isoMonth: string) =>
  new Date(`${isoMonth}-01T12:00:00`).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

export const formatTimeLabel = (isoDateTime: string | null) => {
  if (!isoDateTime) {
    return "Any time";
  }

  return new Date(isoDateTime).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
};

export const formatRelativeDate = (isoDate: string) => {
  const today = getTodayDate();
  if (isoDate === today) {
    return "Today";
  }

  const yesterday = new Date(`${today}T12:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isoDate === toIsoDate(yesterday)) {
    return "Yesterday";
  }

  return formatShortDate(isoDate);
};

export const daysUntil = (isoDate: string) => {
  const today = new Date(`${getTodayDate()}T12:00:00`);
  const target = new Date(`${isoDate}T12:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
};

export const formatDueLabel = (isoDate: string) => {
  const difference = daysUntil(isoDate);

  if (difference <= 0) {
    return difference === 0 ? "today" : "overdue";
  }

  return difference === 1 ? "1 day" : `${difference} days`;
};

export const setPreferredWeekStart = (day: number) => {
  cachedWeekStartsOn = day;
};

export const setPreferredTimezone = (timezone: string) => {
  cachedTimezone = timezone;
};

export const getPreferredWeekStartsOn = () => cachedWeekStartsOn ?? 1;

export const getPreferredTimezone = () => cachedTimezone;

export const getPreferenceAwareWeekStartDate = (isoDate: string) => {
  const weekStartsOn = getPreferredWeekStartsOn();
  const date = new Date(`${isoDate}T12:00:00`);
  const day = date.getDay();
  const diff = (day - weekStartsOn + 7) % 7;
  date.setDate(date.getDate() - diff);
  return toIsoDate(date);
};
