import { useQuery } from "@tanstack/react-query";
import type {
  DailyScoreBreakdownResponse,
  ScoreHistoryDay,
  ScoreHistoryResponse,
  ScoreHistorySummary,
  WeeklyMomentumResponse,
} from "@life-os/contracts";

import {
  apiRequest,
  queryKeys,
} from "./core";

export type {
  ScoreHistoryDay,
  ScoreHistoryResponse,
  ScoreHistorySummary,
  WeeklyMomentumResponse,
};

export const useDailyScoreQuery = (date: string) =>
  useQuery({
    queryKey: queryKeys.score(date),
    queryFn: () => apiRequest<DailyScoreBreakdownResponse>(`/api/scores/daily/${date}`),
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
