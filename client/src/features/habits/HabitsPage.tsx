import { PageHeader } from "../../shared/ui/PageHeader";
import {
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";

import { DailyFocusSection } from "./components/DailyFocusSection";
import { HabitsScoreStrip } from "./components/HabitsScoreStrip";
import { ManageHabitsSection } from "./components/ManageHabitsSection";
import { ManageRoutinesSection } from "./components/ManageRoutinesSection";
import { SignalsSection } from "./components/SignalsSection";
import { useHabitsPageController } from "./useHabitsPageController";

export function HabitsPage() {
  const controller = useHabitsPageController();

  if (controller.habitsQuery.isLoading && !controller.habitsQuery.data) {
    return (
      <PageLoadingState
        title="Loading habits"
        description="Checking due habits, routines, and consistency signals."
      />
    );
  }

  if (controller.habitsQuery.isError || !controller.habitsQuery.data) {
    return (
      <PageErrorState
        title="Habits could not load"
        message={
          controller.habitsQuery.error instanceof Error
            ? controller.habitsQuery.error.message
            : undefined
        }
        onRetry={() => void controller.habitsQuery.refetch()}
      />
    );
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Consistency"
        title="Habits and routines"
        description="Check in on what matters today, track your streaks, and keep the system working."
      />

      <HabitsScoreStrip
        score={controller.score}
        scoreError={controller.scoreQuery.isError}
        scorePercent={controller.scorePercent}
        consistencyBars={controller.consistencyBars}
        trendError={controller.weeklyMomentumQuery.isError}
        statsCount={controller.statsCount}
        dueCompletedUnits={controller.dueCompletedUnits}
        dueTargetUnits={controller.dueTargetUnits}
        routineCompleted={controller.routineCompleted}
        routineTotal={controller.routineTotal}
        momentumValue={controller.weeklyMomentumQuery.data?.value}
        strongDayStreak={controller.strongDayStreak}
      />

      <DailyFocusSection
        allHabits={controller.allHabits}
        dueHabits={controller.dueHabits}
        activeRoutines={controller.activeRoutines}
        dueCompletedUnits={controller.dueCompletedUnits}
        dueTargetUnits={controller.dueTargetUnits}
        isHabitCheckinPending={controller.habitCheckinMutation.isPending}
        isRoutineCheckinPending={
          controller.routineCheckinMutation.isPending ||
          controller.deleteRoutineCheckinMutation.isPending
        }
        isPausePending={controller.createHabitPauseWindowMutation.isPending}
        onCreateFirstHabit={controller.handleOpenAddHabit}
        onHabitCheckin={(habitId) => controller.habitCheckinMutation.mutate(habitId)}
        onRoutineItemCheckin={(itemId) => controller.routineCheckinMutation.mutate(itemId)}
        onRoutineItemUndo={(itemId) => controller.deleteRoutineCheckinMutation.mutate(itemId)}
        onRestDay={controller.handleRestDay}
      />

      <SignalsSection
        weeklyChallenge={controller.weeklyChallenge}
        isMomentumError={controller.weeklyMomentumQuery.isError}
        momentumErrorMessage={
          controller.weeklyMomentumQuery.error instanceof Error
            ? controller.weeklyMomentumQuery.error.message
            : undefined
        }
        onRetry={() => void controller.weeklyMomentumQuery.refetch()}
      />

      <ManageHabitsSection
        allHabits={controller.allHabits}
        nonArchivedHabits={controller.nonArchivedHabits}
        archivedHabits={controller.archivedHabits}
        showAddHabit={controller.showAddHabit}
        editingHabitId={controller.editingHabitId}
        vacationHabitId={controller.vacationHabitId}
        vacationForm={controller.vacationForm}
        confirmArchiveHabitId={controller.confirmArchiveHabitId}
        createPending={controller.createHabitMutation.isPending}
        updatePending={controller.updateHabitMutation.isPending}
        pausePending={controller.createHabitPauseWindowMutation.isPending}
        deletePausePending={controller.deleteHabitPauseWindowMutation.isPending}
        createError={controller.createHabitMutation.error}
        updateError={controller.updateHabitMutation.error}
        pauseError={controller.createHabitPauseWindowMutation.error}
        deletePauseError={controller.deleteHabitPauseWindowMutation.error}
        onOpenAddHabit={controller.handleOpenAddHabit}
        onCloseAddHabit={() => controller.setShowAddHabit(false)}
        onEditHabit={controller.handleEditHabit}
        onCancelEditHabit={() => controller.setEditingHabitId(null)}
        onCreateHabit={controller.handleCreateHabit}
        onUpdateHabit={controller.handleUpdateHabit}
        onRestDay={controller.handleRestDay}
        onOpenVacation={controller.handleOpenVacation}
        onCloseVacation={() => controller.setVacationHabitId(null)}
        onVacationFormChange={controller.setVacationForm}
        onSaveVacation={controller.handleSaveVacation}
        onDeletePauseWindow={controller.handleDeletePauseWindow}
        onChangeHabitStatus={controller.handlePermanentHabitStatusChange}
        onRequestArchiveHabit={controller.setConfirmArchiveHabitId}
        onCancelArchiveHabit={() => controller.setConfirmArchiveHabitId(null)}
        onConfirmArchiveHabit={controller.handleArchiveHabit}
      />

      <ManageRoutinesSection
        routines={controller.routines}
        activeRoutineCount={controller.activeRoutines.length}
        nonArchivedRoutines={controller.nonArchivedRoutines}
        archivedRoutines={controller.archivedRoutines}
        showAddRoutine={controller.showAddRoutine}
        editingRoutineId={controller.editingRoutineId}
        confirmArchiveRoutineId={controller.confirmArchiveRoutineId}
        createPending={controller.createRoutineMutation.isPending}
        updatePending={controller.updateRoutineMutation.isPending}
        createError={controller.createRoutineMutation.error}
        updateError={controller.updateRoutineMutation.error}
        onOpenAddRoutine={controller.handleOpenAddRoutine}
        onCloseAddRoutine={() => controller.setShowAddRoutine(false)}
        onEditRoutine={controller.handleEditRoutine}
        onCancelEditRoutine={() => controller.setEditingRoutineId(null)}
        onCreateRoutine={controller.handleCreateRoutine}
        onUpdateRoutine={controller.handleUpdateRoutine}
        onMoveRoutine={controller.handleMoveRoutine}
        onRequestArchiveRoutine={controller.setConfirmArchiveRoutineId}
        onCancelArchiveRoutine={() => controller.setConfirmArchiveRoutineId(null)}
        onConfirmArchiveRoutine={controller.handleArchiveRoutine}
        onRestoreRoutine={(routineId) =>
          controller.updateRoutineMutation.mutate({ routineId, status: "active" })
        }
      />
    </div>
  );
}
