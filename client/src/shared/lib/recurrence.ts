// Recurrence types and formatting utilities — mirrors packages/contracts/src/recurrence.ts
// for the client-side, keeping a lightweight footprint.

export type RecurrenceFrequency = "daily" | "weekly" | "monthly_nth_weekday" | "interval";
export type RecurrenceEndType = "never" | "on_date" | "after_occurrences";
export type RecurringTaskCarryPolicy = "complete_and_clone" | "move_due_date" | "cancel";

export type RecurrenceEndCondition = {
  type: RecurrenceEndType;
  until?: string | null;
  occurrenceCount?: number | null;
};

export type MonthlyNthWeekdayRule = {
  ordinal: 1 | 2 | 3 | 4 | -1;
  dayOfWeek: number;
};

export type RecurrenceRuleInput = {
  frequency: RecurrenceFrequency;
  startsOn: string;
  interval?: number;
  daysOfWeek?: number[];
  nthWeekday?: MonthlyNthWeekdayRule;
  end?: RecurrenceEndCondition;
};

export type RecurrenceInput = {
  rule: RecurrenceRuleInput;
};

export type RecurrenceDefinition = {
  id: string;
  rule: RecurrenceRuleInput;
  exceptions: Array<{
    occurrenceDate: string;
    action: "skip" | "do_once" | "reschedule";
    targetDate?: string | null;
  }>;
  carryPolicy?: RecurringTaskCarryPolicy | null;
  legacyRuleText?: string | null;
};

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
        const dayNames = rule.daysOfWeek
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
        nthWeekday: { ordinal: 1, dayOfWeek: new Date(`${startsOn}T12:00:00`).getDay() },
      };

    default:
      return { frequency: "daily", startsOn };
  }
}

export function isRecurring(recurrence: RecurrenceDefinition | null | undefined): boolean {
  return recurrence != null && recurrence.rule != null;
}
