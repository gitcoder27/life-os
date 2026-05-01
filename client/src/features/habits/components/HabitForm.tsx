import { type FormEvent, useState } from "react";

import { getTodayDate, useGoalsListQuery } from "../../../shared/lib/api";
import { RecurrenceEditor } from "../../../shared/ui/RecurrenceEditor";

import type { HabitFormValues } from "../types";

const emptyHabitForm: HabitFormValues = {
  title: "",
  category: "",
  habitType: "maintenance",
  targetPerDay: "1",
  durationMinutes: "25",
  recurrenceRule: null,
  goalId: "",
  timingMode: "anytime",
  anchorText: "",
  targetTime: "",
  windowStartTime: "",
  windowEndTime: "",
  minimumVersion: "",
  standardVersion: "",
  stretchVersion: "",
  obstaclePlan: "",
  repairRule: "",
  identityMeaning: "",
};

function hasAdvancedValues(values: HabitFormValues) {
  return Boolean(
    values.category ||
    values.goalId ||
    values.habitType !== "maintenance" ||
    Number(values.targetPerDay) > 1 ||
    values.durationMinutes !== "25" ||
    values.stretchVersion ||
    values.obstaclePlan ||
    values.repairRule ||
    values.identityMeaning,
  );
}

type HabitFormProps = {
  initial?: HabitFormValues;
  submitLabel: string;
  isPending: boolean;
  onSubmit: (values: HabitFormValues) => void;
  onCancel: () => void;
};

