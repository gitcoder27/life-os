import {
  attentionItems,
  financeSnapshot,
  healthSnapshot,
  homeMetrics,
  priorityStack,
  routines,
  scoreBuckets,
  taskItems,
} from "../../shared/lib/demo-data";
import { MetricPill } from "../../shared/ui/MetricPill";
import { ScoreRing } from "../../shared/ui/ScoreRing";
import { SectionCard } from "../../shared/ui/SectionCard";

export function HomePage() {
  return (
    <div className="page">
      <section className="score-hero">
        <div className="score-hero__primary">
          <p className="score-hero__label">Daily score</p>
          <div className="score-hero__ring-area">
            <ScoreRing value={78} label="Solid day" size={140} />
            <div>
              <div className="score-hero__value-row">
                <span className="score-hero__value">78</span>
                <span className="score-hero__band">Solid day</span>
              </div>
              <p className="score-hero__copy">
                Momentum holds because routines are on track. The biggest gap is the unfinished third priority.
              </p>
            </div>
          </div>
          <div className="bucket-bar">
            {scoreBuckets.filter(b => b.possible > 0).map((b) => (
              <div key={b.label} className="bucket-row">
                <span className="bucket-row__label">{b.label}</span>
                <div className="bucket-row__bar">
                  <div
                    className="bucket-row__fill"
                    style={{ width: `${(b.earned / b.possible) * 100}%` }}
                  />
                </div>
                <span className="bucket-row__value">
                  {Math.round(b.earned)}/{b.possible}
                </span>
              </div>
            ))}
          </div>
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

      <div className="dashboard-grid stagger">
        <SectionCard
          title="Attention"
          subtitle="Items needing action now"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {attentionItems.map((item) => (
              <div key={item.title} className="attention-item">
                <span className="attention-item__icon" />
                <div>
                  <div className="attention-item__title">{item.title}</div>
                  <div className="attention-item__detail">{item.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Top priorities"
          subtitle="Ordered by importance"
        >
          <ol className="priority-list">
            {priorityStack.map((priority) => (
              <li
                key={priority.title}
                className={priority.done ? "priority-list__item priority-list__item--done" : "priority-list__item"}
              >
                <span>{priority.title}</span>
                <span className={priority.done ? "tag tag--positive" : "tag tag--warning"}>
                  {priority.done ? "done" : "open"}
                </span>
              </li>
            ))}
          </ol>
        </SectionCard>

        <SectionCard
          title="Task lane"
          subtitle="Today only"
        >
          <ul className="list">
            {taskItems.map((task) => (
              <li key={task.title}>
                <div>
                  <strong>{task.title}</strong>
                  <div className="list__subtle">{task.detail}</div>
                </div>
                <button className="button button--ghost button--small" type="button">Done</button>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="Routines"
          subtitle="Morning and evening"
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
          subtitle="Body basics today"
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
          subtitle="Spend visibility"
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
