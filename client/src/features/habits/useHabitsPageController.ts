import { useEffect, useState } from "react";

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
  DueHabit,
  HabitCheckinLevel,
  HabitFormValues,
  HabitPauseFormValues,
  Routine,
  RoutineFormValues,
} from "./types";
import { parseTimeInputToMinutes } from "./timing";

// Optimistic check-in state. An override is applied on click, marked settled when its
// request finishes, and dropped once a habits refetch that started after it has landed
// (or immediately if the request fails, so the server state shows again).
type HabitOverride = {
  completedToday: boolean;
  completedCountToday: number;
  achievedLevelToday: HabitCheckinLevel | null;
  settledAt: number | null;
};

type StepOverride = {
  completedToday: boolean;
  settledAt: number | null;
};

function pruneSynced<T extends { settledAt: number | null }>(
  overrides: Record<string, T>,
  syncedAt: number,
) {
  const entries = Object.entries(overrides);
  const kept = entries.filter(([, override]) => override.settledAt === null || override.settledAt > syncedAt);
  return kept.length === entries.length ? overrides : Object.fromEntries(kept);
}

function withoutKey<T>(overrides: Record<string, T>, key: string) {
  if (!(key in overrides)) return overrides;
  const next = { ...overrides };
  delete next[key];
  return next;
}

function markSettled<T extends { settledAt: number | null }>(overrides: Record<string, T>, key: string) {
  const override = overrides[key];
  if (!override || override.settledAt !== null) return overrides;
  return { ...overrides, [key]: { ...override, settledAt: Date.now() } };
}

function applyHabitOverride(habit: DueHabit, override: HabitOverride | undefined): DueHabit {
  if (!override) return habit;

  const recentDays = habit.recentDays ?? [];
  const lastIndex = recentDays.length - 1;

  return {
    ...habit,
    completedToday: override.completedToday,
    completedCountToday: override.completedCountToday,
    achievedLevelToday: override.achievedLevelToday,
    recentDays: recentDays.map((day, index) =>
      index === lastIndex && (day.state === "open" || day.state === "done")
        ? { ...day, state: override.completedToday ? "done" : "open" }
        : day,
    ),
  };
}

