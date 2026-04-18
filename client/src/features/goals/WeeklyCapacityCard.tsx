import { useCallback, useEffect, useState } from "react";

import type { WeekPlanResponse } from "../../shared/lib/api";
import { useUpdateWeekCapacityMutation } from "../../shared/lib/api";

type CapacityMode = "light" | "standard" | "heavy";
type AssessmentStatus = "healthy" | "tight" | "overloaded";

type WeeklyCapacityCardProps = {
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

const statusIcons: Record<AssessmentStatus, string> = {
  healthy: "✦",
  tight: "⚡",
  overloaded: "⚠",
};

const statusLabels: Record<AssessmentStatus, string> = {
  healthy: "Healthy",
  tight: "Tight",
  overloaded: "Overloaded",
};

const MIN_DEEP_WORK_BLOCKS = 0;
const MAX_DEEP_WORK_BLOCKS = 10;

const getCompactMessage = (
  status: AssessmentStatus,
  capacityMode: CapacityMode,
  signals: WeekPlanResponse["capacityAssessment"]["signals"],
) => {
  const leadSignal = signals[0];

  if (status === "healthy") {
    return `Looks realistic for a ${capacityMode} week.`;
  }

  if (leadSignal === "deep_work_target_too_high") {
    return status === "tight" ? "Week is getting tight. Lower the deep-work target." : "Week is overloaded. Lower the deep-work target.";
  }

  if (leadSignal === "too_many_priorities") {
    return status === "tight" ? "Week is getting tight. Trim one weekly priority." : "Week is overloaded. Trim one weekly priority.";
  }

  if (leadSignal === "too_many_estimated_minutes") {
    return status === "tight" ? "Week is getting tight. Reduce planned work volume." : "Week is overloaded. Reduce planned work volume.";
  }

  if (leadSignal === "too_many_unsized_tasks") {
    return status === "tight" ? "Week is getting tight. Size the unsized work." : "Week is overloaded. Size the unsized work.";
  }

  if (leadSignal === "too_many_focus_goals") {
    return status === "tight" ? "Week is getting tight. Narrow the number of focus goals." : "Week is overloaded. Narrow the number of focus goals.";
  }

  return status === "tight" ? "Week is getting tight. Reduce one commitment." : "Week is overloaded. Lower commitments.";
};

export function WeeklyCapacityCard({
  weekStartDate,
  capacityProfile,
  capacityAssessment,
  capacityProgress,
}: WeeklyCapacityCardProps) {
  const mutation = useUpdateWeekCapacityMutation(weekStartDate);
  const [localMode, setLocalMode] = useState<CapacityMode>(capacityProfile.capacityMode);
  const [localTarget, setLocalTarget] = useState<number>(capacityProfile.deepWorkBlockTarget);

  useEffect(() => {
    setLocalMode(capacityProfile.capacityMode);
    setLocalTarget(capacityProfile.deepWorkBlockTarget);
  }, [capacityProfile.capacityMode, capacityProfile.deepWorkBlockTarget, weekStartDate]);

  const isSynced =
    localMode === capacityProfile.capacityMode &&
    localTarget === capacityProfile.deepWorkBlockTarget;

  const save = useCallback(
    (mode: CapacityMode, target: number) => {
      const clampedTarget = Math.max(MIN_DEEP_WORK_BLOCKS, Math.min(MAX_DEEP_WORK_BLOCKS, target));

      mutation.mutate({
        capacityMode: mode,
        deepWorkBlockTarget: clampedTarget,
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
  const compactMessage = getCompactMessage(status, capacityProfile.capacityMode, signals);
  const cues = [
    {
      label: `${capacityProgress.completedDeepBlocks}/${capacityProfile.deepWorkBlockTarget} used`,
      isSignal: capacityProgress.status === "over_budget",
    },
    capacityProgress.overBudgetBlocks > 0
      ? {
          label: `${capacityProgress.overBudgetBlocks} over`,
          isSignal: true,
        }
      : capacityProfile.deepWorkBlockTarget > 0
        ? {
            label: `${capacityProgress.remainingDeepBlocks} left`,
            isSignal: capacityProgress.status === "at_budget",
          }
        : null,
    capacityAssessment.plannedPriorityCount > 0
      ? {
          label: `${capacityAssessment.plannedPriorityCount} week priorities`,
          isSignal: signals.includes("too_many_priorities"),
        }
      : null,
    capacityAssessment.scheduledTaskCount > 0
      ? {
          label: `${capacityAssessment.scheduledTaskCount} scheduled tasks`,
          isSignal: false,
        }
      : null,
    capacityAssessment.estimatedMinutesTotal > 0
      ? {
          label: `${Math.round(capacityAssessment.estimatedMinutesTotal / 60)}h estimated`,
          isSignal: signals.includes("too_many_estimated_minutes"),
        }
      : null,
    capacityAssessment.unsizedTaskCount > 0
      ? {
          label: `${capacityAssessment.unsizedTaskCount} unsized`,
          isSignal: signals.includes("too_many_unsized_tasks"),
        }
      : null,
    capacityAssessment.focusGoalCount > 0
      ? {
          label: `${capacityAssessment.focusGoalCount} focus goals`,
          isSignal: signals.includes("too_many_focus_goals"),
        }
      : null,
  ].filter((item): item is { label: string; isSignal: boolean } => Boolean(item));

  return (
    <div className={`ghq-capacity ghq-capacity--${status}`}>
      <div className="ghq-capacity__summary">
        <div className="ghq-capacity__summary-main">
          <span className="ghq-capacity__eyebrow">Week capacity</span>
          <span className={`ghq-capacity__badge ghq-capacity__badge--${status}`}>
            <span className="ghq-capacity__status-icon">{statusIcons[status]}</span>
            {statusLabels[status]}
          </span>
          <p className="ghq-capacity__message" title={primaryMessage}>
            {compactMessage}
          </p>
        </div>
        {mutation.isPending && !isSynced ? (
          <span className="ghq-capacity__saving">Saving…</span>
        ) : null}
      </div>

      <div className="ghq-capacity__rail">
        <div className="ghq-capacity__inline-field">
          <span className="ghq-capacity__label">Intensity</span>
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

        <div className="ghq-capacity__inline-field">
          <span className="ghq-capacity__label">Deep work</span>
          <div className="ghq-capacity__stepper-wrap">
            <div className="ghq-capacity__stepper">
              <button
                type="button"
                className="ghq-capacity__stepper-btn"
                onClick={() => handleTargetChange(-1)}
                disabled={localTarget <= MIN_DEEP_WORK_BLOCKS || mutation.isPending}
                aria-label="Decrease deep work blocks"
              >
                −
              </button>
              <span className="ghq-capacity__stepper-value">{localTarget}</span>
              <button
                type="button"
                className="ghq-capacity__stepper-btn"
                onClick={() => handleTargetChange(1)}
                disabled={localTarget >= MAX_DEEP_WORK_BLOCKS || mutation.isPending}
                aria-label="Increase deep work blocks"
              >
                +
              </button>
            </div>
            <span className="ghq-capacity__stepper-note">blocks</span>
          </div>
        </div>

        {cues.length > 0 ? (
          <div className="ghq-capacity__cues">
            {cues.map((cue) => (
              <span
                key={cue.label}
                className={`ghq-capacity__cue${cue.isSignal ? " ghq-capacity__cue--signal" : ""}`}
              >
                {cue.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
