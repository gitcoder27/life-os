// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { habit, routine } from "../test-fixtures";
import { DayTimeline } from "./DayTimeline";

const recentDays = [
  { date: "2026-10-14", state: "done" as const },
  { date: "2026-10-15", state: "missed" as const },
  { date: "2026-10-16", state: "rest" as const },
  { date: "2026-10-17", state: "done" as const },
  { date: "2026-10-18", state: "not_due" as const },
  { date: "2026-10-19", state: "done" as const },
  { date: "2026-10-20", state: "open" as const },
];

function renderTimeline(overrides: Partial<Parameters<typeof DayTimeline>[0]> = {}) {
  const handlers = {
    onAddHabit: vi.fn(),
    onAddRoutine: vi.fn(),
    onHabitCheckin: vi.fn(),
    onHabitUndo: vi.fn(),
    onToggleRoutineStep: vi.fn(),
    onRestDay: vi.fn(),
    onEditHabit: vi.fn(),
  };

  render(
    <DayTimeline
      hasAnyHabits
      hasAnyRoutines
      dueHabits={[
        habit({
          id: "run",
          title: "Morning run",
          timingMode: "exact_time",
          targetTimeMinutes: 7 * 60,
          timingStatusToday: "due_now",
          streakCount: 3,
          stretchVersion: "5 km",
          recentDays,
        }),
        habit({ id: "journal", title: "Journal", completedToday: true, completedCountToday: 1 }),
      ]}
      activeRoutines={[
        routine({
          id: "evening",
          name: "Evening routine",
          windowStartMinutes: 17 * 60 + 30,
          timingLabel: "5:30 PM - 6:30 PM",
          totalItems: 2,
          completedItems: 1,
          items: [
            { id: "stretch", title: "Stretch", sortOrder: 0, isRequired: true, completedToday: true },
            { id: "clothes", title: "Lay out clothes", sortOrder: 1, isRequired: false, completedToday: false },
          ],
        }),
      ]}
      isRescueMode={false}
      pendingHabitIds={new Set()}
      pendingStepIds={new Set()}
      isPausePending={false}
      {...handlers}
      {...overrides}
    />,
  );

  return handlers;
}

afterEach(cleanup);

describe("DayTimeline", () => {
  it("groups the day and marks the next item", () => {
    renderTimeline();

    expect(screen.getByRole("heading", { name: "Morning" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Evening" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Anytime" })).toBeTruthy();
    expect(document.querySelector("#habits-focus-run")?.classList.contains("is-next")).toBe(true);
    expect(
      screen.getByRole("img", { name: "Last 7 days: 3 done, 1 not logged, 1 rest day" }),
    ).toBeTruthy();
    expect(screen.queryByText(/drifting/i)).toBeNull();
  });

  it("checks in, undoes, and keeps one strong target per habit", () => {
    const handlers = renderTimeline();

    const runCheck = screen.getByRole("button", { name: "Check in Morning run" });
    expect(runCheck.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(runCheck);
    expect(handlers.onHabitCheckin).toHaveBeenCalledWith("run", "standard");

    const journalCheck = screen.getByRole("button", { name: "Check in Journal" });
    expect(journalCheck.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(journalCheck);
    expect(handlers.onHabitUndo).toHaveBeenCalledWith("journal");
  });

  it("logs the minimum on rescue days and ignores clicks while a check-in is saving", () => {
    const handlers = renderTimeline({ isRescueMode: true, pendingHabitIds: new Set(["journal"]) });

    fireEvent.click(screen.getByRole("button", { name: "Check in Morning run (minimum)" }));
    expect(handlers.onHabitCheckin).toHaveBeenCalledWith("run", "minimum");

    fireEvent.click(screen.getByRole("button", { name: "Check in Journal (minimum)" }));
    expect(handlers.onHabitUndo).not.toHaveBeenCalled();
  });

  it("keeps stretch, rest day, and edit behind the details toggle", () => {
    const handlers = renderTimeline();

    expect(screen.queryByRole("button", { name: "Log stretch" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show details for Morning run" }));

    fireEvent.click(screen.getByRole("button", { name: "Log stretch" }));
    expect(handlers.onHabitCheckin).toHaveBeenCalledWith("run", "stretch");
    fireEvent.click(screen.getByRole("button", { name: "Rest day today" }));
    expect(handlers.onRestDay).toHaveBeenCalledWith("run");
    fireEvent.click(screen.getByRole("button", { name: "Edit habit" }));
    expect(handlers.onEditHabit).toHaveBeenCalledWith("run");
    expect(screen.getByText("Done on 3 of 4 scheduled days this past week. 1 rest day.")).toBeTruthy();
  });

  it("toggles routine steps through labelled checkboxes", () => {
    const handlers = renderTimeline();
    const routineCard = screen.getByRole("region", { name: "Evening routine" });

    fireEvent.click(within(routineCard).getByRole("checkbox", { name: /Lay out clothes/ }));
    expect(handlers.onToggleRoutineStep).toHaveBeenCalledWith("clothes", true);
    fireEvent.click(within(routineCard).getByRole("checkbox", { name: /Stretch/ }));
    expect(handlers.onToggleRoutineStep).toHaveBeenCalledWith("stretch", false);
  });

  it("invites a first habit when nothing exists yet", () => {
    const handlers = renderTimeline({ hasAnyHabits: false, hasAnyRoutines: false, dueHabits: [], activeRoutines: [] });

    fireEvent.click(screen.getByRole("button", { name: "Add a habit" }));
    expect(handlers.onAddHabit).toHaveBeenCalled();
  });
});
