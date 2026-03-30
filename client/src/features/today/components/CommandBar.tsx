import { useEffect, useRef, useState } from "react";
import { useDailyScoreQuery, getTodayDate } from "../../../shared/lib/api";
import {
  getDayPhase,
  getDayPhasePrompt,
  getWinStatus,
} from "../helpers/day-phase";
import { formatDurationMinutes } from "../helpers/planner-blocks";
import type { PlannerExecutionModel } from "../helpers/planner-execution";

function getScoreColor(value: number) {
  if (value >= 85) return "var(--positive)";
  if (value >= 70) return "var(--accent-bright)";
  if (value >= 50) return "var(--accent)";
  return "var(--negative)";
}

export function CommandBar({
  mode,
  onModeChange,
  plannerBlockCount,
  now,
  pendingPriorityCount,
  totalPriorityCount,
  pendingTaskCount,
  completedTaskCount,
  totalTaskCount,
  overdueCount,
  hasDrift,
  onAddTask,
  execution,
  topPriorityTitle,
  onSwitchToPlanner,
}: {
  mode: "execute" | "plan";
  onModeChange: (mode: "execute" | "plan") => void;
  plannerBlockCount: number;
  now: Date;
  pendingPriorityCount: number;
  totalPriorityCount: number;
  pendingTaskCount: number;
  completedTaskCount: number;
  totalTaskCount: number;
  overdueCount: number;
  hasDrift: boolean;
  onAddTask: () => void;
  execution: PlannerExecutionModel;
  topPriorityTitle: string | undefined;
  onSwitchToPlanner: () => void;
}) {
  const today = getTodayDate();
  const scoreQuery = useDailyScoreQuery(today);
  const score = scoreQuery.data;
  const prevValueRef = useRef<number | null>(null);
  const [bumped, setBumped] = useState(false);

  useEffect(() => {
    if (score && prevValueRef.current !== null && score.value !== prevValueRef.current) {
      setBumped(true);
      const timer = setTimeout(() => setBumped(false), 600);
      return () => clearTimeout(timer);
    }
    if (score) prevValueRef.current = score.value;
  }, [score?.value]);

  const phase = getDayPhase(now);
  const phasePrompt = getDayPhasePrompt(phase, {
    priorityCount: totalPriorityCount,
    pendingTaskCount,
    completedTaskCount,
    hasDrift,
  });
  const winStatus = getWinStatus(
    pendingPriorityCount,
    totalPriorityCount,
    completedTaskCount,
    totalTaskCount,
  );

  const executionChip = buildExecutionChip(execution, topPriorityTitle);

  return (
    <header className="command-bar">
      <div className="command-bar__left">
        {score ? (
          <div className={`command-bar__score${bumped ? " command-bar__score--bumped" : ""}`}>
            <MiniScoreRing value={score.value} color={getScoreColor(score.value)} />
            <span className="command-bar__score-label">{score.label}</span>
            <span className="command-bar__score-value">{score.value}</span>
          </div>
        ) : null}

        {executionChip ? (
          <div className={`command-bar__exec-chip command-bar__exec-chip--${executionChip.tone}`}>
            {executionChip.icon ? (
              <span className="command-bar__exec-icon">{executionChip.icon}</span>
            ) : null}
            <span className="command-bar__exec-text">{executionChip.text}</span>
            {executionChip.action ? (
              <button
                className="command-bar__exec-action"
                type="button"
                onClick={onSwitchToPlanner}
              >
                {executionChip.action}
              </button>
            ) : null}
          </div>
        ) : null}

        <span className="command-bar__win-status">{winStatus}</span>
      </div>

      <div className="command-bar__right">
        <span className="command-bar__prompt">{phasePrompt}</span>

        {overdueCount > 0 ? (
          <span className="command-bar__overdue" title={`${overdueCount} overdue`}>
            {overdueCount} overdue
          </span>
        ) : null}

        <button
          className="command-bar__capture"
          type="button"
          onClick={onAddTask}
          aria-label="Add task to today"
        >
          + Add task
        </button>

        <div className="command-bar__mode-toggle">
          <button
            className={`command-bar__mode-btn${mode === "execute" ? " command-bar__mode-btn--active" : ""}`}
            type="button"
            onClick={() => onModeChange("execute")}
          >
            Execute
          </button>
          <button
            className={`command-bar__mode-btn${mode === "plan" ? " command-bar__mode-btn--active" : ""}`}
            type="button"
            onClick={() => onModeChange("plan")}
          >
            Plan
            {plannerBlockCount > 0 ? (
              <span className="command-bar__mode-badge">{plannerBlockCount}</span>
            ) : null}
          </button>
        </div>
      </div>
    </header>
  );
}

type ExecutionChip = {
  tone: "active" | "gap" | "off_track" | "complete" | "no_plan";
  icon: string | null;
  text: string;
  action: string | null;
};

function buildExecutionChip(
  execution: PlannerExecutionModel,
  topPriorityTitle: string | undefined,
): ExecutionChip | null {
  const currentBlock = execution.currentBlock;
  const nextBlock = execution.nextBlock;
  const slippedCount = execution.slippedTaskCount;

  // Current block active
  if (currentBlock && currentBlock.health !== "complete") {
    const blockName = currentBlock.block.title || "Current block";
    const progress = `${currentBlock.completedCount}/${currentBlock.totalCount}`;
    const remaining = formatDurationMinutes(currentBlock.remainingMinutes);
    return {
      tone: "active",
      icon: "▶",
      text: `${blockName} · ${progress} done · ${remaining} left`,
      action: null,
    };
  }

  // Off track
  if (slippedCount > 0) {
    return {
      tone: "off_track",
      icon: "!",
      text: `${slippedCount} task${slippedCount === 1 ? "" : "s"} slipped`,
      action: "Replan",
    };
  }

  // Gap before next block
  if (execution.focusState === "gap_before_next" && nextBlock) {
    const timeText = nextBlock.startsInMinutes != null && nextBlock.startsInMinutes > 0
      ? formatDurationMinutes(nextBlock.startsInMinutes)
      : "now";
    const blockTitle = nextBlock.block.title || "next block";
    return {
      tone: "gap",
      icon: null,
      text: timeText === "now" ? `${blockTitle} starting now` : `${timeText} until ${blockTitle}`,
      action: null,
    };
  }

  // No plan
  if (execution.focusState === "no_plan") {
    return {
      tone: "no_plan",
      icon: null,
      text: topPriorityTitle ? `Focus: ${topPriorityTitle}` : "No plan yet",
      action: "Plan",
    };
  }

  // Plan complete
  if (execution.focusState === "plan_complete") {
    const unplanned = execution.unplannedTaskCount;
    return {
      tone: "complete",
      icon: "✓",
      text: unplanned > 0 ? `Done · ${unplanned} unplanned` : "All blocks done",
      action: null,
    };
  }

  return null;
}

function MiniScoreRing({ value, color }: { value: number; color: string }) {
  const size = 28;
  const strokeWidth = 3;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg className="command-bar__ring" viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.5s var(--ease)" }}
      />
    </svg>
  );
}
