import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { PageErrorState } from "../../shared/ui/PageState";
import { readHomeDestinationState } from "../../shared/lib/homeNavigation";

import { DayTimeline } from "./components/DayTimeline";
import { HabitsSkeleton } from "./components/HabitsSkeleton";
import { ManageHabitsSection } from "./components/ManageHabitsSection";
import { ManageRoutinesSection } from "./components/ManageRoutinesSection";
import { SignalsSection } from "./components/SignalsSection";
import { TodayHero } from "./components/TodayHero";
import { useHabitsPageController } from "./useHabitsPageController";

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

export function HabitsPage() {
  const location = useLocation();
  const controller = useHabitsPageController();
  const [highlightedHabitId, setHighlightedHabitId] = useState<string | null>(null);
  const [highlightWeeklyChallenge, setHighlightWeeklyChallenge] = useState(false);
  const [scrollTargetId, setScrollTargetId] = useState<string | null>(null);
  const homeDestination = readHomeDestinationState(location.state);

  // Manage sections open a render or two after a form is requested, so wait for the target to exist.
  useEffect(() => {
    if (!scrollTargetId) return;

    let frame = 0;
    let attempts = 0;
    const scrollWhenReady = () => {
      const target = document.getElementById(scrollTargetId);
      if (!target && attempts < 10) {
        attempts += 1;
        frame = requestAnimationFrame(scrollWhenReady);
        return;
      }

      target?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
      setScrollTargetId(null);
    };
    frame = requestAnimationFrame(scrollWhenReady);

    return () => cancelAnimationFrame(frame);
  }, [scrollTargetId]);

  useEffect(() => {
    if (homeDestination?.kind !== "habit_focus") {
      setHighlightedHabitId(null);
      setHighlightWeeklyChallenge(false);
      return;
    }

    const targetId = homeDestination.surface === "weekly_challenge"
      ? "habits-weekly-challenge"
      : homeDestination.habitId
        ? `habits-focus-${homeDestination.habitId}`
        : "habits-daily-focus";

    setHighlightedHabitId(homeDestination.surface === "due_today" ? homeDestination.habitId ?? null : null);
    setHighlightWeeklyChallenge(homeDestination.surface === "weekly_challenge");

    requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({
        behavior: scrollBehavior(),
        block: "start",
      });
    });
  }, [homeDestination, location.key]);

  if (controller.habitsQuery.isLoading && !controller.habitsQuery.data) {
    return <HabitsSkeleton />;
  }

  if (controller.habitsQuery.isError || !controller.habitsQuery.data) {
    return (
      <PageErrorState
        title="Habits didn't load"
        message={
          controller.habitsQuery.error instanceof Error
            ? controller.habitsQuery.error.message
            : "Check your connection, then try again."
        }
        onRetry={() => void controller.habitsQuery.refetch()}
      />
    );
  }

  const hasAnyHabits = controller.nonArchivedHabits.length > 0;
  const hasAnyRoutines = controller.nonArchivedRoutines.length > 0;
  const showRail = hasAnyHabits || hasAnyRoutines;

  function handleAddHabit() {
    controller.handleOpenAddHabit();
    setScrollTargetId("habits-manage-habits");
  }

  function handleAddRoutine() {
    controller.handleOpenAddRoutine();
    setScrollTargetId("habits-manage-routines");
  }

  function handleEditFromTimeline(habitId: string) {
    controller.handleEditHabit(habitId);
    setScrollTargetId(`habits-manage-${habitId}`);
  }

  return (
    <div className="page habits-page">
      <header className="page-header hb-header">
        <div className="hb-header__text">
          <h1 className="page-title">Habits</h1>
          <p className="page-description">Check in on today. The streaks follow.</p>
        </div>
        {showRail ? (
          <button className="button button--ghost button--small" type="button" onClick={handleAddHabit}>
            New habit
          </button>
        ) : null}
      </header>

      <div className={`hb-layout${showRail ? "" : " hb-layout--single"}`}>
        {showRail ? (
          <aside className="hb-rail" aria-label="Today at a glance">
            <TodayHero
              dueCompletedUnits={controller.dueCompletedUnits}
              dueTargetUnits={controller.dueTargetUnits}
              routineCompleted={controller.routineCompleted}
              routineTotal={controller.routineTotal}
              score={controller.score}
              scoreError={controller.scoreQuery.isError}
              consistencyBars={controller.consistencyBars}
              trendError={controller.weeklyMomentumQuery.isError}
              momentumValue={controller.weeklyMomentumQuery.data?.value}
              strongDayStreak={controller.strongDayStreak}
            />
            <SignalsSection
              weeklyChallenge={controller.weeklyChallenge}
              highlightWeeklyChallenge={highlightWeeklyChallenge}
              isMomentumError={controller.weeklyMomentumQuery.isError}
              momentumErrorMessage={
                controller.weeklyMomentumQuery.error instanceof Error
                  ? controller.weeklyMomentumQuery.error.message
                  : undefined
              }
              onRetry={() => void controller.weeklyMomentumQuery.refetch()}
            />
          </aside>
        ) : null}

        <div className="hb-main">
          <DayTimeline
            hasAnyHabits={hasAnyHabits}
            hasAnyRoutines={hasAnyRoutines}
            dueHabits={controller.dueHabits}
            activeRoutines={controller.activeRoutines}
            isRescueMode={controller.isRescueMode}
            highlightedHabitId={highlightedHabitId}
            pendingHabitIds={controller.pendingHabitIds}
            pendingStepIds={controller.pendingStepIds}
            isPausePending={controller.createHabitPauseWindowMutation.isPending}
            onAddHabit={handleAddHabit}
            onAddRoutine={handleAddRoutine}
            onHabitCheckin={controller.checkInHabit}
            onHabitUndo={controller.undoHabitCheckin}
            onToggleRoutineStep={controller.toggleRoutineStep}
            onRestDay={controller.handleRestDay}
            onEditHabit={handleEditFromTimeline}
          />

          <div className="hb-manage">
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
        </div>
      </div>
    </div>
  );
}
