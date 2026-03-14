import { healthSnapshot } from "../../shared/lib/demo-data";
import { PageHeader } from "../../shared/ui/PageHeader";
import { SectionCard } from "../../shared/ui/SectionCard";

export function HealthPage() {
  return (
    <div className="page">
      <PageHeader
        eyebrow="Health basics"
        title="Water, meals, training, body weight"
        description="This bootstrap keeps the health surface high-signal and low-friction. The backend will later drive the real summary payloads."
      />

      <div className="dashboard-grid">
        {healthSnapshot.map((item) => (
          <SectionCard
            key={item.label}
            title={item.label}
            subtitle={item.value}
          >
            <button
              className="button button--ghost"
              type="button"
            >
              Quick update
            </button>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
