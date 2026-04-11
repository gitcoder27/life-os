import { useEffect, useState } from "react";

import {
  formatFullRecurrenceSummary,
  isRecurring,
} from "../../../shared/lib/recurrence";

import type {
  HabitFormValues,
  HabitItem,
  HabitPauseFormValues,
} from "../types";
import { formatMinutesToTimeInput } from "../timing";
import { CollapsibleSection } from "./CollapsibleSection";
import { HabitForm } from "./HabitForm";

function formatPauseDate(isoDate: string) {
  try {
    return new Date(`${isoDate}T12:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return isoDate;
  }
}

function formatPauseWindowLabel(window: HabitItem["pauseWindows"][number]) {
  const kindLabel = window.kind === "rest_day" ? "Rest day" : "Vacation";
  const dateLabel =
    window.startsOn === window.endsOn
      ? formatPauseDate(window.startsOn)
      : `${formatPauseDate(window.startsOn)} to ${formatPauseDate(window.endsOn)}`;

  return `${kindLabel}${window.isActiveToday ? " now" : ""} \u00b7 ${dateLabel}`;
}

function getPauseWindowActionLabel(window: HabitItem["pauseWindows"][number]) {
  if (window.kind === "vacation") {
    return window.isActiveToday ? "End vacation" : "Remove vacation";
  }

  return window.isActiveToday ? "End rest day" : "Remove rest day";
}

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

  return (
    <CollapsibleSection
      title="Manage habits"
      subtitle={`${allHabits.filter((habit) => habit.status === "active").length} active`}
      defaultOpen={allHabits.length === 0}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      trailing={
        !showAddHabit ? (
          <button
            className="button button--ghost button--small"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIsOpen(true);
              onOpenAddHabit();
            }}
          >
            + Add habit
          </button>
        ) : null
      }
    >
      {showAddHabit ? (
        <HabitForm
          submitLabel="Create habit"
          isPending={createPending}
          onSubmit={onCreateHabit}
          onCancel={() => {
            onCloseAddHabit();
            if (allHabits.length === 0) {
              setIsOpen(true);
            }
          }}
        />
      ) : null}

      {createError ? (
        <InlineError message={createError.message || "Could not create habit."} />
      ) : null}

      {nonArchivedHabits.length > 0 ? (
        <div className="manage-list">
          {nonArchivedHabits.map((habit) => (
            <div key={habit.id} className="manage-list__item">
              {editingHabitId === habit.id ? (
                <HabitForm
                  initial={{
                    title: habit.title,
                    category: habit.category ?? "",
                    habitType: habit.habitType,
                    targetPerDay: String(habit.targetPerDay),
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
                  }}
                  submitLabel="Save changes"
                  isPending={updatePending}
                  onSubmit={(values) => onUpdateHabit(habit.id, values)}
                  onCancel={onCancelEditHabit}
                />
              ) : (
                <div>
                  <div className="manage-list__row">
                    <div className="manage-list__info">
                      <div className="manage-list__name">
                        <span className={`status-dot status-dot--${habit.status}`} />
                        {habit.title}
                        {habit.pauseWindows.some((window) => window.isActiveToday) ? (
                          <span className="tag tag--warning" style={{ marginLeft: "0.3rem" }}>
                            paused today
                          </span>
                        ) : null}
                      </div>
                      <div className="manage-list__meta">
                        {habit.category || "Uncategorized"}
                        {habit.habitType ? ` · ${habit.habitType}` : ""}
                        {habit.streakCount > 0 ? ` · ${habit.streakCount} streak` : ""}
                        {habit.goal ? ` · ${habit.goal.title}` : ""}
                        {habit.recurrence && isRecurring(habit.recurrence) ? (
                          <span className="manage-list__recurrence">
                            {" · ↻ "}
                            {formatFullRecurrenceSummary(habit.recurrence.rule)}
                          </span>
                        ) : null}
                      </div>
                      {habit.timingLabel || habit.minimumVersion || habit.repairRule ? (
                        <div className="manage-list__meta">
                          {habit.timingLabel ? `Timing: ${habit.timingLabel}` : ""}
                          {habit.minimumVersion ? ` · Min: ${habit.minimumVersion}` : ""}
                          {habit.repairRule ? ` · Repair: ${habit.repairRule}` : ""}
                        </div>
                      ) : null}
                      {habit.pauseWindows.length > 0 ? (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "0.5rem",
                            marginTop: "0.7rem",
                          }}
                        >
                          {habit.pauseWindows.map((window) => (
                            <div key={window.id} className="habits-pause-pill">
                              <span
                                className={`habits-pause-pill__label${window.isActiveToday ? " habits-pause-pill__label--active" : ""}`}
                                title={window.note ?? undefined}
                              >
                                {formatPauseWindowLabel(window)}
                              </span>
                              <button
                                className="habits-pause-pill__remove"
                                type="button"
                                onClick={() => onDeletePauseWindow(habit.id, window.id)}
                                disabled={deletePausePending}
                              >
                                {getPauseWindowActionLabel(window)}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="habits-manage-actions">
                      <button
                        className="button button--ghost button--small"
                        type="button"
                        onClick={() => onEditHabit(habit.id)}
                      >
                        Edit
                      </button>
                      {habit.status === "active" ? (
                        <>
                          <button
                            className="button button--ghost button--small"
                            type="button"
                            onClick={() => onRestDay(habit.id)}
                            disabled={pausePending}
                          >
                            Rest day
                          </button>
                          <button
                            className="button button--ghost button--small"
                            type="button"
                            onClick={() => onOpenVacation(habit.id)}
                          >
                            Vacation
                          </button>
                          <button
                            className="button button--ghost button--small"
                            type="button"
                            onClick={() => onChangeHabitStatus(habit.id, "paused")}
                            disabled={updatePending}
                          >
                            Pause
                          </button>
                        </>
                      ) : habit.status === "paused" ? (
                        <button
                          className="button button--ghost button--small"
                          type="button"
                          onClick={() => onChangeHabitStatus(habit.id, "active")}
                          disabled={updatePending}
                        >
                          Resume
                        </button>
                      ) : null}
                      {habit.status !== "archived" ? (
                        confirmArchiveHabitId === habit.id ? (
                          <span className="confirm-archive">
                            <span className="confirm-archive__label">Archive?</span>
                            <button
                              className="button button--ghost button--small"
                              type="button"
                              style={{ color: "var(--negative)" }}
                              onClick={() => onConfirmArchiveHabit(habit.id)}
                              disabled={updatePending}
                            >
                              Yes
                            </button>
                            <button
                              className="button button--ghost button--small"
                              type="button"
                              onClick={onCancelArchiveHabit}
                            >
                              No
                            </button>
                          </span>
                        ) : (
                          <button
                            className="button button--ghost button--small"
                            type="button"
                            style={{ color: "var(--negative)" }}
                            onClick={() => onRequestArchiveHabit(habit.id)}
                            disabled={updatePending}
                          >
                            Archive
                          </button>
                        )
                      ) : null}
                    </div>
                  </div>
                  {vacationHabitId === habit.id ? (
                    <VacationForm
                      vacationForm={vacationForm}
                      isPending={pausePending}
                      onChange={onVacationFormChange}
                      onCancel={onCloseVacation}
                      onSubmit={() => onSaveVacation(habit.id)}
                    />
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : !showAddHabit ? (
        <div className="habits-group__empty">
          <span className="habits-group__empty-text">
            No habits yet. Add your first habit to start tracking consistency.
          </span>
          <button
            className="button button--ghost button--small"
            type="button"
            onClick={onOpenAddHabit}
          >
            + Add your first habit
          </button>
        </div>
      ) : null}

      {archivedHabits.length > 0 ? (
        <CollapsibleSection
          title="Archived habits"
          subtitle={`${archivedHabits.length} archived`}
        >
          <div className="manage-list manage-list--archived">
            {archivedHabits.map((habit) => (
              <div key={habit.id} className="manage-list__item">
                <div className="manage-list__row">
                  <div className="manage-list__info">
                    <div className="manage-list__name">
                      <span className="status-dot status-dot--archived" />
                      {habit.title}
                    </div>
                    <div className="manage-list__meta">
                      {habit.category || "Uncategorized"}
                      {habit.streakCount > 0 ? ` · ${habit.streakCount} streak` : ""}
                    </div>
                  </div>
                  <div className="habits-manage-actions">
                    <button
                      className="button button--ghost button--small"
                      type="button"
                      onClick={() => onChangeHabitStatus(habit.id, "active")}
                      disabled={updatePending}
                    >
                      Restore
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      ) : null}

      {updateError ? (
        <InlineError message={updateError.message || "Could not update habit."} />
      ) : null}
      {pauseError ? (
        <InlineError
          message={pauseError.message || "Could not save the temporary pause."}
        />
      ) : null}
      {deletePauseError ? (
        <InlineError
          message={deletePauseError.message || "Could not remove the temporary pause."}
        />
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
      style={{ marginTop: "0.85rem" }}
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

function InlineError({ message }: { message: string }) {
  return (
    <div className="inline-state inline-state--error" style={{ marginTop: "0.5rem" }}>
      {message}
    </div>
  );
}
