import { useQuery } from "@tanstack/react-query";
import type {
  AttentionItem,
  HomeAction,
  HomeDestination,
  HomeGuidanceRecommendation,
  HomeOverviewResponse,
  HomeQuoteResponse,
} from "@life-os/contracts";

import {
  apiRequest,
  queryKeys,
} from "./core";

export type {
  HomeAction,
  HomeDestination,
  HomeGuidanceRecommendation,
  HomeOverviewResponse,
};
export type HomeAttentionItem = AttentionItem;

export const useHomeOverviewQuery = (date: string) =>
  useQuery({
    queryKey: queryKeys.home(date),
    queryFn: () => apiRequest<HomeOverviewResponse>("/api/home/overview", { query: { date } }),
    retry: false,
  });

export const useHomeQuoteQuery = () =>
  useQuery({
    queryKey: queryKeys.homeQuote,
    queryFn: () => apiRequest<HomeQuoteResponse>("/api/home/quote"),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
