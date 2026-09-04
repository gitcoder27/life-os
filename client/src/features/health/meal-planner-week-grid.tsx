import { useDroppable } from "@dnd-kit/core";

import {
  formatMealSlotLabel,
  formatShortDate,
} from "../../shared/lib/api";
import {
  MEAL_SLOTS,
  SLOT_ICONS,
  formatDayLabel,
  formatDayNumber,
  type DraftEntry,
  type MealSlot,
} from "./meal-planner-model";

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
    <button
      type="button"
      ref={setNodeRef}
      className={`mp-slot mp-slot--empty${isToday ? " mp-slot--today" : ""}${isDragActive ? " mp-slot--drop-ready" : ""}${isOver ? " mp-slot--drop-over" : ""}`}
      onClick={() => onAssign(date, slot)}
      aria-label={`Assign ${formatMealSlotLabel(slot)} for ${formatShortDate(date)}`}
    >
      {isOver ? (
        <span className="mp-slot__drop-label">Drop here</span>
      ) : isDragActive ? (
        <span className="mp-slot__drop-label">{formatMealSlotLabel(slot)}</span>
      ) : (
        <span className="mp-slot__add">+</span>
      )}
    </button>
  );
}

export function DayColumn({
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
