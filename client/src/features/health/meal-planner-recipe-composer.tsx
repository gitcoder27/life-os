import { useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  formatMealSlotLabel,
  useCreateMealTemplateMutation,
  useUpdateMealTemplateMutation,
} from "../../shared/lib/api";
import type {
  MealTemplateIngredient,
  MealTemplateItem,
} from "../../shared/lib/api";
import { useDialogAccessibility } from "../../shared/ui/DialogSurface";
import {
  MEAL_SLOTS,
  type MealSlot,
} from "./meal-planner-model";
import { EditableList } from "./meal-planner-editable-list";

export function RecipeComposer({
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialTemplate?.name ?? "");
  const [slot, setSlot] = useState<MealSlot | "">(
    initialTemplate?.mealSlot ?? "",
  );
  const [description, setDescription] = useState(
    initialTemplate?.description ?? "",
  );
  const [servings, setServings] = useState(
    initialTemplate?.servings ? String(initialTemplate.servings) : "",
  );
  const [prepMin, setPrepMin] = useState(
    initialTemplate?.prepMinutes ? String(initialTemplate.prepMinutes) : "",
  );
  const [cookMin, setCookMin] = useState(
    initialTemplate?.cookMinutes ? String(initialTemplate.cookMinutes) : "",
  );
  const [ingredients, setIngredients] = useState<string[]>(() =>
    (initialTemplate?.ingredients ?? []).map((ingredient) => {
      const amount = ingredient.quantity ? `${ingredient.quantity}` : "";
      const unit = ingredient.unit ? ` ${ingredient.unit}` : "";
      return `${amount}${unit}${amount || unit ? " " : ""}${ingredient.name}`.trim();
    }),
  );
  const [instructions, setInstructions] = useState<string[]>(
    () => initialTemplate?.instructions ?? [],
  );
  const [tagText, setTagText] = useState(() =>
    (initialTemplate?.tags ?? []).join(", "),
  );
  const [notes, setNotes] = useState(initialTemplate?.notes ?? "");

  const isPending = createMutation.isPending || updateMutation.isPending;

  useDialogAccessibility({
    open: true,
    onClose: onCancel,
    dialogRef,
    initialFocusRef: nameInputRef,
  });

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
        ref={dialogRef}
        className="mp-picker mp-picker--editor"
        onClick={(event) => event.stopPropagation()}
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
                ref={nameInputRef}
                type="text"
                className="rc-field__input"
                placeholder="e.g. Overnight Oats"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="rc-form__row">
              <div className="rc-field rc-field--flex">
                <label className="rc-field__label">Meal slot</label>
                <select
                  className="rc-field__select"
                  value={slot}
                  onChange={(event) => setSlot(event.target.value as MealSlot | "")}
                >
                  <option value="">Any slot</option>
                  {MEAL_SLOTS.map((mealSlot) => (
                    <option key={mealSlot} value={mealSlot}>
                      {formatMealSlotLabel(mealSlot)}
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
                  onChange={(event) => setServings(event.target.value)}
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
                  onChange={(event) => setPrepMin(event.target.value)}
                />
              </div>
              <div className="rc-field rc-field--flex">
                <label className="rc-field__label">Cook (min)</label>
                <input
                  type="number"
                  className="rc-field__input"
                  placeholder="—"
                  value={cookMin}
                  onChange={(event) => setCookMin(event.target.value)}
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
                onChange={(event) => setDescription(event.target.value)}
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
                onChange={(event) => setTagText(event.target.value)}
              />
            </div>
            <div className="rc-field">
              <label className="rc-field__label">Notes</label>
              <textarea
                className="rc-field__textarea"
                placeholder="Any extra notes…"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
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
    document.body,
  );
}
