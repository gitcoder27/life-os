import { type FormEvent, useState } from "react";

import { getTodayDate, useGoalsListQuery } from "../../../shared/lib/api";
import { RecurrenceEditor } from "../../../shared/ui/RecurrenceEditor";

import type { HabitFormValues } from "../types";

const emptyHabitForm: HabitFormValues = {
  title: "",
  category: "",
  habitType: "maintenance",
  targetPerDay: "1",
  recurrenceRule: null,
  goalId: "",
  anchorText: "",
  minimumVersion: "",
  standardVersion: "",
  stretchVersion: "",
  obstaclePlan: "",
  repairRule: "",
  identityMeaning: "",
};

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
    Boolean(
      initial.category ||
      initial.goalId ||
      Number(initial.targetPerDay) > 1 ||
      initial.anchorText ||
      initial.minimumVersion ||
      initial.standardVersion ||
      initial.stretchVersion ||
      initial.obstaclePlan ||
      initial.repairRule ||
      initial.identityMeaning,
    ),
  );
  const goalsQuery = useGoalsListQuery();
  const activeGoals = (goalsQuery.data?.goals ?? []).filter((goal) => goal.status === "active");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!values.title.trim()) return;

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
        {!showAdvanced ? (
          <button
            className="habits-advanced-toggle"
            type="button"
            onClick={() => setShowAdvanced(true)}
          >
            More options
          </button>
        ) : (
          <>
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
          </>
        )}
      </div>
      <div className="button-row button-row--tight">
        <button
          className="button button--primary button--small"
          type="submit"
          disabled={isPending || !values.title.trim()}
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
