import type {
  RecurrenceDefinition,
  RecurrenceEndCondition,
  RecurrenceInput,
  RecurrenceRuleInput,
  RecurringTaskCarryPolicy,
} from "@life-os/contracts";

export type {
  MonthlyNthWeekdayRule,
  RecurrenceDefinition,
  RecurrenceEndCondition,
  RecurrenceEndType,
  RecurrenceExceptionAction,
  RecurrenceExceptionItem,
  RecurrenceFrequency,
  RecurrenceInput,
  RecurrenceRuleInput,
  RecurringTaskCarryPolicy,
} from "@life-os/contracts";

// ── Day labels ──────────────────────────────────

const DAY_LABELS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const DAY_LABELS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const ORDINAL_LABELS: Record<number, string> = {
  1: "First",
  2: "Second",
  3: "Third",
  4: "Fourth",
  [-1]: "Last",
};

export { DAY_LABELS_SHORT, DAY_LABELS_FULL };

const MAX_LOOKAHEAD_DAYS = 366 * 5;

function padNumber(value: number) {
  return String(value).padStart(2, "0");
}

function toIsoDateString(date: Date) {
  return `${date.getUTCFullYear()}-${padNumber(date.getUTCMonth() + 1)}-${padNumber(date.getUTCDate())}`;
}

function parseIsoDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function deriveMonthlyOrdinal(startsOn: string) {
  const startDate = parseIsoDate(startsOn);
  return Math.min(Math.floor((startDate.getUTCDate() - 1) / 7) + 1, 4) as 1 | 2 | 3 | 4;
}

