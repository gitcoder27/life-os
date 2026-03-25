import { useState } from "react";
import type { DayPlannerBlockItem } from "../../../shared/lib/api";

export function PlannerBlockForm({
  date,
  existingBlocks,
  onSubmit,
  onCancel,
}: {
  date: string;
  existingBlocks: DayPlannerBlockItem[];
  onSubmit: (payload: {
    title?: string | null;
    startsAt: string;
    endsAt: string;
  }) => void;
  onCancel: () => void;
}) {
  const defaultStart = getNextAvailableTime(existingBlocks);
  const defaultEnd = addMinutes(defaultStart, 60);

  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState(defaultStart);
  const [endTime, setEndTime] = useState(defaultEnd);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (startTime >= endTime) {
      setError("End time must be after start time.");
      return;
    }

    const tz = getLocalTimezoneOffset();
    const startsAt = `${date}T${startTime}:00${tz}`;
    const endsAt = `${date}T${endTime}:00${tz}`;

    onSubmit({
      title: title.trim() || null,
      startsAt,
      endsAt,
    });
  }

  return (
    <form className="planner-form" onSubmit={handleSubmit}>
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

      {error ? <div className="planner-form__error">{error}</div> : null}

      <div className="planner-form__actions">
        <button className="button button--primary button--small" type="submit">
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
        {QUICK_PRESETS.map((preset) => (
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

const QUICK_PRESETS = [
  { label: "Morning focus", icon: "🌅", start: "08:00", end: "10:00" },
  { label: "Lunch", icon: "🍽", start: "12:00", end: "13:00" },
  { label: "Deep work", icon: "🎯", start: "14:00", end: "16:00" },
  { label: "Gym", icon: "💪", start: "17:00", end: "18:00" },
  { label: "Wind down", icon: "🌙", start: "20:00", end: "21:00" },
];

function getNextAvailableTime(blocks: DayPlannerBlockItem[]): string {
  if (blocks.length === 0) {
    const now = new Date();
    const h = String(Math.max(now.getHours(), 8)).padStart(2, "0");
    return `${h}:00`;
  }

  const lastBlock = blocks[blocks.length - 1];
  try {
    const end = new Date(lastBlock.endsAt);
    const h = String(end.getHours()).padStart(2, "0");
    const m = String(end.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  } catch {
    return "09:00";
  }
}

function addMinutes(timeStr: string, minutes: number): string {
  const [h, m] = timeStr.split(":").map(Number);
  const totalMinutes = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  const newH = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const newM = String(totalMinutes % 60).padStart(2, "0");
  return `${newH}:${newM}`;
}

function getLocalTimezoneOffset(): string {
  const offset = new Date().getTimezoneOffset();
  const sign = offset <= 0 ? "+" : "-";
  const absOffset = Math.abs(offset);
  const h = String(Math.floor(absOffset / 60)).padStart(2, "0");
  const m = String(absOffset % 60).padStart(2, "0");
  return `${sign}${h}:${m}`;
}
