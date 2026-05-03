import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";

import {
  invalidateCoreData,
  queryKeys,
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
});