function addIsoDays(isoDate: string, days: number) {
  const date = parseIsoDate(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDateString(date);
}

function daysBetween(startIsoDate: string, endIsoDate: string) {
  const start = parseIsoDate(startIsoDate).getTime();
  const end = parseIsoDate(endIsoDate).getTime();
  return Math.round((end - start) / 86_400_000);
}

function monthsBetween(startIsoDate: string, endIsoDate: string) {
  const start = parseIsoDate(startIsoDate);
  const end = parseIsoDate(endIsoDate);
  return (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
}

function getNthWeekdayOfMonth(year: number, month: number, ordinal: number, dayOfWeek: number) {
  if (ordinal === -1) {
    const lastDay = new Date(Date.UTC(year, month + 1, 0));
    const delta = (lastDay.getUTCDay() - dayOfWeek + 7) % 7;
    return new Date(Date.UTC(year, month + 1, lastDay.getUTCDate() - delta));
  }

  const firstDay = new Date(Date.UTC(year, month, 1));
  const offset = (dayOfWeek - firstDay.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month, 1 + offset + (ordinal - 1) * 7));
}

function rawRuleMatchesDate(rule: RecurrenceRuleInput, isoDate: string) {
  if (isoDate < rule.startsOn) {
    return false;
  }

  switch (rule.frequency) {
    case "daily": {
      const interval = Math.max(rule.interval ?? 1, 1);
      return daysBetween(rule.startsOn, isoDate) % interval === 0;
    }
    case "weekly": {
      const daysOfWeek = rule.daysOfWeek && rule.daysOfWeek.length > 0
        ? rule.daysOfWeek
        : [parseIsoDate(rule.startsOn).getUTCDay()];
      if (!daysOfWeek.includes(parseIsoDate(isoDate).getUTCDay())) {
        return false;
      }

      const interval = Math.max(rule.interval ?? 1, 1);
      return Math.floor(daysBetween(rule.startsOn, isoDate) / 7) % interval === 0;
    }
    case "monthly_nth_weekday": {
      if (!rule.nthWeekday) {
        return false;
      }

      const interval = Math.max(rule.interval ?? 1, 1);
      if (monthsBetween(rule.startsOn, isoDate) % interval !== 0) {
        return false;
      }

      const date = parseIsoDate(isoDate);
      const target = getNthWeekdayOfMonth(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        rule.nthWeekday.ordinal,
        rule.nthWeekday.dayOfWeek,
      );
      return toIsoDateString(target) === isoDate;
    }
    case "interval": {
      const interval = Math.max(rule.interval ?? 1, 1);
      return daysBetween(rule.startsOn, isoDate) % interval === 0;
    }
  }
}

function endConditionAllowsDate(rule: RecurrenceRuleInput, isoDate: string) {
  const end = rule.end;
  if (!end || end.type === "never") {
    return true;
  }

  if (end.type === "on_date") {
    return Boolean(end.until && isoDate <= end.until);
  }

  const occurrenceCount = end.occurrenceCount ?? 0;
  if (occurrenceCount <= 0) {
    return false;
  }

  let count = 0;
  let cursor = rule.startsOn;
  while (cursor <= isoDate) {
    if (rawRuleMatchesDate(rule, cursor)) {
      count += 1;
      if (cursor === isoDate) {
        return count <= occurrenceCount;
      }
    }
    cursor = addIsoDays(cursor, 1);
  }

  return false;
}

export function listUpcomingRecurrenceDates(
  rule: RecurrenceRuleInput,
  count = 3,
  startIsoDate = rule.startsOn,
) {
  const dates: string[] = [];
  let cursor = startIsoDate < rule.startsOn ? rule.startsOn : startIsoDate;
  let safety = 0;

  while (dates.length < count && safety < MAX_LOOKAHEAD_DAYS) {
    if (rawRuleMatchesDate(rule, cursor) && endConditionAllowsDate(rule, cursor)) {
      dates.push(cursor);
    }
    cursor = addIsoDays(cursor, 1);
    safety += 1;
  }

  return dates;
}

// ── Summary formatter ───────────────────────────

function formatStartDate(startsOn: string): string {
  try {
    const date = new Date(`${startsOn}T12:00:00`);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return startsOn;
  }
}

export function formatRecurrenceSummary(rule: RecurrenceRuleInput): string {
  const startLabel = formatStartDate(rule.startsOn);

  switch (rule.frequency) {
    case "daily":
      return `Daily starting ${startLabel}`;

    case "weekly": {
      if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
        const dayNames = [...rule.daysOfWeek]
          .sort((a, b) => a - b)
          .map((d) => DAY_LABELS_SHORT[d])
          .join(", ");
        return `Every ${dayNames} starting ${startLabel}`;
      }
      return `Weekly starting ${startLabel}`;
    }

    case "interval": {
      const n = rule.interval ?? 1;
      if (n === 1) return `Daily starting ${startLabel}`;
      return `Every ${n} days starting ${startLabel}`;
    }

    case "monthly_nth_weekday": {
      if (rule.nthWeekday) {
        const ordinal = ORDINAL_LABELS[rule.nthWeekday.ordinal] ?? `${rule.nthWeekday.ordinal}th`;
        const day = DAY_LABELS_FULL[rule.nthWeekday.dayOfWeek] ?? "day";
        return `${ordinal} ${day} of every month`;
      }
      return `Monthly starting ${startLabel}`;
    }

    default:
      return `Recurring from ${startLabel}`;
  }
}

export function formatRecurrenceEndSummary(end?: RecurrenceEndCondition | null): string | null {
  if (!end || end.type === "never") return null;

  if (end.type === "on_date" && end.until) {
    return `until ${formatStartDate(end.until)}`;
  }

  if (end.type === "after_occurrences" && end.occurrenceCount) {
    return `for ${end.occurrenceCount} occurrence${end.occurrenceCount === 1 ? "" : "s"}`;
  }

  return null;
}

export function formatFullRecurrenceSummary(rule: RecurrenceRuleInput): string {
  const base = formatRecurrenceSummary(rule);
  const endPart = formatRecurrenceEndSummary(rule.end);
  return endPart ? `${base}, ${endPart}` : base;
}

// ── Carry policy labels ─────────────────────────

const CARRY_POLICY_LABELS: Record<RecurringTaskCarryPolicy, string> = {
  complete_and_clone: "Complete & clone next",
  move_due_date: "Move due date",
  cancel: "Cancel if missed",
};

