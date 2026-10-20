import { useEffect, useState } from "react";

import type {
  HabitFormValues,
  HabitItem,
  HabitPauseFormValues,
} from "../types";
import {
  habitMetaItems,
  pauseWindowActionLabel,
  pauseWindowLabel,
} from "../libraryFormat";
import { formatMinutesToTimeInput } from "../timing";
import { ActionMenu, type ActionMenuItem } from "./ActionMenu";
import { CollapsibleSection } from "./CollapsibleSection";
import { HabitForm } from "./HabitForm";
import { ArchiveConfirm, ArchivedList, FormPanel, InlineError } from "./LibraryParts";

type ManageHabitsSectionProps = {
  allHabits: HabitItem[];
  nonArchivedHabits: HabitItem[];
  archivedHabits: HabitItem[];
  showAddHabit: boolean;
  editingHabitId: string | null;
  vacationHabitId: string | null;
  vacationForm: HabitPauseFormValues;
  confirmArchiveHabitId: string | null;
  createPending: boolean;
  updatePending: boolean;
  pausePending: boolean;
  deletePausePending: boolean;
  createError: Error | null;
  updateError: Error | null;
  pauseError: Error | null;
  deletePauseError: Error | null;
  onOpenAddHabit: () => void;
  onCloseAddHabit: () => void;
  onEditHabit: (habitId: string) => void;
  onCancelEditHabit: () => void;
  onCreateHabit: (values: HabitFormValues) => void;
  onUpdateHabit: (habitId: string, values: HabitFormValues) => void;
  onRestDay: (habitId: string) => void;
  onOpenVacation: (habitId: string) => void;
  onCloseVacation: () => void;
  onVacationFormChange: (
    updater: (current: HabitPauseFormValues) => HabitPauseFormValues,
  ) => void;
  onSaveVacation: (habitId: string) => void;
  onDeletePauseWindow: (habitId: string, pauseWindowId: string) => void;
  onChangeHabitStatus: (
    habitId: string,
    status: "active" | "paused" | "archived",
  ) => void;
  onRequestArchiveHabit: (habitId: string) => void;
  onCancelArchiveHabit: () => void;
  onConfirmArchiveHabit: (habitId: string) => void;
};

function toFormValues(habit: HabitItem): HabitFormValues {
  return {
    title: habit.title,
    category: habit.category ?? "",
    habitType: habit.habitType,
    targetPerDay: String(habit.targetPerDay),
    durationMinutes: String(habit.durationMinutes),
    recurrenceRule: habit.recurrence?.rule ?? null,
    goalId: habit.goalId ?? "",
    timingMode: habit.timingMode,
    anchorText: habit.anchorText ?? "",
    targetTime: formatMinutesToTimeInput(habit.targetTimeMinutes),
    windowStartTime: formatMinutesToTimeInput(habit.windowStartMinutes),
    windowEndTime: formatMinutesToTimeInput(habit.windowEndMinutes),
    minimumVersion: habit.minimumVersion ?? "",
    standardVersion: habit.standardVersion ?? "",
    stretchVersion: habit.stretchVersion ?? "",
    obstaclePlan: habit.obstaclePlan ?? "",
    repairRule: habit.repairRule ?? "",
    identityMeaning: habit.identityMeaning ?? "",
  };
}

function countLabel(habits: HabitItem[]) {
  const active = habits.filter((habit) => habit.status === "active").length;
  const paused = habits.filter((habit) => habit.status === "paused").length;
  return paused > 0 ? `${active} active, ${paused} paused` : `${active} active`;
}

