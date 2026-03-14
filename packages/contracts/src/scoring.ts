import type { ApiMeta, IsoDateString } from "./common.js";

export type ScoreLabel = "Strong Day" | "Solid Day" | "Recovering Day" | "Off-Track Day";
export type ScoreBucketKey =
  | "plan_and_priorities"
  | "routines_and_habits"
  | "health_basics"
  | "finance_and_admin"
  | "review_and_reset";

export interface ScoreBucket {
  key: ScoreBucketKey;
  label: string;
  earnedPoints: number;
  applicablePoints: number;
  explanation: string;
}

export interface ScoreReason {
  label: string;
  missingPoints: number;
}

export interface DailyScoreBreakdownResponse extends ApiMeta {
  date: IsoDateString;
  value: number;
  label: ScoreLabel;
  earnedPoints: number;
  possiblePoints: number;
  buckets: ScoreBucket[];
  topReasons: ScoreReason[];
  finalizedAt: string | null;
}

export interface WeeklyMomentumDay {
  date: IsoDateString;
  value: number;
  label: ScoreLabel;
}

export interface WeeklyMomentumResponse extends ApiMeta {
  endingOn: IsoDateString;
  value: number;
  basedOnDays: number;
  weeklyReviewBonus: number;
  strongDayStreak: number;
  dailyScores: WeeklyMomentumDay[];
}
