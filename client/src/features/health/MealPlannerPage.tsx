import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  type Modifier,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import type { IsoDateString } from "@life-os/contracts";

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
  MealPlanGroceryItem,
  SaveMealPlanWeekPayload,
  MealTemplateIngredient,
  MealTemplateItem,
} from "../../shared/lib/api";
import {
  PageLoadingState,
} from "../../shared/ui/PageState";
import { HealthSubNav } from "./HealthSubNav";

/* ═══════════════════════════════════════════════
   Constants & Types
   ═══════════════════════════════════════════════ */

type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

const SLOT_ICONS: Record<MealSlot, string> = {
  breakfast: "\u2600",
  lunch: "\u25D1",
  dinner: "\u263D",
  snack: "\u2726",
};

const CATEGORIES: { key: MealSlot; label: string }[] = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snacks" },
];

const MEAL_PLAN_AUTOSAVE_DELAY_MS = 800;

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

/* ═══════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════ */

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

function buildIngredientText(ingredients: MealTemplateIngredient[]) {
  return ingredients
    .map((ingredient) => {
      const amount = ingredient.quantity ? `${ingredient.quantity}` : "";
      const unit = ingredient.unit ? ` ${ingredient.unit}` : "";
      return `${amount}${unit}${amount || unit ? " " : ""}${ingredient.name}`.trim();
    })
    .join("\n");
}

function buildMealPlanSavePayload({
  notes,
  entries,
  prepSessions,
  manualGroceries,
  groceryItems,
}: {
  notes: string;
  entries: DraftEntry[];
  prepSessions: DraftPrepSession[];
  manualGroceries: DraftGroceryItem[];
  groceryItems: MealPlanGroceryItem[];
}): SaveMealPlanWeekPayload {
  return {
    notes: notes || null,
    entries: entries.map((entry, index) => ({
      id: entry.id,
      date: entry.date as IsoDateString,
      mealSlot: entry.mealSlot,
      mealTemplateId: entry.mealTemplateId,
      servings: entry.servings,
      note: entry.note,
      sortOrder: index,
    })),
    prepSessions: prepSessions.map((session, index) => ({
      id: session.id,
      scheduledForDate: session.scheduledForDate as IsoDateString,
      title: session.title,
      notes: session.notes,
      sortOrder: index,
    })),
    manualGroceryItems: manualGroceries.map((item, index) => ({
      id: item.id?.startsWith("manual-") ? undefined : item.id,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      section: item.section,
      note: item.note,
      isChecked: item.isChecked,
      sortOrder: index,
    })),
    plannedGroceryItems: groceryItems
      .filter((item) => item.sourceType === "planned")
      .map((item) => ({
        name: item.name,
        unit: item.unit,
        isChecked: item.isChecked,
      })),
  };
}

/* ═══════════════════════════════════════════════
   Draggable Recipe Card (horizontal layout)
   ═══════════════════════════════════════════════ */

