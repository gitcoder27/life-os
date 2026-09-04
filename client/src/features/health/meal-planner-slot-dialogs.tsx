import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  formatMealSlotLabel,
} from "../../shared/lib/api";
import type { MealTemplateItem } from "../../shared/lib/api";
import { useDialogAccessibility } from "../../shared/ui/DialogSurface";
import type { DraftEntry } from "./meal-planner-model";

export function TemplatePicker({
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
  const dialogRef = useRef<HTMLDivElement>(null);

  useDialogAccessibility({
    open: true,
    onClose,
    dialogRef,
    initialFocusRef: inputRef,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return templates;
    const query = search.toLowerCase();
    return templates.filter(
      (template) =>
        template.name.toLowerCase().includes(query) ||
        (template.tags && template.tags.some((tag) => tag.toLowerCase().includes(query))),
    );
  }, [templates, search]);

  return createPortal(
    <div className="mp-picker-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="mp-picker"
        onClick={(event) => event.stopPropagation()}
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
            onChange={(event) => setSearch(event.target.value)}
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
            filtered.map((template) => (
              <button
                key={template.id}
                type="button"
                className="mp-picker__item"
                onClick={() => onSelect(template)}
              >
                <span className="mp-picker__item-name">{template.name}</span>
                <span className="mp-picker__item-meta">
                  {template.mealSlot ? formatMealSlotLabel(template.mealSlot) : "Any slot"}
                  {template.prepMinutes || template.cookMinutes ? (
                    <span className="mp-picker__item-time">
                      {template.prepMinutes ? `${template.prepMinutes}m prep` : ""}
                      {template.prepMinutes && template.cookMinutes ? " + " : ""}
                      {template.cookMinutes ? `${template.cookMinutes}m cook` : ""}
                    </span>
                  ) : null}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function PlannedEntryEditor({
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
    entry.servings ? String(entry.servings) : "",
  );
  const [note, setNote] = useState(entry.note ?? "");
  const dialogRef = useRef<HTMLDivElement>(null);
  const servingsInputRef = useRef<HTMLInputElement>(null);

  useDialogAccessibility({
    open: true,
    onClose,
    dialogRef,
    initialFocusRef: servingsInputRef,
  });

  return createPortal(
    <div className="mp-picker-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="mp-picker mp-picker--editor"
        onClick={(event) => event.stopPropagation()}
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
              ref={servingsInputRef}
              type="number"
              className="mp-input"
              placeholder="Servings"
              value={servings}
              onChange={(event) => setServings(event.target.value)}
            />
            <textarea
              className="mp-textarea mp-textarea--compact"
              placeholder="Slot note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
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
    document.body,
  );
}
