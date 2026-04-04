import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink } from "react-router-dom";

import {
  formatMealSlotLabel,
  formatShortDate,
  getTodayDate,
  getWeekStartDate,
  getWeekEndDate,
  toIsoDate,
  useMealPlanWeekQuery,
  useMealTemplatesQuery,
  useSaveMealPlanWeekMutation,
  useCreateMealTemplateMutation,
  useUpdateMealTemplateMutation,
} from "../../shared/lib/api";
import type {
  MealPlanEntryItem,
  MealPlanGroceryItem,
  MealPlanWeekResponse,
  MealPrepSessionItem,
  MealTemplateIngredient,
  MealTemplateItem,
} from "../../shared/lib/api";
import {
  PageLoadingState,
  PageErrorState,
  EmptyState,
} from "../../shared/ui/PageState";

/* ── Constants ── */

type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

const SLOT_ICONS: Record<MealSlot, string> = {
  breakfast: "\u2600",
  lunch: "\u2614",
  dinner: "\u263D",
  snack: "\u2726",
};

type DraftEntry = {
  id?: string;
  date: string;
  mealSlot: MealSlot;
  mealTemplateId: string;
  mealTemplateName: string;
  servings: number | null;
  note: string | null;
  sortOrder: number;
  isLogged: boolean;
};

type DraftPrepSession = {
  id?: string;
  scheduledForDate: string;
  title: string;
  notes: string | null;
  taskId?: string | null;
  taskStatus?: "pending" | "completed" | "dropped" | null;
  sortOrder: number;
};

type DraftGroceryItem = {
  id?: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  section: string | null;
  note: string | null;
  isChecked: boolean;
  sortOrder: number;
};

/* ── Helpers ── */

function getWeekDates(startDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(`${startDate}T12:00:00`);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(toIsoDate(d));
  }
  return dates;
}

function formatDayLabel(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
  });
}

function formatDayNumber(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
  });
}

function formatWeekRange(startDate: string, endDate: string): string {
  return `${formatShortDate(startDate)}\u2009\u2014\u2009${formatShortDate(endDate)}`;
}

function shiftWeek(startDate: string, direction: number): string {
  const d = new Date(`${startDate}T12:00:00`);
  d.setDate(d.getDate() + 7 * direction);
  return getWeekStartDate(toIsoDate(d));
}

/* ── Sub-navigation ── */

function HealthSubNav() {
  return (
    <nav className="mp-subnav" aria-label="Health sections">
      <NavLink
        to="/health"
        className={({ isActive }) =>
          `mp-subnav__link${isActive ? " mp-subnav__link--active" : ""}`
        }
        end
      >
        Basics
      </NavLink>
      <NavLink
        to="/health/meals"
        className={({ isActive }) =>
          `mp-subnav__link${isActive ? " mp-subnav__link--active" : ""}`
        }
      >
        Meals
      </NavLink>
    </nav>
  );
}

/* ── Template Picker ── */

