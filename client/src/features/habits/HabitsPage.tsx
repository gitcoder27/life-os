import { habits } from "../../shared/lib/demo-data";
import { PageHeader } from "../../shared/ui/PageHeader";
import { SectionCard } from "../../shared/ui/SectionCard";

export function HabitsPage() {
  return (
    <div className="page">
      <PageHeader
        eyebrow="Consistency"
        title="Habits and routines"
        description="A lightweight management surface with one-tap completion, edit-in-place later, and room for streak visuals."
      />

      <div className="dashboard-grid">
        <SectionCard
          title="Due today"
          subtitle="Fast interaction path"
        >
          <ul className="habit-list">
            {habits.map((habit) => (
              <li key={habit.title}>
                <div>
                  <strong>{habit.title}</strong>
                  <span className="list__subtle">{habit.detail}</span>
                </div>
                <button
                  className="button button--ghost button--small"
                  type="button"
                >
                  {habit.state}
                </button>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="Routine shells"
          subtitle="Morning and evening"
        >
          <p className="support-copy">
            The bootstrap keeps routines visible without building the editor yet.
          </p>
        </SectionCard>
      </div>
    </div>
  );
}