const CARRY_POLICY_SHORT: Record<RecurringTaskCarryPolicy, string> = {
  complete_and_clone: "Clone next",
  move_due_date: "Shift date",
  cancel: "Cancel",
};

export function formatCarryPolicy(policy: RecurringTaskCarryPolicy): string {
  return CARRY_POLICY_LABELS[policy] ?? policy;
}

export function formatCarryPolicyShort(policy: RecurringTaskCarryPolicy): string {
  return CARRY_POLICY_SHORT[policy] ?? policy;
}

// ── Default builders ────────────────────────────

export type RecurrenceContext = "task" | "habit" | "finance" | "reminder";

export function getDefaultRecurrenceRule(
  context: RecurrenceContext,
  startsOn: string,
): RecurrenceRuleInput {
  switch (context) {
    case "habit":
    case "task":
    case "reminder":
      return { frequency: "daily", startsOn };

    case "finance":
      return {
        frequency: "monthly_nth_weekday",
        startsOn,
        nthWeekday: {
          ordinal: deriveMonthlyOrdinal(startsOn),
          dayOfWeek: parseIsoDate(startsOn).getUTCDay(),
        },
      };

    default:
      return { frequency: "daily", startsOn };
  }
}

export function isRecurring(recurrence: RecurrenceDefinition | null | undefined): boolean {
  return recurrence != null && recurrence.rule != null;
}

export function parseLegacyFinanceRecurrenceRule(
  recurrenceRule: string,
  startsOn: string,
): RecurrenceRuleInput | null {
  const normalized = recurrenceRule.trim().toLowerCase();

  if (normalized === "daily") {
    return { frequency: "daily", startsOn, interval: 1, end: { type: "never" } };
  }

  if (normalized === "weekly") {
    return {
      frequency: "weekly",
      startsOn,
      interval: 1,
      daysOfWeek: [parseIsoDate(startsOn).getUTCDay()],
      end: { type: "never" },
    };
  }

  if (normalized === "monthly") {
    return {
      frequency: "monthly_nth_weekday",
      startsOn,
      interval: 1,
      nthWeekday: {
        ordinal: deriveMonthlyOrdinal(startsOn),
        dayOfWeek: parseIsoDate(startsOn).getUTCDay(),
      },
      end: { type: "never" },
    };
  }

  const match = normalized.match(/^every:(\d+):(day|days|week|weeks|month|months)$/);
  if (!match) {
    return null;
  }

  const interval = Number(match[1]);
  const unit = match[2];
  if (unit.startsWith("day")) {
    return { frequency: "interval", startsOn, interval, end: { type: "never" } };
  }

  if (unit.startsWith("week")) {
    return {
      frequency: "weekly",
      startsOn,
      interval,
      daysOfWeek: [parseIsoDate(startsOn).getUTCDay()],
      end: { type: "never" },
    };
  }

  return {
    frequency: "monthly_nth_weekday",
    startsOn,
    interval,
    nthWeekday: {
      ordinal: deriveMonthlyOrdinal(startsOn),
      dayOfWeek: parseIsoDate(startsOn).getUTCDay(),
    },
    end: { type: "never" },
  };
}

export function formatLegacyFinanceRecurrenceRule(rule: RecurrenceRuleInput) {
  if (rule.frequency === "daily" && (rule.interval ?? 1) === 1) {
    return "daily";
  }

  if (rule.frequency === "weekly" && (rule.interval ?? 1) === 1) {
    return "weekly";
  }

  if (rule.frequency === "monthly_nth_weekday" && (rule.interval ?? 1) === 1) {
    return "monthly";
  }

  if (rule.frequency === "interval") {
    return `every:${rule.interval ?? 1}:day`;
  }

  if (rule.frequency === "weekly") {
    return `every:${rule.interval ?? 1}:week`;
  }

  return `every:${rule.interval ?? 1}:month`;
}
