import { useMemo, useState } from "react";
import {
  type Modifier,
  useDraggable,
} from "@dnd-kit/core";

import {
  formatMealSlotLabel,
} from "../../shared/lib/api";
import type { MealTemplateItem } from "../../shared/lib/api";
import {
  CATEGORIES,
  SLOT_ICONS,
  type MealSlot,
} from "./meal-planner-model";

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

export function RecipeDragOverlay({ template }: { template: MealTemplateItem }) {
  return (
    <div className="mp-drag-overlay">
      <span className="mp-drag-overlay__icon">
        {template.mealSlot ? SLOT_ICONS[template.mealSlot as MealSlot] : "\u2726"}
      </span>
      <span className="mp-drag-overlay__name">{template.name}</span>
    </div>
  );
}

export const snapRecipeOverlayToCursor: Modifier = ({
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

export function RecipeLibraryBar({
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
        (template) => (template.mealSlot || "other") === activeCategory,
      );
    }
    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter(
        (template) =>
          template.name.toLowerCase().includes(query) ||
          (template.tags && template.tags.some((tag) => tag.toLowerCase().includes(query))),
      );
    }
    return result;
  }, [templates, activeCategory, search]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: templates.length };
    for (const category of CATEGORIES) {
      counts[category.key] = templates.filter(
        (template) => template.mealSlot === category.key,
      ).length;
    }
    counts.other = templates.filter((template) => !template.mealSlot).length;
    return counts;
  }, [templates]);

  const selected = templates.find((template) => template.id === selectedId);

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
            {CATEGORIES.map((category) => (
              <button
                key={category.key}
                type="button"
                className={`mp-library__pill${activeCategory === category.key ? " mp-library__pill--active" : ""}`}
                onClick={() => setActiveCategory(category.key)}
              >
                <span className="mp-library__pill-icon">
                  {SLOT_ICONS[category.key]}
                </span>
                {category.label}
                {categoryCounts[category.key] > 0 && (
                  <span className="mp-library__pill-count">
                    {categoryCounts[category.key]}
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
              onChange={(event) => setSearch(event.target.value)}
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
                {filtered.map((template) => (
                  <DraggableRecipeCard
                    key={template.id}
                    template={template}
                    isSelected={selectedId === template.id}
                    onSelect={() =>
                      setSelectedId(selectedId === template.id ? null : template.id)
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
                      {selected.ingredients.map((ingredient, index) => (
                        <li key={index}>
                          {ingredient.quantity ? `${ingredient.quantity}` : ""}
                          {ingredient.unit ? ` ${ingredient.unit}` : ""}{" "}
                          {ingredient.name}
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
                      {selected.instructions.map((step, index) => (
                        <li key={index}>{step}</li>
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
