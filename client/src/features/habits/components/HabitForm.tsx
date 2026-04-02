import { type FormEvent, useState } from "react";

import { getTodayDate, useGoalsListQuery } from "../../../shared/lib/api";
import { RecurrenceEditor } from "../../../shared/ui/RecurrenceEditor";

import type { HabitFormValues } from "../types";

const emptyHabitForm: HabitFormValues = {
  title: "",
  category: "",
  targetPerDay: "1",
  recurrenceRule: null,
  goalId: "",
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
    Boolean(initial.category || initial.goalId || Number(initial.targetPerDay) > 1),
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
