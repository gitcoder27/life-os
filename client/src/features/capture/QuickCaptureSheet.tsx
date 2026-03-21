import { useCallback, useEffect, useRef, useState } from "react";

import {
  formatMealSlotLabel,
  getTodayDate,
  toIsoDate,
  parseAmountToMinor,
  parseNumberValue,
  useAddMealMutation,
  useAddWaterMutation,
  useAddWeightMutation,
  useCreateExpenseMutation,
  useCreateTaskMutation,
  useFinanceDataQuery,
  useMealTemplatesQuery,
  useWorkoutMutation,
} from "../../shared/lib/api";
import { type RecurrenceRuleInput } from "../../shared/lib/recurrence";
import { stringifyQuickCaptureNotes } from "../../shared/lib/quickCapture";
import { RecurrenceToggle, buildRecurrenceInput } from "../../shared/ui/RecurrenceEditor";

const LAST_EXPENSE_CATEGORY_KEY = "lifeos_last_expense_category";

const captureTypes = [
  "Task",
  "Expense",
  "Water",
  "Meal",
  "Workout",
  "Weight",
  "Note",
  "Reminder",
] as const;

function getTomorrowDate(isoDate: string) {
  const tomorrow = new Date(`${isoDate}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toIsoDate(tomorrow);
}

type CaptureType = (typeof captureTypes)[number];

type QuickCaptureSheetProps = {
  open: boolean;
  onClose: () => void;
};

export function QuickCaptureSheet({
  open,
  onClose,
}: QuickCaptureSheetProps) {
  const today = getTodayDate();
  const defaultReminderDate = getTomorrowDate(today);
  const [activeType, setActiveType] = useState<CaptureType>("Task");
  const [textValue, setTextValue] = useState("");
  const [descriptionValue, setDescriptionValue] = useState("");
  const [amountValue, setAmountValue] = useState("");
  const [detailValue, setDetailValue] = useState("");
  const [categoryId, setCategoryId] = useState(() => {
    try { return localStorage.getItem(LAST_EXPENSE_CATEGORY_KEY) ?? ""; } catch { return ""; }
  });
  const [weightValue, setWeightValue] = useState("");
  const [weightUnit, setWeightUnit] = useState("kg");
  const [mealMode, setMealMode] = useState<"template" | "freeform">("template");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [mealSlot, setMealSlot] = useState<"breakfast" | "lunch" | "dinner" | "snack">("breakfast");
  const [workoutStatus, setWorkoutStatus] = useState<"completed" | "recovery_respected">("completed");
  const [reminderDate, setReminderDate] = useState(defaultReminderDate);
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRuleInput | null>(null);

  const panelRef = useRef<HTMLElement>(null);
  const firstInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const createTaskMutation = useCreateTaskMutation(today);
  const createExpenseMutation = useCreateExpenseMutation(today);
  const addWaterMutation = useAddWaterMutation(today);
  const addMealMutation = useAddMealMutation(today);
  const workoutMutation = useWorkoutMutation(today);
  const addWeightMutation = useAddWeightMutation(today);

  // Smart defaults: load categories and meal templates
  const financeQuery = useFinanceDataQuery(today);
  const templatesQuery = useMealTemplatesQuery();
  const categories = financeQuery.data?.categories?.categories?.filter((c) => !c.archivedAt) ?? [];
  const mealTemplates = templatesQuery.data?.mealTemplates ?? [];

  // Initialize selected template when templates load
  useEffect(() => {
    if (mealTemplates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(mealTemplates[0].id);
    }
  }, [mealTemplates, selectedTemplateId]);

  // Focus management: focus first input when sheet opens
  useEffect(() => {
    if (open) {
      if (activeType === "Reminder") {
        setReminderDate((current) => current || defaultReminderDate);
      }

      requestAnimationFrame(() => {
        firstInputRef.current?.focus();
      });
    }
  }, [open, activeType]);

  // Keyboard: Escape to close
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }, [open, onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  function resetAndClose() {
    setTextValue("");
    setDescriptionValue("");
    setAmountValue("");
    setDetailValue("");
    setWeightValue("");
    setReminderDate(defaultReminderDate);
    setRecurrenceEnabled(false);
    setRecurrenceRule(null);
    onClose();
  }

  async function saveWater(amountMl: number) {
    await addWaterMutation.mutateAsync(amountMl);
    resetAndClose();
  }

  async function handleSave() {
    if (activeType === "Task") {
      const title = textValue.trim();
      if (!title) return;

      await createTaskMutation.mutateAsync({
        title: title.split("\n")[0],
        notes: title,
        scheduledForDate: today,
        originType: "quick_capture",
      });
      resetAndClose();
      return;
    }

    if (activeType === "Expense") {
      const amountMinor = parseAmountToMinor(amountValue);
      if (!amountMinor) return;

      // Remember last category
      if (categoryId) {
        try { localStorage.setItem(LAST_EXPENSE_CATEGORY_KEY, categoryId); } catch { /* ignore */ }
      }

      await createExpenseMutation.mutateAsync({
        spentOn: today,
        amountMinor,
        description: descriptionValue || "Quick expense",
        expenseCategoryId: categoryId || undefined,
        source: "quick_capture",
      });
      resetAndClose();
      return;
    }

    if (activeType === "Note" || activeType === "Reminder") {
      const title = textValue.trim();
      if (!title) return;

      if (activeType === "Reminder" && !reminderDate) {
        return;
      }

      await createTaskMutation.mutateAsync({
        title: title.split("\n")[0].trim() || (activeType === "Reminder" ? "Reminder" : "Note"),
        notes: stringifyQuickCaptureNotes({
          kind: activeType === "Reminder" ? "reminder" : "note",
          text: title,
          reminderDate: activeType === "Reminder" ? reminderDate : undefined,
        }),
        scheduledForDate: activeType === "Reminder" ? reminderDate : today,
        originType: "quick_capture",
        recurrence: recurrenceEnabled && recurrenceRule ? buildRecurrenceInput(recurrenceRule) : undefined,
      });
      resetAndClose();
      return;
    }

    if (activeType === "Meal") {
      if (mealMode === "template" && mealTemplates.length > 0) {
        const t = mealTemplates.find((tpl) => tpl.id === selectedTemplateId);
        if (!t) return;
        await addMealMutation.mutateAsync({
          description: t.name,
          mealSlot: t.mealSlot ?? undefined,
          mealTemplateId: t.id,
          loggingQuality: "meaningful",
        });
      } else {
        if (!detailValue.trim()) return;
        await addMealMutation.mutateAsync({
          description: detailValue.trim(),
          mealSlot,
          loggingQuality: "partial",
        });
      }
      resetAndClose();
      return;
    }

    if (activeType === "Workout") {
      await workoutMutation.mutateAsync({
        planType: workoutStatus === "completed" ? "workout" : "recovery",
        plannedLabel: workoutStatus === "completed" ? (detailValue.trim() || "Workout") : "Recovery",
        actualStatus: workoutStatus,
      });
      resetAndClose();
      return;
    }

    if (activeType === "Weight") {
      const parsed = parseNumberValue(weightValue);
      if (!parsed) return;
      await addWeightMutation.mutateAsync({
        weightValue: parsed,
        unit: weightUnit,
        measuredOn: today,
      });
      resetAndClose();
    }
  }

  // Ctrl+Enter / Cmd+Enter to submit from anywhere in the sheet
  function handleFormKeyDown(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSave();
    }
  }

  const typeHints: Partial<Record<CaptureType, string>> = {
    Note: "Saved as a day note, separate from executable tasks.",
    Reminder: "Saved as a reminder note with a due date.",
  };

  return (
    <div
      aria-hidden={!open}
      className={`capture-sheet${open ? " capture-sheet--open" : ""}`}
    >
      <div
        className="capture-sheet__backdrop"
        onClick={onClose}
      />
      <section className="capture-sheet__panel" ref={panelRef} onKeyDown={handleFormKeyDown}>
        <div className="capture-sheet__header">
          <div>
            <p className="page-eyebrow">Quick entry</p>
            <h3 className="capture-sheet__title">Capture</h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span className="kbd-hint"><span className="kbd">Esc</span> close</span>
            <button
              className="button button--ghost button--small"
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          </div>
        </div>

        <div className="capture-grid">
          {captureTypes.map((item) => (
            <button
              key={item}
              className={`capture-chip${item === activeType ? " capture-chip--active" : ""}`}
              type="button"
              onClick={() => setActiveType(item)}
            >
              {item}
            </button>
          ))}
        </div>

        {typeHints[activeType] && (
          <p className="capture-type-hint">{typeHints[activeType]}</p>
        )}

        <div className="stack-form">
          {activeType === "Expense" && (
            <>
              <label className="field">
                <span>Amount</span>
                <input
                  ref={(el) => { firstInputRef.current = el; }}
                  placeholder="$0.00"
                  type="text"
                  inputMode="decimal"
                  value={amountValue}
                  onChange={(event) => setAmountValue(event.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleSave(); }}
                />
              </label>
              <label className="field">
                <span>Description</span>
                <input
                  placeholder="What was it for?"
                  type="text"
                  value={descriptionValue}
                  onChange={(event) => setDescriptionValue(event.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleSave(); }}
                />
              </label>
              {categories.length > 0 && (
                <label className="field">
                  <span>Category</span>
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                    <option value="">Uncategorized</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}

          {activeType === "Water" && (
            <div className="button-row">
              <button className="button button--ghost" type="button" onClick={() => void saveWater(250)}>+250ml</button>
              <button className="button button--ghost" type="button" onClick={() => void saveWater(500)}>+500ml</button>
              <button className="button button--primary" type="button" onClick={() => void saveWater(1000)}>+1L</button>
            </div>
          )}

          {(activeType === "Task" || activeType === "Note" || activeType === "Reminder") && (
            <label className="field">
              <span>{activeType === "Note" ? "Note" : activeType === "Reminder" ? "Reminder" : "Task"}</span>
              <textarea
                ref={(el) => { firstInputRef.current = el; }}
                placeholder={activeType === "Note" ? "What do you want to remember?" : activeType === "Reminder" ? "What should you be reminded about?" : "Quick task..."}
                rows={3}
                value={textValue}
                onChange={(event) => setTextValue(event.target.value)}
              />
            </label>
          )}

          {activeType === "Reminder" && (
            <label className="field">
              <span>Reminder date</span>
              <input
                type="date"
                value={reminderDate}
                min={today}
                onChange={(event) => setReminderDate(event.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleSave(); }}
              />
            </label>
          )}

          {(activeType === "Note" || activeType === "Reminder") && (
            <RecurrenceToggle
              enabled={recurrenceEnabled}
              onToggle={setRecurrenceEnabled}
              rule={recurrenceRule}
              onRuleChange={setRecurrenceRule}
              context="reminder"
              startsOn={activeType === "Reminder" ? reminderDate : today}
            />
          )}

          {activeType === "Meal" && (
            <>
              {mealTemplates.length > 0 && (
                <div className="meal-mode-toggle">
                  <button type="button" className={`meal-mode-toggle__btn${mealMode === "template" ? " meal-mode-toggle__btn--active" : ""}`} onClick={() => setMealMode("template")}>From template</button>
                  <button type="button" className={`meal-mode-toggle__btn${mealMode === "freeform" ? " meal-mode-toggle__btn--active" : ""}`} onClick={() => setMealMode("freeform")}>Freeform</button>
                </div>
              )}
              {mealMode === "template" && mealTemplates.length > 0 ? (
                <label className="field">
                  <span>Template</span>
                  <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
                    {mealTemplates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} — {formatMealSlotLabel(t.mealSlot)}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <>
                  <label className="field">
                    <span>Description</span>
                    <input
                      ref={(el) => { firstInputRef.current = el; }}
                      placeholder="What did you eat?"
                      type="text"
                      value={detailValue}
                      onChange={(event) => setDetailValue(event.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void handleSave(); }}
                    />
                  </label>
                  <label className="field">
                    <span>Meal slot</span>
                    <select value={mealSlot} onChange={(e) => setMealSlot(e.target.value as typeof mealSlot)}>
                      <option value="breakfast">Breakfast</option>
                      <option value="lunch">Lunch</option>
                      <option value="dinner">Dinner</option>
                      <option value="snack">Snack</option>
                    </select>
                  </label>
                </>
              )}
            </>
          )}

          {activeType === "Workout" && (
            <>
              <div className="segmented-control" style={{ alignSelf: "flex-start" }}>
                <button type="button" className={`segmented-control__option${workoutStatus === "completed" ? " segmented-control__option--active" : ""}`} onClick={() => setWorkoutStatus("completed")}>Completed</button>
                <button type="button" className={`segmented-control__option${workoutStatus === "recovery_respected" ? " segmented-control__option--active" : ""}`} onClick={() => setWorkoutStatus("recovery_respected")}>Rest day</button>
              </div>
              {workoutStatus === "completed" && (
                <label className="field">
                  <span>Label (optional)</span>
                  <input
                    ref={(el) => { firstInputRef.current = el; }}
                    placeholder="e.g. Upper body, Run"
                    type="text"
                    value={detailValue}
                    onChange={(event) => setDetailValue(event.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void handleSave(); }}
                  />
                </label>
              )}
            </>
          )}

          {activeType === "Weight" && (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
              <label className="field" style={{ flex: 1 }}>
                <span>Weight</span>
                <input
                  ref={(el) => { firstInputRef.current = el; }}
                  type="number"
                  step="0.1"
                  min="0"
                  inputMode="decimal"
                  placeholder="0.0"
                  value={weightValue}
                  onChange={(event) => setWeightValue(event.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleSave(); }}
                />
              </label>
              <label className="field" style={{ width: "5rem" }}>
                <span>Unit</span>
                <select value={weightUnit} onChange={(e) => setWeightUnit(e.target.value)}>
                  <option value="kg">kg</option>
                  <option value="lb">lb</option>
                </select>
              </label>
            </div>
          )}

          {activeType !== "Water" && (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <button
                className="button button--primary"
                type="button"
                style={{ flex: 1 }}
                onClick={() => void handleSave()}
              >
                Save {activeType.toLowerCase()}
              </button>
              <span className="kbd-hint"><span className="kbd">⌘</span><span className="kbd">↵</span></span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