export function ManageHabitsSection({
  allHabits,
  nonArchivedHabits,
  archivedHabits,
  showAddHabit,
  editingHabitId,
  vacationHabitId,
  vacationForm,
  confirmArchiveHabitId,
  createPending,
  updatePending,
  pausePending,
  deletePausePending,
  createError,
  updateError,
  pauseError,
  deletePauseError,
  onOpenAddHabit,
  onCloseAddHabit,
  onEditHabit,
  onCancelEditHabit,
  onCreateHabit,
  onUpdateHabit,
  onRestDay,
  onOpenVacation,
  onCloseVacation,
  onVacationFormChange,
  onSaveVacation,
  onDeletePauseWindow,
  onChangeHabitStatus,
  onRequestArchiveHabit,
  onCancelArchiveHabit,
  onConfirmArchiveHabit,
}: ManageHabitsSectionProps) {
  const [isOpen, setIsOpen] = useState(allHabits.length === 0);
  const hasOpenForm = showAddHabit || editingHabitId !== null || vacationHabitId !== null;

  useEffect(() => {
    if (hasOpenForm) {
      setIsOpen(true);
    }
  }, [hasOpenForm]);

  function menuItems(habit: HabitItem): ActionMenuItem[] {
    const items: ActionMenuItem[] = [];

    if (habit.status === "active") {
      const restingToday = habit.pauseWindows.some((window) => window.isActiveToday);
      items.push(
        { label: "Rest day today", onSelect: () => onRestDay(habit.id), disabled: pausePending || restingToday },
        { label: "Plan a vacation", onSelect: () => onOpenVacation(habit.id) },
        { label: "Pause habit", onSelect: () => onChangeHabitStatus(habit.id, "paused"), disabled: updatePending },
      );
    } else if (habit.status === "paused") {
      items.push({ label: "Resume habit", onSelect: () => onChangeHabitStatus(habit.id, "active"), disabled: updatePending });
    }

    items.push({
      label: "Archive",
      tone: "danger",
      onSelect: () => onRequestArchiveHabit(habit.id),
      disabled: updatePending,
    });

    return items;
  }

  return (
    <CollapsibleSection
      id="habits-manage-habits"
      title="All habits"
      subtitle={countLabel(allHabits)}
      defaultOpen={allHabits.length === 0}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      trailing={
        !showAddHabit ? (
          <button
            className="button button--ghost button--small"
            type="button"
            onClick={() => {
              setIsOpen(true);
              onOpenAddHabit();
            }}
          >
            New habit
          </button>
        ) : null
      }
    >
      {showAddHabit ? (
        <FormPanel title="New habit">
          <HabitForm
            submitLabel="Create habit"
            isPending={createPending}
            onSubmit={onCreateHabit}
            onCancel={onCloseAddHabit}
          />
        </FormPanel>
      ) : null}

      {createError ? (
        <InlineError message={createError.message || "Couldn't create the habit."} />
      ) : null}

      {nonArchivedHabits.length > 0 ? (
        <ul className="hb-items">
          {nonArchivedHabits.map((habit) => (
            <li key={habit.id} className="hb-item" id={`habits-manage-${habit.id}`}>
              {editingHabitId === habit.id ? (
                <FormPanel title={`Edit ${habit.title}`}>
                  <HabitForm
                    initial={toFormValues(habit)}
                    submitLabel="Save changes"
                    isPending={updatePending}
                    onSubmit={(values) => onUpdateHabit(habit.id, values)}
                    onCancel={onCancelEditHabit}
                  />
                </FormPanel>
              ) : (
                <>
                  <div className={`hb-item__row${habit.status === "paused" ? " is-paused" : ""}`}>
                    <span className={`hb-item__dot hb-item__dot--${habit.status}`} aria-hidden="true" />
                    <div className="hb-item__body">
                      <span className="hb-item__name">
                        {habit.title}
                        {habit.status === "paused" ? <span className="hb-item__state">Paused</span> : null}
                      </span>
                      <span className="hb-item__meta">
                        {habitMetaItems(habit).map((item, index) => (
                          <span key={index}>{item}</span>
                        ))}
                      </span>
                      {habit.pauseWindows.length > 0 ? (
                        <ul className="hb-item__pauses">
                          {habit.pauseWindows.map((window) => (
                            <li
                              key={window.id}
                              className={`hb-item__pause${window.isActiveToday ? " is-active" : ""}`}
                              title={window.note ?? undefined}
                            >
                              <span>{pauseWindowLabel(window)}</span>
                              <button
                                className="hb-item__pause-action"
                                type="button"
                                onClick={() => onDeletePauseWindow(habit.id, window.id)}
                                disabled={deletePausePending}
                                aria-label={`${pauseWindowActionLabel(window)} ${pauseWindowLabel(window).toLowerCase()} for ${habit.title}`}
                              >
                                {pauseWindowActionLabel(window)}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    <div className="hb-item__actions">
                      <button
                        className="hb-item__edit"
                        type="button"
                        onClick={() => onEditHabit(habit.id)}
                        aria-label={`Edit ${habit.title}`}
                      >
                        Edit
                      </button>
                      <ActionMenu label={`More actions for ${habit.title}`} items={menuItems(habit)} />
                    </div>
                  </div>

                  {confirmArchiveHabitId === habit.id ? (
                    <ArchiveConfirm
                      name={habit.title}
                      detail="It leaves today's list and stops counting. You can restore it later."
                      isPending={updatePending}
                      onConfirm={() => onConfirmArchiveHabit(habit.id)}
                      onCancel={onCancelArchiveHabit}
                    />
                  ) : null}

                  {vacationHabitId === habit.id ? (
                    <FormPanel title={`Vacation for ${habit.title}`}>
                      <VacationForm
                        vacationForm={vacationForm}
                        isPending={pausePending}
                        onChange={onVacationFormChange}
                        onCancel={onCloseVacation}
                        onSubmit={() => onSaveVacation(habit.id)}
                      />
                    </FormPanel>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
      ) : !showAddHabit ? (
        <div className="hb-library__empty">
          <span>No habits yet. Add one to start checking in.</span>
          <button
            className="button button--ghost button--small"
            type="button"
            onClick={onOpenAddHabit}
          >
            Add your first habit
          </button>
        </div>
      ) : null}

      {archivedHabits.length > 0 ? (
        <ArchivedList
          noun="habit"
          items={archivedHabits.map((habit) => ({
            id: habit.id,
            name: habit.title,
            meta: habit.streakCount > 0 ? `${habit.streakCount} in a row before archiving` : null,
          }))}
          isPending={updatePending}
          onRestore={(habitId) => onChangeHabitStatus(habitId, "active")}
        />
      ) : null}

      {updateError ? (
        <InlineError message={updateError.message || "Couldn't update the habit."} />
      ) : null}
      {pauseError ? (
        <InlineError message={pauseError.message || "Couldn't save the pause."} />
      ) : null}
      {deletePauseError ? (
        <InlineError message={deletePauseError.message || "Couldn't remove the pause."} />
      ) : null}
    </CollapsibleSection>
  );
}

type VacationFormProps = {
  vacationForm: HabitPauseFormValues;
  isPending: boolean;
  onChange: (updater: (current: HabitPauseFormValues) => HabitPauseFormValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

function VacationForm({
  vacationForm,
  isPending,
  onChange,
  onSubmit,
  onCancel,
}: VacationFormProps) {
  return (
    <form
      className="manage-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="manage-form__row">
        <label className="field" style={{ flex: 1 }}>
          <span>Start date</span>
          <input
            type="date"
            value={vacationForm.startsOn}
            onChange={(event) =>
              onChange((current) => {
                const startsOn = event.target.value;
                const endsOn = current.endsOn < startsOn ? startsOn : current.endsOn;

                return { ...current, startsOn, endsOn };
              })
            }
            required
          />
        </label>
        <label className="field" style={{ flex: 1 }}>
          <span>End date</span>
          <input
            type="date"
            value={vacationForm.endsOn}
            min={vacationForm.startsOn}
            onChange={(event) =>
              onChange((current) => ({ ...current, endsOn: event.target.value }))
            }
            required
          />
        </label>
      </div>
      <label className="field">
        <span>Note (optional)</span>
        <input
          type="text"
          value={vacationForm.note}
          placeholder="Out of town, sick day, recovery week..."
          onChange={(event) =>
            onChange((current) => ({ ...current, note: event.target.value }))
          }
        />
      </label>
      <div className="button-row button-row--tight">
        <button
          className="button button--primary button--small"
          type="submit"
          disabled={isPending}
        >
          {isPending ? "Saving..." : "Save vacation"}
        </button>
        <button
          className="button button--ghost button--small"
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
