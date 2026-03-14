import type { ApiMeta, EntityId, IsoDateString } from "./common.js";

export type WaterLogSource = "tap" | "quick_capture" | "manual";
export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
export type MealLoggingQuality = "partial" | "meaningful" | "full";
export type WorkoutPlanType = "workout" | "recovery" | "none";
export type WorkoutActualStatus = "completed" | "recovery_respected" | "fallback" | "missed" | "none";

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

export interface HealthSummaryResponse extends ApiMeta {
  from: IsoDateString;
  to: IsoDateString;
  currentDay: {
    date: IsoDateString;
    waterMl: number;
    waterTargetMl: number;
    mealCount: number;
    meaningfulMealCount: number;
    workoutDay: WorkoutDayItem | null;
    latestWeight: WeightLogItem | null;
  };
  range: {
    totalWaterMl: number;
    totalMealsLogged: number;
    workoutsCompleted: number;
    workoutsPlanned: number;
  };
  mealLogs: MealLogItem[];
  weightHistory: WeightLogItem[];
}

export interface CreateWaterLogRequest {
  occurredAt?: string;
  amountMl: number;
  source?: WaterLogSource;
}

export interface WaterLogMutationResponse extends ApiMeta {
  waterLog: WaterLogItem;
}

export interface CreateMealLogRequest {
  occurredAt?: string;
  mealSlot?: MealSlot | null;
  mealTemplateId?: EntityId | null;
  description: string;
  loggingQuality: MealLoggingQuality;
}

export interface MealLogMutationResponse extends ApiMeta {
  mealLog: MealLogItem;
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

export interface WeightLogMutationResponse extends ApiMeta {
  weightLog: WeightLogItem;
}
