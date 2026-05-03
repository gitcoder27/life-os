import {
  useAdaptiveTodayQuery,
  useDayCapacityQuery,
} from "../../../shared/lib/api";

export function useAdaptiveToday(date: string, options?: { enabled?: boolean }) {
  const adaptiveQuery = useAdaptiveTodayQuery(date, options);
  const capacityQuery = useDayCapacityQuery(date, {
    enabled: options?.enabled === false ? false : !adaptiveQuery.data,
  });

  return {
    adaptiveQuery,
    nextMove: adaptiveQuery.data?.nextMove ?? null,
    capacity: adaptiveQuery.data?.capacity ?? capacityQuery.data?.capacity ?? null,
    isLoading: adaptiveQuery.isLoading || capacityQuery.isLoading,
    error: adaptiveQuery.error ?? capacityQuery.error,
    refetch: () => {
      void adaptiveQuery.refetch();
      void capacityQuery.refetch();
    },
  };
}
