import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";

import {
  getTodayDate,
  getWeekStartDate,
  getWeekEndDate,
  useMealPlanWeekQuery,
  useMealTemplatesQuery,
  useSaveMealPlanWeekMutation,
} from "../../shared/lib/api";
import type {
  MealPlanGroceryItem,
  MealTemplateItem,
} from "../../shared/lib/api";
import {
  PageLoadingState,
} from "../../shared/ui/PageState";
import { HealthSubNav } from "./HealthSubNav";
import {
  MEAL_PLAN_AUTOSAVE_DELAY_MS,
  MEAL_SLOTS,
  buildIngredientText,
  buildMealPlanSavePayload,
  formatWeekRange,
  getWeekDates,
  shiftWeek,
  type DraftEntry,
  type DraftGroceryItem,
  type DraftPrepSession,
  type MealSlot,
} from "./meal-planner-model";
import {
  RecipeDragOverlay,
  RecipeLibraryBar,
  snapRecipeOverlayToCursor,
} from "./meal-planner-recipe-library";
import {
  RecipeComposer,
} from "./meal-planner-recipe-composer";
import {
  PlannedEntryEditor,
  TemplatePicker,
} from "./meal-planner-slot-dialogs";
import {
  GroceryPanel,
  PrepPanel,
  WeekNotesPanel,
} from "./meal-planner-week-panels";
import { DayColumn } from "./meal-planner-week-grid";

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
    }),
    useSensor(KeyboardSensor)
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
