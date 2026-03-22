type QuickCaptureTaskLike = {
  kind: "task" | "note" | "reminder";
  notes: string | null;
  reminderDate: string | null;
};

type QuickCaptureReferenceTaskLike = {
  originType: string;
  kind: QuickCaptureTaskLike["kind"];
};

export function isQuickCaptureReferenceTask(task: QuickCaptureReferenceTaskLike): boolean {
  return task.originType === "quick_capture" && task.kind !== "task";
}

export function getQuickCaptureText(task: Pick<QuickCaptureTaskLike, "notes">, fallback = ""): string {
  return task.notes?.trim() || fallback;
}

export function getQuickCaptureDisplayText(
  task: Pick<QuickCaptureTaskLike, "kind" | "notes" | "reminderDate">,
  fallback = "",
): string {
  const text = getQuickCaptureText(task, fallback);

  if (task.kind === "reminder") {
    return `Reminder${task.reminderDate ? ` for ${task.reminderDate}` : ""}: ${text || "Reminder"}`;
  }

  return text || fallback;
}
