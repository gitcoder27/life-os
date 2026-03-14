import { NavLink, useParams } from "react-router-dom";

import { reviewCadences } from "../../shared/lib/demo-data";
import { PageHeader } from "../../shared/ui/PageHeader";
import { SectionCard } from "../../shared/ui/SectionCard";

export function ReviewsPage() {
  const { cadence = "daily" } = useParams();
  const cadenceKey =
    cadence === "daily" || cadence === "weekly" || cadence === "monthly"
      ? cadence
      : "daily";
  const config = reviewCadences[cadenceKey];

  const requiredCount = config.prompts.length;

  return (
    <div className="page">
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.25rem" }}>
        {(["daily", "weekly", "monthly"] as const).map((c) => (
          <NavLink
            key={c}
            to={`/reviews/${c}`}
            className={`button ${c === cadenceKey ? "button--primary" : "button--ghost"} button--small`}
          >
            {reviewCadences[c].label}
          </NavLink>
        ))}
      </div>

      <PageHeader
        eyebrow={`${config.label} review`}
        title={config.title}
        description={config.description}
      />

      <div className="review-progress">
        {config.prompts.map((_, i) => (
          <div
            key={i}
            className={`review-progress__step${i < 0 ? " review-progress__step--complete" : i === 0 ? " review-progress__step--active" : ""}`}
          />
        ))}
      </div>

      <div className="two-column-grid stagger">
        <SectionCard
          title="Prefilled summary"
          subtitle="System-generated overview"
        >
          <ul className="list">
            {config.summary.map((item) => (
              <li key={item}>
                <span>{item}</span>
                <span className="tag tag--neutral">auto</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="Required prompts"
          subtitle={`${requiredCount} sections to complete`}
        >
          <div className="stack-form">
            {config.prompts.map((prompt) => (
              <label key={prompt} className="field">
                <span>{prompt}</span>
                <textarea
                  placeholder="Type your response..."
                  rows={2}
                />
              </label>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="button-row" style={{ paddingTop: "0.5rem" }}>
        <button className="button button--ghost" type="button">Save draft</button>
        <button className="button button--primary" type="button">Submit review</button>
      </div>
    </div>
  );
}
