import { todayPlan } from "../../shared/lib/demo-data";
import { PageHeader } from "../../shared/ui/PageHeader";
import { SectionCard } from "../../shared/ui/SectionCard";

export function TodayPage() {
  return (
    <div className="page">
      <PageHeader
        eyebrow="Execution view"
        title="Today"
        description="This route focuses on priorities, today-only tasks, and the immediate plan. It avoids deep analytics."
      />

      <div className="two-column-grid">
        <SectionCard
          title="Priority stack"
          subtitle="Reorder-friendly shell"
        >
          <ol className="priority-list">
            {todayPlan.priorities.map((item) => (
              <li
                key={item}
                className="priority-list__item"
              >
                <span>{item}</span>
                <button
                  className="button button--ghost button--small"
                  type="button"
                >
                  Move
                </button>
              </li>
            ))}
          </ol>
        </SectionCard>

        <SectionCard
          title="Task lane"
          subtitle="Today only"
        >
          <ul className="list">
            {todayPlan.tasks.map((item) => (
              <li key={item.title}>
                <strong>{item.title}</strong>
                <span className="list__subtle">{item.detail}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="Time blocks"
          subtitle="Optional planning surface"
        >
          <ul className="list">
            {todayPlan.blocks.map((block) => (
              <li key={block}>{block}</li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="Meals and training"
          subtitle="Keep the day realistic"
        >
          <ul className="list">
            {todayPlan.planBits.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
