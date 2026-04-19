import {
  useEffect,
  useState,
} from "react";
import { NavLink, useLocation } from "react-router-dom";

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
import type {
  HealthGuidanceIntent,
  HealthGuidanceItem,
  HealthTimelineItem,
} from "../../shared/lib/api";
import {
  EmptyState,
  InlineErrorState,
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";
import { readHomeDestinationState } from "../../shared/lib/homeNavigation";

type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

const mealSlotOptions: { value: MealSlot; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

const PHASE_LABEL: Record<string, string> = {
  morning: "Morning",
  midday: "Afternoon",
  evening: "Evening",
};

const SCORE_LABEL: Record<string, string> = {
  strong: "Strong",
  steady: "Steady",
  needs_attention: "Needs work",
};

/* ── Score Ring (small SVG) ── */
function ScoreRing({ value, label }: { value: number; label: string }) {
  const size = 76;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="health-score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle className="health-score-ring__track" cx={size / 2} cy={size / 2} r={radius} />
        <circle
          className={`health-score-ring__fill health-score-ring__fill--${label}`}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="health-score-ring__inner">
        <span className="health-score-ring__value">{value}</span>
        <span className={`health-score-ring__label health-score-ring__label--${label}`}>
          {SCORE_LABEL[label] ?? label}
        </span>
      </div>
    </div>
  );
}

/* ── Meal Log Form ── */
type PlannedMealEntry = {
  mealPlanEntryId: string;
  date: string;
  mealSlot: MealSlot;
  mealTemplateId: string | null;
  title: string;
  servings: number | null;
  note: string | null;
  isLogged: boolean;
};

function MealLogForm({
  templates,
  plannedMeals,
  onSave,
  onCancel,
  isPending,
}: {
  templates: Array<{ id: string; name: string; mealSlot: MealSlot | null; description: string | null }>;
  plannedMeals: PlannedMealEntry[];
  onSave: (payload: { description: string; mealSlot?: MealSlot; mealTemplateId?: string; mealPlanEntryId?: string; loggingQuality: "partial" | "meaningful" | "full" }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const unloggedPlanned = plannedMeals.filter((p) => !p.isLogged);
  const hasPlanned = unloggedPlanned.length > 0;
  const defaultMode = hasPlanned ? "planned" : templates.length > 0 ? "template" : "freeform";
  const [mode, setMode] = useState<"planned" | "template" | "freeform">(defaultMode);
  const [selectedPlannedId, setSelectedPlannedId] = useState(unloggedPlanned[0]?.mealPlanEntryId ?? "");
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id ?? "");
  const [freeDesc, setFreeDesc] = useState("");
  const [freeSlot, setFreeSlot] = useState<MealSlot>("breakfast");

  function handleSubmit() {
    if (mode === "planned") {
      const p = unloggedPlanned.find((pm) => pm.mealPlanEntryId === selectedPlannedId);
      if (!p) return;
      onSave({
        description: p.title,
        mealSlot: p.mealSlot,
        mealTemplateId: p.mealTemplateId ?? undefined,
        mealPlanEntryId: p.mealPlanEntryId,
        loggingQuality: "meaningful",
      });
    } else if (mode === "template") {
      const t = templates.find((tpl) => tpl.id === selectedTemplateId);
      if (!t) return;
      onSave({ description: t.name, mealSlot: t.mealSlot ?? undefined, mealTemplateId: t.id, loggingQuality: "meaningful" });
    } else {
      if (!freeDesc.trim()) return;
      onSave({ description: freeDesc.trim(), mealSlot: freeSlot, loggingQuality: "partial" });
    }
  }

  return (
    <div className="health-form-area">
      <div className="inline-editor">
        <div className="stack-form">
          <div className="meal-mode-toggle">
            {hasPlanned && (
              <button type="button" className={`meal-mode-toggle__btn${mode === "planned" ? " meal-mode-toggle__btn--active" : ""}`} onClick={() => setMode("planned")}>From plan</button>
            )}
            {templates.length > 0 && (
              <button type="button" className={`meal-mode-toggle__btn${mode === "template" ? " meal-mode-toggle__btn--active" : ""}`} onClick={() => setMode("template")}>From template</button>
            )}
            <button type="button" className={`meal-mode-toggle__btn${mode === "freeform" ? " meal-mode-toggle__btn--active" : ""}`} onClick={() => setMode("freeform")}>Freeform</button>
          </div>
          {mode === "planned" && hasPlanned ? (
            <label className="field">
              <span>Today&apos;s planned meal</span>
              <select value={selectedPlannedId} onChange={(e) => setSelectedPlannedId(e.target.value)}>
                {unloggedPlanned.map((p) => (
                  <option key={p.mealPlanEntryId} value={p.mealPlanEntryId}>
                    {p.title} — {formatMealSlotLabel(p.mealSlot)}
                  </option>
                ))}
              </select>
            </label>
          ) : mode === "template" && templates.length > 0 ? (
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
              {isPending ? "Saving..." : "Log meal"}
            </button>
            <button className="button button--ghost button--small" type="button" onClick={onCancel}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Weight Entry Form ── */
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
    <div className="health-form-area">
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
              {isPending ? "Saving..." : "Log weight"}
            </button>
            <button className="button button--ghost button--small" type="button" onClick={onCancel}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Meal Template Manager (secondary) ── */
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
    <div className="health-templates-body">
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
              {isSaving ? "Saving..." : editingId ? "Update" : "Create"}
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
    </div>
  );
}

/* ── Timeline Row ── */
function TimelineRow({
  item,
  onEdit,
  onDelete,
  canDelete = true,
}: {
  item: HealthTimelineItem;
  onEdit: () => void;
  onDelete: () => void;
  canDelete?: boolean;
}) {
  const time = new Date(item.occurredAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="health-timeline__item">
      <div className="health-timeline__dot-col">
        <div className={`health-timeline__dot health-timeline__dot--${item.kind}`} />
      </div>
      <div className="health-timeline__content">
        <div className="health-timeline__title">{item.title}</div>
        <div className="health-timeline__meta">
          <span className="health-timeline__time">{time}</span>
          <span>{item.detail}</span>
        </div>
      </div>
      <div className="health-timeline__actions">
        <button className="button button--ghost button--small" type="button" onClick={onEdit} aria-label="Edit">Edit</button>
        {canDelete ? (
          <button className="button button--ghost button--small" type="button" onClick={onDelete} aria-label="Delete">Delete</button>
        ) : null}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Health Page — Main Component
   ═══════════════════════════════════════════════ */

/* ── Health Sub-Navigation ── */
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
        to="/meals"
        className={({ isActive }) =>
          `mp-subnav__link${isActive ? " mp-subnav__link--active" : ""}`
        }
      >
        Meals
      </NavLink>
    </nav>
  );
}

export function HealthPage() {
  const location = useLocation();
  const today = getTodayDate();
  const healthQuery = useHealthDataQuery(today);
  const homeDestination = readHomeDestinationState(location.state);
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
  const [activeForm, setActiveForm] = useState<"meal" | "weight" | "workout" | null>(null);
  const [homeFocusHighlight, setHomeFocusHighlight] = useState<"water" | "meals" | "workout" | "patterns" | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  // Inline editing state
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

  useEffect(() => {
    if (homeDestination?.kind !== "health_focus") {
      setHomeFocusHighlight(null);
      return;
    }

    setHomeFocusHighlight(homeDestination.surface);

    if (homeDestination.surface === "meals") {
      setActiveForm("meal");
    } else if (homeDestination.surface === "workout") {
      setActiveForm("workout");
    }

    requestAnimationFrame(() => {
      const targetId = homeDestination.surface === "patterns"
        ? "health-patterns"
        : "health-pulse";
      document.getElementById(targetId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [homeDestination, location.key]);

  if (healthQuery.isLoading && !healthQuery.data) {
    return (
      <div className="health-page">
        <HealthSubNav />
        <PageLoadingState
          title="Loading health basics"
          description="Pulling together water, meals, workout status, and weight history."
        />
      </div>
    );
  }

  if (healthQuery.isError || !healthQuery.data) {
    return (
      <div className="health-page">
        <HealthSubNav />
        <PageErrorState
          title="Health could not load"
          message={healthQuery.error instanceof Error ? healthQuery.error.message : undefined}
          onRetry={() => void healthQuery.refetch()}
        />
      </div>
    );
  }

  const { summary } = healthQuery.data;
  const { currentDay, guidance, range } = summary;
  const { signals, score, timeline, phase } = currentDay;
  const insights = range.insights;
  const templates = healthQuery.data.mealTemplates?.mealTemplates ?? [];
  const mealLogs = healthQuery.data.mealLogs?.mealLogs ?? [];
  const waterLogs = healthQuery.data.waterLogs?.waterLogs ?? [];
  const weightLogs = summary.weightHistory ?? [];

  const plannedMeals: PlannedMealEntry[] = (currentDay.plannedMeals ?? []).map((p) => ({
    ...p,
    mealSlot: p.mealSlot as MealSlot,
  }));
  const waterMl = currentDay.waterMl ?? 0;
  const waterTargetMl = currentDay.waterTargetMl ?? 1;
  const waterPaceShortfallMl = Math.max(0, signals.water.paceTargetMl - waterMl);

  function handleIntent(intent: HealthGuidanceIntent) {
    switch (intent) {
      case "log_water":
        addWaterMutation.mutate(500);
        break;
      case "log_meal":
        setActiveForm("meal");
        break;
      case "update_workout":
        setActiveForm("workout");
        break;
      case "log_weight":
        setActiveForm("weight");
        break;
      case "review_patterns":
        document.getElementById("health-patterns")?.scrollIntoView({ behavior: "smooth" });
        break;
    }
  }

  function handleTimelineEdit(item: HealthTimelineItem) {
    const realId = item.id.split(":").slice(1).join(":");
    switch (item.kind) {
      case "water": {
        const log = waterLogs.find((l) => l.id === realId);
        if (log) {
          setEditingWaterId(log.id);
          setEditWaterMl(String(log.amountMl));
        }
        break;
      }
      case "meal": {
        const log = mealLogs.find((l) => l.id === realId);
        if (log) {
          setEditingMealId(log.id);
          setEditMealDesc(log.description);
          setEditMealSlot((log.mealSlot as MealSlot) || "breakfast");
        }
        break;
      }
      case "weight": {
        const log = weightLogs.find((l) => l.id === realId);
        if (log) {
          setEditingWeightId(log.id);
          setEditWeightVal(String(log.weightValue));
          setEditWeightUnit(log.unit);
        }
        break;
      }
      case "workout":
        setActiveForm("workout");
        break;
    }
  }

  function handleTimelineDelete(item: HealthTimelineItem) {
    const realId = item.id.split(":").slice(1).join(":");
    switch (item.kind) {
      case "water":
        setDeletingWaterId(realId);
        break;
      case "meal":
        setDeletingMealId(realId);
        break;
      case "weight":
        setDeletingWeightId(realId);
        break;
    }
  }

  const filteredRecommendations = guidance.recommendations.filter(
    (rec) => rec.id !== guidance.focus.id,
  );

  return (
    <div className="health-page">
      <HealthSubNav />

      {/* ═══ Health Status Matrix ═══ */}
      <section className="health-matrix" id="health-pulse">
        <div className="health-matrix__header">
          <div className="health-matrix__title-group">
            <span className="health-matrix__title">Health basics</span>
            <span className="health-matrix__phase">{PHASE_LABEL[phase] ?? phase}</span>
          </div>
          <div className={`health-matrix__score health-matrix__score--${score.label}`}>
            <span className="health-matrix__score-value">{score.value}</span>
            <span className="health-matrix__score-label">{SCORE_LABEL[score.label] ?? score.label}</span>
          </div>
        </div>

        <div className="health-matrix__signals">
          {/* Water */}
          <div className={`health-matrix__signal${homeFocusHighlight === "water" ? " health-matrix__signal--highlight" : ""}`}>
            <div className={`health-matrix__dot health-matrix__dot--${signals.water.status === "behind" ? "behind" : "water"}`} />
            <span className="health-matrix__signal-label">Water</span>
            <span className="health-matrix__signal-value">
              {(waterMl / 1000).toFixed(1)}L / {(waterTargetMl / 1000).toFixed(1)}L
            </span>
            <div className="health-matrix__bar">
              <div
                className={`health-matrix__bar-fill health-matrix__bar-fill--${signals.water.status === "complete" ? "complete" : "water"}`}
                style={{ width: `${signals.water.progressPct}%` }}
              />
            </div>
            <span className={`health-matrix__signal-status health-matrix__signal-status--${signals.water.status}`}>
              {signals.water.status === "complete"
                ? "Target hit"
                : signals.water.status === "on_track"
                  ? "On pace"
                  : `${waterPaceShortfallMl}ml behind`}
            </span>
          </div>

          {/* Meals */}
          <div className={`health-matrix__signal${homeFocusHighlight === "meals" ? " health-matrix__signal--highlight" : ""}`}>
            <div className={`health-matrix__dot health-matrix__dot--${signals.meals.status === "behind" ? "behind" : "meals"}`} />
            <span className="health-matrix__signal-label">Meals</span>
            <span className="health-matrix__signal-value">
              {currentDay.mealCount} / {signals.meals.targetCount || 3} logged
            </span>
            <div className="health-matrix__bar">
              <div
                className={`health-matrix__bar-fill health-matrix__bar-fill--${signals.meals.status === "complete" ? "complete" : "meals"}`}
                style={{ width: `${signals.meals.progressPct}%` }}
              />
            </div>
            <span className={`health-matrix__signal-status health-matrix__signal-status--${signals.meals.status}`}>
              {signals.meals.status === "complete"
                ? "All logged"
                : signals.meals.nextSuggestedSlot
                  ? `Next: ${formatMealSlotLabel(signals.meals.nextSuggestedSlot)}`
                  : signals.meals.status === "on_track"
                    ? "On track"
                    : "Behind"}
            </span>
          </div>

          {/* Workout */}
          <div className={`health-matrix__signal health-matrix__signal--no-bar${homeFocusHighlight === "workout" ? " health-matrix__signal--highlight" : ""}`}>
            <div className={`health-matrix__dot health-matrix__dot--${signals.workout.status}`} />
            <span className="health-matrix__signal-label">Workout</span>
            <span className="health-matrix__signal-value health-matrix__signal-value--wide">{signals.workout.label}</span>
            <span className={`health-matrix__signal-status health-matrix__signal-status--${signals.workout.status}`}>
              {signals.workout.status === "complete" ? "Done" : signals.workout.status === "recovery" ? "Recovery" : signals.workout.status === "missed" ? "Missed" : "Open"}
            </span>
          </div>
        </div>

        <div className="health-matrix__focus">
          <div className="health-matrix__focus-content">
            <span className="health-matrix__focus-title">{guidance.focus.title}</span>
            <span className="health-matrix__focus-detail">{guidance.focus.detail}</span>
          </div>
          {guidance.focus.intent !== "review_patterns" && (
            <button
              className="health-matrix__cta"
              type="button"
              onClick={() => handleIntent(guidance.focus.intent)}
            >
              {guidance.focus.actionLabel}
            </button>
          )}
        </div>
      </section>

      {/* ═══ Quick Action Rail ═══ */}
      <div className="health-action-rail">
        <button
          className="health-action-rail__btn health-action-rail__btn--water"
          type="button"
          onClick={() => addWaterMutation.mutate(250)}
        >
          +250ml
        </button>
        <button
          className="health-action-rail__btn health-action-rail__btn--water"
          type="button"
          onClick={() => addWaterMutation.mutate(500)}
        >
          +500ml
        </button>
        <button
          className={`health-action-rail__btn${activeForm === "meal" ? " health-action-rail__btn--active" : ""}`}
          type="button"
          onClick={() => setActiveForm(activeForm === "meal" ? null : "meal")}
        >
          Log meal
        </button>
        <button
          className={`health-action-rail__btn${activeForm === "workout" ? " health-action-rail__btn--active" : ""}`}
          type="button"
          onClick={() => setActiveForm(activeForm === "workout" ? null : "workout")}
        >
          Workout
        </button>
        <button
          className={`health-action-rail__btn${activeForm === "weight" ? " health-action-rail__btn--active" : ""}`}
          type="button"
          onClick={() => setActiveForm(activeForm === "weight" ? null : "weight")}
        >
          Log weight
        </button>
      </div>

      {/* ═══ Inline Forms ═══ */}
      {activeForm === "meal" && (
        <MealLogForm
          templates={templates}
          plannedMeals={plannedMeals}
          isPending={addMealMutation.isPending}
          onSave={(p) => { void addMealMutation.mutateAsync(p).then(() => setActiveForm(null)); }}
          onCancel={() => setActiveForm(null)}
        />
      )}

      {activeForm === "weight" && (
        <WeightEntryForm
          defaultUnit={currentDay.latestWeight?.unit ?? "kg"}
          isPending={addWeightMutation.isPending}
          onSave={(v, u) => { void addWeightMutation.mutateAsync({ weightValue: v, unit: u, measuredOn: today }).then(() => setActiveForm(null)); }}
          onCancel={() => setActiveForm(null)}
        />
      )}

      {activeForm === "workout" && (
        <div className="health-workout-toggle">
          <span className="health-workout-toggle__label">Update workout status</span>
          <div className="health-workout-toggle__current">
            <span className="health-workout-toggle__plan">
              {currentDay.workoutDay?.plannedLabel ?? "Today"}
            </span>
            <span className="tag tag--neutral">{formatWorkoutStatus(currentDay.workoutDay?.actualStatus)}</span>
          </div>
          <div className="segmented-control">
            <button
              className={`segmented-control__option${currentDay.workoutDay?.actualStatus === "completed" ? " segmented-control__option--active" : ""}`}
              type="button"
              onClick={() => { updateWorkoutMutation.mutate({ planType: "workout", actualStatus: "completed", plannedLabel: currentDay.workoutDay?.plannedLabel ?? "Workout" }); setActiveForm(null); }}
            >
              Completed
            </button>
            <button
              className={`segmented-control__option${currentDay.workoutDay?.actualStatus === "recovery_respected" ? " segmented-control__option--active" : ""}`}
              type="button"
              onClick={() => { updateWorkoutMutation.mutate({ planType: "recovery", actualStatus: "recovery_respected", plannedLabel: "Recovery" }); setActiveForm(null); }}
            >
              Rest day
            </button>
            <button
              className={`segmented-control__option${currentDay.workoutDay?.actualStatus === "missed" ? " segmented-control__option--active" : ""}`}
              type="button"
              onClick={() => { updateWorkoutMutation.mutate({ planType: "workout", actualStatus: "missed", plannedLabel: currentDay.workoutDay?.plannedLabel ?? "Workout" }); setActiveForm(null); }}
            >
              Missed
            </button>
          </div>
        </div>
      )}

      {/* ═══ Section errors ═══ */}
      {healthQuery.data.sectionErrors.waterLogs && (
        <InlineErrorState
          message={healthQuery.data.sectionErrors.waterLogs.message}
          onRetry={() => void healthQuery.refetch()}
        />
      )}
      {(healthQuery.data.sectionErrors.mealTemplates || healthQuery.data.sectionErrors.mealLogs) && (
        <InlineErrorState
          message={healthQuery.data.sectionErrors.mealTemplates?.message ?? healthQuery.data.sectionErrors.mealLogs?.message ?? "Meal data could not load."}
          onRetry={() => void healthQuery.refetch()}
        />
      )}

      {/* ═══ Recommendations ═══ */}
      {filteredRecommendations.length > 0 && (
        <div className="health-recs">
          <div className="health-recs__title">Recovery actions</div>
          {filteredRecommendations.map((rec: HealthGuidanceItem) => (
            <div className="health-rec" key={rec.id}>
              <div className={`health-rec__indicator health-rec__indicator--${rec.tone}`} />
              <div className="health-rec__content">
                <div className="health-rec__title">{rec.title}</div>
                <div className="health-rec__detail">{rec.detail}</div>
              </div>
              <button
                className="health-rec__action"
                type="button"
                onClick={() => handleIntent(rec.intent)}
              >
                {rec.actionLabel}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ═══ Daily Timeline ═══ */}
      <section className="health-timeline-section">
        <div className="health-section-label">Today&apos;s activity</div>
        {timeline.length > 0 ? (
          <div className="health-timeline">
            {timeline.map((item) => {
              const realId = item.id.split(":").slice(1).join(":");

              return (
                <div key={item.id}>
                  <TimelineRow
                    item={item}
                    onEdit={() => handleTimelineEdit(item)}
                    onDelete={() => handleTimelineDelete(item)}
                    canDelete={item.kind !== "workout"}
                  />

                  {/* Inline edit forms for water */}
                  {item.kind === "water" && editingWaterId === realId && (
                    <div className="inline-editor" style={{ marginLeft: "1.75rem" }}>
                      <div className="stack-form">
                        <label className="field">
                          <span>Amount (ml)</span>
                          <input type="number" min="0" value={editWaterMl} autoFocus onChange={(e) => setEditWaterMl(e.target.value)} onKeyDown={(e) => {
                            if (e.key === "Enter") { const v = parseInt(editWaterMl, 10); if (v > 0) { void updateWaterMutation.mutateAsync({ waterLogId: realId, amountMl: v }).then(() => setEditingWaterId(null)); } }
                            if (e.key === "Escape") setEditingWaterId(null);
                          }} />
                        </label>
                        <div className="button-row button-row--tight">
                          <button className="button button--primary button--small" type="button" disabled={updateWaterMutation.isPending} onClick={() => { const v = parseInt(editWaterMl, 10); if (v > 0) void updateWaterMutation.mutateAsync({ waterLogId: realId, amountMl: v }).then(() => setEditingWaterId(null)); }}>
                            {updateWaterMutation.isPending ? "Saving..." : "Save"}
                          </button>
                          <button className="button button--ghost button--small" type="button" onClick={() => setEditingWaterId(null)}>Cancel</button>
                        </div>
                      </div>
                    </div>
                  )}
                  {item.kind === "water" && deletingWaterId === realId && (
                    <div className="confirm-bar" style={{ marginLeft: "1.75rem" }}>
                      <span className="confirm-bar__text">Delete this water log?</span>
                      <button className="button button--ghost button--small" type="button" disabled={deleteWaterMutation.isPending} onClick={() => void deleteWaterMutation.mutateAsync(realId).then(() => setDeletingWaterId(null))}>
                        {deleteWaterMutation.isPending ? "Deleting..." : "Confirm"}
                      </button>
                      <button className="button button--ghost button--small" type="button" onClick={() => setDeletingWaterId(null)}>Cancel</button>
                    </div>
                  )}

                  {/* Inline edit forms for meals */}
                  {item.kind === "meal" && editingMealId === realId && (
                    <div className="inline-editor" style={{ marginLeft: "1.75rem" }}>
                      <div className="stack-form">
                        <label className="field">
                          <span>Description</span>
                          <input type="text" value={editMealDesc} autoFocus onChange={(e) => setEditMealDesc(e.target.value)} onKeyDown={(e) => {
                            if (e.key === "Enter" && editMealDesc.trim()) void updateMealMutation.mutateAsync({ mealLogId: realId, description: editMealDesc.trim(), mealSlot: editMealSlot }).then(() => setEditingMealId(null));
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
                          <button className="button button--primary button--small" type="button" disabled={updateMealMutation.isPending} onClick={() => { if (editMealDesc.trim()) void updateMealMutation.mutateAsync({ mealLogId: realId, description: editMealDesc.trim(), mealSlot: editMealSlot }).then(() => setEditingMealId(null)); }}>
                            {updateMealMutation.isPending ? "Saving..." : "Save"}
                          </button>
                          <button className="button button--ghost button--small" type="button" onClick={() => setEditingMealId(null)}>Cancel</button>
                        </div>
                      </div>
                    </div>
                  )}
                  {item.kind === "meal" && deletingMealId === realId && (
                    <div className="confirm-bar" style={{ marginLeft: "1.75rem" }}>
                      <span className="confirm-bar__text">Delete this meal log?</span>
                      <button className="button button--ghost button--small" type="button" disabled={deleteMealMutation.isPending} onClick={() => void deleteMealMutation.mutateAsync(realId).then(() => setDeletingMealId(null))}>
                        {deleteMealMutation.isPending ? "Deleting..." : "Confirm"}
                      </button>
                      <button className="button button--ghost button--small" type="button" onClick={() => setDeletingMealId(null)}>Cancel</button>
                    </div>
                  )}

                  {/* Inline edit forms for weight */}
                  {item.kind === "weight" && editingWeightId === realId && (
                    <div className="inline-editor" style={{ marginLeft: "1.75rem" }}>
                      <div className="stack-form">
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
                          <label className="field" style={{ flex: 1 }}>
                            <span>Weight</span>
                            <input type="number" step="0.1" min="0" value={editWeightVal} autoFocus onChange={(e) => setEditWeightVal(e.target.value)} onKeyDown={(e) => {
                              if (e.key === "Enter") { const v = parseNumberValue(editWeightVal); if (v) void updateWeightMutation.mutateAsync({ weightLogId: realId, weightValue: v, unit: editWeightUnit }).then(() => setEditingWeightId(null)); }
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
                          <button className="button button--primary button--small" type="button" disabled={updateWeightMutation.isPending} onClick={() => { const v = parseNumberValue(editWeightVal); if (v) void updateWeightMutation.mutateAsync({ weightLogId: realId, weightValue: v, unit: editWeightUnit }).then(() => setEditingWeightId(null)); }}>
                            {updateWeightMutation.isPending ? "Saving..." : "Save"}
                          </button>
                          <button className="button button--ghost button--small" type="button" onClick={() => setEditingWeightId(null)}>Cancel</button>
                        </div>
                      </div>
                    </div>
                  )}
                  {item.kind === "weight" && deletingWeightId === realId && (
                    <div className="confirm-bar" style={{ marginLeft: "1.75rem" }}>
                      <span className="confirm-bar__text">Delete this weight entry?</span>
                      <button className="button button--ghost button--small" type="button" disabled={deleteWeightMutation.isPending} onClick={() => void deleteWeightMutation.mutateAsync(realId).then(() => setDeletingWeightId(null))}>
                        {deleteWeightMutation.isPending ? "Deleting..." : "Confirm"}
                      </button>
                      <button className="button button--ghost button--small" type="button" onClick={() => setDeletingWeightId(null)}>Cancel</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="health-timeline__empty">
            No activity logged yet today. Use the quick actions above to get started.
          </div>
        )}
      </section>

      {/* ═══ Weekly Patterns ═══ */}
      <section
        className="health-patterns-section"
        id="health-patterns"
        style={homeFocusHighlight === "patterns"
          ? {
              borderColor: "rgba(217, 153, 58, 0.4)",
              boxShadow: "0 0 0 1px rgba(217, 153, 58, 0.25)",
              background: "rgba(217, 153, 58, 0.04)",
            }
          : undefined}
      >
        <div className="health-section-label">7-day patterns</div>
        <div className="health-patterns">
          <div className="health-pattern">
            <span className="health-pattern__label">Hydration</span>
            <span className="health-pattern__value">{insights.waterDaysOnTarget}/7</span>
            <span className="health-pattern__context">days on target</span>
            <div className="health-pattern__bar">
              <div
                className="health-pattern__bar-fill health-pattern__bar-fill--water"
                style={{ width: `${(insights.waterDaysOnTarget / 7) * 100}%` }}
              />
            </div>
          </div>
          <div className="health-pattern">
            <span className="health-pattern__label">Meals</span>
            <span className="health-pattern__value">{insights.mealLoggingDays}/7</span>
            <span className="health-pattern__context">
              {insights.meaningfulMealDays > 0 ? `${insights.meaningfulMealDays} meaningful` : "days logged"}
            </span>
            <div className="health-pattern__bar">
              <div
                className="health-pattern__bar-fill health-pattern__bar-fill--meals"
                style={{ width: `${(insights.mealLoggingDays / 7) * 100}%` }}
              />
            </div>
          </div>
          <div className="health-pattern">
            <span className="health-pattern__label">Workouts</span>
            <span className="health-pattern__value">
              {insights.workoutCompletionRate !== null ? `${insights.workoutCompletionRate}%` : "—"}
            </span>
            <span className="health-pattern__context">
              {insights.workoutsMissed > 0 ? `${insights.workoutsMissed} missed` : "completion rate"}
            </span>
            {insights.workoutCompletionRate !== null && (
              <div className="health-pattern__bar">
                <div
                  className="health-pattern__bar-fill health-pattern__bar-fill--workout"
                  style={{ width: `${insights.workoutCompletionRate}%` }}
                />
              </div>
            )}
          </div>
          <div className="health-pattern">
            <span className="health-pattern__label">Weight</span>
            <span className="health-pattern__value">
              {insights.weightChange !== null
                ? `${insights.weightChange > 0 ? "+" : ""}${insights.weightChange.toFixed(1)} ${insights.weightUnit ?? "kg"}`
                : "—"}
            </span>
            <span className="health-pattern__context">
              {insights.weightChange !== null
                ? insights.weightChange < 0 ? "trending down" : insights.weightChange > 0 ? "trending up" : "stable"
                : "not enough data"}
            </span>
          </div>
        </div>
      </section>

      {/* ═══ Meal Templates (collapsible secondary) ═══ */}
      <section className="health-templates-section">
        <button
          className="health-templates-toggle"
          type="button"
          onClick={() => setShowTemplates(!showTemplates)}
        >
          <span className="health-section-label" style={{ margin: 0 }}>
            Meal templates
          </span>
          <span className={`health-templates-toggle__caret${showTemplates ? " health-templates-toggle__caret--open" : ""}`}>
            &#9660;
          </span>
        </button>
        {showTemplates && <MealTemplateManager />}
      </section>
    </div>
  );
}
