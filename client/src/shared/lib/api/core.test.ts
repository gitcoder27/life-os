import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";

import {
  invalidateCoreData,
  queryKeys,
  taskQueryTracksUnscheduledTasks,
  taskQueryTouchesDate,
} from "./core";

const createQueryClientStub = () =>
  ({
    invalidateQueries: vi.fn(),
  }) as unknown as QueryClient & {
    invalidateQueries: ReturnType<typeof vi.fn>;
  };

describe("core query invalidation", () => {
  it("matches task query keys by scheduled date and date range", () => {
    expect(taskQueryTouchesDate(queryKeys.tasks({ scheduledForDate: "2026-05-03" }), "2026-05-03")).toBe(true);
    expect(taskQueryTouchesDate(queryKeys.tasks({ from: "2026-05-01", to: "2026-05-07" }), "2026-05-03")).toBe(true);
    expect(taskQueryTouchesDate(queryKeys.tasks({ from: "2026-05-04", to: "2026-05-07" }), "2026-05-03")).toBe(false);
    expect(taskQueryTouchesDate(queryKeys.tasks({ scheduledState: "unscheduled" }), "2026-05-03")).toBe(false);
  });

  it("recognizes unscheduled task queues that need refreshing after task mutations", () => {
    expect(taskQueryTracksUnscheduledTasks(queryKeys.tasks({ scheduledState: "unscheduled" }))).toBe(true);
    expect(taskQueryTracksUnscheduledTasks(queryKeys.tasks({
      scheduledState: "unscheduled",
      originType: "quick_capture",
      includeSummary: true,
      limit: 1,
    }))).toBe(true);
    expect(taskQueryTracksUnscheduledTasks(queryKeys.tasks({ scheduledState: "scheduled" }))).toBe(false);
    expect(taskQueryTracksUnscheduledTasks(queryKeys.tasks({ scheduledForDate: "2026-05-03" }))).toBe(false);
  });

  it("invalidates daily command-center data without touching unrelated domains", () => {
    const queryClient = createQueryClientStub();

    invalidateCoreData(queryClient, "2026-05-03");

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.home("2026-05-03"),
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.dayPlan("2026-05-03"),
    });
    expect(queryClient.invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: ["health"],
    });
    expect(queryClient.invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: ["finance"],
    });
  });

  it("invalidates the inbox summary query after core task mutations", () => {
    const queryClient = createQueryClientStub();

    invalidateCoreData(queryClient, "2026-05-03");

    const tasksInvalidation = queryClient.invalidateQueries.mock.calls.find(([call]) =>
      typeof call?.predicate === "function",
    )?.[0];

    expect(tasksInvalidation?.predicate?.({
      queryKey: queryKeys.tasks({
        scheduledState: "unscheduled",
        originType: "quick_capture",
        includeSummary: true,
        limit: 1,
      }),
    } as never)).toBe(true);
  });
});
