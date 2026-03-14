import {
  attentionItems,
  financeSnapshot,
  healthSnapshot,
  homeMetrics,
  priorityStack,
  routines,
  taskItems,
} from "../../shared/lib/demo-data";
import { MetricPill } from "../../shared/ui/MetricPill";
import { PageHeader } from "../../shared/ui/PageHeader";
import { SectionCard } from "../../shared/ui/SectionCard";

export function HomePage() {
  return (
    <div className="page">
      <PageHeader
        eyebrow="Home dashboard"
        title="What matters today"
        description="This is the command-center shell. It prioritizes score, attention, and next actions before deeper module views."
      />

      <section className="score-hero">
        <div className="score-hero__primary">
          <p className="score-hero__label">Daily score</p>
          <div className="score-hero__value-row">
            <span className="score-hero__value">78</span>
            <span className="score-hero__band">Solid day</span>
          </div>
          <p className="score-hero__copy">
            Momentum holds because routines are on track. The biggest gap is
            still the unfinished third priority.
          </p>
        </div>
        <div className="score-hero__metrics">
          {homeMetrics.map((metric) => (
            <MetricPill
              key={metric.label}
              label={metric.label}
              value={metric.value}
            />
          ))}
        </div>
      </section>

      <div className="dashboard-grid">
        <SectionCard
          title="Attention"
          subtitle="Rule-driven prompts from the backend"
        >
          <ul className="list">
            {attentionItems.map((item) => (
              <li key={item.title}>
                <strong>{item.title}</strong>
                <span className="list__subtle">{item.detail}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="Top priorities"
          subtitle="Ordered by importance, not by volume"
        >
          <ol className="priority-list">
            {priorityStack.map((priority) => (
              <li
                key={priority.title}
                className={priority.done ? "priority-list__item priority-list__item--done" : "priority-list__item"}
              >
                <span>{priority.title}</span>
                <span>{priority.done ? "done" : "open"}</span>
              </li>
            ))}
          </ol>
        </SectionCard>

        <SectionCard
          title="Task lane"
          subtitle="Only the current day matters here"
        >
          <ul className="list">
            {taskItems.map((task) => (
              <li key={task.title}>
                <strong>{task.title}</strong>
                <span className="list__subtle">{task.detail}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="Routines"
          subtitle="Morning and evening structure"
        >
          <ul className="list">
            {routines.map((routine) => (
              <li key={routine.title}>
                <strong>{routine.title}</strong>
                <span className="list__subtle">{routine.detail}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="Health snapshot"
          subtitle="High-signal basics only"
        >
          <ul className="list">
            {healthSnapshot.map((item) => (
              <li key={item.label}>
                <strong>{item.label}</strong>
                <span className="list__subtle">{item.value}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="Finance snapshot"
          subtitle="Spend visibility without accounting depth"
        >
          <ul className="list">
            {financeSnapshot.map((item) => (
              <li key={item.label}>
                <strong>{item.label}</strong>
                <span className="list__subtle">{item.value}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
