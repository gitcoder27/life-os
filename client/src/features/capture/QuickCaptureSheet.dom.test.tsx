// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QuickCaptureSheet } from "./QuickCaptureSheet";

vi.mock("../../shared/lib/api", () => ({
  formatMealSlotLabel: (value: string | null) => value ?? "Meal",
  getTodayDate: () => "2026-05-19",
  parseAmountToMinor: () => null,
  parseNumberValue: () => null,
  toIsoDate: (date: Date) => date.toISOString().slice(0, 10),
  useAddMealMutation: () => ({ mutateAsync: vi.fn() }),
  useAddWaterMutation: () => ({ mutateAsync: vi.fn() }),
  useAddWeightMutation: () => ({ mutateAsync: vi.fn() }),
  useCreateExpenseMutation: () => ({ mutateAsync: vi.fn() }),
  useCreateTaskMutation: () => ({ mutateAsync: vi.fn() }),
  useFinanceDataQuery: () => ({ data: { categories: { categories: [] } } }),
  useMealTemplatesQuery: () => ({ data: { mealTemplates: [] } }),
  useWorkoutMutation: () => ({ mutateAsync: vi.fn() }),
}));

const renderSheet = (open: boolean) => {
  const onClose = vi.fn();
  const result = render(<QuickCaptureSheet open={open} onClose={onClose} />);

  return {
    ...result,
    onClose,
  };
};

afterEach(() => {
  cleanup();
});

describe("QuickCaptureSheet", () => {
  it("does not leave focusable controls mounted while closed", () => {
    renderSheet(false);

    expect(screen.queryByRole("dialog", { name: "Quick capture" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Task" })).toBeNull();
  });

  it("renders an accessible dialog when opened", () => {
    renderSheet(true);

    expect(screen.getByRole("dialog", { name: "Quick capture" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Task" })).toBeTruthy();
  });
});
