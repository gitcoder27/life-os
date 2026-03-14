import { useParams } from "react-router-dom";

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

  return (
    <div className="page">
      <PageHeader
        eyebrow={`${config.label} review`}
        title={config.title}
        description={config.description}
      />

      <div className="two-column-grid">
        <SectionCard
          title="Prefilled summary"
          subtitle="Backend-owned source of truth"
        >
          <ul className="list">
            {config.summary.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="Required prompts"
          subtitle="Draft support comes next"
        >
          <ul className="list">
            {config.prompts.map((prompt) => (
              <li key={prompt}>{prompt}</li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
