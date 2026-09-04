import type { ComponentProps, RefCallback } from "react";

import { InlineErrorState } from "../../../shared/ui/PageState";
import { DailyEssentials } from "./DailyEssentials";
import { DayNotes } from "./DayNotes";
import { DriftRecoveryBar } from "./DriftRecoveryBar";
import { ExecutionStream } from "./ExecutionStream";
import { GoalNudges } from "./GoalNudges";
import { NextMoveStrip } from "./NextMoveStrip";
import { PreLaunchModeNotice } from "./PreLaunchModeNotice";
import { TaskInspectorPanel } from "./TaskInspectorPanel";
import { WeekDeepWorkStrip } from "./WeekDeepWorkStrip";
import { WorkbenchResizeHandle } from "./WorkbenchResizeHandle";

type RetryableSectionError = {
  message: string | null | undefined;
  onRetry: () => void;
};

type TodayExecuteWorkspaceProps = {
  activeFocusSession: boolean;
  dayNotesProps: ComponentProps<typeof DayNotes>;
  dailyEssentialsProps: ComponentProps<typeof DailyEssentials>;
  driftRecoveryBarProps: ComponentProps<typeof DriftRecoveryBar>;
  executionStreamProps: ComponentProps<typeof ExecutionStream>;
  goalNudgesProps: ComponentProps<typeof GoalNudges>;
  goalsError: RetryableSectionError;
  healthError: RetryableSectionError;
  nextMoveProps: ComponentProps<typeof NextMoveStrip>;
  overdueTasksError: RetryableSectionError;
  preLaunchProps: ComponentProps<typeof PreLaunchModeNotice>;
  resizeHandleProps: ComponentProps<typeof WorkbenchResizeHandle>;
  showDriftRecoveryBar: boolean;
  taskInspectorProps: ComponentProps<typeof TaskInspectorPanel>;
  weekDeepWorkProps: ComponentProps<typeof WeekDeepWorkStrip>;
  weekPlanError: RetryableSectionError;
  workbenchRef: RefCallback<HTMLElement>;
  workbenchResizing: boolean;
};

export function TodayExecuteWorkspace({
  activeFocusSession,
  dayNotesProps,
  dailyEssentialsProps,
  driftRecoveryBarProps,
  executionStreamProps,
  goalNudgesProps,
  goalsError,
  healthError,
  nextMoveProps,
  overdueTasksError,
  preLaunchProps,
  resizeHandleProps,
  showDriftRecoveryBar,
  taskInspectorProps,
  weekDeepWorkProps,
  weekPlanError,
  workbenchRef,
  workbenchResizing,
}: TodayExecuteWorkspaceProps) {
  return (
    <div className="today-execute-v2">
      <div className="today-main-v2">
        <section
          className={`today-workbench${workbenchResizing ? " today-workbench--resizing" : ""}${activeFocusSession ? " today-workbench--focus-active" : ""}`}
          aria-label="Today workbench"
          ref={workbenchRef}
        >
          <div className="today-workbench__queue">
            <PreLaunchModeNotice {...preLaunchProps} />

            <NextMoveStrip {...nextMoveProps} />

            {showDriftRecoveryBar ? <DriftRecoveryBar {...driftRecoveryBarProps} /> : null}

            {overdueTasksError.message ? (
              <InlineErrorState
                message={overdueTasksError.message}
                onRetry={overdueTasksError.onRetry}
              />
            ) : null}

            <ExecutionStream {...executionStreamProps} />
          </div>

          <WorkbenchResizeHandle {...resizeHandleProps} />

          <aside className="today-workbench__side" aria-label="Today context">
            <TaskInspectorPanel {...taskInspectorProps} />

            <div className="today-workbench__support">
              <GoalNudges {...goalNudgesProps} />
              {goalsError.message ? (
                <InlineErrorState
                  message={goalsError.message}
                  onRetry={goalsError.onRetry}
                />
              ) : null}

              {healthError.message ? (
                <InlineErrorState
                  message={healthError.message}
                  onRetry={healthError.onRetry}
                />
              ) : (
                <DailyEssentials {...dailyEssentialsProps} />
              )}
              {weekPlanError.message ? (
                <InlineErrorState
                  message={weekPlanError.message}
                  onRetry={weekPlanError.onRetry}
                />
              ) : (
                <WeekDeepWorkStrip {...weekDeepWorkProps} />
              )}
              <DayNotes {...dayNotesProps} />
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
