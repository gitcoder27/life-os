import { todayPlan } from "../../shared/lib/demo-data";
import { PageHeader } from "../../shared/ui/PageHeader";
import { SectionCard } from "../../shared/ui/SectionCard";

export function TodayPage() {
  return (
    <div className="page">
      <PageHeader
        eyebrow="Execution view"
        title="Today"
        description="Priorities, today-only tasks, and the immediate plan. Focus on what moves the day forward."
      />

      <div className="two-column-grid stagger">
        <SectionCard
          title="Priority stack"
          subtitle="Ordered by impact"
        >
          <ol className="priority-list">
            {todayPlan.priorities.map((item, i) => (
              <li
                key={item}
                className="priority-list__item"
              >
                <span>
                  <span className="tag tag--neutral" style={{ marginRight: "0.5rem" }}>P{i + 1}</span>
                  {item}
                </span>
                <button
                  className="button button--ghost button--small"
                  type="button"
                >
                  Done
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
                <div>
                  <strong>{item.title}</strong>
                  <div className="list__subtle">{item.detail}</div>
                </div>
                <button className="button button--ghost button--small" type="button">Done</button>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="Time blocks"
          subtitle="Day structure"
        >
          <div>
            {todayPlan.blocks.map((block) => {
              const parts = block.split(" | ");
              return (
                <div key={block} className="time-block">
                  <span className="time-block__time">{parts[0]}</span>
                  <span className="time-block__label">{parts[1] || block}</span>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          title="Meals and training"
          subtitle="Keep the day realistic"
        >
          <ul className="list">
            {todayPlan.planBits.map((item) => (
              <li key={item}>
                <span>{item}</span>
                <span className={
                  item.includes("complete") ? "tag tag--positive" :
                  item.includes("unplanned") ? "tag tag--warning" :
                  "tag tag--neutral"
                }>
                  {item.includes("complete") ? "done" : item.includes("unplanned") ? "open" : "queued"}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
