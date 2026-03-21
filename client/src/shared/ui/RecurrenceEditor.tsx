import { type FormEvent, useState } from "react";
import {
  type RecurrenceContext,
  type RecurrenceEndCondition,
  type RecurrenceEndType,
  type RecurrenceFrequency,
  type RecurrenceInput,
  type RecurrenceRuleInput,
  type MonthlyNthWeekdayRule,
  DAY_LABELS_SHORT,
  formatFullRecurrenceSummary,
  getDefaultRecurrenceRule,
} from "../lib/recurrence";

type RecurrenceEditorProps = {
  value: RecurrenceRuleInput | null;
  onChange: (rule: RecurrenceRuleInput) => void;
  context: RecurrenceContext;
  startsOn: string;
};

const FREQUENCY_OPTIONS: Array<{ value: RecurrenceFrequency; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "interval", label: "Every N days" },
  { value: "monthly_nth_weekday", label: "Monthly" },
];

const ORDINAL_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: "First" },
  { value: 2, label: "Second" },
  { value: 3, label: "Third" },
  { value: 4, label: "Fourth" },
  { value: -1, label: "Last" },
];

const DAY_OPTIONS = DAY_LABELS_SHORT.map((label, index) => ({
  value: index,
  label,
}));

export function RecurrenceEditor({ value, onChange, context, startsOn }: RecurrenceEditorProps) {
  const rule = value ?? getDefaultRecurrenceRule(context, startsOn);
  const [showEndCondition, setShowEndCondition] = useState(
    rule.end != null && rule.end.type !== "never",
  );

  function updateFrequency(frequency: RecurrenceFrequency) {
    const base: RecurrenceRuleInput = {
      frequency,
      startsOn: rule.startsOn,
      end: rule.end,
    };

    if (frequency === "weekly") {
      const currentDay = new Date(`${rule.startsOn}T12:00:00`).getDay();
      base.daysOfWeek = rule.daysOfWeek?.length ? rule.daysOfWeek : [currentDay];
    }

    if (frequency === "interval") {
      base.interval = rule.interval ?? 2;
    }

    if (frequency === "monthly_nth_weekday") {
      const currentDay = new Date(`${rule.startsOn}T12:00:00`).getDay();
      base.nthWeekday = rule.nthWeekday ?? { ordinal: 1, dayOfWeek: currentDay };
    }

    onChange(base);
  }

  function toggleWeekday(day: number) {
    const current = new Set(rule.daysOfWeek ?? []);
    if (current.has(day)) {
      current.delete(day);
    } else {
      current.add(day);
    }
    // Ensure at least one day selected
    if (current.size === 0) return;
    onChange({ ...rule, daysOfWeek: Array.from(current) });
  }

  function updateInterval(interval: number) {
    onChange({ ...rule, interval: Math.max(1, interval) });
  }

  function updateNthWeekday(partial: Partial<MonthlyNthWeekdayRule>) {
    const current = rule.nthWeekday ?? { ordinal: 1, dayOfWeek: 0 };
    onChange({ ...rule, nthWeekday: { ...current, ...partial } as MonthlyNthWeekdayRule });
  }

  function updateStartsOn(startsOn: string) {
    onChange({ ...rule, startsOn });
  }

  function updateEndCondition(end: RecurrenceEndCondition | undefined) {
    onChange({ ...rule, end });
  }

  const summary = formatFullRecurrenceSummary(rule);

  return (
    <div className="recurrence-editor">
      {/* Live summary */}
      <div className="recurrence-editor__summary">
        <span className="recurrence-editor__summary-icon">↻</span>
        <span>{summary}</span>
      </div>

      {/* Frequency selector */}
      <div className="recurrence-editor__frequency">
        {FREQUENCY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`recurrence-freq-btn${rule.frequency === opt.value ? " recurrence-freq-btn--active" : ""}`}
            onClick={() => updateFrequency(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Weekly: day-of-week selection */}
      {rule.frequency === "weekly" && (
        <div className="recurrence-editor__days">
          {DAY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`recurrence-day-btn${(rule.daysOfWeek ?? []).includes(opt.value) ? " recurrence-day-btn--active" : ""}`}
              onClick={() => toggleWeekday(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Interval: every N days */}
      {rule.frequency === "interval" && (
        <label className="field recurrence-editor__interval-field">
          <span>Every</span>
          <div className="recurrence-editor__interval-row">
            <input
              type="number"
              min={1}
              max={365}
              value={rule.interval ?? 2}
              onChange={(e) => updateInterval(Number(e.target.value))}
              className="recurrence-editor__interval-input"
            />
            <span className="recurrence-editor__interval-unit">days</span>
          </div>
        </label>
      )}

      {/* Monthly nth weekday */}
      {rule.frequency === "monthly_nth_weekday" && (
        <div className="recurrence-editor__monthly">
          <select
            className="recurrence-editor__select"
            value={rule.nthWeekday?.ordinal ?? 1}
            onChange={(e) => updateNthWeekday({ ordinal: Number(e.target.value) as MonthlyNthWeekdayRule["ordinal"] })}
          >
            {ORDINAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            className="recurrence-editor__select"
            value={rule.nthWeekday?.dayOfWeek ?? 0}
            onChange={(e) => updateNthWeekday({ dayOfWeek: Number(e.target.value) })}
          >
            {DAY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label === "Sun" ? "Sunday" : opt.label === "Mon" ? "Monday" : opt.label === "Tue" ? "Tuesday" : opt.label === "Wed" ? "Wednesday" : opt.label === "Thu" ? "Thursday" : opt.label === "Fri" ? "Friday" : "Saturday"}</option>
            ))}
          </select>
          <span className="recurrence-editor__monthly-label">of every month</span>
        </div>
      )}

      {/* Start date */}
      <label className="field recurrence-editor__start-field">
        <span>Starts on</span>
        <input
          type="date"
          value={rule.startsOn}
          onChange={(e) => updateStartsOn(e.target.value)}
        />
      </label>

      {/* End condition — progressive disclosure */}
      {!showEndCondition ? (
        <button
          type="button"
          className="button button--ghost button--small recurrence-editor__end-toggle"
          onClick={() => {
            setShowEndCondition(true);
            updateEndCondition({ type: "never" });
          }}
        >
          + Add end condition
        </button>
      ) : (
        <div className="recurrence-editor__end">
          <label className="field">
            <span>Ends</span>
            <select
              value={rule.end?.type ?? "never"}
              onChange={(e) => {
                const type = e.target.value as RecurrenceEndType;
                if (type === "never") {
                  updateEndCondition(undefined);
                  setShowEndCondition(false);
                } else {
                  updateEndCondition({ type });
                }
              }}
            >
              <option value="never">Never</option>
              <option value="on_date">On a date</option>
              <option value="after_occurrences">After N occurrences</option>
            </select>
          </label>

          {rule.end?.type === "on_date" && (
            <label className="field">
              <span>Until</span>
              <input
                type="date"
                value={rule.end.until ?? ""}
                min={rule.startsOn}
                onChange={(e) =>
                  updateEndCondition({ ...rule.end!, until: e.target.value || null })
                }
              />
            </label>
          )}

          {rule.end?.type === "after_occurrences" && (
            <label className="field">
              <span>Occurrences</span>
              <input
                type="number"
                min={1}
                max={365}
                value={rule.end.occurrenceCount ?? 10}
                onChange={(e) =>
                  updateEndCondition({
                    ...rule.end!,
                    occurrenceCount: Math.max(1, Number(e.target.value)),
                  })
                }
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
}

// ── Compact inline toggle for optional recurrence ───

type RecurrenceToggleProps = {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  rule: RecurrenceRuleInput | null;
  onRuleChange: (rule: RecurrenceRuleInput) => void;
  context: RecurrenceContext;
  startsOn: string;
};

export function RecurrenceToggle({
  enabled,
  onToggle,
  rule,
  onRuleChange,
  context,
  startsOn,
}: RecurrenceToggleProps) {
  return (
    <div className="recurrence-toggle">
      <button
        type="button"
        className={`recurrence-toggle__btn${enabled ? " recurrence-toggle__btn--active" : ""}`}
        onClick={() => onToggle(!enabled)}
      >
        <span className="recurrence-toggle__icon">↻</span>
        {enabled ? "Recurring" : "Make recurring"}
      </button>
      {enabled && (
        <RecurrenceEditor
          value={rule}
          onChange={onRuleChange}
          context={context}
          startsOn={startsOn}
        />
      )}
    </div>
  );
}

// ── Helper to build RecurrenceInput from editor state ───

export function buildRecurrenceInput(rule: RecurrenceRuleInput): RecurrenceInput {
  return { rule };
}
