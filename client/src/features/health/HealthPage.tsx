import {
  formatMealSlotLabel,
  formatWorkoutStatus,
  getTodayDate,
  parseNumberValue,
  useAddMealMutation,
  useAddWaterMutation,
  useAddWeightMutation,
  useHealthDataQuery,
  useWorkoutMutation,
} from "../../shared/lib/api";
import { PageHeader } from "../../shared/ui/PageHeader";
import { SectionCard } from "../../shared/ui/SectionCard";

export function HealthPage() {
  const today = getTodayDate();
  const healthQuery = useHealthDataQuery(today);
  const addWaterMutation = useAddWaterMutation(today);
  const addMealMutation = useAddMealMutation(today);
  const updateWorkoutMutation = useWorkoutMutation(today);
  const addWeightMutation = useAddWeightMutation(today);
  const currentDay = healthQuery.data?.summary.currentDay;
  const waterMl = currentDay?.waterMl ?? 0;
  const waterTargetMl = currentDay?.waterTargetMl ?? 1;
  const pct = Math.min(100, (waterMl / waterTargetMl) * 100);
  const templates = healthQuery.data?.mealTemplates.mealTemplates ?? [];
  const mealLogs = healthQuery.data?.mealLogs.mealLogs ?? [];
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
  const weightLogs = healthQuery.data?.summary.weightHistory ?? [];

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
    </div>
  );
}
