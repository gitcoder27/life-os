import { useQuery } from "@tanstack/react-query";
import type {
  BehaviorState,
  BehaviorStateResponse,
  BehaviorStateSnapshot,
} from "@life-os/contracts";

import {
  apiRequest,
  queryKeys,
} from "./core";

export type {
  BehaviorState,
  BehaviorStateSnapshot,
};

export const useBehaviorStateQuery = (date: string, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: queryKeys.behaviorState(date),
    queryFn: () =>
      apiRequest<BehaviorStateResponse>("/api/behavior/state", {
        query: { date },
      }),
    enabled: options?.enabled,
    retry: false,
  });
