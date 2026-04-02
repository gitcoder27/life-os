import {
  useDailyScoreQuery,
  useHabitsQuery,
  useWeeklyMomentumQuery,
} from "../../shared/lib/api";
import type { RecurrenceRuleInput } from "../../shared/lib/recurrence";

import type { RoutineItemEntry } from "./RoutineItemEditor";

export type HabitsData = NonNullable<ReturnType<typeof useHabitsQuery>["data"]>;
export type HabitItem = HabitsData["habits"][number];
export type DueHabit = HabitsData["dueHabits"][number];
export type Routine = HabitsData["routines"][number];
export type WeeklyChallenge = HabitsData["weeklyChallenge"];
export type DailyScore = ReturnType<typeof useDailyScoreQuery>["data"];
export type WeeklyMomentum = ReturnType<typeof useWeeklyMomentumQuery>["data"];
export type ConsistencyBar = NonNullable<WeeklyMomentum>["dailyScores"][number];

export type HabitFormValues = {
  title: string;
  category: string;
  targetPerDay: string;
  recurrenceRule: RecurrenceRuleInput | null;
  goalId: string;
};

export type RoutineFormValues = {
  name: string;
  items: RoutineItemEntry[];
};

export type HabitPauseFormValues = {
  startsOn: string;
  endsOn: string;
  note: string;
};
