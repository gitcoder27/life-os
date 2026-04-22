import { useQuery } from "@tanstack/react-query";

import {
  apiRequest,
  queryKeys,
} from "./core";

type ScoreBucket = {
  key: string;
  label: string;
  earnedPoints: number;
  applicablePoints: number;
  explanation: string;
};

type DailyScoreResponse = {
  generatedAt: string;
  date: string;
  value: number;
  label: string;
  earnedPoints: number;
  possiblePoints: number;
  buckets: ScoreBucket[];
  topReasons: Array<{
    label: string;
    missingPoints: number;
  }>;
  finalizedAt: string | null;
};

export type WeeklyMomentumResponse = {
  generatedAt: string;
  endingOn: string;
  value: number;
  basedOnDays: number;
  weeklyReviewBonus: number;
  strongDayStreak: number;
  dailyScores: Array<{
    date: string;
    value: number;
    label: string;
  }>;
};

export type ScoreHistoryDay = {
  date: string;
  value: number | null;
  label: "Strong Day" | "Solid Day" | "Recovering Day" | "Off-Track Day" | null;
  finalized: boolean;
  isToday: boolean;
};

export type ScoreHistorySummary = {
  consistencyRun: number;
  solidPlusDays: number;
  strongDays: number;
  current7DayAverage: number | null;
  previous7DayAverage: number | null;
};

export type ScoreHistoryResponse = {
  generatedAt: string;
  endingOn: string;
  days: number;
  entries: ScoreHistoryDay[];
  summary: ScoreHistorySummary;
};

export const useDailyScoreQuery = (date: string) =>
  useQuery({
    queryKey: queryKeys.score(date),
    queryFn: () => apiRequest<DailyScoreResponse>(`/api/scores/daily/${date}`),
    retry: false,
  });

export const useWeeklyMomentumQuery = (endingOn: string) =>
  useQuery({
    queryKey: queryKeys.weeklyMomentum(endingOn),
    queryFn: () =>
      apiRequest<WeeklyMomentumResponse>("/api/scores/weekly-momentum", {
        query: { endingOn },
      }),
    retry: false,
  });

export const useScoreHistoryQuery = (endingOn: string, days: number, enabled = true) =>
  useQuery({
    queryKey: queryKeys.scoreHistory(endingOn, days),
    queryFn: () =>
      apiRequest<ScoreHistoryResponse>("/api/scores/history", {
        query: {
          endingOn,
          days: String(days),
        },
      }),
    retry: false,
    enabled,
  });
