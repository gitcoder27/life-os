import { useCallback, useEffect, useState } from "react";

import type { WeekPlanResponse } from "../../shared/lib/api";
import { useUpdateWeekCapacityMutation } from "../../shared/lib/api";

type CapacityMode = "light" | "standard" | "heavy";
type AssessmentStatus = "healthy" | "tight" | "overloaded";

type WeeklyCapacityLineProps = {
  weekStartDate: string;
  capacityProfile: WeekPlanResponse["capacityProfile"];
  capacityAssessment: WeekPlanResponse["capacityAssessment"];
  capacityProgress: WeekPlanResponse["capacityProgress"];
};

const modeLabels: Record<CapacityMode, string> = {
  light: "Light",
  standard: "Standard",
  heavy: "Heavy",
};

const modeDescriptions: Record<CapacityMode, string> = {
  light: "Fewer priorities, more breathing room",
  standard: "Normal load, balanced pace",
  heavy: "Ambitious week, full commitment",
};

const statusLabels: Record<AssessmentStatus, string> = {
  healthy: "Healthy",
  tight: "Tight",
  overloaded: "Overloaded",
};

const MIN_DEEP_WORK_BLOCKS = 0;
const MAX_DEEP_WORK_BLOCKS = 10;

const getAdvice = (signals: WeekPlanResponse["capacityAssessment"]["signals"]) => {
  switch (signals[0]) {
    case "deep_work_target_too_high":
      return "Lower the deep-work target.";
    case "too_many_priorities":
      return "Trim one weekly priority.";
    case "too_many_estimated_minutes":
      return "Reduce planned work volume.";
    case "too_many_unsized_tasks":
      return "Size the unsized work.";
    case "too_many_focus_goals":
      return "Narrow the number of focus goals.";
    default:
      return "Reduce one commitment.";
  }
};

/* One line in the commitments rail. The intensity and deep-work controls open
   in place; the week's full planning lives in Today. */
export function WeeklyCapacityLine({
  weekStartDate,
  capacityProfile,
  capacityAssessment,
  capacityProgress,
}: WeeklyCapacityLineProps) {
  const mutation = useUpdateWeekCapacityMutation(weekStartDate);
  const [isOpen, setIsOpen] = useState(false);
  const [localMode, setLocalMode] = useState<CapacityMode>(capacityProfile.capacityMode);
  const [localTarget, setLocalTarget] = useState<number>(capacityProfile.deepWorkBlockTarget);

  useEffect(() => {
    setLocalMode(capacityProfile.capacityMode);
    setLocalTarget(capacityProfile.deepWorkBlockTarget);
  }, [capacityProfile.capacityMode, capacityProfile.deepWorkBlockTarget, weekStartDate]);

  const save = useCallback(
    (mode: CapacityMode, target: number) => {
      mutation.mutate({
        capacityMode: mode,
        deepWorkBlockTarget: Math.max(MIN_DEEP_WORK_BLOCKS, Math.min(MAX_DEEP_WORK_BLOCKS, target)),
      });
    },
    [mutation],
  );

  const handleModeChange = (mode: CapacityMode) => {
    setLocalMode(mode);
    save(mode, localTarget);
  };

  const handleTargetChange = (delta: number) => {
    const next = Math.max(MIN_DEEP_WORK_BLOCKS, Math.min(MAX_DEEP_WORK_BLOCKS, localTarget + delta));
    setLocalTarget(next);
    save(localMode, next);
  };

  const { status, primaryMessage, signals } = capacityAssessment;
  const isSynced =
    localMode === capacityProfile.capacityMode && localTarget === capacityProfile.deepWorkBlockTarget;
  const summary = `${modeLabels[capacityProfile.capacityMode]} week · ${capacityProgress.completedDeepBlocks} of ${capacityProfile.deepWorkBlockTarget} deep blocks`;

  return (
    <div className={`ghq-capacity-line ghq-capacity-line--${status}`}>
      <div className="ghq-capacity-line__summary">
        <span className="ghq-capacity-line__text">
          {summary}
          {status !== "healthy" ? (
            <span className="ghq-capacity-line__status" title={primaryMessage}>
              {" · "}
              {statusLabels[status]}
            </span>
          ) : null}
        </span>
        <button
          className="ghq-rail__text-btn"
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          aria-expanded={isOpen}
        >
          {isOpen ? "Done" : "Adjust"}
        </button>
      </div>

      {status !== "healthy" ? (
        <p className="ghq-capacity-line__advice">{getAdvice(signals)}</p>
      ) : null}

      {isOpen ? (
        <div className="ghq-capacity-line__controls">
          <div className="ghq-capacity-line__field">
            <span>Intensity</span>
            <div className="ghq-capacity-line__modes" role="group" aria-label="Week intensity">
              {(["light", "standard", "heavy"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`ghq-capacity-line__mode${localMode === mode ? " ghq-capacity-line__mode--active" : ""}`}
                  onClick={() => handleModeChange(mode)}
                  disabled={mutation.isPending}
                  aria-pressed={localMode === mode}
                  title={modeDescriptions[mode]}
                >
                  {modeLabels[mode]}
                </button>
              ))}
            </div>
          </div>
          <div className="ghq-capacity-line__field">
            <span>Deep work blocks</span>
            <div className="ghq-capacity-line__stepper">
              <button
                type="button"
                onClick={() => handleTargetChange(-1)}
                disabled={localTarget <= MIN_DEEP_WORK_BLOCKS || mutation.isPending}
                aria-label="Decrease deep work blocks"
              >
                −
              </button>
              <span className="ghq-capacity-line__value">{localTarget}</span>
              <button
                type="button"
                onClick={() => handleTargetChange(1)}
                disabled={localTarget >= MAX_DEEP_WORK_BLOCKS || mutation.isPending}
                aria-label="Increase deep work blocks"
              >
                +
              </button>
            </div>
          </div>
          {mutation.isPending && !isSynced ? <span className="ghq-capacity-line__saving">Saving…</span> : null}
        </div>
      ) : null}
    </div>
  );
}
