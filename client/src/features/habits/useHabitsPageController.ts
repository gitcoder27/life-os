import { useState } from "react";

import {
  getTodayDate,
  useDayPlanQuery,
  useCreateHabitPauseWindowMutation,
  useCreateHabitMutation,
  useCreateRoutineMutation,
  useDailyScoreQuery,
  useDeleteHabitCheckinMutation,
  useDeleteHabitPauseWindowMutation,
  useDeleteRoutineCheckinMutation,
  useHabitCheckinMutation,
  useHabitsQuery,
  useRoutineCheckinMutation,
  useUpdateHabitMutation,
  useUpdateRoutineMutation,
  useWeeklyMomentumQuery,
} from "../../shared/lib/api";
import { buildRecurrenceInput } from "../../shared/ui/RecurrenceEditor";

import type {
  HabitFormValues,
  HabitPauseFormValues,
  RoutineFormValues,
} from "./types";

export function useHabitsPageController() {
  const today = getTodayDate();
  const habitsQuery = useHabitsQuery();
  const scoreQuery = useDailyScoreQuery(today);
  const weeklyMomentumQuery = useWeeklyMomentumQuery(today);
  const dayPlanQuery = useDayPlanQuery(today);
  const habitCheckinMutation = useHabitCheckinMutation(today);
  const deleteHabitCheckinMutation = useDeleteHabitCheckinMutation(today);
  const routineCheckinMutation = useRoutineCheckinMutation(today);
  const deleteRoutineCheckinMutation = useDeleteRoutineCheckinMutation(today);
  const createHabitMutation = useCreateHabitMutation();
  const updateHabitMutation = useUpdateHabitMutation();
  const createHabitPauseWindowMutation = useCreateHabitPauseWindowMutation();
  const deleteHabitPauseWindowMutation = useDeleteHabitPauseWindowMutation();
  const createRoutineMutation = useCreateRoutineMutation();
  const updateRoutineMutation = useUpdateRoutineMutation();

  const [showAddHabit, setShowAddHabit] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [vacationHabitId, setVacationHabitId] = useState<string | null>(null);
  const [vacationForm, setVacationForm] = useState<HabitPauseFormValues>({
    startsOn: today,
    endsOn: today,
    note: "",
  });
  const [showAddRoutine, setShowAddRoutine] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [confirmArchiveHabitId, setConfirmArchiveHabitId] = useState<string | null>(null);
  const [confirmArchiveRoutineId, setConfirmArchiveRoutineId] = useState<string | null>(null);

  const habitsData = habitsQuery.data;
  const dueHabits = habitsData?.dueHabits ?? [];
  const allHabits = habitsData?.habits ?? [];
  const nonArchivedHabits = allHabits.filter((habit) => habit.status !== "archived");
  const archivedHabits = allHabits.filter((habit) => habit.status === "archived");
  const weeklyChallenge = habitsData?.weeklyChallenge ?? null;
  const routines = [...(habitsData?.routines ?? [])].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  );
  const activeRoutines = routines.filter((routine) => routine.status === "active");
  const nonArchivedRoutines = routines.filter((routine) => routine.status !== "archived");
  const archivedRoutines = routines.filter((routine) => routine.status === "archived");
  const consistencyBars = weeklyMomentumQuery.data?.dailyScores ?? [];
  const score = scoreQuery.data;
  const scorePercent = score
    ? Math.round((score.earnedPoints / Math.max(score.possiblePoints, 1)) * 100)
    : 0;
  const dueCompletedUnits = dueHabits.reduce(
    (sum, habit) => sum + Math.min(habit.completedCountToday, habit.targetPerDay),
    0,
  );
  const dueTargetUnits = dueHabits.reduce((sum, habit) => sum + habit.targetPerDay, 0);
  const routineCompleted = activeRoutines.reduce(
    (sum, routine) => sum + routine.completedItems,
    0,
  );
  const routineTotal = activeRoutines.reduce((sum, routine) => sum + routine.totalItems, 0);
  const strongDayStreak = weeklyMomentumQuery.data?.strongDayStreak ?? 0;
  const statsCount = strongDayStreak > 0 ? 4 : 3;
  const isRescueMode =
    dayPlanQuery.data?.launch?.dayMode === "rescue" || dayPlanQuery.data?.launch?.dayMode === "recovery";

  function resetHabitManagementState() {
    setEditingHabitId(null);
    setVacationHabitId(null);
    setConfirmArchiveHabitId(null);
  }

  function resetRoutineManagementState() {
    setEditingRoutineId(null);
    setConfirmArchiveRoutineId(null);
  }

  function handleOpenAddHabit() {
    resetHabitManagementState();
    setShowAddHabit(true);
  }

  function handleOpenAddRoutine() {
    resetRoutineManagementState();
    setShowAddRoutine(true);
  }

  function handleEditHabit(habitId: string) {
    setEditingHabitId(habitId);
    setShowAddHabit(false);
    setVacationHabitId(null);
    setConfirmArchiveHabitId(null);
  }

  function handleEditRoutine(routineId: string) {
    setEditingRoutineId(routineId);
    setShowAddRoutine(false);
    setConfirmArchiveRoutineId(null);
  }

  function handleCreateHabit(values: HabitFormValues) {
    createHabitMutation.mutate(
      {
        title: values.title.trim(),
        category: values.category.trim() || null,
        habitType: values.habitType,
        targetPerDay: Math.max(1, Number.parseInt(values.targetPerDay, 10) || 1),
        recurrence: values.recurrenceRule
          ? buildRecurrenceInput(values.recurrenceRule)
          : undefined,
        goalId: values.goalId || null,
        anchorText: values.anchorText.trim() || null,
        minimumVersion: values.minimumVersion.trim() || null,
        standardVersion: values.standardVersion.trim() || null,
        stretchVersion: values.stretchVersion.trim() || null,
        obstaclePlan: values.obstaclePlan.trim() || null,
        repairRule: values.repairRule.trim() || null,
        identityMeaning: values.identityMeaning.trim() || null,
      },
      { onSuccess: () => setShowAddHabit(false) },
    );
  }

  function handleUpdateHabit(habitId: string, values: HabitFormValues) {
    updateHabitMutation.mutate(
      {
        habitId,
        title: values.title.trim(),
        category: values.category.trim() || null,
        habitType: values.habitType,
        targetPerDay: Math.max(1, Number.parseInt(values.targetPerDay, 10) || 1),
        recurrence: values.recurrenceRule
          ? buildRecurrenceInput(values.recurrenceRule)
          : undefined,
        goalId: values.goalId || null,
        anchorText: values.anchorText.trim() || null,
        minimumVersion: values.minimumVersion.trim() || null,
        standardVersion: values.standardVersion.trim() || null,
        stretchVersion: values.stretchVersion.trim() || null,
        obstaclePlan: values.obstaclePlan.trim() || null,
        repairRule: values.repairRule.trim() || null,
        identityMeaning: values.identityMeaning.trim() || null,
      },
      { onSuccess: () => setEditingHabitId(null) },
    );
  }

  function handlePermanentHabitStatusChange(
    habitId: string,
    status: "active" | "paused" | "archived",
  ) {
    updateHabitMutation.mutate({ habitId, status });
  }

  function handleRestDay(habitId: string) {
    createHabitPauseWindowMutation.mutate({
      habitId,
      kind: "rest_day",
      startsOn: today,
      endsOn: today,
    });
  }

  function handleOpenVacation(habitId: string) {
    setVacationHabitId(habitId);
    setVacationForm({ startsOn: today, endsOn: today, note: "" });
    setEditingHabitId(null);
    setShowAddHabit(false);
  }

  function handleSaveVacation(habitId: string) {
    createHabitPauseWindowMutation.mutate(
      {
        habitId,
        kind: "vacation",
        startsOn: vacationForm.startsOn,
        endsOn: vacationForm.endsOn,
        note: vacationForm.note.trim() || null,
      },
      {
        onSuccess: () => {
          setVacationHabitId(null);
          setVacationForm({ startsOn: today, endsOn: today, note: "" });
        },
      },
    );
  }

  function handleDeletePauseWindow(habitId: string, pauseWindowId: string) {
    deleteHabitPauseWindowMutation.mutate({ habitId, pauseWindowId });
  }

  function handleArchiveHabit(habitId: string) {
    handlePermanentHabitStatusChange(habitId, "archived");
    setConfirmArchiveHabitId(null);
  }

  function handleCreateRoutine(values: RoutineFormValues) {
    const items = values.items
      .filter((item) => item.title.trim())
      .map((item, index) => ({
        title: item.title.trim(),
        sortOrder: index,
        isRequired: item.isRequired,
      }));
    if (!items.length) return;

    createRoutineMutation.mutate(
      { name: values.name.trim(), items },
      { onSuccess: () => setShowAddRoutine(false) },
    );
  }

  function handleUpdateRoutine(routineId: string, values: RoutineFormValues) {
    const items = values.items
      .filter((item) => item.title.trim())
      .map((item, index) => ({
        id: item.id,
        title: item.title.trim(),
        sortOrder: index,
        isRequired: item.isRequired,
      }));

    updateRoutineMutation.mutate(
      { routineId, name: values.name.trim(), items: items.length ? items : undefined },
      { onSuccess: () => setEditingRoutineId(null) },
    );
  }

  function handleMoveRoutine(routineId: string, sortOrder: number) {
    updateRoutineMutation.mutate({ routineId, sortOrder });
  }

  function handleArchiveRoutine(routineId: string) {
    updateRoutineMutation.mutate({ routineId, status: "archived" });
    setConfirmArchiveRoutineId(null);
  }

  return {
    habitsQuery,
    scoreQuery,
    weeklyMomentumQuery,
    showAddHabit,
    editingHabitId,
    vacationHabitId,
    vacationForm,
    showAddRoutine,
    editingRoutineId,
    confirmArchiveHabitId,
    confirmArchiveRoutineId,
    dueHabits,
    allHabits,
    nonArchivedHabits,
    archivedHabits,
    weeklyChallenge,
    routines,
    activeRoutines,
    nonArchivedRoutines,
    archivedRoutines,
    consistencyBars,
    score,
    scorePercent,
    dueCompletedUnits,
    dueTargetUnits,
    routineCompleted,
    routineTotal,
    strongDayStreak,
    statsCount,
    dayPlanQuery,
    isRescueMode,
    habitCheckinMutation,
    deleteHabitCheckinMutation,
    routineCheckinMutation,
    deleteRoutineCheckinMutation,
    createHabitMutation,
    updateHabitMutation,
    createHabitPauseWindowMutation,
    deleteHabitPauseWindowMutation,
    createRoutineMutation,
    updateRoutineMutation,
    setVacationForm,
    setConfirmArchiveHabitId,
    setConfirmArchiveRoutineId,
    setShowAddHabit,
    setShowAddRoutine,
    setEditingHabitId,
    setEditingRoutineId,
    setVacationHabitId,
    handleOpenAddHabit,
    handleOpenAddRoutine,
    handleEditHabit,
    handleEditRoutine,
    handleCreateHabit,
    handleUpdateHabit,
    handlePermanentHabitStatusChange,
    handleRestDay,
    handleOpenVacation,
    handleSaveVacation,
    handleDeletePauseWindow,
    handleArchiveHabit,
    handleCreateRoutine,
    handleUpdateRoutine,
    handleMoveRoutine,
    handleArchiveRoutine,
  };
}
