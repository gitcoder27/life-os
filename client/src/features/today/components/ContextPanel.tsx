import { RoutinesHabits } from "./RoutinesHabits";
import { HealthPulse } from "./HealthPulse";
import { FinanceAdmin } from "./FinanceAdmin";
import { PlannerSummary } from "./PlannerSummary";
import { TimeBlocks } from "./TimeBlocks";
import { DayNotes } from "./DayNotes";
import { GoalNudges } from "./GoalNudges";
import type { TaskItem, GoalNudgeItem, DayPlannerBlockItem } from "../../../shared/lib/api";
import type { EditablePriority } from "../hooks/usePriorityDraft";

type HealthDay = {
  waterMl: number;
  waterTargetMl: number;
  mealCount: number;
  workoutDay: { actualStatus: string } | null;
};

export function ContextPanel({
  currentDay,
  timedTasks,
  quickCaptureTasks,
  goalNudges,
  priorityDraft,
  canAddGoalNudge,
  onAddGoalNudge,
  plannerBlocks,
  onSwitchToPlanner,
}: {
  currentDay: HealthDay | undefined;
  timedTasks: TaskItem[];
  quickCaptureTasks: TaskItem[];
  goalNudges: GoalNudgeItem[];
  priorityDraft: EditablePriority[];
  canAddGoalNudge: boolean;
  onAddGoalNudge: (nudge: GoalNudgeItem) => void;
  plannerBlocks: DayPlannerBlockItem[];
  onSwitchToPlanner: () => void;
}) {
  return (
    <aside className="today-context-panel">
      <RoutinesHabits />
      <HealthPulse currentDay={currentDay} />
      <FinanceAdmin />
      {plannerBlocks.length > 0 ? (
        <PlannerSummary blocks={plannerBlocks} onSwitchToPlanner={onSwitchToPlanner} />
      ) : (
        <TimeBlocks tasks={timedTasks} />
      )}
      <DayNotes tasks={quickCaptureTasks} />
      <GoalNudges
        nudges={goalNudges}
        priorityDraft={priorityDraft}
        canAdd={canAddGoalNudge}
        onAdd={onAddGoalNudge}
      />
    </aside>
  );
}
