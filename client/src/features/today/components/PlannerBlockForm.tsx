import { useState } from "react";
import type { DayPlannerBlockItem } from "../../../shared/lib/api";
import {
  QUICK_BLOCK_PRESETS,
  addMinutes,
  getLocalTimezoneOffset,
  getNextAvailableTime,
  validatePlannerBlockDraft,
} from "../helpers/planner-blocks";

export function PlannerBlockForm({
  date,
  existingBlocks,
  initialValues,
  onSubmit,
  onCancel,
}: {
  date: string;
  existingBlocks: DayPlannerBlockItem[];
  initialValues?: {
    title?: string;
    startTime?: string;
    endTime?: string;
  };
  onSubmit: (payload: {
    title?: string | null;
    startsAt: string;
    endsAt: string;
  }) => void;
  onCancel: () => void;
}) {
  const defaultStart = getNextAvailableTime(existingBlocks);
  const defaultEnd = addMinutes(defaultStart, 60);

  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [startTime, setStartTime] = useState(initialValues?.startTime ?? defaultStart);
  const [endTime, setEndTime] = useState(initialValues?.endTime ?? defaultEnd);
  const validation = validatePlannerBlockDraft({
    date,
    startTime,
    endTime,
    timezoneOffset: getLocalTimezoneOffset(),
    existingBlocks,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validation.error) {
      return;
    }

    onSubmit({
      title: title.trim() || null,
      startsAt: validation.startsAt,
      endsAt: validation.endsAt,
    });
  }

  return (
    <form
      className="planner-form"
      onSubmit={handleSubmit}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      <div className="planner-form__title-label">New time block</div>

      <input
        className="planner-form__input"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Block title (e.g. Deep work, Lunch, Meetings)"
        autoFocus
      />

      <div className="planner-form__times">
        <label className="planner-form__time-field">
          <span className="planner-form__time-label">Start</span>
          <input
            className="planner-form__time-input"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
        </label>
        <span className="planner-form__time-sep">→</span>
        <label className="planner-form__time-field">
          <span className="planner-form__time-label">End</span>
          <input
            className="planner-form__time-input"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
          />
        </label>
      </div>

      {validation.error ? <div className="planner-form__error">{validation.error}</div> : null}

      <div className="planner-form__actions">
        <button
          className="button button--primary button--small"
          type="submit"
          disabled={Boolean(validation.error)}
        >
          Create block
        </button>
        <button
          className="button button--ghost button--small"
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>

      <div className="planner-form__presets">
        <span className="planner-form__presets-label">Quick:</span>
        {QUICK_BLOCK_PRESETS.map((preset) => (
          <button
            key={preset.label}
            className="planner-form__preset"
            type="button"
            onClick={() => {
              setTitle(preset.label);
              setStartTime(preset.start);
              setEndTime(preset.end);
            }}
          >
            {preset.icon} {preset.label}
          </button>
        ))}
      </div>
    </form>
  );
}
