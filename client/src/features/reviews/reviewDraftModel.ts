import type {
  DailyFrictionTag,
  DailyTomorrowAdjustment,
  DailyTomorrowAdjustmentRecommendation,
  TaskItem,
} from "../../shared/lib/api";
import { isQuickCaptureReferenceTask } from "../../shared/lib/quickCapture";
import { toIsoDate } from "../../shared/lib/api";
import type { ReviewWindowPresentation } from "./reviewWindowModel";

export type DailyTaskDecision = {
  type: "carry_forward" | "drop" | "reschedule";
  targetDate?: string;
};

export type DailyPriorityDraft = {
  id?: string;
  title: string;
};

export type DailyInputs = {
  biggestWin: string;
  frictionNote: string;
  energyRating: string;
  optionalNote: string;
  tomorrowAdjustment: "" | DailyTomorrowAdjustment;
};

export type DailyReviewDraft = {
  dailyInputs: DailyInputs;
  dailyTaskDecisions: Record<string, DailyTaskDecision>;
  dailyTomorrowPriorities: DailyPriorityDraft[];
  dailyTomorrowPrioritiesTouched?: boolean;
};

export type WeeklyReviewDraft = {
  responses: string[];
  focusHabitId: string | null;
};

export type MonthlyReviewDraft = {
  responses: string[];
};

export type ReviewDraftState = {
  hydratedKey: string | null;
  lastSavedAt: string | null;
};

export const prioritySlots: Array<1 | 2> = [1, 2];
const reviewRiskFrictionTags = new Set<DailyFrictionTag>([
  "low energy",
  "poor planning",
  "overcommitment",
]);

export const detectFrictionTag = (value: string): DailyFrictionTag => {
  const normalized = value.toLowerCase();
  if (normalized.includes("energy")) return "low energy";
  if (normalized.includes("interrupt")) return "interruptions";
  if (normalized.includes("distraction")) return "distraction";
  if (normalized.includes("overcommit")) return "overcommitment";
  if (normalized.includes("avoid")) return "avoidance";
  if (normalized.includes("unclear")) return "unclear task";
  if (normalized.includes("travel") || normalized.includes("schedule")) return "travel or schedule disruption";
  return "poor planning";
};

export const parseEnergyRating = (value: string) => {
  const number = Number.parseInt(value.replace(/[^0-9]/g, ""), 10);
  if (!Number.isFinite(number)) {
    return 3;
  }

  return Math.min(5, Math.max(1, number));
};

export const formatTomorrowAdjustmentLabel = (value: DailyTomorrowAdjustment | null | undefined) => {
  if (value === "rescue") {
    return "Rescue Mode";
  }

  if (value === "recovery") {
    return "Recovery Mode";
  }

  if (value === "keep_standard") {
    return "Keep standard day";
  }

  return "No change";
};

export const evaluateTomorrowAdjustmentRequirement = (input: {
  recommendation: DailyTomorrowAdjustmentRecommendation;
  energyRating: number;
  frictionTag?: DailyFrictionTag | null;
}): DailyTomorrowAdjustmentRecommendation => {
  if (input.recommendation.required) {
    return input.recommendation;
  }

  if (input.energyRating <= 2) {
    return {
      required: true,
      suggestedAdjustment: "rescue" as const,
      reason: "low_energy" as const,
      detail: "Low energy today is a strong signal to scale tomorrow down deliberately.",
    };
  }

  if (input.frictionTag && reviewRiskFrictionTags.has(input.frictionTag)) {
    return {
      required: true,
      suggestedAdjustment: "rescue" as const,
      reason:
        input.frictionTag === "overcommitment"
          ? "overcommitment"
          : input.frictionTag === "poor planning"
            ? "poor_planning"
            : "low_energy",
      detail:
        input.frictionTag === "overcommitment"
          ? "Overcommitment today is a sign to shrink tomorrow before it spirals."
          : input.frictionTag === "poor planning"
            ? "Poor planning today is a signal to lower tomorrow's expectations."
            : "Low energy today is a strong signal to scale tomorrow down deliberately.",
    };
  }

  return input.recommendation;
};

export const getTomorrowDate = (isoDate: string) => {
  const tomorrow = new Date(`${isoDate}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toIsoDate(tomorrow);
};

export const isQuickCaptureMetadataTask = (task: Pick<TaskItem, "originType" | "kind">) =>
  isQuickCaptureReferenceTask(task);

export const fillThreePriorityDraft = (values: DailyPriorityDraft[]) => {
  const next = values.slice(0, 2);
  while (next.length < 2) {
    next.push({ title: "" });
  }

  return next;
};

export const normalizePromptResponses = (values: string[] | undefined, count: number) =>
  Array.from({ length: count }, (_, index) => values?.[index] ?? "");

export const hasMeaningfulPromptResponses = (values: string[]) =>
  values.some((value) => value.trim().length > 0);

export const hasMeaningfulDailyDraft = (draft: DailyReviewDraft) =>
  draft.dailyInputs.biggestWin.trim().length > 0 ||
  draft.dailyInputs.frictionNote.trim().length > 0 ||
  draft.dailyInputs.optionalNote.trim().length > 0 ||
  (draft.dailyInputs.tomorrowAdjustment ?? "").trim().length > 0 ||
  draft.dailyInputs.energyRating.trim() !== "3" ||
  Object.keys(draft.dailyTaskDecisions).length > 0;

export const formatDraftStatus = (lastSavedAt: string | null) => {
  if (!lastSavedAt) {
    return "Draft autosaves on this device as you type.";
  }

  return `Draft autosaves on this device. Last saved ${new Date(lastSavedAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}.`;
};

export const formatClosedWindowStatus = (windowPresentation: ReviewWindowPresentation | null) => {
  if (!windowPresentation) {
    return "Submission is currently disabled - the review window is not open.";
  }

  if (windowPresentation.opensAtLocal && windowPresentation.closesAtLocal) {
    return `Submission is currently disabled - the next review window opens ${windowPresentation.opensAtLocal} and closes ${windowPresentation.closesAtLocal} (${windowPresentation.timezone}).`;
  }

  if (windowPresentation.opensAtLocal) {
    return `Submission is currently disabled - the next review window opens ${windowPresentation.opensAtLocal} (${windowPresentation.timezone}).`;
  }

  return `Submission is currently disabled - ${windowPresentation.description}`;
};

export const formatCount = (count: number, singular: string, plural: string) =>
  `${count} ${count === 1 ? singular : plural}`;
