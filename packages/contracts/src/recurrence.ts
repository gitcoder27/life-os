import type { EntityId, IsoDateString } from "./common.js";

export type RecurrenceFrequency = "daily" | "weekly" | "monthly_nth_weekday" | "interval";
export type RecurrenceIntervalUnit = "day" | "week" | "month";
export type RecurrenceEndType = "never" | "on_date" | "after_occurrences";
export type RecurrenceExceptionAction = "skip" | "do_once" | "reschedule";
export type RecurringTaskCarryPolicy = "complete_and_clone" | "move_due_date" | "cancel";

export interface RecurrenceEndCondition {
  type: RecurrenceEndType;
  until?: IsoDateString | null;
  occurrenceCount?: number | null;
}

export interface MonthlyNthWeekdayRule {
  ordinal: 1 | 2 | 3 | 4 | -1;
  dayOfWeek: number;
}

export interface RecurrenceRuleInput {
  frequency: RecurrenceFrequency;
  startsOn: IsoDateString;
  interval?: number;
  daysOfWeek?: number[];
  nthWeekday?: MonthlyNthWeekdayRule;
  end?: RecurrenceEndCondition;
}

export interface RecurrenceExceptionItem {
  occurrenceDate: IsoDateString;
  action: RecurrenceExceptionAction;
  targetDate?: IsoDateString | null;
}

export interface RecurrenceInput {
  rule: RecurrenceRuleInput;
  exceptions?: RecurrenceExceptionItem[];
}

export interface RecurrenceDefinition {
  id: EntityId;
  rule: RecurrenceRuleInput;
  exceptions: RecurrenceExceptionItem[];
  carryPolicy?: RecurringTaskCarryPolicy | null;
  legacyRuleText?: string | null;
}
