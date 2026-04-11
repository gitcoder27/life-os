import { type FormEvent, useState } from "react";

import {
  RoutineItemEditor,
  createEmptyItem,
} from "../RoutineItemEditor";
import type {
  Routine,
  RoutineFormValues,
} from "../types";

const emptyRoutineForm: RoutineFormValues = {
  name: "",
  windowStartTime: "",
  windowEndTime: "",
  items: [createEmptyItem()],
};

export const buildRoutineFormItems = (items: Routine["items"]) =>
  [...items]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((item) => ({
      key: item.id,
      id: item.id,
      title: item.title,
      isRequired: item.isRequired,
    }));

type RoutineFormProps = {
  initial?: RoutineFormValues;
  submitLabel: string;
  isPending: boolean;
  onSubmit: (values: RoutineFormValues) => void;
  onCancel: () => void;
};

export function RoutineForm({
  initial = emptyRoutineForm,
  submitLabel,
  isPending,
  onSubmit,
  onCancel,
}: RoutineFormProps) {
  const [values, setValues] = useState<RoutineFormValues>(initial);
  const hasValidTiming =
    values.windowStartTime.length > 0 &&
    values.windowEndTime.length > 0 &&
    values.windowStartTime < values.windowEndTime;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!values.name.trim() || !hasValidTiming) return;

    const nonEmptyItems = values.items.filter((item) => item.title.trim());
    if (nonEmptyItems.length === 0) return;

    onSubmit({ ...values, items: nonEmptyItems });
  }

  return (
    <form className="manage-form" onSubmit={handleSubmit}>
      <div className="manage-form__fields">
        <label className="field">
          <span>Name</span>
          <input
            type="text"
            placeholder="e.g. Night routine"
            value={values.name}
            onChange={(event) =>
              setValues((current) => ({ ...current, name: event.target.value }))
            }
            autoFocus
          />
        </label>
        <div className="manage-form__row">
          <label className="field" style={{ flex: 1 }}>
            <span>Window start time</span>
            <input
              type="time"
              value={values.windowStartTime}
              onChange={(event) =>
                setValues((current) => ({ ...current, windowStartTime: event.target.value }))
              }
            />
          </label>
          <label className="field" style={{ flex: 1 }}>
            <span>Window end time</span>
            <input
              type="time"
              value={values.windowEndTime}
              onChange={(event) =>
                setValues((current) => ({ ...current, windowEndTime: event.target.value }))
              }
            />
          </label>
        </div>
        <RoutineItemEditor
          items={values.items}
          onChange={(items) => setValues((current) => ({ ...current, items }))}
        />
      </div>
      <div className="button-row button-row--tight">
        <button
          className="button button--primary button--small"
          type="submit"
          disabled={
            isPending ||
            !values.name.trim() ||
            !hasValidTiming ||
            !values.items.some((item) => item.title.trim())
          }
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
