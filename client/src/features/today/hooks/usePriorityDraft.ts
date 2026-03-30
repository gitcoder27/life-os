import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useUpdateDayPrioritiesMutation,
  useUpdatePriorityMutation,
  type GoalNudgeItem,
} from "../../../shared/lib/api";
import { nextDraftKey } from "../helpers/date-helpers";

export type EditablePriority = {
  id?: string;
  sortKey: string;
  title: string;
  goalId?: string | null;
  status: "pending" | "completed" | "dropped";
};

const PRIORITY_SLOTS: Array<1 | 2 | 3> = [1, 2, 3];
const AUTO_SAVE_DELAY = 800;

type ServerPriority = {
  id: string;
  slot: 1 | 2 | 3;
  title: string;
  status: "pending" | "completed" | "dropped";
  goalId: string | null;
};

export function usePriorityDraft(today: string, priorities: ServerPriority[], dataReady: boolean) {
  const [draft, setDraft] = useState<EditablePriority[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const updateDayPrioritiesMutation = useUpdateDayPrioritiesMutation(today);
  const updatePriorityMutation = useUpdatePriorityMutation(today);

  useEffect(() => {
    if (!dataReady) return;
    const sorted = [...priorities].sort((a, b) => a.slot - b.slot);
    setDraft(sorted.map((p) => ({
      id: p.id,
      sortKey: p.id,
      title: p.title,
      goalId: p.goalId,
      status: p.status,
    })));
  }, [dataReady, priorities]);

  const serverSnapshot = useMemo(
    () => [...priorities].sort((a, b) => a.slot - b.slot).map((p) => ({
      id: p.id,
      title: p.title,
      goalId: p.goalId,
    })),
    [priorities],
  );

  const draftSnapshot = useMemo(
    () => draft.map((p) => ({ id: p.id, title: p.title.trim(), goalId: p.goalId ?? null })),
    [draft],
  );

  const isDirty = JSON.stringify(draftSnapshot) !== JSON.stringify(serverSnapshot);
  const hasBlankTitle = draft.some((p) => !p.title.trim());
  const isMutating = updatePriorityMutation.isPending || updateDayPrioritiesMutation.isPending;

  const doSave = useCallback(() => {
    const current = draftRef.current;
    if (current.some((p) => !p.title.trim())) return;

    const payload = current
      .map((p, i) => ({
        id: p.id,
        slot: PRIORITY_SLOTS[i],
        title: p.title.trim(),
        goalId: p.goalId ?? null,
      }))
      .filter((p) => p.title.length > 0);

    setSaveStatus("saving");
    updateDayPrioritiesMutation.mutate(
      { priorities: payload },
      {
        onSuccess: () => {
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        },
        onError: () => setSaveStatus("idle"),
      },
    );
  }, [updateDayPrioritiesMutation]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(doSave, AUTO_SAVE_DELAY);
  }, [doSave]);

  const saveNow = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    doSave();
  }, [doSave]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const updateTitle = useCallback((index: number, title: string) => {
    setDraft((current) =>
      current.map((item, i) => (i === index ? { ...item, title } : item)),
    );
  }, []);

  const updateGoal = useCallback((index: number, goalId: string) => {
    setDraft((current) =>
      current.map((item, i) => (i === index ? { ...item, goalId: goalId || null } : item)),
    );
    scheduleSave();
  }, [scheduleSave]);

  const addPriority = useCallback(() => {
    setDraft((current) => {
      if (current.length >= 3) return current;
      return [...current, { title: "", goalId: null, status: "pending" as const, sortKey: nextDraftKey() }];
    });
  }, []);

  const removePriority = useCallback((index: number) => {
    setDraft((current) => current.filter((_, i) => i !== index));
    scheduleSave();
  }, [scheduleSave]);

  const reorder = useCallback((oldIndex: number, newIndex: number) => {
    setDraft((current) => {
      const next = [...current];
      const [removed] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, removed);
      return next;
    });
    scheduleSave();
  }, [scheduleSave]);

  const addGoalNudge = useCallback((nudge: GoalNudgeItem) => {
    setDraft((current) => {
      if (current.some((p) => p.goalId === nudge.goal.id)) return current;
      const emptyIdx = current.findIndex((p) => !p.title.trim());
      if (emptyIdx >= 0) {
        return current.map((p, i) =>
          i === emptyIdx ? { ...p, title: nudge.suggestedPriorityTitle, goalId: nudge.goal.id } : p,
        );
      }
      if (current.length >= 3) return current;
      return [...current, {
        title: nudge.suggestedPriorityTitle,
        goalId: nudge.goal.id,
        status: "pending" as const,
        sortKey: nextDraftKey(),
      }];
    });
    scheduleSave();
  }, [scheduleSave]);

  const changeStatus = useCallback((priorityId: string, status: "pending" | "completed" | "dropped") => {
    updatePriorityMutation.mutate({ priorityId, status });
  }, [updatePriorityMutation]);

  return {
    draft,
    saveStatus,
    isDirty,
    hasBlankTitle,
    isMutating,
    updateTitle,
    updateGoal,
    addPriority,
    removePriority,
    reorder,
    addGoalNudge,
    changeStatus,
    scheduleSave,
    saveNow,
    mutationError: updateDayPrioritiesMutation.error ?? updatePriorityMutation.error,
  };
}
