import {
  useEffect,
  useState,
} from "react";
import { useLocation } from "react-router-dom";

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
import { HealthSubNav } from "./HealthSubNav";

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

type HealthIconName =
  | "activity"
  | "calendar"
  | "chevron"
  | "heart"
  | "meal"
  | "sun"
  | "water"
  | "weight"
  | "workout";

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

function HealthIcon({
  name,
  className = "",
}: {
  name: HealthIconName;
  className?: string;
}) {
  const content = (() => {
    switch (name) {
      case "activity":
        return <path d="M3 12h3l2-5 4 10 3-7 2 2h4" />;
      case "calendar":
        return (
          <>
            <rect x="4" y="5" width="16" height="15" rx="2" />
            <path d="M8 3v4M16 3v4M4 10h16" />
          </>
        );
      case "chevron":
        return <path d="M9 6l6 6-6 6" />;
      case "heart":
        return <path d="M20.4 5.9c-1.6-1.8-4.2-1.9-6-.3L12 8l-2.4-2.4c-1.8-1.6-4.4-1.5-6 .3-1.7 1.9-1.5 4.8.3 6.5L12 20l8.1-7.6c1.8-1.7 2-4.6.3-6.5z" />;
      case "meal":
        return (
          <>
            <path d="M7 3v8M5 3v4M9 3v4M5 7h4M7 11v10" />
            <path d="M16 3v18M16 3c2 1.2 3 3.2 3 6v3h-3" />
          </>
        );
      case "sun":
        return (
          <>
            <circle cx="12" cy="12" r="3.5" />
            <path d="M12 2v3M12 19v3M4.9 4.9L7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1" />
          </>
        );
      case "water":
        return <path d="M12 3.5S6.5 10 6.5 14a5.5 5.5 0 0011 0C17.5 10 12 3.5 12 3.5z" />;
      case "weight":
        return (
          <>
            <rect x="5" y="6" width="14" height="14" rx="2.5" />
            <path d="M9 10a3 3 0 016 0M12 10v2" />
          </>
        );
      case "workout":
        return (
          <>
            <path d="M4 10v4M8 8v8M16 8v8M20 10v4M8 12h8" />
          </>
        );
      default:
        return null;
    }
  })();

  return (
    <svg
      aria-hidden="true"
      className={`health-icon${className ? ` ${className}` : ""}`}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      {content}
    </svg>
  );
}

function MiniWeekBars({
  activeCount,
  tone,
}: {
  activeCount: number;
  tone: "meal" | "water" | "workout";
}) {
  const activeBars = Math.max(0, Math.min(7, Math.round(activeCount)));

  return (
    <div className="health-mini-week" aria-hidden="true">
      <div className="health-mini-week__bars">
        {WEEKDAY_LABELS.map((label, index) => (
          <span
            className={`health-mini-week__bar${index < activeBars ? ` health-mini-week__bar--${tone}` : ""}`}
            key={`${label}-${index}`}
            style={{ height: `${1.5 + ((index + 2) % 3) * 0.28}rem` }}
          />
        ))}
      </div>
      <div className="health-mini-week__labels">
        {WEEKDAY_LABELS.map((label, index) => (
          <span key={`${label}-label-${index}`}>{label}</span>
        ))}
      </div>
    </div>
  );
}

