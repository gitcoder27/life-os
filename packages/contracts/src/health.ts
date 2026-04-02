import type { ApiMeta, EntityId, IsoDateString } from "./common.js";

export type WaterLogSource = "tap" | "quick_capture" | "manual";
export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
export type MealLoggingQuality = "partial" | "meaningful" | "full";
export type WorkoutPlanType = "workout" | "recovery" | "none";
export type WorkoutActualStatus = "completed" | "recovery_respected" | "fallback" | "missed" | "none";
export type HealthPhase = "morning" | "midday" | "evening";
export type HealthSignalStatus = "on_track" | "behind" | "complete" | "pending" | "recovery" | "missed";
export type HealthScoreLabel = "strong" | "steady" | "needs_attention";
export type HealthTimelineKind = "water" | "meal" | "workout" | "weight";
export type HealthGuidanceKind = "water" | "meal" | "workout" | "weight" | "consistency";
export type HealthGuidanceTone = "positive" | "neutral" | "warning";
export type HealthGuidanceIntent =
  | "log_water"
  | "log_meal"
  | "update_workout"
  | "log_weight"
  | "review_patterns";

export interface WaterLogItem {
  id: EntityId;
  occurredAt: string;
  amountMl: number;
  source: WaterLogSource;
  createdAt: string;
}

export interface MealLogItem {
  id: EntityId;
  occurredAt: string;
  mealSlot: MealSlot | null;
  mealTemplateId: EntityId | null;
  description: string;
  loggingQuality: MealLoggingQuality;
  createdAt: string;
}

export interface WorkoutDayItem {
  id: EntityId;
  date: IsoDateString;
  planType: WorkoutPlanType;
  plannedLabel: string | null;
  actualStatus: WorkoutActualStatus;
  note: string | null;
  updatedAt: string;
}

export interface WeightLogItem {
  id: EntityId;
  measuredOn: IsoDateString;
  weightValue: number;
  unit: string;
  note: string | null;
  createdAt: string;
}

export interface HealthTimelineItem {
  id: string;
  kind: HealthTimelineKind;
  occurredAt: string;
  title: string;
  detail: string;
}

export interface HealthGuidanceItem {
  id: string;
  kind: HealthGuidanceKind;
  tone: HealthGuidanceTone;
  title: string;
  detail: string;
  actionLabel: string;
  route: "/health";
  intent: HealthGuidanceIntent;
}

export interface HealthWaterSignal {
  status: "on_track" | "behind" | "complete";
  progressPct: number;
  remainingMl: number;
  paceTargetMl: number;
}

export interface HealthMealSignal {
  status: "on_track" | "behind" | "complete";
  progressPct: number;
  targetCount: number;
  nextSuggestedSlot: MealSlot | null;
}

export interface HealthWorkoutSignal {
  status: Exclude<HealthSignalStatus, "on_track" | "behind">;
  label: string;
}

export interface HealthScoreSnapshot {
  value: number;
  label: HealthScoreLabel;
  earnedPoints: number;
  possiblePoints: number;
}

export interface HealthRangeInsights {
  waterDaysOnTarget: number;
  mealLoggingDays: number;
  meaningfulMealDays: number;
  workoutsMissed: number;
  workoutCompletionRate: number | null;
  weightChange: number | null;
  weightUnit: string | null;
}

export interface HealthSummaryResponse extends ApiMeta {
  from: IsoDateString;
  to: IsoDateString;
  currentDay: {
    date: IsoDateString;
    phase: HealthPhase;
    waterMl: number;
    waterTargetMl: number;
    mealCount: number;
    meaningfulMealCount: number;
    workoutDay: WorkoutDayItem | null;
    latestWeight: WeightLogItem | null;
    signals: {
      water: HealthWaterSignal;
      meals: HealthMealSignal;
      workout: HealthWorkoutSignal;
    };
    score: HealthScoreSnapshot;
    timeline: HealthTimelineItem[];
  };
  range: {
    totalWaterMl: number;
    totalMealsLogged: number;
    workoutsCompleted: number;
    workoutsPlanned: number;
    insights: HealthRangeInsights;
  };
  guidance: {
    focus: HealthGuidanceItem;
    recommendations: HealthGuidanceItem[];
  };
  mealLogs: MealLogItem[];
  weightHistory: WeightLogItem[];
}

export interface CreateWaterLogRequest {
  occurredAt?: string;
  amountMl: number;
  source?: WaterLogSource;
}

export interface UpdateWaterLogRequest {
  occurredAt?: string;
  amountMl?: number;
  source?: WaterLogSource;
}

export interface WaterLogMutationResponse extends ApiMeta {
  waterLog: WaterLogItem;
}

export interface WaterLogsResponse extends ApiMeta {
  date: IsoDateString;
  waterLogs: WaterLogItem[];
}

export interface DeleteWaterLogResponse extends ApiMeta {
  deleted: true;
  waterLogId: EntityId;
}

export interface CreateMealLogRequest {
  occurredAt?: string;
  mealSlot?: MealSlot | null;
  mealTemplateId?: EntityId | null;
  description: string;
  loggingQuality: MealLoggingQuality;
}

export interface UpdateMealLogRequest {
  occurredAt?: string;
  mealSlot?: MealSlot | null;
  mealTemplateId?: EntityId | null;
  description?: string;
  loggingQuality?: MealLoggingQuality;
}

export interface MealLogMutationResponse extends ApiMeta {
  mealLog: MealLogItem;
}

export interface MealTemplateItem {
  id: EntityId;
  name: string;
  mealSlot: MealSlot | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MealTemplatesResponse extends ApiMeta {
  mealTemplates: MealTemplateItem[];
}

export interface CreateMealTemplateRequest {
  name: string;
  mealSlot?: MealSlot | null;
  description?: string | null;
}

export interface UpdateMealTemplateRequest {
  name?: string;
  mealSlot?: MealSlot | null;
  description?: string | null;
  archived?: boolean;
}

export interface MealTemplateMutationResponse extends ApiMeta {
  mealTemplate: MealTemplateItem;
}

export interface MealLogsResponse extends ApiMeta {
  date: IsoDateString;
  mealLogs: MealLogItem[];
}

export interface DeleteMealLogResponse extends ApiMeta {
  deleted: true;
  mealLogId: EntityId;
}

export interface UpdateWorkoutDayRequest {
  planType?: WorkoutPlanType;
  plannedLabel?: string | null;
  actualStatus?: WorkoutActualStatus;
  note?: string | null;
}

export interface WorkoutDayMutationResponse extends ApiMeta {
  workoutDay: WorkoutDayItem;
}

export interface CreateWeightLogRequest {
  measuredOn?: IsoDateString;
  weightValue: number;
  unit?: string;
  note?: string | null;
}

export interface UpdateWeightLogRequest {
  measuredOn?: IsoDateString;
  weightValue?: number;
  unit?: string;
  note?: string | null;
}

export interface WeightLogMutationResponse extends ApiMeta {
  weightLog: WeightLogItem;
}

export interface DeleteWeightLogResponse extends ApiMeta {
  deleted: true;
  weightLogId: EntityId;
}
