import { useEffect, useRef, useState } from "react";
import { useDailyScoreQuery, getTodayDate } from "../../../shared/lib/api";
import {
  getDayPhase,
  getDayPhaseLabel,
  getDayPhasePrompt,
  getWinStatus,
  formatTodayDate,
} from "../helpers/day-phase";

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
  onCapture,
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
  onCapture: () => void;
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
  const phaseLabel = getDayPhaseLabel(phase);
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

  return (
    <header className="command-bar">
      <div className="command-bar__left">
        <div className="command-bar__date">
          <span className="command-bar__day">{formatTodayDate(now)}</span>
          <span className="command-bar__phase">{phaseLabel}</span>
        </div>

        {score ? (
          <div className={`command-bar__score${bumped ? " command-bar__score--bumped" : ""}`}>
            <MiniScoreRing value={score.value} color={getScoreColor(score.value)} />
            <span className="command-bar__score-label">{score.label}</span>
            <span className="command-bar__score-value">{score.value}</span>
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
          onClick={onCapture}
          aria-label="Quick capture"
        >
          + Capture
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
