// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { habitScheduleLabel } from "../libraryFormat";
import { habit } from "../test-fixtures";
import { ManageHabitsSection } from "./ManageHabitsSection";

function renderSection(overrides: Partial<Parameters<typeof ManageHabitsSection>[0]> = {}) {
  const habits = [
    habit({ id: "run", title: "Morning run", timingLabel: "7:00 AM" }),
    habit({ id: "read", title: "Read", status: "paused" }),
  ];
  const handlers = {
    onOpenAddHabit: vi.fn(),
    onCloseAddHabit: vi.fn(),
    onEditHabit: vi.fn(),
    onCancelEditHabit: vi.fn(),
    onCreateHabit: vi.fn(),
    onUpdateHabit: vi.fn(),
    onRestDay: vi.fn(),
    onOpenVacation: vi.fn(),
    onCloseVacation: vi.fn(),
    onVacationFormChange: vi.fn(),
    onSaveVacation: vi.fn(),
    onDeletePauseWindow: vi.fn(),
    onChangeHabitStatus: vi.fn(),
    onRequestArchiveHabit: vi.fn(),
    onCancelArchiveHabit: vi.fn(),
    onConfirmArchiveHabit: vi.fn(),
  };

  render(
    <ManageHabitsSection
      allHabits={habits}
      nonArchivedHabits={habits}
      archivedHabits={[]}
      showAddHabit={false}
      editingHabitId={null}
      vacationHabitId={null}
      vacationForm={{ startsOn: "2026-10-20", endsOn: "2026-10-20", note: "" }}
      confirmArchiveHabitId={null}
      createPending={false}
      updatePending={false}
      pausePending={false}
      deletePausePending={false}
      createError={null}
      updateError={null}
      pauseError={null}
      deletePauseError={null}
      {...handlers}
      {...overrides}
    />,
  );

  return handlers;
}

afterEach(cleanup);

describe("ManageHabitsSection", () => {
  it("lists habits with one edit button and a menu instead of a row of buttons", () => {
    const handlers = renderSection();

    fireEvent.click(screen.getByRole("button", { name: /All habits/ }));
    expect(screen.getByText("1 active, 1 paused")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pause" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Edit Morning run" }));
    expect(handlers.onEditHabit).toHaveBeenCalledWith("run");
  });

  it("moves secondary actions into a keyboard-friendly menu", () => {
    const handlers = renderSection();
    fireEvent.click(screen.getByRole("button", { name: /All habits/ }));

    const trigger = screen.getByRole("button", { name: "More actions for Morning run" });
    fireEvent.click(trigger);
    const menu = screen.getByRole("menu", { name: "More actions for Morning run" });
    expect(document.activeElement?.textContent).toBe("Rest day today");

    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement?.textContent).toBe("Plan a vacation");
    fireEvent.keyDown(menu, { key: "End" });
    expect(document.activeElement?.textContent).toBe("Archive");
    fireEvent.keyDown(menu, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: "Pause habit" }));
    expect(handlers.onChangeHabitStatus).toHaveBeenCalledWith("run", "paused");

    fireEvent.click(screen.getByRole("button", { name: "More actions for Read" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Resume habit" }));
    expect(handlers.onChangeHabitStatus).toHaveBeenCalledWith("read", "active");
  });

  it("asks before archiving", () => {
    const handlers = renderSection({ confirmArchiveHabitId: "run" });
    fireEvent.click(screen.getByRole("button", { name: /All habits/ }));

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(handlers.onConfirmArchiveHabit).toHaveBeenCalledWith("run");
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(handlers.onCancelArchiveHabit).toHaveBeenCalled();
  });
});

describe("habitScheduleLabel", () => {
  it("names common schedules plainly", () => {
    expect(habitScheduleLabel({ recurrence: null, scheduleRule: {} })).toBe("Every day");
    expect(habitScheduleLabel({ recurrence: null, scheduleRule: { daysOfWeek: [5, 1, 2, 3, 4] } })).toBe("Weekdays");
    expect(habitScheduleLabel({ recurrence: null, scheduleRule: { daysOfWeek: [1, 4] } })).toBe("Mon, Thu");
    expect(
      habitScheduleLabel({
        scheduleRule: {},
        recurrence: {
          id: "rule",
          rule: { frequency: "interval", interval: 3, startsOn: "2026-05-09" },
          exceptions: [],
          carryPolicy: null,
          legacyRuleText: null,
        },
      }),
    ).toBe("Every 3 days");
  });
});