function applyStepOverrides(routine: Routine, overrides: Record<string, StepOverride>): Routine {
  if (!routine.items.some((item) => item.id in overrides)) return routine;

  const items = routine.items.map((item) =>
    overrides[item.id] ? { ...item, completedToday: overrides[item.id].completedToday } : item,
  );

  return {
    ...routine,
    items,
    completedItems: items.filter((item) => item.completedToday).length,
  };
}

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
  const [habitOverrides, setHabitOverrides] = useState<Record<string, HabitOverride>>({});
  const [stepOverrides, setStepOverrides] = useState<Record<string, StepOverride>>({});
  const habitsSyncedAt = Math.max(habitsQuery.dataUpdatedAt, habitsQuery.errorUpdatedAt);

  useEffect(() => {
    setHabitOverrides((current) => pruneSynced(current, habitsSyncedAt));
    setStepOverrides((current) => pruneSynced(current, habitsSyncedAt));
  }, [habitsSyncedAt]);

  const habitsData = habitsQuery.data;
  const dueHabits = (habitsData?.dueHabits ?? []).map((habit) =>
    applyHabitOverride(habit, habitOverrides[habit.id]),
  );
  const allHabits = habitsData?.habits ?? [];
  const nonArchivedHabits = allHabits.filter((habit) => habit.status !== "archived");
  const archivedHabits = allHabits.filter((habit) => habit.status === "archived");
  const weeklyChallenge = habitsData?.weeklyChallenge ?? null;
  const routines = [...(habitsData?.routines ?? [])]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((routine) => applyStepOverrides(routine, stepOverrides));
  const activeRoutines = routines.filter((routine) => routine.status === "active");
  const nonArchivedRoutines = routines.filter((routine) => routine.status !== "archived");
  const archivedRoutines = routines.filter((routine) => routine.status === "archived");
  const consistencyBars = weeklyMomentumQuery.data?.dailyScores ?? [];
  const score = scoreQuery.data;
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
  const pendingHabitIds = new Set(
    Object.entries(habitOverrides)
      .filter(([, override]) => override.settledAt === null)
      .map(([habitId]) => habitId),
  );
  const pendingStepIds = new Set(
    Object.entries(stepOverrides)
      .filter(([, override]) => override.settledAt === null)
      .map(([itemId]) => itemId),
  );
  const isRescueMode =
    dayPlanQuery.data?.launch?.dayMode === "rescue" || dayPlanQuery.data?.launch?.dayMode === "recovery";

  function checkInHabit(habitId: string, level: HabitCheckinLevel) {
    const habit = dueHabits.find((candidate) => candidate.id === habitId);
    if (!habit || pendingHabitIds.has(habitId)) return;

    const completedCountToday = habit.completedCountToday + 1;
    setHabitOverrides((current) => ({
      ...current,
      [habitId]: {
        completedToday: completedCountToday >= habit.targetPerDay,
        completedCountToday,
        achievedLevelToday: level,
        settledAt: null,
      },
    }));
    habitCheckinMutation.mutateAsync({ habitId, level }).then(
      () => setHabitOverrides((current) => markSettled(current, habitId)),
      () => setHabitOverrides((current) => withoutKey(current, habitId)),
    );
  }

  function undoHabitCheckin(habitId: string) {
    if (pendingHabitIds.has(habitId)) return;

    setHabitOverrides((current) => ({
      ...current,
      [habitId]: {
        completedToday: false,
        completedCountToday: 0,
        achievedLevelToday: null,
        settledAt: null,
      },
    }));
    deleteHabitCheckinMutation.mutateAsync(habitId).then(
      () => setHabitOverrides((current) => markSettled(current, habitId)),
      () => setHabitOverrides((current) => withoutKey(current, habitId)),
    );
  }

  function toggleRoutineStep(itemId: string, completed: boolean) {
    if (pendingStepIds.has(itemId)) return;

    setStepOverrides((current) => ({
      ...current,
      [itemId]: { completedToday: completed, settledAt: null },
    }));
    const request = completed
      ? routineCheckinMutation.mutateAsync(itemId)
      : deleteRoutineCheckinMutation.mutateAsync(itemId);
    request.then(
      () => setStepOverrides((current) => markSettled(current, itemId)),
      () => setStepOverrides((current) => withoutKey(current, itemId)),
    );
  }

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
        durationMinutes: Math.max(1, Number.parseInt(values.durationMinutes, 10) || 25),
        recurrence: values.recurrenceRule
          ? buildRecurrenceInput(values.recurrenceRule)
          : undefined,
        goalId: values.goalId || null,
        timingMode: values.timingMode,
        anchorText: values.anchorText.trim() || null,
        targetTimeMinutes: parseTimeInputToMinutes(values.targetTime),
        windowStartMinutes: parseTimeInputToMinutes(values.windowStartTime),
        windowEndMinutes: parseTimeInputToMinutes(values.windowEndTime),
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
        durationMinutes: Math.max(1, Number.parseInt(values.durationMinutes, 10) || 25),
        recurrence: values.recurrenceRule
          ? buildRecurrenceInput(values.recurrenceRule)
          : undefined,
        goalId: values.goalId || null,
        timingMode: values.timingMode,
        anchorText: values.anchorText.trim() || null,
        targetTimeMinutes: parseTimeInputToMinutes(values.targetTime),
        windowStartMinutes: parseTimeInputToMinutes(values.windowStartTime),
        windowEndMinutes: parseTimeInputToMinutes(values.windowEndTime),
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
      {
        name: values.name.trim(),
        timingMode: "custom_window",
        windowStartMinutes: parseTimeInputToMinutes(values.windowStartTime),
        windowEndMinutes: parseTimeInputToMinutes(values.windowEndTime),
        items,
      },
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
      {
        routineId,
        name: values.name.trim(),
        timingMode: "custom_window",
        windowStartMinutes: parseTimeInputToMinutes(values.windowStartTime),
        windowEndMinutes: parseTimeInputToMinutes(values.windowEndTime),
        items: items.length ? items : undefined,
      },
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
    dueCompletedUnits,
    dueTargetUnits,
    routineCompleted,
    routineTotal,
    strongDayStreak,
    pendingHabitIds,
    pendingStepIds,
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
    checkInHabit,
    undoHabitCheckin,
    toggleRoutineStep,
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