function WeightTrendPreview({ change }: { change: number | null }) {
  const points = change === null
    ? "6,26 32,26 58,26 84,26 110,26"
    : change < 0
      ? "6,30 32,27 58,25 84,21 110,18"
      : change > 0
        ? "6,18 32,21 58,24 84,27 110,30"
        : "6,25 32,24 58,25 84,24 110,25";

  return (
    <div className="health-weight-preview" aria-hidden="true">
      <svg viewBox="0 0 116 44">
        <polyline className="health-weight-preview__line" points={points} />
        {[6, 32, 58, 84, 110].map((x) => (
          <circle className="health-weight-preview__point" cx={x} cy="26" key={x} r="2.4" />
        ))}
      </svg>
      <div className="health-mini-week__labels">
        {WEEKDAY_LABELS.map((label, index) => (
          <span key={`${label}-weight-${index}`}>{label}</span>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Health Page — Main Component
   ═══════════════════════════════════════════════ */

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
  const waterProgressPct = clampPercent(signals.water.progressPct);
  const mealProgressPct = clampPercent(signals.meals.progressPct);
  const mealTargetCount = signals.meals.targetCount || 3;
  const waterRingSize = 170;
  const waterRingStroke = 12;
  const waterRingRadius = (waterRingSize - waterRingStroke) / 2;
  const waterRingCircumference = 2 * Math.PI * waterRingRadius;
  const waterRingOffset = waterRingCircumference - (waterProgressPct / 100) * waterRingCircumference;
  const waterStatusText = signals.water.status === "complete"
    ? "Target hit"
    : signals.water.status === "on_track"
      ? "On pace"
      : `${waterPaceShortfallMl} ml behind`;
  const mealStatusText = signals.meals.status === "complete"
    ? "All logged"
    : signals.meals.nextSuggestedSlot
      ? `Next: ${formatMealSlotLabel(signals.meals.nextSuggestedSlot)}`
      : signals.meals.status === "on_track"
        ? "On track"
        : "Behind";
  const workoutStatusText = signals.workout.status === "complete"
    ? "Done"
    : signals.workout.status === "recovery"
      ? "Recovery"
      : signals.workout.status === "missed"
        ? "Missed"
        : "Open";
  const weeklyWorkoutCount = insights.workoutCompletionRate === null
    ? 0
    : (insights.workoutCompletionRate / 100) * 7;

  return (
    <div className="health-page">
      <div className="health-page__masthead">
        <h1 className="health-page__title">Health</h1>
        <HealthSubNav />
      </div>

      {(healthQuery.data.sectionErrors.waterLogs || healthQuery.data.sectionErrors.mealTemplates || healthQuery.data.sectionErrors.mealLogs) && (
        <div className="health-page__alerts">
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
        </div>
      )}

      <div className="health-dashboard-grid">
        <div className="health-primary-stack">
          <section className="health-daily-panel" id="health-pulse">
            <div className="health-daily-panel__top">
              <div className="health-daily-panel__heading">
                <HealthIcon name="sun" className="health-icon--muted" />
                <span className="health-daily-panel__title">Daily basics</span>
                <span className="health-daily-panel__phase">
                  <HealthIcon name="sun" />
                  {PHASE_LABEL[phase] ?? phase}
                </span>
              </div>
              <div className="health-daily-panel__actions">
                <span className={`health-score-pill health-score-pill--${score.label}`}>
                  <strong>{score.value}</strong>
                  {SCORE_LABEL[score.label] ?? score.label}
                </span>
                <button
                  className="health-outline-button"
                  disabled={addWaterMutation.isPending}
                  type="button"
                  onClick={() => addWaterMutation.mutate(500)}
                >
                  <HealthIcon name="water" />
                  Log water
                </button>
              </div>
            </div>

            <div className="health-daily-panel__metrics">
              <article className={`health-focus-metric health-focus-metric--water${homeFocusHighlight === "water" ? " health-focus-metric--highlight" : ""}`}>
                <div className="health-focus-metric__label">
                  <HealthIcon name="water" />
                  <span>Water</span>
                </div>
                <div className="health-water-orb" aria-label={`${(waterMl / 1000).toFixed(1)} liters of ${(waterTargetMl / 1000).toFixed(1)} liters`}>
                  <svg className="health-water-orb__ring" height={waterRingSize} width={waterRingSize} viewBox={`0 0 ${waterRingSize} ${waterRingSize}`}>
                    <circle
                      className="health-water-orb__track"
                      cx={waterRingSize / 2}
                      cy={waterRingSize / 2}
                      r={waterRingRadius}
                      strokeWidth={waterRingStroke}
                    />
                    <circle
                      className="health-water-orb__progress"
                      cx={waterRingSize / 2}
                      cy={waterRingSize / 2}
                      r={waterRingRadius}
                      strokeDasharray={waterRingCircumference}
                      strokeDashoffset={waterRingOffset}
                      strokeWidth={waterRingStroke}
                    />
                  </svg>
                  <div className="health-water-orb__pool" style={{ height: `${waterProgressPct}%` }} />
                  <div className="health-water-orb__value">
                    <strong>{(waterMl / 1000).toFixed(1)}</strong>
                    <span>L</span>
                  </div>
                  <div className="health-water-orb__target">/ {(waterTargetMl / 1000).toFixed(1)} L</div>
                </div>
                <div className={`health-focus-metric__status health-focus-metric__status--${signals.water.status}`}>
                  {waterStatusText}
                </div>
                <p className="health-focus-metric__hint">
                  {signals.water.status === "complete" ? "Hydration is covered." : "Stay consistent, you have got this."}
                </p>
              </article>

              <article className={`health-focus-metric health-focus-metric--meals${homeFocusHighlight === "meals" ? " health-focus-metric--highlight" : ""}`}>
                <div className="health-focus-metric__label">
                  <HealthIcon name="meal" />
                  <span>Meals</span>
                </div>
                <div className="health-meal-count">
                  <span className="health-meal-count__current">{currentDay.mealCount}</span>
                  <span className="health-meal-count__slash">/</span>
                  <span className="health-meal-count__target">{mealTargetCount}</span>
                </div>
                <span className="health-focus-metric__subtle">logged</span>
                <div className="health-meal-dots" aria-hidden="true">
                  {Array.from({ length: mealTargetCount }).map((_, index) => (
                    <span
                      className={`health-meal-dots__dot${index < currentDay.mealCount ? " health-meal-dots__dot--active" : ""}`}
                      key={index}
                    >
                      {index + 1}
                    </span>
                  ))}
                </div>
                <div className="health-progress-line" aria-hidden="true">
                  <span style={{ width: `${mealProgressPct}%` }} />
                </div>
                <p className="health-focus-metric__hint">{mealStatusText}</p>
              </article>

              <article className={`health-focus-metric health-focus-metric--workout${homeFocusHighlight === "workout" ? " health-focus-metric--highlight" : ""}`}>
                <div className="health-focus-metric__label">
                  <HealthIcon name="workout" />
                  <span>Workout</span>
                </div>
                <button
                  className={`health-workout-orb health-workout-orb--${signals.workout.status}`}
                  type="button"
                  onClick={() => setActiveForm(activeForm === "workout" ? null : "workout")}
                  aria-label="Update workout status"
                >
                  <HealthIcon name="calendar" />
                </button>
                <div className="health-workout-copy">
                  <strong>{signals.workout.label}</strong>
                  <span>{workoutStatusText}</span>
                </div>
              </article>
            </div>
          </section>

          <div className="health-action-strip" aria-label="Health quick actions">
            <button
              className="health-action-strip__button health-action-strip__button--water"
              disabled={addWaterMutation.isPending}
              type="button"
              onClick={() => addWaterMutation.mutate(250)}
            >
              <HealthIcon name="water" />
              <span>+250ml</span>
            </button>
            <button
              className="health-action-strip__button health-action-strip__button--water"
              disabled={addWaterMutation.isPending}
              type="button"
              onClick={() => addWaterMutation.mutate(500)}
            >
              <HealthIcon name="water" />
              <span>+500ml</span>
            </button>
            <button
              className={`health-action-strip__button${activeForm === "meal" ? " health-action-strip__button--active" : ""}`}
              type="button"
              onClick={() => setActiveForm(activeForm === "meal" ? null : "meal")}
            >
              <HealthIcon name="meal" />
              <span>Log meal</span>
            </button>
            <button
              className={`health-action-strip__button${activeForm === "workout" ? " health-action-strip__button--active" : ""}`}
              type="button"
              onClick={() => setActiveForm(activeForm === "workout" ? null : "workout")}
            >
              <HealthIcon name="workout" />
              <span>Workout</span>
            </button>
            <button
              className={`health-action-strip__button${activeForm === "weight" ? " health-action-strip__button--active" : ""}`}
              type="button"
              onClick={() => setActiveForm(activeForm === "weight" ? null : "weight")}
            >
              <HealthIcon name="weight" />
              <span>Log weight</span>
            </button>
          </div>

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
        </div>

        <aside className="health-secondary-stack">
          <section className="health-side-panel">
            <div className="health-side-panel__header">
              <HealthIcon name="heart" />
              <h2>Recovery actions</h2>
            </div>
            {filteredRecommendations.length > 0 ? (
              <div className="health-recovery-list">
                {filteredRecommendations.map((rec: HealthGuidanceItem) => (
                  <div className="health-recovery-row" key={rec.id}>
                    <span className={`health-recovery-row__dot health-recovery-row__dot--${rec.tone}`} />
                    <button
                      className="health-recovery-row__main"
                      type="button"
                      onClick={() => handleIntent(rec.intent)}
                    >
                      <span>{rec.title}</span>
                      <HealthIcon name="chevron" />
                    </button>
                    <button
                      className="health-outline-button health-outline-button--small"
                      type="button"
                      onClick={() => handleIntent(rec.intent)}
                    >
                      {rec.actionLabel}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="health-side-panel__empty">Nothing needs attention.</p>
            )}
          </section>

          <section className="health-side-panel health-side-panel--activity">
            <div className="health-side-panel__header">
              <HealthIcon name="activity" />
              <h2>Today&apos;s activity</h2>
            </div>
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

                      {item.kind === "water" && editingWaterId === realId && (
                        <div className="inline-editor health-timeline__editor">
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
                        <div className="confirm-bar health-timeline__editor">
                          <span className="confirm-bar__text">Delete this water log?</span>
                          <button className="button button--ghost button--small" type="button" disabled={deleteWaterMutation.isPending} onClick={() => void deleteWaterMutation.mutateAsync(realId).then(() => setDeletingWaterId(null))}>
                            {deleteWaterMutation.isPending ? "Deleting..." : "Confirm"}
                          </button>
                          <button className="button button--ghost button--small" type="button" onClick={() => setDeletingWaterId(null)}>Cancel</button>
                        </div>
                      )}

                      {item.kind === "meal" && editingMealId === realId && (
                        <div className="inline-editor health-timeline__editor">
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
                        <div className="confirm-bar health-timeline__editor">
                          <span className="confirm-bar__text">Delete this meal log?</span>
                          <button className="button button--ghost button--small" type="button" disabled={deleteMealMutation.isPending} onClick={() => void deleteMealMutation.mutateAsync(realId).then(() => setDeletingMealId(null))}>
                            {deleteMealMutation.isPending ? "Deleting..." : "Confirm"}
                          </button>
                          <button className="button button--ghost button--small" type="button" onClick={() => setDeletingMealId(null)}>Cancel</button>
                        </div>
                      )}

                      {item.kind === "weight" && editingWeightId === realId && (
                        <div className="inline-editor health-timeline__editor">
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
                        <div className="confirm-bar health-timeline__editor">
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
              <div className="health-activity-empty">
                <div className="health-activity-empty__icon">
                  <HealthIcon name="calendar" />
                </div>
                <strong>No activity logged yet</strong>
                <span>Use the quick actions to get started.</span>
              </div>
            )}
          </section>
        </aside>
      </div>

      <section
        className={`health-patterns-section${homeFocusHighlight === "patterns" ? " health-patterns-section--highlight" : ""}`}
        id="health-patterns"
      >
        <div className="health-patterns-section__header">
          <div className="health-section-label">7-day patterns</div>
          <button
            className="health-text-button"
            type="button"
            onClick={() => document.getElementById("health-patterns")?.scrollIntoView({ behavior: "smooth" })}
          >
            View details
          </button>
        </div>
        <div className="health-patterns">
          <div className="health-pattern">
            <div className="health-pattern__head">
              <HealthIcon name="water" />
              <span>Hydration</span>
            </div>
            <span className="health-pattern__value">{insights.waterDaysOnTarget}<small>/7</small></span>
            <span className="health-pattern__context">days on target</span>
            <MiniWeekBars activeCount={insights.waterDaysOnTarget} tone="water" />
          </div>
          <div className="health-pattern">
            <div className="health-pattern__head">
              <HealthIcon name="meal" />
              <span>Meals</span>
            </div>
            <span className="health-pattern__value">{insights.mealLoggingDays}<small>/7</small></span>
            <span className="health-pattern__context">
              {insights.meaningfulMealDays > 0 ? `${insights.meaningfulMealDays} meaningful` : "days logged"}
            </span>
            <MiniWeekBars activeCount={insights.mealLoggingDays} tone="meal" />
          </div>
          <div className="health-pattern">
            <div className="health-pattern__head">
              <HealthIcon name="workout" />
              <span>Workouts</span>
            </div>
            <span className="health-pattern__value">
              {insights.workoutCompletionRate !== null ? `${insights.workoutCompletionRate}%` : "—"}
            </span>
            <span className="health-pattern__context">
              {insights.workoutsMissed > 0 ? `${insights.workoutsMissed} missed` : "completion rate"}
            </span>
            <MiniWeekBars activeCount={weeklyWorkoutCount} tone="workout" />
          </div>
          <div className="health-pattern">
            <div className="health-pattern__head">
              <HealthIcon name="weight" />
              <span>Weight</span>
            </div>
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
            <WeightTrendPreview change={insights.weightChange} />
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
