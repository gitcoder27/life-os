import { RoutinesHabits } from "./RoutinesHabits";
import { HealthPulse } from "./HealthPulse";
import { FinanceAdmin } from "./FinanceAdmin";
import { TimeBlocks } from "./TimeBlocks";
import { DayNotes } from "./DayNotes";
import { GoalNudges } from "./GoalNudges";
import type { TaskItem, GoalNudgeItem } from "../../../shared/lib/api";
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
}: {
  currentDay: HealthDay | undefined;
  timedTasks: TaskItem[];
  quickCaptureTasks: TaskItem[];
  goalNudges: GoalNudgeItem[];
  priorityDraft: EditablePriority[];
  canAddGoalNudge: boolean;
  onAddGoalNudge: (nudge: GoalNudgeItem) => void;
}) {
  return (
    <aside className="today-context-panel">
      <RoutinesHabits />
      <HealthPulse currentDay={currentDay} />
      <FinanceAdmin />
      <TimeBlocks tasks={timedTasks} />
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
