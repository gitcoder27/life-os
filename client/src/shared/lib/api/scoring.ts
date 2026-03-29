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
