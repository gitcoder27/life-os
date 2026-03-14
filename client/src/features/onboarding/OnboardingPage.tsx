import { onboardingSteps } from "../../shared/lib/demo-data";
import { PageHeader } from "../../shared/ui/PageHeader";
import { SectionCard } from "../../shared/ui/SectionCard";

export function OnboardingPage() {
  return (
    <div className="page page--wide">
      <PageHeader
        eyebrow="First-run setup"
        title="Create the first useful Life OS state"
        description="The onboarding flow stays practical: goals, routines, defaults, and review preferences. Draft persistence can be layered in next."
      />

      <div className="step-grid">
        {onboardingSteps.map((step, index) => (
          <SectionCard
            key={step.title}
            title={`${index + 1}. ${step.title}`}
            subtitle={step.summary}
          >
            <ul className="list">
              {step.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