export function HabitForm({
  initial = emptyHabitForm,
  submitLabel,
  isPending,
  onSubmit,
  onCancel,
}: HabitFormProps) {
  const today = getTodayDate();
  const [values, setValues] = useState<HabitFormValues>(initial);
  const [showAdvanced, setShowAdvanced] = useState(
    hasAdvancedValues(initial),
  );
  const goalsQuery = useGoalsListQuery();
  const activeGoals = (goalsQuery.data?.goals ?? []).filter((goal) => goal.status === "active");
  const hasValidTiming =
    values.timingMode === "anytime" ||
    (values.timingMode === "anchor" && values.anchorText.trim().length > 0) ||
    (values.timingMode === "exact_time" && values.targetTime.length > 0) ||
    (values.timingMode === "time_window" &&
      values.windowStartTime.length > 0 &&
      values.windowEndTime.length > 0 &&
      values.windowStartTime < values.windowEndTime);
  const parsedDuration = Number.parseInt(values.durationMinutes, 10);
  const hasValidDuration = Number.isFinite(parsedDuration) && parsedDuration > 0 && parsedDuration <= 720;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!values.title.trim() || !hasValidTiming || !hasValidDuration) return;

    onSubmit(values);
  }

  return (
    <form className="manage-form" onSubmit={handleSubmit}>
      <div className="manage-form__fields">
        <label className="field">
          <span>Title</span>
          <input
            type="text"
            placeholder="e.g. Morning workout"
            value={values.title}
            onChange={(event) =>
              setValues((current) => ({ ...current, title: event.target.value }))
            }
            autoFocus
          />
        </label>
        <div className="manage-form__section">
          <span className="manage-form__section-label">Schedule</span>
          <RecurrenceEditor
            value={values.recurrenceRule}
            onChange={(rule) =>
              setValues((current) => ({ ...current, recurrenceRule: rule }))
            }
            context="habit"
            startsOn={values.recurrenceRule?.startsOn ?? today}
          />
        </div>
        <div className="manage-form__section">
          <span className="manage-form__section-label">Timing and duration</span>
          <div className="manage-form__row">
            <label className="field" style={{ flex: 1 }}>
              <span>Planning style</span>
              <select
                value={values.timingMode}
                onChange={(event) =>
                  setValues((current) => ({ ...current, timingMode: event.target.value as HabitFormValues["timingMode"] }))
                }
              >
                <option value="anytime">Anytime</option>
                <option value="anchor">Anchor</option>
                <option value="exact_time">Exact time</option>
                <option value="time_window">Time window</option>
              </select>
            </label>
            {values.timingMode === "exact_time" ? (
              <label className="field" style={{ flex: 1 }}>
                <span>Time</span>
                <input
                  type="time"
                  value={values.targetTime}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, targetTime: event.target.value }))
                  }
                />
              </label>
            ) : null}
          </div>
          <div className="manage-form__row">
            <label className="field" style={{ width: "9rem" }}>
              <span>Time needed</span>
              <input
                type="number"
                min="1"
                max="720"
                value={values.durationMinutes}
                onChange={(event) =>
                  setValues((current) => ({ ...current, durationMinutes: event.target.value }))
                }
              />
            </label>
            <div className="habit-duration-presets" aria-label="Habit duration presets">
              {[5, 10, 20, 30, 45].map((minutes) => (
                <button
                  key={minutes}
                  className={`habit-duration-presets__button${
                    values.durationMinutes === String(minutes) ? " habit-duration-presets__button--active" : ""
                  }`}
                  type="button"
                  onClick={() =>
                    setValues((current) => ({ ...current, durationMinutes: String(minutes) }))
                  }
                >
                  {minutes}m
                </button>
              ))}
            </div>
          </div>
          {values.timingMode === "anchor" ? (
            <label className="field">
              <span>Anchor</span>
              <input
                type="text"
                placeholder="After dinner"
                value={values.anchorText}
                onChange={(event) =>
                  setValues((current) => ({ ...current, anchorText: event.target.value }))
                }
              />
            </label>
          ) : null}
          {values.timingMode === "time_window" ? (
            <div className="manage-form__row">
              <label className="field" style={{ flex: 1 }}>
                <span>Window start</span>
                <input
                  type="time"
                  value={values.windowStartTime}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, windowStartTime: event.target.value }))
                  }
                />
              </label>
              <label className="field" style={{ flex: 1 }}>
                <span>Window end</span>
                <input
                  type="time"
                  value={values.windowEndTime}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, windowEndTime: event.target.value }))
                  }
                />
              </label>
            </div>
          ) : null}
        </div>
        <div className="manage-form__section">
          <span className="manage-form__section-label">What Counts</span>
          <div className="manage-form__row">
            <label className="field" style={{ flex: 1 }}>
              <span>Minimum version</span>
              <input
                type="text"
                placeholder="1 page"
                value={values.minimumVersion}
                onChange={(event) =>
                  setValues((current) => ({ ...current, minimumVersion: event.target.value }))
                }
              />
            </label>
            <label className="field" style={{ flex: 1 }}>
              <span>Standard version</span>
              <input
                type="text"
                placeholder="20 minutes"
                value={values.standardVersion}
                onChange={(event) =>
                  setValues((current) => ({ ...current, standardVersion: event.target.value }))
                }
              />
            </label>
          </div>
        </div>
        <button
          className="habits-advanced-toggle"
          type="button"
          onClick={() => setShowAdvanced((current) => !current)}
        >
          {showAdvanced ? "Hide advanced options" : "Show advanced options"}
        </button>
        {showAdvanced ? (
          <div className="manage-form__section">
            <span className="manage-form__section-label">Advanced</span>
            <div className="manage-form__row">
              <label className="field" style={{ flex: 1 }}>
                <span>Habit type</span>
                <select
                  value={values.habitType}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, habitType: event.target.value as HabitFormValues["habitType"] }))
                  }
                >
                  <option value="maintenance">Maintenance</option>
                  <option value="growth">Growth</option>
                  <option value="identity">Identity</option>
                </select>
              </label>
              <label className="field" style={{ flex: 1 }}>
                <span>Category</span>
                <input
                  type="text"
                  placeholder="General"
                  value={values.category}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, category: event.target.value }))
                  }
                />
              </label>
              <label className="field" style={{ width: "6rem" }}>
                <span>Target / day</span>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={values.targetPerDay}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      targetPerDay: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <label className="field">
              <span>Stretch version</span>
              <input
                type="text"
                placeholder="40 minutes"
                value={values.stretchVersion}
                onChange={(event) =>
                  setValues((current) => ({ ...current, stretchVersion: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Obstacle plan</span>
              <textarea
                rows={2}
                value={values.obstaclePlan}
                placeholder="If traveling, do 5 minutes on the phone"
                onChange={(event) =>
                  setValues((current) => ({ ...current, obstaclePlan: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Repair rule</span>
              <textarea
                rows={2}
                value={values.repairRule}
                placeholder="Tomorrow minimum counts as recovery"
                onChange={(event) =>
                  setValues((current) => ({ ...current, repairRule: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Identity meaning</span>
              <textarea
                rows={2}
                value={values.identityMeaning}
                placeholder="This supports the kind of person I want to become"
                onChange={(event) =>
                  setValues((current) => ({ ...current, identityMeaning: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Linked goal (optional)</span>
              <select
                value={values.goalId}
                onChange={(event) =>
                  setValues((current) => ({ ...current, goalId: event.target.value }))
                }
              >
                <option value="">None</option>
                {activeGoals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </div>
      <div className="button-row button-row--tight">
        <button
          className="button button--primary button--small"
          type="submit"
          disabled={isPending || !values.title.trim() || !hasValidTiming || !hasValidDuration}
        >
          {isPending ? "Saving..." : submitLabel}
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
