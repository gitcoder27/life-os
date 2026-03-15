import { useState } from "react";

import {
  formatMealSlotLabel,
  formatWorkoutStatus,
  getTodayDate,
  parseNumberValue,
  useAddMealMutation,
  useAddWaterMutation,
  useAddWeightMutation,
  useCreateMealTemplateMutation,
  useDeleteMealLogMutation,
  useDeleteWaterLogMutation,
  useDeleteWeightLogMutation,
  useHealthDataQuery,
  useMealTemplatesQuery,
  useUpdateMealLogMutation,
  useUpdateMealTemplateMutation,
  useUpdateWaterLogMutation,
  useUpdateWeightLogMutation,
  useWorkoutMutation,
} from "../../shared/lib/api";
import { PageHeader } from "../../shared/ui/PageHeader";
import {
  EmptyState,
  InlineErrorState,
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";
import { SectionCard } from "../../shared/ui/SectionCard";

type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

const mealSlotOptions: { value: MealSlot; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

type TemplateFormState = {
  name: string;
  mealSlot: MealSlot;
  description: string;
};

const emptyTemplateForm: TemplateFormState = {
  name: "",
  mealSlot: "breakfast",
  description: "",
};

function MealTemplateManager() {
  const templatesQuery = useMealTemplatesQuery();
  const createMutation = useCreateMealTemplateMutation();
  const updateMutation = useUpdateMealTemplateMutation();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateFormState>(emptyTemplateForm);

  const templates = templatesQuery.data?.mealTemplates ?? [];

  function openCreate() {
    setEditingId(null);
    setForm(emptyTemplateForm);
    setShowForm(true);
  }

  function openEdit(template: {
    id: string;
    name: string;
    mealSlot: string | null;
    description: string | null;
  }) {
    setEditingId(template.id);
    setForm({
      name: template.name,
      mealSlot: (template.mealSlot as MealSlot) || "breakfast",
      description: template.description ?? "",
    });
    setShowForm(true);
  }

  function handleCancel() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyTemplateForm);
  }

  async function handleSubmit() {
    if (!form.name.trim()) return;

    if (editingId) {
      await updateMutation.mutateAsync({
        mealTemplateId: editingId,
        name: form.name.trim(),
        mealSlot: form.mealSlot,
        description: form.description.trim() || null,
      });
    } else {
      await createMutation.mutateAsync({
        name: form.name.trim(),
        mealSlot: form.mealSlot,
        description: form.description.trim() || undefined,
      });
    }
    handleCancel();
  }

  async function handleArchive(templateId: string) {
    await updateMutation.mutateAsync({
      mealTemplateId: templateId,
      archived: true,
    });
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (templatesQuery.isLoading && !templatesQuery.data) {
    return null;
  }

  return (
    <SectionCard
      title="Meal templates"
      subtitle={`${templates.length} active template${templates.length !== 1 ? "s" : ""}`}
    >
      {showForm && (
        <div className="stack-form" style={{ marginBottom: "0.75rem" }}>
          <label className="field">
            <span>Name</span>
            <input
              type="text"
              value={form.name}
              placeholder="e.g. Morning oats"
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>Meal slot</span>
            <select
              value={form.mealSlot}
              onChange={(e) =>
                setForm((f) => ({ ...f, mealSlot: e.target.value as MealSlot }))
              }
            >
              {mealSlotOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Description (optional)</span>
            <input
              type="text"
              value={form.description}
              placeholder="Brief description"
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </label>
          <div className="button-row button-row--tight">
            <button
              className="button button--primary button--small"
              type="button"
              disabled={!form.name.trim() || isSaving}
              onClick={() => void handleSubmit()}
            >
              {isSaving ? "Saving…" : editingId ? "Update" : "Create"}
            </button>
            <button
              className="button button--ghost button--small"
              type="button"
              onClick={handleCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {templates.length > 0 ? (
        <div className="template-grid">
          {templates.map((t) => (
            <div key={t.id} className="template-card">
              <div className="template-card__name">{t.name}</div>
              <div className="template-card__slot">
                {formatMealSlotLabel(t.mealSlot)}
              </div>
              {t.description && (
                <div className="template-card__desc">{t.description}</div>
              )}
              <div className="button-row button-row--tight" style={{ marginTop: "0.25rem" }}>
                <button
                  className="button button--ghost button--small"
                  type="button"
                  onClick={() => openEdit(t)}
                >
                  Edit
                </button>
                <button
                  className="button button--ghost button--small"
                  type="button"
                  disabled={updateMutation.isPending}
                  onClick={() => void handleArchive(t.id)}
                >
                  Archive
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No meal templates"
          description="Create templates for your regular meals to make logging faster."
        />
      )}

      {!showForm && (
        <button
          className="button button--ghost button--small"
          type="button"
          style={{ marginTop: "0.5rem" }}
          onClick={openCreate}
        >
          + New template
        </button>
      )}
    </SectionCard>
  );
}

/* ── Inline weight entry form ── */
function WeightEntryForm({
  defaultUnit,
  onSave,
  onCancel,
  isPending,
}: {
  defaultUnit: string;
  onSave: (value: number, unit: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState(defaultUnit);

  function handleSubmit() {
    const parsed = parseNumberValue(value);
    if (parsed) onSave(parsed, unit);
  }

  return (
    <div className="inline-editor">
      <div className="stack-form">
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
          <label className="field" style={{ flex: 1 }}>
            <span>Weight</span>
            <input
              type="number"
              step="0.1"
              min="0"
              placeholder="0.0"
              value={value}
              autoFocus
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") onCancel(); }}
            />
          </label>
          <label className="field" style={{ width: "5rem" }}>
            <span>Unit</span>
            <select value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="kg">kg</option>
              <option value="lb">lb</option>
            </select>
          </label>
        </div>
        <div className="button-row button-row--tight">
          <button className="button button--primary button--small" type="button" disabled={!value.trim() || isPending} onClick={handleSubmit}>
            {isPending ? "Saving…" : "Log weight"}
          </button>
          <button className="button button--ghost button--small" type="button" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ── Inline meal-log form (template or freeform) ── */
function MealLogForm({
  templates,
  onSave,
  onCancel,
  isPending,
}: {
  templates: Array<{ id: string; name: string; mealSlot: MealSlot | null; description: string | null }>;
  onSave: (payload: { description: string; mealSlot?: MealSlot; mealTemplateId?: string; loggingQuality: "partial" | "meaningful" | "full" }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [mode, setMode] = useState<"template" | "freeform">(templates.length > 0 ? "template" : "freeform");
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id ?? "");
  const [freeDesc, setFreeDesc] = useState("");
  const [freeSlot, setFreeSlot] = useState<MealSlot>("breakfast");

  function handleSubmit() {
    if (mode === "template") {
      const t = templates.find((tpl) => tpl.id === selectedTemplateId);
      if (!t) return;
      onSave({ description: t.name, mealSlot: t.mealSlot ?? undefined, mealTemplateId: t.id, loggingQuality: "meaningful" });
    } else {
      if (!freeDesc.trim()) return;
      onSave({ description: freeDesc.trim(), mealSlot: freeSlot, loggingQuality: "partial" });
    }
  }

  return (
    <div className="inline-editor">
      <div className="stack-form">
        {templates.length > 0 && (
          <div className="meal-mode-toggle">
            <button type="button" className={`meal-mode-toggle__btn${mode === "template" ? " meal-mode-toggle__btn--active" : ""}`} onClick={() => setMode("template")}>From template</button>
            <button type="button" className={`meal-mode-toggle__btn${mode === "freeform" ? " meal-mode-toggle__btn--active" : ""}`} onClick={() => setMode("freeform")}>Freeform</button>
          </div>
        )}
        {mode === "template" && templates.length > 0 ? (
          <label className="field">
            <span>Template</span>
            <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name} — {formatMealSlotLabel(t.mealSlot)}</option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label className="field">
              <span>Description</span>
              <input type="text" value={freeDesc} placeholder="What did you eat?" autoFocus onChange={(e) => setFreeDesc(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") onCancel(); }} />
            </label>
            <label className="field">
              <span>Meal slot</span>
              <select value={freeSlot} onChange={(e) => setFreeSlot(e.target.value as MealSlot)}>
                {mealSlotOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
              </select>
            </label>
          </>
        )}
        <div className="button-row button-row--tight">
          <button className="button button--primary button--small" type="button" disabled={isPending} onClick={handleSubmit}>
            {isPending ? "Saving…" : "Log meal"}
          </button>
          <button className="button button--ghost button--small" type="button" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export function HealthPage() {
  const today = getTodayDate();
  const healthQuery = useHealthDataQuery(today);
  const addWaterMutation = useAddWaterMutation(today);
  const updateWaterMutation = useUpdateWaterLogMutation(today);
  const deleteWaterMutation = useDeleteWaterLogMutation(today);
  const addMealMutation = useAddMealMutation(today);
  const updateMealMutation = useUpdateMealLogMutation(today);
  const deleteMealMutation = useDeleteMealLogMutation(today);
  const updateWorkoutMutation = useWorkoutMutation(today);
  const addWeightMutation = useAddWeightMutation(today);
  const updateWeightMutation = useUpdateWeightLogMutation(today);
  const deleteWeightMutation = useDeleteWeightLogMutation(today);

  // UI state
  const [showWeightForm, setShowWeightForm] = useState(false);
  const [showMealForm, setShowMealForm] = useState(false);
  const [editingWaterId, setEditingWaterId] = useState<string | null>(null);
  const [editWaterMl, setEditWaterMl] = useState("");
  const [deletingWaterId, setDeletingWaterId] = useState<string | null>(null);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [editMealDesc, setEditMealDesc] = useState("");
  const [editMealSlot, setEditMealSlot] = useState<MealSlot>("breakfast");
  const [deletingMealId, setDeletingMealId] = useState<string | null>(null);
  const [editingWeightId, setEditingWeightId] = useState<string | null>(null);
  const [editWeightVal, setEditWeightVal] = useState("");
  const [editWeightUnit, setEditWeightUnit] = useState("kg");
  const [deletingWeightId, setDeletingWeightId] = useState<string | null>(null);

  if (healthQuery.isLoading && !healthQuery.data) {
    return (
      <PageLoadingState
        title="Loading health basics"
        description="Pulling together water, meals, workout status, and weight history."
      />
    );
  }

  if (healthQuery.isError || !healthQuery.data) {
    return (
      <PageErrorState
        title="Health could not load"
        message={healthQuery.error instanceof Error ? healthQuery.error.message : undefined}
        onRetry={() => void healthQuery.refetch()}
      />
    );
  }

  const currentDay = healthQuery.data.summary.currentDay;
  const waterMl = currentDay?.waterMl ?? 0;
  const waterTargetMl = currentDay?.waterTargetMl ?? 1;
  const pct = Math.min(100, (waterMl / waterTargetMl) * 100);
  const templates = healthQuery.data.mealTemplates?.mealTemplates ?? [];
  const mealLogs = healthQuery.data.mealLogs?.mealLogs ?? [];
  const waterLogs = healthQuery.data.waterLogs?.waterLogs ?? [];
  const weightLogs = healthQuery.data.summary.weightHistory ?? [];

  // Trends
  const rangeSummary = healthQuery.data.summary.range;
  const waterDaysHit = waterTargetMl > 0 ? Math.min(7, Math.round((rangeSummary.totalWaterMl / waterTargetMl / 7) * 7)) : 0;
  const workoutRate = rangeSummary.workoutsPlanned > 0
    ? Math.round((rangeSummary.workoutsCompleted / rangeSummary.workoutsPlanned) * 100)
    : null;
  const weightTrend = weightLogs.length >= 2
    ? weightLogs[0].weightValue - weightLogs[weightLogs.length - 1].weightValue
    : null;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Health basics"
        title="Water, meals, training, body weight"
        description="High-signal tracking with very low friction. Log fast, review at a glance."
      />

      {/* ── Trends bar ── */}
      <SectionCard title="7-day snapshot" subtitle="Recent consistency">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
          <div className="trend-row">
            <span className="trend-row__icon">💧</span>
            <span className="trend-row__label">Water days on target</span>
            <span className="trend-row__value">{waterDaysHit}/7</span>
          </div>
          {workoutRate !== null && (
            <div className="trend-row">
              <span className="trend-row__icon">🏋️</span>
              <span className="trend-row__label">Workout completion</span>
              <span className="trend-row__value">{workoutRate}%</span>
            </div>
          )}
          {weightTrend !== null && (
            <div className="trend-row">
              <span className="trend-row__icon">{weightTrend < 0 ? "↓" : weightTrend > 0 ? "↑" : "→"}</span>
              <span className="trend-row__label">Weight change</span>
              <span className="trend-row__value">
                {weightTrend > 0 ? "+" : ""}{weightTrend.toFixed(1)} {weightLogs[0]?.unit ?? "kg"}
              </span>
            </div>
          )}
        </div>
      </SectionCard>

      <div className="dashboard-grid stagger">
        {/* ── Water ── */}
        <SectionCard
          title="Water"
          subtitle={`${Math.round(pct)}% of daily target`}
        >
          <div className="water-tracker">
            {healthQuery.data.sectionErrors.waterLogs ? (
              <InlineErrorState
                message={healthQuery.data.sectionErrors.waterLogs.message}
                onRetry={() => void healthQuery.refetch()}
              />
            ) : null}
            <div className="water-tracker__header">
              <span className="water-tracker__current">{(waterMl / 1000).toFixed(1)}L</span>
              <span className="water-tracker__target">/ {(waterTargetMl / 1000).toFixed(1)}L</span>
            </div>
            <div className="progress-bar">
              <div className="progress-bar__fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="button-row">
              <button className="button button--ghost button--small" type="button" onClick={() => addWaterMutation.mutate(250)}>+250ml</button>
              <button className="button button--ghost button--small" type="button" onClick={() => addWaterMutation.mutate(500)}>+500ml</button>
            </div>
          </div>

          {/* Water log list with correction */}
          {waterLogs.length > 0 && (
            <div style={{ marginTop: "0.75rem", borderTop: "1px solid var(--border)", paddingTop: "0.5rem" }}>
              <div style={{ fontSize: "var(--fs-micro)", color: "var(--text-tertiary)", marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Today&apos;s logs</div>
              {waterLogs.map((log) => (
                <div key={log.id}>
                  <div className="log-row">
                    <div className="log-row__info">
                      <span className="log-row__primary">{log.amountMl}ml</span>
                      <span className="log-row__secondary">
                        {" · "}{new Date(log.occurredAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="log-row__actions">
                      <button className="button button--ghost button--small" type="button" onClick={() => { setEditingWaterId(log.id); setEditWaterMl(String(log.amountMl)); setDeletingWaterId(null); }} aria-label="Edit water log">Edit</button>
                      <button className="button button--ghost button--small" type="button" onClick={() => { setDeletingWaterId(log.id); setEditingWaterId(null); }} aria-label="Delete water log">Delete</button>
                    </div>
                  </div>
                  {editingWaterId === log.id && (
                    <div className="inline-editor">
                      <div className="stack-form">
                        <label className="field">
                          <span>Amount (ml)</span>
                          <input type="number" min="0" value={editWaterMl} autoFocus onChange={(e) => setEditWaterMl(e.target.value)} onKeyDown={(e) => {
                            if (e.key === "Enter") { const v = parseInt(editWaterMl, 10); if (v > 0) { void updateWaterMutation.mutateAsync({ waterLogId: log.id, amountMl: v }).then(() => setEditingWaterId(null)); } }
                            if (e.key === "Escape") setEditingWaterId(null);
                          }} />
                        </label>
                        <div className="button-row button-row--tight">
                          <button className="button button--primary button--small" type="button" disabled={updateWaterMutation.isPending} onClick={() => { const v = parseInt(editWaterMl, 10); if (v > 0) void updateWaterMutation.mutateAsync({ waterLogId: log.id, amountMl: v }).then(() => setEditingWaterId(null)); }}>
                            {updateWaterMutation.isPending ? "Saving…" : "Save"}
                          </button>
                          <button className="button button--ghost button--small" type="button" onClick={() => setEditingWaterId(null)}>Cancel</button>
                        </div>
                      </div>
                    </div>
                  )}
                  {deletingWaterId === log.id && (
                    <div className="confirm-bar">
                      <span className="confirm-bar__text">Delete this {log.amountMl}ml log?</span>
                      <button className="button button--ghost button--small" type="button" disabled={deleteWaterMutation.isPending} onClick={() => void deleteWaterMutation.mutateAsync(log.id).then(() => setDeletingWaterId(null))}>
                        {deleteWaterMutation.isPending ? "Deleting…" : "Confirm"}
                      </button>
                      <button className="button button--ghost button--small" type="button" onClick={() => setDeletingWaterId(null)}>Cancel</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* ── Meals ── */}
        <SectionCard
          title="Meals"
          subtitle={`${mealLogs.length} logged today`}
        >
          {healthQuery.data.sectionErrors.mealTemplates || healthQuery.data.sectionErrors.mealLogs ? (
            <InlineErrorState
              message={
                healthQuery.data.sectionErrors.mealTemplates?.message ??
                healthQuery.data.sectionErrors.mealLogs?.message ??
                "Meal data could not load."
              }
              onRetry={() => void healthQuery.refetch()}
            />
          ) : (
            <>
              {/* Meal log form (template or freeform) */}
              {showMealForm ? (
                <MealLogForm
                  templates={templates}
                  isPending={addMealMutation.isPending}
                  onSave={(p) => { void addMealMutation.mutateAsync(p).then(() => setShowMealForm(false)); }}
                  onCancel={() => setShowMealForm(false)}
                />
              ) : (
                <button className="button button--ghost button--small" type="button" onClick={() => setShowMealForm(true)} style={{ marginBottom: "0.5rem" }}>+ Log meal</button>
              )}

              {/* Existing meal logs with correction */}
              {mealLogs.length > 0 ? (
                <div>
                  {mealLogs.map((log) => (
                    <div key={log.id}>
                      <div className="log-row">
                        <div className="log-row__info">
                          <span className="log-row__primary">{log.description}</span>
                          <span className="log-row__secondary">
                            {formatMealSlotLabel(log.mealSlot)}
                            {" · "}{new Date(log.occurredAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                          </span>
                        </div>
                        <div className="log-row__actions">
                          <button className="button button--ghost button--small" type="button" onClick={() => { setEditingMealId(log.id); setEditMealDesc(log.description); setEditMealSlot((log.mealSlot as MealSlot) || "breakfast"); setDeletingMealId(null); }} aria-label="Edit meal log">Edit</button>
                          <button className="button button--ghost button--small" type="button" onClick={() => { setDeletingMealId(log.id); setEditingMealId(null); }} aria-label="Delete meal log">Delete</button>
                        </div>
                      </div>
                      {editingMealId === log.id && (
                        <div className="inline-editor">
                          <div className="stack-form">
                            <label className="field">
                              <span>Description</span>
                              <input type="text" value={editMealDesc} autoFocus onChange={(e) => setEditMealDesc(e.target.value)} onKeyDown={(e) => {
                                if (e.key === "Enter" && editMealDesc.trim()) void updateMealMutation.mutateAsync({ mealLogId: log.id, description: editMealDesc.trim(), mealSlot: editMealSlot }).then(() => setEditingMealId(null));
                                if (e.key === "Escape") setEditingMealId(null);
                              }} />
                            </label>
                            <label className="field">
                              <span>Meal slot</span>
                              <select value={editMealSlot} onChange={(e) => setEditMealSlot(e.target.value as MealSlot)}>
                                {mealSlotOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                              </select>
                            </label>
                            <div className="button-row button-row--tight">
                              <button className="button button--primary button--small" type="button" disabled={updateMealMutation.isPending} onClick={() => { if (editMealDesc.trim()) void updateMealMutation.mutateAsync({ mealLogId: log.id, description: editMealDesc.trim(), mealSlot: editMealSlot }).then(() => setEditingMealId(null)); }}>
                                {updateMealMutation.isPending ? "Saving…" : "Save"}
                              </button>
                              <button className="button button--ghost button--small" type="button" onClick={() => setEditingMealId(null)}>Cancel</button>
                            </div>
                          </div>
                        </div>
                      )}
                      {deletingMealId === log.id && (
                        <div className="confirm-bar">
                          <span className="confirm-bar__text">Delete &ldquo;{log.description}&rdquo;?</span>
                          <button className="button button--ghost button--small" type="button" disabled={deleteMealMutation.isPending} onClick={() => void deleteMealMutation.mutateAsync(log.id).then(() => setDeletingMealId(null))}>
                            {deleteMealMutation.isPending ? "Deleting…" : "Confirm"}
                          </button>
                          <button className="button button--ghost button--small" type="button" onClick={() => setDeletingMealId(null)}>Cancel</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No meals logged yet"
                  description="Use the button above or Quick Capture to log your first meal."
                />
              )}
            </>
          )}
        </SectionCard>

        {/* ── Workout ── */}
        <SectionCard
          title="Workout"
          subtitle={currentDay?.workoutDay?.plannedLabel ?? "Today"}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem" }}>
                {currentDay?.workoutDay?.plannedLabel ?? "No workout logged"}
              </span>
              <span className="tag tag--positive">{formatWorkoutStatus(currentDay?.workoutDay?.actualStatus)}</span>
            </div>
            <div className="segmented-control">
              <button
                className={`segmented-control__option${currentDay?.workoutDay?.actualStatus === "completed" ? " segmented-control__option--active" : ""}`}
                type="button"
                onClick={() => updateWorkoutMutation.mutate({ planType: "workout", actualStatus: "completed", plannedLabel: currentDay?.workoutDay?.plannedLabel ?? "Workout" })}
              >
                Completed
              </button>
              <button
                className={`segmented-control__option${currentDay?.workoutDay?.actualStatus === "recovery_respected" ? " segmented-control__option--active" : ""}`}
                type="button"
                onClick={() => updateWorkoutMutation.mutate({ planType: "recovery", actualStatus: "recovery_respected", plannedLabel: "Recovery" })}
              >
                Rest day
              </button>
              <button
                className={`segmented-control__option${currentDay?.workoutDay?.actualStatus === "missed" ? " segmented-control__option--active" : ""}`}
                type="button"
                onClick={() => updateWorkoutMutation.mutate({ planType: "workout", actualStatus: "missed", plannedLabel: currentDay?.workoutDay?.plannedLabel ?? "Workout" })}
              >
                Missed
              </button>
            </div>
          </div>
        </SectionCard>

        {/* ── Body weight ── */}
        <SectionCard
          title="Body weight"
          subtitle={weightLogs.length > 0 ? `Latest: ${weightLogs[0].weightValue} ${weightLogs[0].unit}` : "No entries yet"}
        >
          {/* Inline weight entry form */}
          {showWeightForm ? (
            <WeightEntryForm
              defaultUnit={currentDay?.latestWeight?.unit ?? "kg"}
              isPending={addWeightMutation.isPending}
              onSave={(v, u) => { void addWeightMutation.mutateAsync({ weightValue: v, unit: u, measuredOn: today }).then(() => setShowWeightForm(false)); }}
              onCancel={() => setShowWeightForm(false)}
            />
          ) : (
            <button className="button button--ghost button--small" type="button" onClick={() => setShowWeightForm(true)} style={{ marginBottom: "0.5rem" }}>+ Add entry</button>
          )}

          {/* Weight log list with correction */}
          {weightLogs.length > 0 ? (
            <div>
              {weightLogs.map((entry) => (
                <div key={entry.id}>
                  <div className="log-row">
                    <div className="log-row__info">
                      <span className="log-row__primary">{entry.weightValue} {entry.unit}</span>
                      <span className="log-row__secondary">{entry.measuredOn}</span>
                    </div>
                    <div className="log-row__actions">
                      <button className="button button--ghost button--small" type="button" onClick={() => { setEditingWeightId(entry.id); setEditWeightVal(String(entry.weightValue)); setEditWeightUnit(entry.unit); setDeletingWeightId(null); }} aria-label="Edit weight log">Edit</button>
                      <button className="button button--ghost button--small" type="button" onClick={() => { setDeletingWeightId(entry.id); setEditingWeightId(null); }} aria-label="Delete weight log">Delete</button>
                    </div>
                  </div>
                  {editingWeightId === entry.id && (
                    <div className="inline-editor">
                      <div className="stack-form">
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
                          <label className="field" style={{ flex: 1 }}>
                            <span>Weight</span>
                            <input type="number" step="0.1" min="0" value={editWeightVal} autoFocus onChange={(e) => setEditWeightVal(e.target.value)} onKeyDown={(e) => {
                              if (e.key === "Enter") { const v = parseNumberValue(editWeightVal); if (v) void updateWeightMutation.mutateAsync({ weightLogId: entry.id, weightValue: v, unit: editWeightUnit }).then(() => setEditingWeightId(null)); }
                              if (e.key === "Escape") setEditingWeightId(null);
                            }} />
                          </label>
                          <label className="field" style={{ width: "5rem" }}>
                            <span>Unit</span>
                            <select value={editWeightUnit} onChange={(e) => setEditWeightUnit(e.target.value)}>
                              <option value="kg">kg</option>
                              <option value="lb">lb</option>
                            </select>
                          </label>
                        </div>
                        <div className="button-row button-row--tight">
                          <button className="button button--primary button--small" type="button" disabled={updateWeightMutation.isPending} onClick={() => { const v = parseNumberValue(editWeightVal); if (v) void updateWeightMutation.mutateAsync({ weightLogId: entry.id, weightValue: v, unit: editWeightUnit }).then(() => setEditingWeightId(null)); }}>
                            {updateWeightMutation.isPending ? "Saving…" : "Save"}
                          </button>
                          <button className="button button--ghost button--small" type="button" onClick={() => setEditingWeightId(null)}>Cancel</button>
                        </div>
                      </div>
                    </div>
                  )}
                  {deletingWeightId === entry.id && (
                    <div className="confirm-bar">
                      <span className="confirm-bar__text">Delete {entry.weightValue} {entry.unit} entry?</span>
                      <button className="button button--ghost button--small" type="button" disabled={deleteWeightMutation.isPending} onClick={() => void deleteWeightMutation.mutateAsync(entry.id).then(() => setDeletingWeightId(null))}>
                        {deleteWeightMutation.isPending ? "Deleting…" : "Confirm"}
                      </button>
                      <button className="button button--ghost button--small" type="button" onClick={() => setDeletingWeightId(null)}>Cancel</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No weight entries"
              description="Body-weight history starts after the first manual log."
            />
          )}
        </SectionCard>
      </div>

      <MealTemplateManager />
    </div>
  );
}