function TemplatePicker({
  templates,
  onSelect,
  onClose,
  onCreateNew,
}: {
  templates: MealTemplateItem[];
  onSelect: (template: MealTemplateItem) => void;
  onClose: () => void;
  onCreateNew: () => void;
}) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.tags && t.tags.some((tag) => tag.toLowerCase().includes(q)))
    );
  }, [templates, search]);

  return (
    <div className="mp-picker-overlay" onClick={onClose}>
      <div className="mp-picker" onClick={(e) => e.stopPropagation()}>
        <div className="mp-picker__header">
          <input
            ref={inputRef}
            type="text"
            className="mp-picker__search"
            placeholder="Search recipes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            className="mp-picker__close"
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <div className="mp-picker__list">
          {filtered.length === 0 ? (
            <div className="mp-picker__empty">
              <span className="mp-picker__empty-text">No recipes found</span>
              <button
                type="button"
                className="button button--ghost button--small"
                onClick={onCreateNew}
              >
                Create new recipe
              </button>
            </div>
          ) : (
            filtered.map((t) => (
              <button
                key={t.id}
                type="button"
                className="mp-picker__item"
                onClick={() => onSelect(t)}
              >
                <span className="mp-picker__item-name">{t.name}</span>
                <span className="mp-picker__item-meta">
                  {t.mealSlot ? formatMealSlotLabel(t.mealSlot) : "Any slot"}
                  {t.prepMinutes || t.cookMinutes ? (
                    <span className="mp-picker__item-time">
                      {t.prepMinutes ? `${t.prepMinutes}m prep` : ""}
                      {t.prepMinutes && t.cookMinutes ? " + " : ""}
                      {t.cookMinutes ? `${t.cookMinutes}m cook` : ""}
                    </span>
                  ) : null}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Meal Slot Cell ── */

function MealSlotCell({
  date,
  slot,
  entry,
  isToday,
  onAssign,
  onEdit,
  onRemove,
}: {
  date: string;
  slot: MealSlot;
  entry: DraftEntry | undefined;
  isToday: boolean;
  onAssign: (date: string, slot: MealSlot) => void;
  onEdit: (date: string, slot: MealSlot) => void;
  onRemove: (date: string, slot: MealSlot) => void;
}) {
  if (entry) {
    return (
      <div className={`mp-slot mp-slot--filled${entry.isLogged ? " mp-slot--logged" : ""}`}>
        <button
          type="button"
          className="mp-slot__main"
          onClick={() => onEdit(date, slot)}
          aria-label={`Edit ${entry.mealTemplateName}`}
        >
          <div className="mp-slot__content">
            <span className="mp-slot__name">{entry.mealTemplateName}</span>
            {entry.servings ? (
              <span className="mp-slot__servings">{entry.servings}x</span>
            ) : null}
          </div>
        </button>
        <button
          type="button"
          className="mp-slot__remove"
          onClick={(event) => {
            event.stopPropagation();
            onRemove(date, slot);
          }}
          aria-label={`Remove ${entry.mealTemplateName}`}
        >
          &times;
        </button>
        {entry.isLogged && <span className="mp-slot__logged-dot" title="Logged" />}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`mp-slot mp-slot--empty${isToday ? " mp-slot--today" : ""}`}
      onClick={() => onAssign(date, slot)}
      aria-label={`Assign ${formatMealSlotLabel(slot)} for ${formatShortDate(date)}`}
    >
      <span className="mp-slot__add">+</span>
    </button>
  );
}

/* ── Day Column ── */

function DayColumn({
  date,
  isToday,
  entries,
  onAssign,
  onEdit,
  onRemove,
}: {
  date: string;
  isToday: boolean;
  entries: Map<MealSlot, DraftEntry>;
  onAssign: (date: string, slot: MealSlot) => void;
  onEdit: (date: string, slot: MealSlot) => void;
  onRemove: (date: string, slot: MealSlot) => void;
}) {
  return (
    <div className={`mp-day${isToday ? " mp-day--today" : ""}`}>
      <div className="mp-day__header">
        <span className="mp-day__weekday">{formatDayLabel(date)}</span>
        <span className="mp-day__date">{formatDayNumber(date)}</span>
      </div>
      <div className="mp-day__slots">
        {MEAL_SLOTS.map((slot) => (
          <div key={slot} className="mp-day__slot-row">
            <span className="mp-day__slot-icon" title={formatMealSlotLabel(slot)}>
              {SLOT_ICONS[slot]}
            </span>
            <MealSlotCell
              date={date}
              slot={slot}
              entry={entries.get(slot)}
              isToday={isToday}
              onAssign={onAssign}
              onEdit={onEdit}
              onRemove={onRemove}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Planned Entry Editor ── */

function PlannedEntryEditor({
  entry,
  onSave,
  onChangeRecipe,
  onClose,
}: {
  entry: DraftEntry;
  onSave: (updates: { servings: number | null; note: string | null }) => void;
  onChangeRecipe: () => void;
  onClose: () => void;
}) {
  const [servings, setServings] = useState(entry.servings ? String(entry.servings) : "");
  const [note, setNote] = useState(entry.note ?? "");

  return (
    <div className="mp-picker-overlay" onClick={onClose}>
      <div className="mp-picker mp-picker--editor" onClick={(e) => e.stopPropagation()}>
        <div className="mp-template-creator">
          <div className="mp-template-creator__header">
            <h4 className="mp-template-creator__title">Edit planned meal</h4>
            <button
              type="button"
              className="mp-picker__close"
              onClick={onClose}
              aria-label="Close"
            >
              &times;
            </button>
          </div>
          <div className="mp-entry-editor__recipe">{entry.mealTemplateName}</div>
          <div className="mp-template-creator__fields">
            <input
              type="number"
              className="mp-input"
              placeholder="Servings"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
            />
            <textarea
              className="mp-textarea mp-textarea--compact"
              placeholder="Slot note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
          <div className="mp-template-creator__actions">
            <button
              type="button"
              className="button button--ghost button--small"
              onClick={onChangeRecipe}
            >
              Change recipe
            </button>
            <button
              type="button"
              className="button button--ghost button--small"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button button--primary button--small"
              onClick={() => onSave({
                servings: servings ? Number(servings) : null,
                note: note.trim() || null,
              })}
            >
              Save meal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Prep Sessions Panel ── */

function PrepPanel({
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

  const statusLabel = (s: DraftPrepSession) => {
    if (!s.taskStatus) return null;
    return s.taskStatus;
  };

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
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
          <div className="mp-prep-form__row">
            <select
              className="mp-select"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            >
              {weekDates.map((d) => (
                <option key={d} value={d}>
                  {formatDayLabel(d)} {formatDayNumber(d)}
                </option>
              ))}
            </select>
            <input
              type="text"
              className="mp-input mp-input--grow"
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
          {sessions.map((s, i) => (
            <li key={s.id || `draft-${i}`} className="mp-prep-item">
              <div className="mp-prep-item__body">
                <span className="mp-prep-item__title">{s.title}</span>
                <span className="mp-prep-item__date">
                  {formatDayLabel(s.scheduledForDate)}{" "}
                  {formatDayNumber(s.scheduledForDate)}
                </span>
                {s.notes && (
                  <span className="mp-prep-item__notes">{s.notes}</span>
                )}
              </div>
              <div className="mp-prep-item__actions">
                {statusLabel(s) && (
                  <span
                    className={`mp-badge mp-badge--${s.taskStatus}`}
                  >
                    {statusLabel(s)}
                  </span>
                )}
                <button
                  type="button"
                  className="mp-prep-item__remove"
                  onClick={() => onRemove(i)}
                  aria-label={`Remove ${s.title}`}
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

/* ── Grocery List Panel ── */

function GroceryPanel({
  items,
  onToggle,
  onAddManual,
  onRemoveManual,
}: {
  items: MealPlanGroceryItem[];
  onToggle: (id: string) => void;
  onAddManual: (item: { name: string; quantity: number | null; unit: string | null; section: string | null }) => void;
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

  const checkedCount = items.filter((i) => i.isChecked).length;

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
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
          <div className="mp-grocery-form__row">
            <input
              type="number"
              className="mp-input mp-input--narrow"
              placeholder="Qty"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
            <input
              type="text"
              className="mp-input mp-input--narrow"
              placeholder="Unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
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
                        {item.quantity}{item.unit ? ` ${item.unit}` : ""}
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

/* ── Week Notes Panel ── */

function WeekNotesPanel({
  notes,
  onChange,
}: {
  notes: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mp-panel mp-panel--notes">
      <h3 className="mp-panel__title">Week notes</h3>
      <textarea
        className="mp-textarea"
        placeholder="Meal prep reminders, dietary notes, preferences for the week..."
        value={notes}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
      />
    </div>
  );
}

/* ── Recipe Composer ── */

function buildIngredientText(ingredients: MealTemplateIngredient[]) {
  return ingredients
    .map((ingredient) => {
      const amount = ingredient.quantity ? `${ingredient.quantity}` : "";
      const unit = ingredient.unit ? ` ${ingredient.unit}` : "";
      return `${amount}${unit}${amount || unit ? " " : ""}${ingredient.name}`.trim();
    })
    .join("\n");
}

function RecipeComposer({
  mode,
  initialTemplate,
  onSaved,
  onCancel,
}: {
  mode: "create" | "edit";
  initialTemplate?: MealTemplateItem;
  onSaved: (template: MealTemplateItem) => void;
  onCancel: () => void;
}) {
  const createMutation = useCreateMealTemplateMutation();
  const updateMutation = useUpdateMealTemplateMutation();
  const [name, setName] = useState(initialTemplate?.name ?? "");
  const [slot, setSlot] = useState<MealSlot | "">(initialTemplate?.mealSlot ?? "");
  const [description, setDescription] = useState(initialTemplate?.description ?? "");
  const [servings, setServings] = useState(initialTemplate?.servings ? String(initialTemplate.servings) : "");
  const [prepMin, setPrepMin] = useState(initialTemplate?.prepMinutes ? String(initialTemplate.prepMinutes) : "");
  const [cookMin, setCookMin] = useState(initialTemplate?.cookMinutes ? String(initialTemplate.cookMinutes) : "");
  const [ingredientText, setIngredientText] = useState(() => buildIngredientText(initialTemplate?.ingredients ?? []));
  const [instructionText, setInstructionText] = useState(() => (initialTemplate?.instructions ?? []).join("\n"));
  const [tagText, setTagText] = useState(() => (initialTemplate?.tags ?? []).join(", "));
  const [notes, setNotes] = useState(initialTemplate?.notes ?? "");

  const isPending = createMutation.isPending || updateMutation.isPending;

  function parseIngredients(): MealTemplateIngredient[] {
    return ingredientText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ name: line, quantity: null, unit: null, section: null, note: null }));
  }

  function parseInstructions() {
    return instructionText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function parseTags() {
    return tagText
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  function handleSave() {
    if (!name.trim()) return;

    const sharedPayload = {
      name: name.trim(),
      mealSlot: slot || null,
      servings: servings ? Number(servings) : null,
      prepMinutes: prepMin ? Number(prepMin) : null,
      cookMinutes: cookMin ? Number(cookMin) : null,
      ingredients: parseIngredients(),
      instructions: parseInstructions(),
      tags: parseTags(),
      notes: notes.trim() || null,
    };

    if (mode === "edit" && initialTemplate) {
      void updateMutation
        .mutateAsync({
          mealTemplateId: initialTemplate.id,
          ...sharedPayload,
          description: description.trim() || null,
        })
        .then((response) => onSaved(response.mealTemplate));
      return;
    }

    void createMutation
      .mutateAsync({
        ...sharedPayload,
        description: description.trim() || undefined,
      })
      .then((response) => onSaved(response.mealTemplate));
  }

  return (
    <div className="mp-picker-overlay" onClick={onCancel}>
      <div className="mp-picker mp-picker--editor" onClick={(e) => e.stopPropagation()}>
        <div className="mp-template-creator">
          <div className="mp-template-creator__header">
            <h4 className="mp-template-creator__title">
              {mode === "edit" ? "Edit recipe" : "New recipe"}
            </h4>
            <button
              type="button"
              className="mp-picker__close"
              onClick={onCancel}
              aria-label="Close"
            >
              &times;
            </button>
          </div>
          <div className="mp-template-creator__fields">
            <input
              type="text"
              className="mp-input"
              placeholder="Recipe name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="mp-template-creator__row">
              <select
                className="mp-select"
                value={slot}
                onChange={(e) => setSlot(e.target.value as MealSlot | "")}
              >
                <option value="">Any slot</option>
                {MEAL_SLOTS.map((s) => (
                  <option key={s} value={s}>
                    {formatMealSlotLabel(s)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                className="mp-input mp-input--narrow"
                placeholder="Servings"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
              />
            </div>
            <div className="mp-template-creator__row">
              <input
                type="number"
                className="mp-input mp-input--narrow"
                placeholder="Prep (min)"
                value={prepMin}
                onChange={(e) => setPrepMin(e.target.value)}
              />
              <input
                type="number"
                className="mp-input mp-input--narrow"
                placeholder="Cook (min)"
                value={cookMin}
                onChange={(e) => setCookMin(e.target.value)}
              />
            </div>
            <input
              type="text"
              className="mp-input"
              placeholder="Short description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <textarea
              className="mp-textarea mp-textarea--compact"
              placeholder="Ingredients (one per line)"
              value={ingredientText}
              onChange={(e) => setIngredientText(e.target.value)}
              rows={4}
            />
            <textarea
              className="mp-textarea mp-textarea--compact"
              placeholder="Instructions (one per line)"
              value={instructionText}
              onChange={(e) => setInstructionText(e.target.value)}
              rows={4}
            />
            <input
              type="text"
              className="mp-input"
              placeholder="Tags (comma separated)"
              value={tagText}
              onChange={(e) => setTagText(e.target.value)}
            />
            <textarea
              className="mp-textarea mp-textarea--compact"
              placeholder="Recipe notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          <div className="mp-template-creator__actions">
            <button
              type="button"
              className="button button--ghost button--small"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button button--primary button--small"
              onClick={handleSave}
              disabled={!name.trim() || isPending}
            >
              {isPending
                ? mode === "edit" ? "Saving..." : "Creating..."
                : mode === "edit" ? "Save recipe" : "Create recipe"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Template Library Panel ── */

function TemplateLibrary({
  templates,
  onCreateRecipe,
  onEditRecipe,
}: {
  templates: MealTemplateItem[];
  onCreateRecipe: () => void;
  onEditRecipe: (template: MealTemplateItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = templates.find((t) => t.id === selectedId);

  return (
    <div className="mp-panel">
      <div className="mp-panel__header">
        <button
          type="button"
          className="mp-panel__title mp-panel__title--toggle"
          onClick={() => setExpanded(!expanded)}
        >
          Recipe library
          <span className={`mp-panel__chevron${expanded ? " mp-panel__chevron--open" : ""}`}>
            &#9662;
          </span>
          <span className="mp-panel__count">{templates.length}</span>
        </button>
        {expanded && (
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={onCreateRecipe}
          >
            + New
          </button>
        )}
      </div>
      {expanded && (
        <>
          {templates.length === 0 ? (
            <EmptyState
              title="No recipes yet"
              description="Create your first recipe to start meal planning."
              actionLabel="Create recipe"
              onAction={onCreateRecipe}
            />
          ) : (
            <div className="mp-template-grid">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`mp-template-card${selectedId === t.id ? " mp-template-card--selected" : ""}`}
                  onClick={() => setSelectedId(selectedId === t.id ? null : t.id)}
                >
                  <span className="mp-template-card__name">{t.name}</span>
                  <span className="mp-template-card__meta">
                    {t.mealSlot ? formatMealSlotLabel(t.mealSlot) : "Any slot"}
                    {t.ingredients.length > 0 &&
                      ` \u00B7 ${t.ingredients.length} ingredients`}
                  </span>
                </button>
              ))}
            </div>
          )}
          {selected && (
            <div className="mp-template-detail">
              <div className="mp-template-detail__header">
                <h4 className="mp-template-detail__name">{selected.name}</h4>
                <button
                  type="button"
                  className="button button--ghost button--small"
                  onClick={() => onEditRecipe(selected)}
                >
                  Edit
                </button>
              </div>
              {selected.description && (
                <p className="mp-template-detail__desc">{selected.description}</p>
              )}
              <div className="mp-template-detail__meta-row">
                {selected.servings && (
                  <span className="mp-template-detail__chip">
                    {selected.servings} servings
                  </span>
                )}
                {selected.prepMinutes && (
                  <span className="mp-template-detail__chip">
                    {selected.prepMinutes}m prep
                  </span>
                )}
                {selected.cookMinutes && (
                  <span className="mp-template-detail__chip">
                    {selected.cookMinutes}m cook
                  </span>
                )}
              </div>
              {selected.ingredients.length > 0 && (
                <div className="mp-template-detail__section">
                  <span className="mp-template-detail__label">Ingredients</span>
                  <ul className="mp-template-detail__list">
                    {selected.ingredients.map((ing, i) => (
                      <li key={i}>
                        {ing.quantity ? `${ing.quantity}` : ""}
                        {ing.unit ? ` ${ing.unit}` : ""}{" "}
                        {ing.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {selected.instructions.length > 0 && (
                <div className="mp-template-detail__section">
                  <span className="mp-template-detail__label">Instructions</span>
                  <ol className="mp-template-detail__steps">
                    {selected.instructions.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
              {selected.tags.length > 0 && (
                <div className="mp-template-detail__tags">
                  {selected.tags.map((tag) => (
                    <span key={tag} className="mp-template-detail__tag">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Main Page Component
   ═══════════════════════════════════════════════════════ */

export function MealPlannerPage() {
  const today = getTodayDate();
  const [weekStart, setWeekStart] = useState(() => getWeekStartDate(today));

  const weekEnd = getWeekEndDate(weekStart);
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  /* ── Server data ── */
  const weekQuery = useMealPlanWeekQuery(weekStart);
  const templatesQuery = useMealTemplatesQuery();
  const saveMutation = useSaveMealPlanWeekMutation(weekStart);

  /* ── Draft state ── */
  const [entries, setEntries] = useState<DraftEntry[]>([]);
  const [prepSessions, setPrepSessions] = useState<DraftPrepSession[]>([]);
  const [groceryItems, setGroceryItems] = useState<MealPlanGroceryItem[]>([]);
  const [manualGroceries, setManualGroceries] = useState<DraftGroceryItem[]>([]);
  const [weekNotes, setWeekNotes] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{ date: string; slot: MealSlot } | null>(null);
  const [editingEntryTarget, setEditingEntryTarget] = useState<{ date: string; slot: MealSlot } | null>(null);
  const [recipeComposerState, setRecipeComposerState] = useState<
    | { mode: "create"; target?: { date: string; slot: MealSlot } | null }
    | { mode: "edit"; template: MealTemplateItem }
    | null
  >(null);

  /* ── Hydrate draft from server ── */
  useEffect(() => {
    if (!weekQuery.data) return;
    const data = weekQuery.data;
    setEntries(
      data.entries.map((e) => ({
        id: e.id,
        date: e.date,
        mealSlot: e.mealSlot,
        mealTemplateId: e.mealTemplateId,
        mealTemplateName: e.mealTemplateName,
        servings: e.servings,
        note: e.note,
        sortOrder: e.sortOrder,
        isLogged: e.isLogged,
      }))
    );
    setPrepSessions(
      data.prepSessions.map((p) => ({
        id: p.id,
        scheduledForDate: p.scheduledForDate,
        title: p.title,
        notes: p.notes,
        taskId: p.taskId,
        taskStatus: p.taskStatus,
        sortOrder: p.sortOrder,
      }))
    );
    setGroceryItems(data.groceryItems);
    setManualGroceries(
      data.groceryItems
        .filter((g) => g.sourceType === "manual")
        .map((g) => ({
          id: g.id,
          name: g.name,
          quantity: g.quantity,
          unit: g.unit,
          section: g.section,
          note: g.note,
          isChecked: g.isChecked,
          sortOrder: g.sortOrder,
        }))
    );
    setWeekNotes(data.notes || "");
    setIsDirty(false);
  }, [weekQuery.data]);

  /* ── Entry helpers ── */

  const entryMap = useMemo(() => {
    const map = new Map<string, DraftEntry>();
    for (const e of entries) {
      map.set(`${e.date}:${e.mealSlot}`, e);
    }
    return map;
  }, [entries]);

  const getEntriesForDay = useCallback(
    (date: string) => {
      const map = new Map<MealSlot, DraftEntry>();
      for (const slot of MEAL_SLOTS) {
        const entry = entryMap.get(`${date}:${slot}`);
        if (entry) map.set(slot, entry);
      }
      return map;
    },
    [entryMap]
  );

  /* ── Template list ── */
  const templates = useMemo(
    () => [
      ...(weekQuery.data?.mealTemplates || []),
      ...(templatesQuery.data?.mealTemplates || []),
    ].filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i),
    [weekQuery.data?.mealTemplates, templatesQuery.data?.mealTemplates]
  );

  /* ── Actions ── */

  function assignTemplateToSlot(template: MealTemplateItem, date: string, slot: MealSlot) {
    setEntries((prev) => {
      const existing = prev.find((entry) => entry.date === date && entry.mealSlot === slot);
      const filtered = prev.filter(
        (entry) => !(entry.date === date && entry.mealSlot === slot)
      );

      return [
        ...filtered,
        {
          id: existing?.id,
          date,
          mealSlot: slot,
          mealTemplateId: template.id,
          mealTemplateName: template.name,
          servings: existing?.servings ?? template.servings,
          note: existing?.note ?? null,
          sortOrder: existing?.sortOrder ?? filtered.length,
          isLogged: existing?.isLogged ?? false,
        },
      ];
    });
    setIsDirty(true);
  }

  function handleAssignSlot(date: string, slot: MealSlot) {
    setPickerTarget({ date, slot });
  }

  function handleTemplateSelected(template: MealTemplateItem) {
    if (!pickerTarget) return;
    assignTemplateToSlot(template, pickerTarget.date, pickerTarget.slot);
    setPickerTarget(null);
  }

  function handleRemoveEntry(date: string, slot: MealSlot) {
    setEntries((prev) =>
      prev.filter((e) => !(e.date === date && e.mealSlot === slot))
    );
    setIsDirty(true);
  }

  function handleEditEntry(date: string, slot: MealSlot) {
    setEditingEntryTarget({ date, slot });
  }

  function handleUpdateEntry(updates: { servings: number | null; note: string | null }) {
    if (!editingEntryTarget) return;

    setEntries((prev) =>
      prev.map((entry) =>
        entry.date === editingEntryTarget.date && entry.mealSlot === editingEntryTarget.slot
          ? {
              ...entry,
              servings: updates.servings,
              note: updates.note,
            }
          : entry,
      ),
    );
    setEditingEntryTarget(null);
    setIsDirty(true);
  }

  function handleChangeEntryRecipe() {
    if (!editingEntryTarget) return;
    setPickerTarget(editingEntryTarget);
    setEditingEntryTarget(null);
  }

  function handleAddPrep(session: Omit<DraftPrepSession, "sortOrder">) {
    setPrepSessions((prev) => [
      ...prev,
      { ...session, sortOrder: prev.length },
    ]);
    setIsDirty(true);
  }

  function handleRemovePrep(index: number) {
    setPrepSessions((prev) => prev.filter((_, i) => i !== index));
    setIsDirty(true);
  }

  function handleToggleGrocery(id: string) {
    setGroceryItems((prev) =>
      prev.map((g) => (g.id === id ? { ...g, isChecked: !g.isChecked } : g))
    );
    setManualGroceries((prev) =>
      prev.map((g) => (g.id === id ? { ...g, isChecked: !g.isChecked } : g))
    );
    setIsDirty(true);
  }

  function handleAddManualGrocery(item: {
    name: string;
    quantity: number | null;
    unit: string | null;
    section: string | null;
  }) {
    const tempId = `manual-${Date.now()}`;
    const newItem: DraftGroceryItem = {
      id: tempId,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      section: item.section,
      note: null,
      isChecked: false,
      sortOrder: manualGroceries.length,
    };
    setManualGroceries((prev) => [...prev, newItem]);
    setGroceryItems((prev) => [
      ...prev,
      {
        ...newItem,
        id: tempId,
        sourceType: "manual" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    setIsDirty(true);
  }

  function handleRemoveManualGrocery(id: string) {
    setManualGroceries((prev) => prev.filter((g) => g.id !== id));
    setGroceryItems((prev) => prev.filter((g) => g.id !== id));
    setIsDirty(true);
  }

  function handleNotesChange(value: string) {
    setWeekNotes(value);
    setIsDirty(true);
  }

  /* ── Save ── */

  function handleSave() {
    void saveMutation.mutateAsync({
      notes: weekNotes || null,
      entries: entries.map((e, i) => ({
        id: e.id,
        date: e.date,
        mealSlot: e.mealSlot,
        mealTemplateId: e.mealTemplateId,
        servings: e.servings,
        note: e.note,
        sortOrder: i,
      })),
      prepSessions: prepSessions.map((p, i) => ({
        id: p.id,
        scheduledForDate: p.scheduledForDate,
        title: p.title,
        notes: p.notes,
        sortOrder: i,
      })),
      manualGroceryItems: manualGroceries.map((g, i) => ({
        id: g.id?.startsWith("manual-") ? undefined : g.id,
        name: g.name,
        quantity: g.quantity,
        unit: g.unit,
        section: g.section,
        note: g.note,
        isChecked: g.isChecked,
        sortOrder: i,
      })),
      plannedGroceryItems: groceryItems
        .filter((g) => g.sourceType === "planned")
        .map((g) => ({
          name: g.name,
          unit: g.unit,
          isChecked: g.isChecked,
        })),
    });
  }

  /* ── Week navigation ── */

  function goToPreviousWeek() {
    setWeekStart(shiftWeek(weekStart, -1));
  }

  function goToNextWeek() {
    setWeekStart(shiftWeek(weekStart, 1));
  }

  function goToCurrentWeek() {
    setWeekStart(getWeekStartDate(today));
  }

  const isCurrentWeek = weekStart === getWeekStartDate(today);

  /* ── Summary stats ── */
  const summary = weekQuery.data?.summary;
  const mealCount = entries.length;
  const prepCount = prepSessions.length;
  const groceryCount = groceryItems.length;
  const editingEntry = editingEntryTarget
    ? entryMap.get(`${editingEntryTarget.date}:${editingEntryTarget.slot}`)
    : undefined;

  /* ── Render ── */

  if (weekQuery.isLoading && !weekQuery.data) {
    return (
      <div className="mp-page">
        <HealthSubNav />
        <PageLoadingState
          title="Loading meal planner"
          description="Building your weekly meal planning workspace."
        />
      </div>
    );
  }

  if (weekQuery.isError && !weekQuery.data) {
    return (
      <div className="mp-page">
        <HealthSubNav />
        <PageErrorState
          title="Meal planner could not load"
          message="There was an issue loading your meal plan. Please try again."
          onRetry={() => weekQuery.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="mp-page">
      <HealthSubNav />

      {/* ── Week Header ── */}
      <header className="mp-header">
        <div className="mp-header__top">
          <div className="mp-header__nav">
            <button
              type="button"
              className="mp-header__arrow"
              onClick={goToPreviousWeek}
              aria-label="Previous week"
            >
              &#8249;
            </button>
            <h1 className="mp-header__range">
              {formatWeekRange(weekStart, weekEnd)}
            </h1>
            <button
              type="button"
              className="mp-header__arrow"
              onClick={goToNextWeek}
              aria-label="Next week"
            >
              &#8250;
            </button>
            {!isCurrentWeek && (
              <button
                type="button"
                className="mp-header__today-btn"
                onClick={goToCurrentWeek}
              >
                This week
              </button>
            )}
          </div>
          <div className="mp-header__actions">
            {isDirty && (
              <span className="mp-header__dirty-indicator">Unsaved changes</span>
            )}
            <button
              type="button"
              className="button button--primary button--small"
              onClick={handleSave}
              disabled={saveMutation.isPending || !isDirty}
            >
              {saveMutation.isPending ? "Saving..." : "Save plan"}
            </button>
          </div>
        </div>
        <div className="mp-header__stats">
          <span className="mp-header__stat">
            <span className="mp-header__stat-value">{mealCount}</span>
            <span className="mp-header__stat-label">meals</span>
          </span>
          <span className="mp-header__stat-divider" />
          <span className="mp-header__stat">
            <span className="mp-header__stat-value">{prepCount}</span>
            <span className="mp-header__stat-label">prep sessions</span>
          </span>
          <span className="mp-header__stat-divider" />
          <span className="mp-header__stat">
            <span className="mp-header__stat-value">{groceryCount}</span>
            <span className="mp-header__stat-label">grocery items</span>
          </span>
          {summary && summary.totalPlannedMeals > 0 && (
            <>
              <span className="mp-header__stat-divider" />
              <span className="mp-header__stat">
                <span className="mp-header__stat-value">
                  {Math.round((summary.loggedPlannedMeals / summary.totalPlannedMeals) * 100)}%
                </span>
                <span className="mp-header__stat-label">executed</span>
              </span>
            </>
          )}
        </div>
      </header>

      {/* ── Weekly Planning Board ── */}
      <section className="mp-board" aria-label="Weekly meal plan">
        <div className="mp-board__slot-labels">
          <span className="mp-board__slot-label-spacer" />
          {MEAL_SLOTS.map((slot) => (
            <span key={slot} className="mp-board__slot-label">
              {SLOT_ICONS[slot]}
            </span>
          ))}
        </div>
        <div className="mp-board__grid">
          {weekDates.map((date) => (
            <DayColumn
              key={date}
              date={date}
              isToday={date === today}
              entries={getEntriesForDay(date)}
              onAssign={handleAssignSlot}
              onEdit={handleEditEntry}
              onRemove={handleRemoveEntry}
            />
          ))}
        </div>
      </section>

      {/* ── Secondary Panels ── */}
      <div className="mp-panels">
        <PrepPanel
          sessions={prepSessions}
          weekDates={weekDates}
          onAdd={handleAddPrep}
          onRemove={handleRemovePrep}
        />
        <GroceryPanel
          items={groceryItems}
          onToggle={handleToggleGrocery}
          onAddManual={handleAddManualGrocery}
          onRemoveManual={handleRemoveManualGrocery}
        />
      </div>

      <div className="mp-panels">
        <WeekNotesPanel notes={weekNotes} onChange={handleNotesChange} />
        <TemplateLibrary
          templates={templates}
          onCreateRecipe={() => setRecipeComposerState({ mode: "create" })}
          onEditRecipe={(template) => setRecipeComposerState({ mode: "edit", template })}
        />
      </div>

      {/* ── Template Picker Overlay ── */}
      {pickerTarget && (
        <TemplatePicker
          templates={templates}
          onSelect={handleTemplateSelected}
          onClose={() => setPickerTarget(null)}
          onCreateNew={() => {
            const target = pickerTarget;
            setPickerTarget(null);
            setRecipeComposerState({ mode: "create", target });
          }}
        />
      )}
      {editingEntry && (
        <PlannedEntryEditor
          entry={editingEntry}
          onSave={handleUpdateEntry}
          onChangeRecipe={handleChangeEntryRecipe}
          onClose={() => setEditingEntryTarget(null)}
        />
      )}
      {recipeComposerState && (
        <RecipeComposer
          mode={recipeComposerState.mode}
          initialTemplate={recipeComposerState.mode === "edit" ? recipeComposerState.template : undefined}
          onSaved={(template) => {
            void templatesQuery.refetch();
            void weekQuery.refetch();
            if (recipeComposerState.mode === "create" && recipeComposerState.target) {
              assignTemplateToSlot(template, recipeComposerState.target.date, recipeComposerState.target.slot);
            }
            setRecipeComposerState(null);
          }}
          onCancel={() => setRecipeComposerState(null)}
        />
      )}
    </div>
  );
}
