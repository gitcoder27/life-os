import { useMemo, useState } from "react";

import type { MealPlanGroceryItem } from "../../shared/lib/api";
import {
  formatDayLabel,
  formatDayNumber,
  type DraftPrepSession,
} from "./meal-planner-model";

export function PrepPanel({
  sessions,
  weekDates,
  onAdd,
  onRemove,
}: {
  sessions: DraftPrepSession[];
  weekDates: string[];
  onAdd: (session: Omit<DraftPrepSession, "sortOrder">) => void;
  onRemove: (index: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(weekDates[0] || "");
  const [notes, setNotes] = useState("");

  function handleSubmit() {
    if (!title.trim()) return;
    onAdd({
      scheduledForDate: date,
      title: title.trim(),
      notes: notes.trim() || null,
    });
    setTitle("");
    setNotes("");
    setAdding(false);
  }

  return (
    <div className="mp-panel">
      <div className="mp-panel__header">
        <h3 className="mp-panel__title">Prep sessions</h3>
        <button
          type="button"
          className="button button--ghost button--small"
          onClick={() => setAdding(!adding)}
        >
          {adding ? "Cancel" : "+ Add"}
        </button>
      </div>
      {adding && (
        <div className="mp-prep-form">
          <input
            type="text"
            className="mp-input"
            placeholder="e.g. Sunday batch cook"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleSubmit()}
          />
          <div className="mp-prep-form__row">
            <select
              className="mp-select"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            >
              {weekDates.map((weekDate) => (
                <option key={weekDate} value={weekDate}>
                  {formatDayLabel(weekDate)} {formatDayNumber(weekDate)}
                </option>
              ))}
            </select>
            <input
              type="text"
              className="mp-input mp-input--grow"
              placeholder="Notes (optional)"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          <button
            type="button"
            className="button button--primary button--small"
            onClick={handleSubmit}
            disabled={!title.trim()}
          >
            Add prep session
          </button>
        </div>
      )}
      {sessions.length === 0 && !adding ? (
        <p className="mp-panel__empty">No prep sessions this week</p>
      ) : (
        <ul className="mp-prep-list">
          {sessions.map((session, index) => (
            <li key={session.id || `draft-${index}`} className="mp-prep-item">
              <div className="mp-prep-item__body">
                <span className="mp-prep-item__title">{session.title}</span>
                <span className="mp-prep-item__date">
                  {formatDayLabel(session.scheduledForDate)}{" "}
                  {formatDayNumber(session.scheduledForDate)}
                </span>
                {session.notes && (
                  <span className="mp-prep-item__notes">{session.notes}</span>
                )}
              </div>
              <div className="mp-prep-item__actions">
                {session.taskStatus && (
                  <span className={`mp-badge mp-badge--${session.taskStatus}`}>
                    {session.taskStatus}
                  </span>
                )}
                <button
                  type="button"
                  className="mp-prep-item__remove"
                  onClick={() => onRemove(index)}
                  aria-label={`Remove ${session.title}`}
                >
                  &times;
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function GroceryPanel({
  items,
  onToggle,
  onAddManual,
  onRemoveManual,
}: {
  items: MealPlanGroceryItem[];
  onToggle: (id: string) => void;
  onAddManual: (item: {
    name: string;
    quantity: number | null;
    unit: string | null;
    section: string | null;
  }) => void;
  onRemoveManual: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("");

  function handleSubmit() {
    if (!name.trim()) return;
    onAddManual({
      name: name.trim(),
      quantity: qty ? Number(qty) : null,
      unit: unit.trim() || null,
      section: null,
    });
    setName("");
    setQty("");
    setUnit("");
    setAdding(false);
  }

  const grouped = useMemo(() => {
    const sections = new Map<string, MealPlanGroceryItem[]>();
    for (const item of items) {
      const key = item.section || "Other";
      const group = sections.get(key) || [];
      group.push(item);
      sections.set(key, group);
    }
    return sections;
  }, [items]);

  const checkedCount = items.filter((item) => item.isChecked).length;

  return (
    <div className="mp-panel">
      <div className="mp-panel__header">
        <h3 className="mp-panel__title">
          Groceries
          {items.length > 0 && (
            <span className="mp-panel__count">
              {checkedCount}/{items.length}
            </span>
          )}
        </h3>
        <button
          type="button"
          className="button button--ghost button--small"
          onClick={() => setAdding(!adding)}
        >
          {adding ? "Cancel" : "+ Add"}
        </button>
      </div>
      {adding && (
        <div className="mp-grocery-form">
          <input
            type="text"
            className="mp-input"
            placeholder="Item name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleSubmit()}
          />
          <div className="mp-grocery-form__row">
            <input
              type="number"
              className="mp-input mp-input--narrow"
              placeholder="Qty"
              value={qty}
              onChange={(event) => setQty(event.target.value)}
            />
            <input
              type="text"
              className="mp-input mp-input--narrow"
              placeholder="Unit"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
            />
          </div>
          <button
            type="button"
            className="button button--primary button--small"
            onClick={handleSubmit}
            disabled={!name.trim()}
          >
            Add item
          </button>
        </div>
      )}
      {items.length === 0 && !adding ? (
        <p className="mp-panel__empty">
          Add meals to your plan to generate a grocery list
        </p>
      ) : (
        <div className="mp-grocery-sections">
          {Array.from(grouped.entries()).map(([section, sectionItems]) => (
            <div key={section} className="mp-grocery-section">
              <span className="mp-grocery-section__label">{section}</span>
              <ul className="mp-grocery-list">
                {sectionItems.map((item) => (
                  <li
                    key={item.id}
                    className={`mp-grocery-item${item.isChecked ? " mp-grocery-item--checked" : ""}`}
                  >
                    <button
                      type="button"
                      className="mp-grocery-item__check"
                      onClick={() => onToggle(item.id)}
                      aria-label={item.isChecked ? "Uncheck" : "Check"}
                    >
                      {item.isChecked ? "\u2713" : ""}
                    </button>
                    <span className="mp-grocery-item__name">{item.name}</span>
                    {(item.quantity || item.unit) && (
                      <span className="mp-grocery-item__qty">
                        {item.quantity}
                        {item.unit ? ` ${item.unit}` : ""}
                      </span>
                    )}
                    {item.sourceType === "manual" && (
                      <button
                        type="button"
                        className="mp-grocery-item__remove"
                        onClick={() => onRemoveManual(item.id)}
                        aria-label="Remove"
                      >
                        &times;
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function WeekNotesPanel({
  notes,
  onChange,
}: {
  notes: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mp-panel">
      <h3 className="mp-panel__title">Week notes</h3>
      <textarea
        className="mp-textarea"
        placeholder="Meal prep reminders, dietary notes, preferences for the week..."
        value={notes}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
      />
    </div>
  );
}
