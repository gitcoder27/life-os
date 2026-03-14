import { useState } from "react";
import { Link } from "react-router-dom";

import { onboardingSteps } from "../../shared/lib/demo-data";
import { SectionCard } from "../../shared/ui/SectionCard";

export function OnboardingPage() {
  const [activeStep, setActiveStep] = useState(0);
  const step = onboardingSteps[activeStep];

  return (
    <div className="auth-layout" style={{ alignItems: "start", paddingTop: "3rem" }}>
      <div style={{ width: "min(100%, 44rem)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <span
            style={{
              display: "inline-flex",
              width: "2.4rem",
              height: "2.4rem",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "var(--r-sm)",
              background: "linear-gradient(135deg, rgba(217,153,58,0.2), rgba(217,153,58,0.06))",
              border: "1px solid rgba(217,153,58,0.25)",
              color: "var(--accent-bright)",
              fontFamily: "var(--font-display)",
              fontSize: "1.1rem",
              fontWeight: 600,
            }}
          >
            L
          </span>
          <div>
            <span className="page-eyebrow">First-run setup</span>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 500, marginTop: "0.15rem" }}>
              Create your Life OS
            </div>
          </div>
        </div>

        <div className="onboarding-stepper">
          {onboardingSteps.map((s, i) => (
            <button
              key={s.title}
              className={`onboarding-stepper__step${i < activeStep ? " onboarding-stepper__step--complete" : i === activeStep ? " onboarding-stepper__step--active" : ""}`}
              onClick={() => setActiveStep(i)}
              aria-label={`Step ${i + 1}: ${s.title}`}
              type="button"
            />
          ))}
        </div>

        <SectionCard
          title={`${activeStep + 1}. ${step.title}`}
          subtitle={step.summary}
        >
          <div className="stack-form" style={{ paddingTop: "0.5rem" }}>
            {step.items.map((item) => (
              <label key={item} className="field">
                <span>{item}</span>
                <input placeholder={`Enter ${item.toLowerCase()}...`} type="text" />
              </label>
            ))}
          </div>
        </SectionCard>

        <div className="button-row" style={{ marginTop: "1rem", justifyContent: "space-between" }}>
          <button
            className="button button--ghost"
            type="button"
            disabled={activeStep === 0}
            onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
          >
            Back
          </button>
          <div className="button-row">
            <span className="list__subtle" style={{ alignSelf: "center" }}>
              Step {activeStep + 1} of {onboardingSteps.length}
            </span>
            {activeStep < onboardingSteps.length - 1 ? (
              <button
                className="button button--primary"
                type="button"
                onClick={() => setActiveStep((s) => Math.min(onboardingSteps.length - 1, s + 1))}
              >
                Next
              </button>
            ) : (
              <Link className="button button--primary" to="/">
                Complete setup
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
