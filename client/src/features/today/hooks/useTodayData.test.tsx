// @vitest-environment happy-dom

import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useTodayData } from "./useTodayData";

const apiMocks = vi.hoisted(() => {
  const refetches = {
    dayPlan: vi.fn(),
    weekPlan: vi.fn(),
    overdueTasks: vi.fn(),
    completedTodayTasks: vi.fn(),
    health: vi.fn(),
    goals: vi.fn(),
    score: vi.fn(),
  };

  return {
    refetches,
    useTasksQuery: vi.fn((filters: { completedOn?: string } = {}) => {
      if (filters.completedOn) {
        return {
          data: {
            tasks: [],
          },
          error: null,
          isError: false,
          refetch: refetches.completedTodayTasks,
        };
      }

      return {
        data: null,
        error: new Error("Overdue request failed"),
        isError: true,
        refetch: refetches.overdueTasks,
      };
    }),
  };
});

vi.mock("../../../shared/lib/api", () => ({
  getTodayDate: () => "2026-05-19",
  getWeekStartDate: () => "2026-05-18",
  toIsoDate: (date: Date) => date.toISOString().slice(0, 10),
  useDailyScoreQuery: () => ({
    data: null,
    error: new Error("Score request failed"),
    isError: true,
    refetch: apiMocks.refetches.score,
  }),
  useDayPlanQuery: () => ({
    data: {
      priorities: [],
      launch: null,
      mustWinTask: null,
      rescueSuggestion: null,
      tasks: [],
      goalNudges: [],
      plannerBlocks: [],
    },
    error: null,
    isError: false,
    isLoading: false,
    refetch: apiMocks.refetches.dayPlan,
  }),
  useGoalsListQuery: () => ({
    data: null,
    error: new Error("Goals request failed"),
    isError: true,
    refetch: apiMocks.refetches.goals,
  }),
  useHealthDataQuery: () => ({
    data: null,
    error: new Error("Health request failed"),
    isError: true,
    refetch: apiMocks.refetches.health,
  }),
  useTasksQuery: apiMocks.useTasksQuery,
  useWeekPlanQuery: () => ({
    data: null,
    error: new Error("Week request failed"),
    isError: true,
    refetch: apiMocks.refetches.weekPlan,
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("useTodayData", () => {
  it("exposes secondary query errors and refetches every Today data source", () => {
    const { result } = renderHook(() => useTodayData());

    expect(result.current.sectionErrors).toEqual(expect.objectContaining({
      overdueTasks: "Overdue request failed",
      health: "Health request failed",
      goals: "Goals request failed",
      score: "Score request failed",
      weekPlan: "Week request failed",
    }));

    result.current.refetchAll();

    expect(apiMocks.refetches.dayPlan).toHaveBeenCalled();
    expect(apiMocks.refetches.weekPlan).toHaveBeenCalled();
    expect(apiMocks.refetches.overdueTasks).toHaveBeenCalled();
    expect(apiMocks.refetches.completedTodayTasks).toHaveBeenCalled();
    expect(apiMocks.refetches.health).toHaveBeenCalled();
    expect(apiMocks.refetches.goals).toHaveBeenCalled();
    expect(apiMocks.refetches.score).toHaveBeenCalled();
  });
});
