import { useState } from "react";

import {
  waterProgress,
  mealLogs,
  workoutStatus,
  weightLogs,
} from "../../shared/lib/demo-data";
import { PageHeader } from "../../shared/ui/PageHeader";
import { SectionCard } from "../../shared/ui/SectionCard";

export function HealthPage() {
  const [water, setWater] = useState(waterProgress.current);
  const pct = Math.min(100, (water / waterProgress.target) * 100);

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
              <span className="water-tracker__current">{water.toFixed(1)}{waterProgress.unit}</span>
              <span className="water-tracker__target">/ {waterProgress.target}{waterProgress.unit}</span>
            </div>
            <div className="progress-bar">
              <div className="progress-bar__fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="button-row">
              <button
                className="button button--ghost button--small"
                type="button"
                onClick={() => setWater((w) => Math.min(w + 0.25, waterProgress.target * 1.5))}
              >
                +250ml
              </button>
              <button
                className="button button--ghost button--small"
                type="button"
                onClick={() => setWater((w) => Math.min(w + 0.5, waterProgress.target * 1.5))}
              >
                +500ml
              </button>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Meals"
          subtitle={`${mealLogs.filter((m) => m.logged).length} of ${mealLogs.length} logged`}
        >
          <div>
            {mealLogs.map((meal) => (
              <div key={meal.name} className="habit-item">
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
                  <button className="button button--ghost button--small" type="button">Log</button>
                )}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Workout"
          subtitle={workoutStatus.type}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem" }}>
                {workoutStatus.duration}
              </span>
              <span className="tag tag--positive">{workoutStatus.status}</span>
            </div>
            <div className="button-row">
              <button className="button button--ghost button--small" type="button">Rest day</button>
              <button className="button button--ghost button--small" type="button">Log workout</button>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Body weight"
          subtitle="Recent entries"
        >
          <div>
            {weightLogs.map((entry) => (
              <div key={entry.date} className="expense-row">
                <div className="expense-row__info">
                  <div className="expense-row__title">{entry.value}</div>
                  <div className="expense-row__meta">{entry.date}</div>
                </div>
              </div>
            ))}
          </div>
          <button
            className="button button--ghost button--small"
            type="button"
            style={{ marginTop: "0.5rem" }}
          >
            Add entry
          </button>
        </SectionCard>
      </div>
    </div>
  );
}
