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
  useHealthDataQuery,
  useMealTemplatesQuery,
  useUpdateMealTemplateMutation,
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

export function HealthPage() {
  const today = getTodayDate();
  const healthQuery = useHealthDataQuery(today);
  const addWaterMutation = useAddWaterMutation(today);
  const addMealMutation = useAddMealMutation(today);
  const updateWorkoutMutation = useWorkoutMutation(today);
  const addWeightMutation = useAddWeightMutation(today);
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
  const defaultMealSlots = [
    { id: "breakfast", name: "Breakfast", mealSlot: "breakfast" as const, description: null },
    { id: "lunch", name: "Lunch", mealSlot: "lunch" as const, description: null },
    { id: "dinner", name: "Dinner", mealSlot: "dinner" as const, description: null },
  ];
  const mealEntries = (templates.length
    ? templates.map((template) => ({
        id: template.id,
        name: template.name,
        mealSlot: template.mealSlot,
        description: template.description,
      }))
    : defaultMealSlots).map((entry) => {
    const log = mealLogs.find(
      (mealLog) =>
        mealLog.mealTemplateId === entry.id ||
        mealLog.mealSlot === entry.mealSlot,
    );

    return {
      id: entry.id,
      name: entry.name,
      mealSlot: entry.mealSlot,
      time: log?.occurredAt
        ? new Date(log.occurredAt).toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
          })
        : formatMealSlotLabel(entry.mealSlot),
      logged: Boolean(log),
    };
  });
  const weightLogs = healthQuery.data.summary.weightHistory ?? [];

  async function handleAddWeight() {
    const rawValue = window.prompt("Enter body weight");
    const parsedValue = rawValue ? parseNumberValue(rawValue) : null;
    if (!parsedValue) {
      return;
    }

    await addWeightMutation.mutateAsync({
      weightValue: parsedValue,
      unit: currentDay?.latestWeight?.unit ?? "kg",
      measuredOn: today,
    });
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Health basics"
        title="Water, meals, training, body weight"
        description="High-signal tracking with very low friction. Log fast, review at a glance."
      />

      <div className="dashboard-grid stagger">
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
              <button
                className="button button--ghost button--small"
                type="button"
                onClick={() => addWaterMutation.mutate(250)}
              >
                +250ml
              </button>
              <button
                className="button button--ghost button--small"
                type="button"
                onClick={() => addWaterMutation.mutate(500)}
              >
                +500ml
              </button>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Meals"
          subtitle={`${mealEntries.filter((meal) => meal.logged).length} of ${mealEntries.length} logged`}
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
          ) : mealEntries.length > 0 ? (
            <div>
              {mealEntries.map((meal) => (
                <div key={meal.id} className="habit-item">
                  <button
                    className={`habit-item__check${meal.logged ? " habit-item__check--done" : ""}`}
                    type="button"
                    aria-label={`${meal.name} ${meal.logged ? "logged" : "not logged"}`}
                  >
                    {meal.logged ? "\u2713" : ""}
                  </button>
                  <div className="habit-item__info">
                    <div className="habit-item__title">{meal.name}</div>
                    <div className="habit-item__detail">{meal.time}</div>
                  </div>
                  {!meal.logged && (
                    <button
                      className="button button--ghost button--small"
                      type="button"
                      onClick={() =>
                        addMealMutation.mutate({
                          description: meal.name,
                          loggingQuality: "meaningful",
                          mealSlot: meal.mealSlot,
                        })
                      }
                    >
                      Log
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No meal structure yet"
              description="Meal templates or meal logs will show up here once the first meal is captured."
            />
          )}
        </SectionCard>

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
            <div className="button-row">
              <button
                className="button button--ghost button--small"
                type="button"
                onClick={() =>
                  updateWorkoutMutation.mutate({
                    planType: "recovery",
                    actualStatus: "recovery_respected",
                    plannedLabel: "Recovery",
                  })
                }
              >
                Rest day
              </button>
              <button
                className="button button--ghost button--small"
                type="button"
                onClick={() =>
                  updateWorkoutMutation.mutate({
                    planType: "workout",
                    actualStatus: "completed",
                    plannedLabel: currentDay?.workoutDay?.plannedLabel ?? "Workout",
                  })
                }
              >
                Log workout
              </button>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Body weight"
          subtitle="Recent entries"
        >
          {weightLogs.length > 0 ? (
            <div>
              {weightLogs.map((entry) => (
                <div key={entry.id} className="expense-row">
                  <div className="expense-row__info">
                    <div className="expense-row__title">{entry.weightValue} {entry.unit}</div>
                    <div className="expense-row__meta">{entry.measuredOn}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No weight entries"
              description="Body-weight history starts after the first manual log."
            />
          )}
          <button
            className="button button--ghost button--small"
            type="button"
            style={{ marginTop: "0.5rem" }}
            onClick={() => void handleAddWeight()}
          >
            Add entry
          </button>
        </SectionCard>
      </div>

      <MealTemplateManager />
    </div>
  );
}
