import { useState } from "react";

import { habits, morningRoutine, eveningRoutine } from "../../shared/lib/demo-data";
import { PageHeader } from "../../shared/ui/PageHeader";
import { SectionCard } from "../../shared/ui/SectionCard";

export function HabitsPage() {
  const [checkedHabits, setCheckedHabits] = useState<Set<string>>(
    new Set(habits.filter((h) => h.state === "Complete").map((h) => h.title)),
  );
  const [checkedMorning, setCheckedMorning] = useState<Set<string>>(
    new Set(morningRoutine.filter((r) => r.done).map((r) => r.title)),
  );
  const [checkedEvening, setCheckedEvening] = useState<Set<string>>(
    new Set(eveningRoutine.filter((r) => r.done).map((r) => r.title)),
  );

  function toggleItem(set: Set<string>, setFn: (s: Set<string>) => void, key: string) {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setFn(next);
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Consistency"
        title="Habits and routines"
        description="One-tap completion for due items. Streaks and routines visible at a glance."
      />

      <div className="dashboard-grid stagger">
        <SectionCard title="Due today" subtitle={`${checkedHabits.size} of ${habits.length} complete`}>
          <div>
            {habits.map((habit) => (
              <div key={habit.title} className="habit-item">
                <button
                  className={`habit-item__check${checkedHabits.has(habit.title) ? " habit-item__check--done" : ""}`}
                  type="button"
                  onClick={() => toggleItem(checkedHabits, setCheckedHabits, habit.title)}
                  aria-label={`Mark ${habit.title} ${checkedHabits.has(habit.title) ? "incomplete" : "complete"}`}
                >
                  {checkedHabits.has(habit.title) ? "\u2713" : ""}
                </button>
                <div className="habit-item__info">
                  <div className="habit-item__title">{habit.title}</div>
                  <div className="habit-item__detail">{habit.detail}</div>
                </div>
                <span className="streak-badge">{habit.detail.split(" ")[1]} {habit.detail.split(" ")[0].toLowerCase()}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Morning routine" subtitle={`${checkedMorning.size} of ${morningRoutine.length}`}>
          <div>
            {morningRoutine.map((item) => (
              <div key={item.title} className="habit-item">
                <button
                  className={`habit-item__check${checkedMorning.has(item.title) ? " habit-item__check--done" : ""}`}
                  type="button"
                  onClick={() => toggleItem(checkedMorning, setCheckedMorning, item.title)}
                  aria-label={`Mark ${item.title}`}
                >
                  {checkedMorning.has(item.title) ? "\u2713" : ""}
                </button>
                <div className="habit-item__info">
                  <div className="habit-item__title">{item.title}</div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Evening routine" subtitle={`${checkedEvening.size} of ${eveningRoutine.length}`}>
          <div>
            {eveningRoutine.map((item) => (
              <div key={item.title} className="habit-item">
                <button
                  className={`habit-item__check${checkedEvening.has(item.title) ? " habit-item__check--done" : ""}`}
                  type="button"
                  onClick={() => toggleItem(checkedEvening, setCheckedEvening, item.title)}
                  aria-label={`Mark ${item.title}`}
                >
                  {checkedEvening.has(item.title) ? "\u2713" : ""}
                </button>
                <div className="habit-item__info">
                  <div className="habit-item__title">{item.title}</div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Consistency" subtitle="Last 7 days">
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "end", height: "3rem" }}>
            {[85, 90, 70, 100, 65, 80, 78].map((v, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${v}%`,
                  borderRadius: "var(--r-xs)",
                  background: v >= 70
                    ? "linear-gradient(180deg, var(--accent), rgba(217,153,58,0.3))"
                    : "rgba(255,255,255,0.06)",
                  transition: "height 0.6s var(--ease)",
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.4rem" }}>
            <span className="list__subtle">Mon</span>
            <span className="list__subtle">Sun</span>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
