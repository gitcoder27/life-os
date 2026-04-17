import { useCallback, useState } from "react";

import type { WeekPlanResponse } from "../../shared/lib/api";
import { useUpdateWeekCapacityMutation } from "../../shared/lib/api";

type CapacityMode = "light" | "standard" | "heavy";
type AssessmentStatus = "healthy" | "tight" | "overloaded";

type WeeklyCapacityCardProps = {
  weekStartDate: string;
  capacityProfile: WeekPlanResponse["capacityProfile"];
  capacityAssessment: WeekPlanResponse["capacityAssessment"];
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

const statusIcons: Record<AssessmentStatus, string> = {
  healthy: "✦",
  tight: "⚡",
  overloaded: "⚠",
};

export function WeeklyCapacityCard({
  weekStartDate,
  capacityProfile,
  capacityAssessment,
}: WeeklyCapacityCardProps) {
  const mutation = useUpdateWeekCapacityMutation(weekStartDate);
  const [localMode, setLocalMode] = useState<CapacityMode>(capacityProfile.capacityMode);
  const [localTarget, setLocalTarget] = useState<number>(capacityProfile.deepWorkBlockTarget);

  const isSynced =
    localMode === capacityProfile.capacityMode &&
    localTarget === capacityProfile.deepWorkBlockTarget;

  const save = useCallback(
    (mode: CapacityMode, target: number) => {
      mutation.mutate({
        capacityMode: mode,
        deepWorkBlockTarget: target,
      });
    },
    [mutation],
  );

  const handleModeChange = (mode: CapacityMode) => {
    setLocalMode(mode);
    save(mode, localTarget);
  };

  const handleTargetChange = (delta: number) => {
    const next = Math.max(0, Math.min(20, localTarget + delta));
    setLocalTarget(next);
    save(localMode, next);
  };

  const { status, primaryMessage, signals } = capacityAssessment;

  const showSignals =
    status !== "healthy" &&
    (capacityAssessment.scheduledTaskCount > 0 ||
      capacityAssessment.unsizedTaskCount > 0 ||
      capacityAssessment.focusGoalCount > 0);

  return (
    <div className={`ghq-capacity ghq-capacity--${status}`}>
      {/* Status banner */}
      <div className="ghq-capacity__status">
        <span className="ghq-capacity__status-icon">{statusIcons[status]}</span>
        <p className="ghq-capacity__message">{primaryMessage}</p>
      </div>

      {/* Intensity selector */}
      <div className="ghq-capacity__control">
        <label className="ghq-capacity__label">Week intensity</label>
        <div className="ghq-capacity__modes">
          {(["light", "standard", "heavy"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`ghq-capacity__mode-btn${localMode === mode ? " ghq-capacity__mode-btn--active" : ""}`}
              onClick={() => handleModeChange(mode)}
              disabled={mutation.isPending}
              title={modeDescriptions[mode]}
            >
              {modeLabels[mode]}
            </button>
          ))}
        </div>
      </div>

      {/* Deep work target */}
      <div className="ghq-capacity__control">
        <label className="ghq-capacity__label">Deep work blocks this week</label>
        <div className="ghq-capacity__stepper">
          <button
            type="button"
            className="ghq-capacity__stepper-btn"
            onClick={() => handleTargetChange(-1)}
            disabled={localTarget <= 0 || mutation.isPending}
            aria-label="Decrease deep work blocks"
          >
            −
          </button>
          <span className="ghq-capacity__stepper-value">{localTarget}</span>
          <button
            type="button"
            className="ghq-capacity__stepper-btn"
            onClick={() => handleTargetChange(1)}
            disabled={localTarget >= 20 || mutation.isPending}
            aria-label="Increase deep work blocks"
          >
            +
          </button>
        </div>
      </div>

      {/* Supporting cues */}
      {showSignals ? (
        <div className="ghq-capacity__cues">
          {capacityAssessment.plannedPriorityCount > 0 ? (
            <span className="ghq-capacity__cue">
              {capacityAssessment.plannedPriorityCount} priorities
            </span>
          ) : null}
          {capacityAssessment.scheduledTaskCount > 0 ? (
            <span className="ghq-capacity__cue">
              {capacityAssessment.scheduledTaskCount} scheduled tasks
            </span>
          ) : null}
          {capacityAssessment.estimatedMinutesTotal > 0 ? (
            <span className="ghq-capacity__cue">
              {Math.round(capacityAssessment.estimatedMinutesTotal / 60)}h estimated
            </span>
          ) : null}
          {capacityAssessment.unsizedTaskCount > 0 ? (
            <span className={`ghq-capacity__cue${signals.includes("too_many_unsized_tasks") ? " ghq-capacity__cue--signal" : ""}`}>
              {capacityAssessment.unsizedTaskCount} unsized
            </span>
          ) : null}
          {capacityAssessment.focusGoalCount > 0 ? (
            <span className={`ghq-capacity__cue${signals.includes("too_many_focus_goals") ? " ghq-capacity__cue--signal" : ""}`}>
              {capacityAssessment.focusGoalCount} focus goals
            </span>
          ) : null}
        </div>
      ) : null}

      {mutation.isPending && !isSynced ? (
        <span className="ghq-capacity__saving">Saving…</span>
      ) : null}
    </div>
  );
}