function DraggableRecipeCard({
  template,
  isSelected,
  onSelect,
}: {
  template: MealTemplateItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `recipe-${template.id}`,
    data: { type: "recipe", template },
  });

  const timeInfo = [
    template.prepMinutes ? `${template.prepMinutes}m` : "",
    template.cookMinutes ? `${template.cookMinutes}m` : "",
  ]
    .filter(Boolean)
    .join("+");

  return (
    <div
      ref={setNodeRef}
      className={`mp-rcard${isDragging ? " mp-rcard--dragging" : ""}${isSelected ? " mp-rcard--selected" : ""}`}
      onClick={onSelect}
      {...attributes}
      {...listeners}
    >
      <div className="mp-rcard__grip" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="mp-rcard__body">
        <span className="mp-rcard__name">{template.name}</span>
        <span className="mp-rcard__meta">
          {timeInfo}
          {timeInfo && template.ingredients.length > 0 ? " \u00B7 " : ""}
          {template.ingredients.length > 0
            ? `${template.ingredients.length} ingr.`
            : ""}
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Recipe Drag Overlay
   ═══════════════════════════════════════════════ */

function RecipeDragOverlay({ template }: { template: MealTemplateItem }) {
  return (
    <div className="mp-drag-overlay">
      <span className="mp-drag-overlay__icon">
        {template.mealSlot ? SLOT_ICONS[template.mealSlot as MealSlot] : "\u2726"}
      </span>
      <span className="mp-drag-overlay__name">{template.name}</span>
    </div>
  );
}

const snapRecipeOverlayToCursor: Modifier = ({
  activatorEvent,
  activeNodeRect,
  overlayNodeRect,
  transform,
}) => {
  const pointerEvent = activatorEvent as
    | { clientX: number; clientY: number }
    | null;

  if (
    !pointerEvent ||
    typeof pointerEvent.clientX !== "number" ||
    typeof pointerEvent.clientY !== "number" ||
    !activeNodeRect ||
    !overlayNodeRect
  ) {
    return transform;
  }

  return {
    ...transform,
    x:
      transform.x +
      (pointerEvent.clientX -
        activeNodeRect.left -
        overlayNodeRect.width / 2),
    y:
      transform.y +
      (pointerEvent.clientY -
        activeNodeRect.top -
        overlayNodeRect.height / 2),
  };
};

/* ═══════════════════════════════════════════════
   Recipe Library Bar (horizontal, full-width)
   ═══════════════════════════════════════════════ */

function RecipeLibraryBar({
  templates,
  isDragActive,
  onCreateRecipe,
  onEditRecipe,
}: {
  templates: MealTemplateItem[];
  isDragActive: boolean;
  onCreateRecipe: () => void;
  onEditRecipe: (template: MealTemplateItem) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const filtered = useMemo(() => {
    let result = templates;
    if (activeCategory !== "all") {
      result = result.filter(
        (t) => (t.mealSlot || "other") === activeCategory
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.tags && t.tags.some((tag) => tag.toLowerCase().includes(q)))
      );
    }
    return result;
  }, [templates, activeCategory, search]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: templates.length };
    for (const cat of CATEGORIES) {
      counts[cat.key] = templates.filter(
        (t) => t.mealSlot === cat.key
      ).length;
    }
    counts.other = templates.filter((t) => !t.mealSlot).length;
    return counts;
  }, [templates]);

  const selected = templates.find((t) => t.id === selectedId);

  return (
    <section
      className={`mp-library${isDragActive ? " mp-library--drag-active" : ""}`}
    >
      <div className="mp-library__top">
        <button
          type="button"
          className="mp-library__toggle"
          onClick={() => setExpanded(!expanded)}
        >
          <span className="mp-library__title">Recipes</span>
          <span className="mp-library__title-count">{templates.length}</span>
          <span
            className={`mp-library__chevron${expanded ? " mp-library__chevron--open" : ""}`}
          >
            &#9662;
          </span>
        </button>

        {expanded && (
          <div className="mp-library__filters">
            <button
              type="button"
              className={`mp-library__pill${activeCategory === "all" ? " mp-library__pill--active" : ""}`}
              onClick={() => setActiveCategory("all")}
            >
              All
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                type="button"
                className={`mp-library__pill${activeCategory === cat.key ? " mp-library__pill--active" : ""}`}
                onClick={() => setActiveCategory(cat.key)}
              >
                <span className="mp-library__pill-icon">
                  {SLOT_ICONS[cat.key]}
                </span>
                {cat.label}
                {categoryCounts[cat.key] > 0 && (
                  <span className="mp-library__pill-count">
                    {categoryCounts[cat.key]}
                  </span>
                )}
              </button>
            ))}
            {categoryCounts.other > 0 && (
              <button
                type="button"
                className={`mp-library__pill${activeCategory === "other" ? " mp-library__pill--active" : ""}`}
                onClick={() => setActiveCategory("other")}
              >
                Other
                <span className="mp-library__pill-count">
                  {categoryCounts.other}
                </span>
              </button>
            )}
          </div>
        )}

        <div className="mp-library__actions">
          {expanded && (
            <input
              type="text"
              className="mp-input mp-library__search"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
          <button
            type="button"
            className="button button--primary button--small mp-library__new-btn"
            onClick={onCreateRecipe}
          >
            <span className="mp-library__new-btn-icon" aria-hidden="true">
              +
            </span>
            <span className="mp-library__new-btn-label">New</span>
          </button>
        </div>
      </div>

      {expanded && (
        <>
          {filtered.length === 0 ? (
            <div className="mp-library__empty">
              {templates.length === 0 ? (
                <>
                  <span className="mp-library__empty-icon">{"\u2726"}</span>
                  <p>Create your first recipe to start meal planning</p>
                </>
              ) : (
                <p>No recipes match your filter</p>
              )}
            </div>
          ) : (
            <>
              <span className="mp-library__drag-hint">
                Drag up to calendar {"\u2191"}
              </span>
              <div className="mp-library__cards">
                {filtered.map((t) => (
                  <DraggableRecipeCard
                    key={t.id}
                    template={t}
                    isSelected={selectedId === t.id}
                    onSelect={() =>
                      setSelectedId(selectedId === t.id ? null : t.id)
                    }
                  />
                ))}
              </div>
            </>
          )}

          {selected && (
            <div className="mp-library__detail">
              <div className="mp-library__detail-main">
                <div className="mp-library__detail-header">
                  <h4 className="mp-library__detail-name">{selected.name}</h4>
                  <div className="mp-library__detail-chips">
                    {selected.servings && (
                      <span className="mp-library__detail-chip">
                        {selected.servings} servings
                      </span>
                    )}
                    {selected.prepMinutes && (
                      <span className="mp-library__detail-chip">
                        {selected.prepMinutes}m prep
                      </span>
                    )}
                    {selected.cookMinutes && (
                      <span className="mp-library__detail-chip">
                        {selected.cookMinutes}m cook
                      </span>
                    )}
                  </div>
                </div>
                {selected.description && (
                  <p className="mp-library__detail-desc">
                    {selected.description}
                  </p>
                )}
              </div>
              <div className="mp-library__detail-cols">
                {selected.ingredients.length > 0 && (
                  <div className="mp-library__detail-section">
                    <span className="mp-library__detail-label">
                      Ingredients
                    </span>
                    <ul className="mp-library__detail-list">
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
                  <div className="mp-library__detail-section">
                    <span className="mp-library__detail-label">
                      Instructions
                    </span>
                    <ol className="mp-library__detail-steps">
                      {selected.instructions.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}
                {selected.tags.length > 0 && (
                  <div className="mp-library__detail-section">
                    <span className="mp-library__detail-label">Tags</span>
                    <div className="mp-library__detail-tags">
                      {selected.tags.map((tag) => (
                        <span key={tag} className="mp-library__detail-tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="button button--ghost button--small mp-library__detail-edit"
                onClick={() => onEditRecipe(selected)}
              >
                Edit recipe
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* ═══════════════════════════════════════════════
   Droppable Meal Slot
   ═══════════════════════════════════════════════ */

function DroppableMealSlot({
  date,
  slot,
  entry,
  isToday,
  isDragActive,
  onAssign,
  onEdit,
  onRemove,
}: {
  date: string;
  slot: MealSlot;
  entry: DraftEntry | undefined;
  isToday: boolean;
  isDragActive: boolean;
  onAssign: (date: string, slot: MealSlot) => void;
  onEdit: (date: string, slot: MealSlot) => void;
  onRemove: (date: string, slot: MealSlot) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${date}-${slot}`,
    data: { type: "meal-slot", date, slot },
  });

  if (entry) {
    return (
      <div
        ref={setNodeRef}
        className={`mp-slot mp-slot--filled${entry.isLogged ? " mp-slot--logged" : ""}${isOver ? " mp-slot--drop-replace" : ""}`}
      >
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
        {entry.isLogged && (
          <span className="mp-slot__logged-dot" title="Logged" />
        )}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={`mp-slot mp-slot--empty${isToday ? " mp-slot--today" : ""}${isDragActive ? " mp-slot--drop-ready" : ""}${isOver ? " mp-slot--drop-over" : ""}`}
      onClick={() => !isDragActive && onAssign(date, slot)}
      role="button"
      tabIndex={0}
      aria-label={`Assign ${formatMealSlotLabel(slot)} for ${formatShortDate(date)}`}
    >
      {isOver ? (
        <span className="mp-slot__drop-label">Drop here</span>
      ) : isDragActive ? (
        <span className="mp-slot__drop-label">{formatMealSlotLabel(slot)}</span>
      ) : (
        <span className="mp-slot__add">+</span>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Day Column
   ═══════════════════════════════════════════════ */

function DayColumn({
  date,
  isToday,
  entries,
  isDragActive,
  onAssign,
  onEdit,
  onRemove,
}: {
  date: string;
  isToday: boolean;
  entries: Map<MealSlot, DraftEntry>;
  isDragActive: boolean;
  onAssign: (date: string, slot: MealSlot) => void;
  onEdit: (date: string, slot: MealSlot) => void;
  onRemove: (date: string, slot: MealSlot) => void;
}) {
  const filledCount = entries.size;
  return (
    <div className={`mp-day${isToday ? " mp-day--today" : ""}`}>
      <div className="mp-day__header">
        <div className="mp-day__header-left">
          <span className="mp-day__weekday">{formatDayLabel(date)}</span>
          <span className="mp-day__date">{formatDayNumber(date)}</span>
        </div>
        {filledCount > 0 && (
          <span className="mp-day__count">{filledCount} meal{filledCount > 1 ? "s" : ""}</span>
        )}
      </div>
      <div className="mp-day__slots">
        {MEAL_SLOTS.map((slot) => (
          <div key={slot} className="mp-day__slot-row">
            <span
              className="mp-day__slot-label"
              title={formatMealSlotLabel(slot)}
            >
              {SLOT_ICONS[slot]}
            </span>
            <DroppableMealSlot
              date={date}
              slot={slot}
              entry={entries.get(slot)}
              isToday={isToday}
              isDragActive={isDragActive}
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

/* ═══════════════════════════════════════════════
   Template Picker (click-to-assign)
   ═══════════════════════════════════════════════ */

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

  return createPortal(
    <div className="mp-picker-overlay" onClick={onClose}>
      <div
        className="mp-picker"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Recipe picker"
      >
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
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════
   Planned Entry Editor
   ═══════════════════════════════════════════════ */

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
  const [servings, setServings] = useState(
    entry.servings ? String(entry.servings) : ""
  );
  const [note, setNote] = useState(entry.note ?? "");

  return createPortal(
    <div className="mp-picker-overlay" onClick={onClose}>
      <div
        className="mp-picker mp-picker--editor"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Edit planned meal"
      >
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
          <div className="mp-entry-editor__recipe">
            {entry.mealTemplateName}
          </div>
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
              onClick={() =>
                onSave({
                  servings: servings ? Number(servings) : null,
                  note: note.trim() || null,
                })
              }
            >
              Save meal
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════
   Prep Sessions Panel
   ═══════════════════════════════════════════════ */

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
                {s.taskStatus && (
                  <span className={`mp-badge mp-badge--${s.taskStatus}`}>
                    {s.taskStatus}
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

/* ═══════════════════════════════════════════════
   Grocery List Panel
   ═══════════════════════════════════════════════ */

function GroceryPanel({
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

/* ═══════════════════════════════════════════════
   Week Notes Panel
   ═══════════════════════════════════════════════ */

function WeekNotesPanel({
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
        onChange={(e) => onChange(e.target.value)}
        rows={3}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Editable List — shared by ingredients & instructions
   ═══════════════════════════════════════════════ */

function EditableList({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const addRef = useRef<HTMLInputElement>(null);

  function handleAdd() {
    const value = draft.trim();
    if (!value) return;
    onChange([...items, value]);
    setDraft("");
    addRef.current?.focus();
  }

  function handleRemove(index: number) {
    onChange(items.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
    }
  }

  function handleEditStart(index: number) {
    setEditingIndex(index);
    setEditValue(items[index]);
  }

  function handleEditSave(index: number) {
    const value = editValue.trim();
    if (!value) {
      handleRemove(index);
    } else {
      onChange(items.map((item, i) => (i === index ? value : item)));
    }
    setEditingIndex(null);
  }

  function handleEditKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleEditSave(index);
    } else if (e.key === "Escape") {
      setEditingIndex(null);
    }
  }

  return (
    <div className="rc-editable-list">
      {items.length > 0 && (
        <ul className="rc-editable-list__items">
          {items.map((item, i) => (
            <li key={i} className="rc-editable-list__item">
              <span className="rc-editable-list__num">{i + 1}</span>
              {editingIndex === i ? (
                <input
                  type="text"
                  className="rc-editable-list__edit-input"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => handleEditKeyDown(e, i)}
                  onBlur={() => handleEditSave(i)}
                  autoFocus
                />
              ) : (
                <span
                  className="rc-editable-list__text"
                  onClick={() => handleEditStart(i)}
                >
                  {item}
                </span>
              )}
              <button
                type="button"
                className="rc-editable-list__remove"
                onClick={() => handleRemove(i)}
                aria-label={`Remove item ${i + 1}`}
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="rc-editable-list__add">
        <input
          ref={addRef}
          type="text"
          className="rc-editable-list__add-input"
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        {draft.trim() && (
          <button
            type="button"
            className="rc-editable-list__add-btn"
            onClick={handleAdd}
          >
            Add
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Recipe Composer
   ═══════════════════════════════════════════════ */

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
  const [slot, setSlot] = useState<MealSlot | "">(
    initialTemplate?.mealSlot ?? ""
  );
  const [description, setDescription] = useState(
    initialTemplate?.description ?? ""
  );
  const [servings, setServings] = useState(
    initialTemplate?.servings ? String(initialTemplate.servings) : ""
  );
  const [prepMin, setPrepMin] = useState(
    initialTemplate?.prepMinutes ? String(initialTemplate.prepMinutes) : ""
  );
  const [cookMin, setCookMin] = useState(
    initialTemplate?.cookMinutes ? String(initialTemplate.cookMinutes) : ""
  );
  const [ingredients, setIngredients] = useState<string[]>(() =>
    (initialTemplate?.ingredients ?? []).map((ing) => {
      const amount = ing.quantity ? `${ing.quantity}` : "";
      const unit = ing.unit ? ` ${ing.unit}` : "";
      return `${amount}${unit}${amount || unit ? " " : ""}${ing.name}`.trim();
    })
  );
  const [instructions, setInstructions] = useState<string[]>(
    () => initialTemplate?.instructions ?? []
  );
  const [tagText, setTagText] = useState(() =>
    (initialTemplate?.tags ?? []).join(", ")
  );
  const [notes, setNotes] = useState(initialTemplate?.notes ?? "");

  const isPending = createMutation.isPending || updateMutation.isPending;

  function parseIngredients(): MealTemplateIngredient[] {
    return ingredients
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({
        name: line,
        quantity: null,
        unit: null,
        section: null,
        note: null,
      }));
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
      instructions: instructions.filter(Boolean),
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

  return createPortal(
    <div className="mp-picker-overlay" onClick={onCancel}>
      <div
        className="mp-picker mp-picker--editor"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={mode === "edit" ? "Edit recipe" : "New recipe"}
      >
        <div className="rc-form">
          <div className="rc-form__header">
            <h4 className="rc-form__title">
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
          <div className="rc-form__body">
            <div className="rc-field">
              <label className="rc-field__label">Recipe name</label>
              <input
                type="text"
                className="rc-field__input"
                placeholder="e.g. Overnight Oats"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="rc-form__row">
              <div className="rc-field rc-field--flex">
                <label className="rc-field__label">Meal slot</label>
                <select
                  className="rc-field__select"
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
              </div>
              <div className="rc-field rc-field--flex">
                <label className="rc-field__label">Servings</label>
                <input
                  type="number"
                  className="rc-field__input"
                  placeholder="—"
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                />
              </div>
            </div>
            <div className="rc-form__row">
              <div className="rc-field rc-field--flex">
                <label className="rc-field__label">Prep (min)</label>
                <input
                  type="number"
                  className="rc-field__input"
                  placeholder="—"
                  value={prepMin}
                  onChange={(e) => setPrepMin(e.target.value)}
                />
              </div>
              <div className="rc-field rc-field--flex">
                <label className="rc-field__label">Cook (min)</label>
                <input
                  type="number"
                  className="rc-field__input"
                  placeholder="—"
                  value={cookMin}
                  onChange={(e) => setCookMin(e.target.value)}
                />
              </div>
            </div>
            <div className="rc-field">
              <label className="rc-field__label">Description</label>
              <input
                type="text"
                className="rc-field__input"
                placeholder="Short description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="rc-field">
              <label className="rc-field__label">Ingredients</label>
              <EditableList
                items={ingredients}
                onChange={setIngredients}
                placeholder="Add ingredient…"
              />
            </div>
            <div className="rc-field">
              <label className="rc-field__label">Instructions</label>
              <EditableList
                items={instructions}
                onChange={setInstructions}
                placeholder="Add step…"
              />
            </div>
            <div className="rc-field">
              <label className="rc-field__label">Tags</label>
              <input
                type="text"
                className="rc-field__input"
                placeholder="Comma separated, e.g. healthy, quick"
                value={tagText}
                onChange={(e) => setTagText(e.target.value)}
              />
            </div>
            <div className="rc-field">
              <label className="rc-field__label">Notes</label>
              <textarea
                className="rc-field__textarea"
                placeholder="Any extra notes…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <div className="rc-form__actions">
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
                ? mode === "edit"
                  ? "Saving…"
                  : "Creating…"
                : mode === "edit"
                  ? "Save recipe"
                  : "Create recipe"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
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
  const saveMutation = useSaveMealPlanWeekMutation(weekStart, {
    successMessage: "",
  });

  /* ── Draft state ── */
  const [entries, setEntries] = useState<DraftEntry[]>([]);
  const [prepSessions, setPrepSessions] = useState<DraftPrepSession[]>([]);
  const [groceryItems, setGroceryItems] = useState<MealPlanGroceryItem[]>([]);
  const [manualGroceries, setManualGroceries] = useState<DraftGroceryItem[]>(
    []
  );
  const [weekNotes, setWeekNotes] = useState("");
  const [pickerTarget, setPickerTarget] = useState<{
    date: string;
    slot: MealSlot;
  } | null>(null);
  const [editingEntryTarget, setEditingEntryTarget] = useState<{
    date: string;
    slot: MealSlot;
  } | null>(null);
  const [recipeComposerState, setRecipeComposerState] = useState<
    | { mode: "create"; target?: { date: string; slot: MealSlot } | null }
    | { mode: "edit"; template: MealTemplateItem }
    | null
  >(null);
  const hasHydratedWeekRef = useRef(false);
  const lastSavedPayloadRef = useRef<string | null>(null);
  const lastAttemptedPayloadRef = useRef<string | null>(null);

  const savePayload = useMemo(
    () =>
      buildMealPlanSavePayload({
        notes: weekNotes,
        entries,
        prepSessions,
        manualGroceries,
        groceryItems,
      }),
    [entries, groceryItems, manualGroceries, prepSessions, weekNotes]
  );
  const serializedSavePayload = useMemo(
    () => JSON.stringify(savePayload),
    [savePayload]
  );

  /* ── Drag & drop ── */
  const [activeDragTemplate, setActiveDragTemplate] =
    useState<MealTemplateItem | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  function handleDragStart(event: DragStartEvent) {
    const template = event.active.data.current?.template as
      | MealTemplateItem
      | undefined;
    if (template) setActiveDragTemplate(template);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragTemplate(null);
    const { active, over } = event;
    if (!over) return;

    const template = active.data.current?.template as
      | MealTemplateItem
      | undefined;
    const slotData = over.data.current as
      | { type: string; date: string; slot: MealSlot }
      | undefined;

    if (template && slotData?.type === "meal-slot") {
      assignTemplateToSlot(template, slotData.date, slotData.slot);
    }
  }

  function handleDragCancel() {
    setActiveDragTemplate(null);
  }

  useEffect(() => {
    hasHydratedWeekRef.current = false;
    lastSavedPayloadRef.current = null;
    lastAttemptedPayloadRef.current = null;
  }, [weekStart]);

  /* ── Hydrate draft from server ── */
  useEffect(() => {
    if (!weekQuery.data) return;
    const data = weekQuery.data;
    const nextEntries = data.entries.map((entry) => ({
      id: entry.id,
      date: entry.date,
      mealSlot: entry.mealSlot,
      mealTemplateId: entry.mealTemplateId,
      mealTemplateName: entry.mealTemplateName,
      servings: entry.servings,
      note: entry.note,
      sortOrder: entry.sortOrder,
      isLogged: entry.isLogged,
    }));
    const nextPrepSessions = data.prepSessions.map((session) => ({
      id: session.id,
      scheduledForDate: session.scheduledForDate,
      title: session.title,
      notes: session.notes,
      taskId: session.taskId,
      taskStatus: session.taskStatus,
      sortOrder: session.sortOrder,
    }));
    const nextGroceryItems = data.groceryItems;
    const nextManualGroceries = data.groceryItems
      .filter((item) => item.sourceType === "manual")
      .map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        section: item.section,
        note: item.note,
        isChecked: item.isChecked,
        sortOrder: item.sortOrder,
      }));
    const nextWeekNotes = data.notes || "";
    const hydratedPayload = buildMealPlanSavePayload({
      notes: nextWeekNotes,
      entries: nextEntries,
      prepSessions: nextPrepSessions,
      manualGroceries: nextManualGroceries,
      groceryItems: nextGroceryItems,
    });
    const hydratedSerializedPayload = JSON.stringify(hydratedPayload);
    const hasUnsavedDraft =
      hasHydratedWeekRef.current &&
      serializedSavePayload !== lastSavedPayloadRef.current;

    if (hasUnsavedDraft && hydratedSerializedPayload !== serializedSavePayload) {
      return;
    }

    setEntries(nextEntries);
    setPrepSessions(nextPrepSessions);
    setGroceryItems(nextGroceryItems);
    setManualGroceries(nextManualGroceries);
    setWeekNotes(nextWeekNotes);
    lastSavedPayloadRef.current = hydratedSerializedPayload;
    lastAttemptedPayloadRef.current = lastSavedPayloadRef.current;
    hasHydratedWeekRef.current = true;
  }, [serializedSavePayload, weekQuery.data]);

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
    () =>
      [
        ...(weekQuery.data?.mealTemplates || []),
        ...(templatesQuery.data?.mealTemplates || []),
      ].filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i),
    [weekQuery.data?.mealTemplates, templatesQuery.data?.mealTemplates]
  );
  /* ── Actions ── */

  function assignTemplateToSlot(
    template: MealTemplateItem,
    date: string,
    slot: MealSlot
  ) {
    setEntries((prev) => {
      const existing = prev.find(
        (entry) => entry.date === date && entry.mealSlot === slot
      );
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
  }

  function handleEditEntry(date: string, slot: MealSlot) {
    setEditingEntryTarget({ date, slot });
  }

  function handleUpdateEntry(updates: {
    servings: number | null;
    note: string | null;
  }) {
    if (!editingEntryTarget) return;
    setEntries((prev) =>
      prev.map((entry) =>
        entry.date === editingEntryTarget.date &&
        entry.mealSlot === editingEntryTarget.slot
          ? { ...entry, servings: updates.servings, note: updates.note }
          : entry
      )
    );
    setEditingEntryTarget(null);
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
  }

  function handleRemovePrep(index: number) {
    setPrepSessions((prev) => prev.filter((_, i) => i !== index));
  }

  function handleToggleGrocery(id: string) {
    setGroceryItems((prev) =>
      prev.map((g) => (g.id === id ? { ...g, isChecked: !g.isChecked } : g))
    );
    setManualGroceries((prev) =>
      prev.map((g) => (g.id === id ? { ...g, isChecked: !g.isChecked } : g))
    );
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
  }

  function handleRemoveManualGrocery(id: string) {
    setManualGroceries((prev) => prev.filter((g) => g.id !== id));
    setGroceryItems((prev) => prev.filter((g) => g.id !== id));
  }

  function handleNotesChange(value: string) {
    setWeekNotes(value);
  }

  /* ── Week navigation ── */

  function saveCurrentDraftBeforeNavigation(nextWeekStart: string) {
    if (nextWeekStart === weekStart) {
      return;
    }

    if (
      !hasHydratedWeekRef.current ||
      serializedSavePayload === lastSavedPayloadRef.current
    ) {
      setWeekStart(nextWeekStart);
      return;
    }

    if (saveMutation.isPending) {
      return;
    }

    const payloadSnapshot = serializedSavePayload;
    lastAttemptedPayloadRef.current = payloadSnapshot;

    void saveMutation
      .mutateAsync(savePayload)
      .then(() => {
        lastSavedPayloadRef.current = payloadSnapshot;
        setWeekStart(nextWeekStart);
      })
      .catch(() => {
        lastAttemptedPayloadRef.current = lastSavedPayloadRef.current;
      });
  }

  function goToPreviousWeek() {
    saveCurrentDraftBeforeNavigation(shiftWeek(weekStart, -1));
  }
  function goToNextWeek() {
    saveCurrentDraftBeforeNavigation(shiftWeek(weekStart, 1));
  }
  function goToCurrentWeek() {
    saveCurrentDraftBeforeNavigation(getWeekStartDate(today));
  }

  const isCurrentWeek = weekStart === getWeekStartDate(today);

  /* ── Computed ── */
  const summary = weekQuery.data?.summary;
  const mealCount = entries.length;
  const prepCount = prepSessions.length;
  const groceryCount = groceryItems.length;
  const editingEntry = editingEntryTarget
    ? entryMap.get(
        `${editingEntryTarget.date}:${editingEntryTarget.slot}`
      )
    : undefined;
  const isDragActive = activeDragTemplate !== null;

  useEffect(() => {
    const className = "mp-dragging-cursor";
    document.body.classList.toggle(className, isDragActive);

    return () => {
      document.body.classList.remove(className);
    };
  }, [isDragActive]);

  useEffect(() => {
    if (!hasHydratedWeekRef.current) {
      return;
    }

    if (serializedSavePayload === lastSavedPayloadRef.current) {
      lastAttemptedPayloadRef.current = serializedSavePayload;
      return;
    }

    if (
      saveMutation.isPending ||
      serializedSavePayload === lastAttemptedPayloadRef.current
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const payloadSnapshot = serializedSavePayload;
      lastAttemptedPayloadRef.current = payloadSnapshot;

      void saveMutation
        .mutateAsync(savePayload)
        .then(() => {
          lastSavedPayloadRef.current = payloadSnapshot;
        })
        .catch(() => {
          lastAttemptedPayloadRef.current = lastSavedPayloadRef.current;
        });
    }, MEAL_PLAN_AUTOSAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [saveMutation, saveMutation.isPending, savePayload, serializedSavePayload]);

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
        <PageLoadingState
          title="Meal planner could not load"
          description="There was an issue loading your meal plan. Please try again."
        />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
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
            <div className="mp-header__meta">
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
                        {Math.round(
                          (summary.loggedPlannedMeals /
                            summary.totalPlannedMeals) *
                            100
                        )}
                        %
                      </span>
                      <span className="mp-header__stat-label">executed</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* ── Weekly Calendar (full width) ── */}
        <section
          className={`mp-calendar${isDragActive ? " mp-calendar--drag-active" : ""}`}
          aria-label="Weekly meal plan"
        >
          <div className="mp-board__grid">
            {weekDates.map((date) => (
              <DayColumn
                key={date}
                date={date}
                isToday={date === today}
                entries={getEntriesForDay(date)}
                isDragActive={isDragActive}
                onAssign={handleAssignSlot}
                onEdit={handleEditEntry}
                onRemove={handleRemoveEntry}
              />
            ))}
          </div>
        </section>

        {/* ── Recipe Library Bar ── */}
        <RecipeLibraryBar
          templates={templates}
          isDragActive={isDragActive}
          onCreateRecipe={() =>
            setRecipeComposerState({ mode: "create" })
          }
          onEditRecipe={(template) =>
            setRecipeComposerState({ mode: "edit", template })
          }
        />

        {/* ── Bottom Panels ── */}
        <div className="mp-bottom-panels">
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
          <WeekNotesPanel notes={weekNotes} onChange={handleNotesChange} />
        </div>

        {/* ── Overlays ── */}
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
            initialTemplate={
              recipeComposerState.mode === "edit"
                ? recipeComposerState.template
                : undefined
            }
            onSaved={(template) => {
              void templatesQuery.refetch();
              if (
                recipeComposerState.mode === "create" &&
                recipeComposerState.target
              ) {
                assignTemplateToSlot(
                  template,
                  recipeComposerState.target.date,
                  recipeComposerState.target.slot
                );
              }
              setRecipeComposerState(null);
            }}
            onCancel={() => setRecipeComposerState(null)}
          />
        )}
      </div>

      {createPortal(
        <DragOverlay
          dropAnimation={null}
          modifiers={[snapRecipeOverlayToCursor]}
        >
          {activeDragTemplate ? (
            <RecipeDragOverlay template={activeDragTemplate} />
          ) : null}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  );
}
