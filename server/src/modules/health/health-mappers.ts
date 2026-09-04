import type {
  MealLogItem,
  MealLoggingQuality,
  MealSlot,
  MealTemplateItem,
  WaterLogItem,
  WaterLogSource,
  WeightLogItem,
  WorkoutActualStatus,
  WorkoutDayItem,
  WorkoutPlanType,
} from "@life-os/contracts";
import type {
  MealLog,
  MealLoggingQuality as PrismaMealLoggingQuality,
  MealSlot as PrismaMealSlot,
  MealTemplate as PrismaMealTemplate,
  WaterLog,
  WaterLogSource as PrismaWaterLogSource,
  WeightLog,
  WorkoutActualStatus as PrismaWorkoutActualStatus,
  WorkoutDay,
  WorkoutPlanType as PrismaWorkoutPlanType,
} from "@prisma/client";

import { toIsoDateString } from "../../lib/time/date.js";
import { parseMealTemplatePayload } from "./meal-template-payload.js";

export function toPrismaWaterLogSource(source: WaterLogSource): PrismaWaterLogSource {
  switch (source) {
    case "tap":
      return "TAP";
    case "quick_capture":
      return "QUICK_CAPTURE";
    case "manual":
      return "MANUAL";
  }
}

function fromPrismaWaterLogSource(source: PrismaWaterLogSource): WaterLogSource {
  switch (source) {
    case "TAP":
      return "tap";
    case "QUICK_CAPTURE":
      return "quick_capture";
    case "MANUAL":
      return "manual";
  }
}

export function toPrismaMealSlot(slot: MealSlot | null | undefined): PrismaMealSlot | null | undefined {
  if (slot === undefined) {
    return undefined;
  }
  if (slot === null) {
    return null;
  }

  switch (slot) {
    case "breakfast":
      return "BREAKFAST";
    case "lunch":
      return "LUNCH";
    case "dinner":
      return "DINNER";
    case "snack":
      return "SNACK";
  }
}

export function fromPrismaMealSlot(slot: PrismaMealSlot | null): MealSlot | null {
  switch (slot) {
    case "BREAKFAST":
      return "breakfast";
    case "LUNCH":
      return "lunch";
    case "DINNER":
      return "dinner";
    case "SNACK":
      return "snack";
    case null:
      return null;
  }
}

export function toPrismaMealLoggingQuality(
  quality: MealLoggingQuality,
): PrismaMealLoggingQuality {
  switch (quality) {
    case "partial":
      return "PARTIAL";
    case "meaningful":
      return "MEANINGFUL";
    case "full":
      return "FULL";
  }
}

function fromPrismaMealLoggingQuality(
  quality: PrismaMealLoggingQuality,
): MealLoggingQuality {
  switch (quality) {
    case "PARTIAL":
      return "partial";
    case "MEANINGFUL":
      return "meaningful";
    case "FULL":
      return "full";
  }
}

export function toPrismaWorkoutPlanType(type: WorkoutPlanType): PrismaWorkoutPlanType {
  switch (type) {
    case "workout":
      return "WORKOUT";
    case "recovery":
      return "RECOVERY";
    case "none":
      return "NONE";
  }
}

function fromPrismaWorkoutPlanType(type: PrismaWorkoutPlanType): WorkoutPlanType {
  switch (type) {
    case "WORKOUT":
      return "workout";
    case "RECOVERY":
      return "recovery";
    case "NONE":
      return "none";
  }
}

export function toPrismaWorkoutActualStatus(status: WorkoutActualStatus): PrismaWorkoutActualStatus {
  switch (status) {
    case "completed":
      return "COMPLETED";
    case "recovery_respected":
      return "RECOVERY_RESPECTED";
    case "fallback":
      return "FALLBACK";
    case "missed":
      return "MISSED";
    case "none":
      return "NONE";
  }
}

function fromPrismaWorkoutActualStatus(status: PrismaWorkoutActualStatus): WorkoutActualStatus {
  switch (status) {
    case "COMPLETED":
      return "completed";
    case "RECOVERY_RESPECTED":
      return "recovery_respected";
    case "FALLBACK":
      return "fallback";
    case "MISSED":
      return "missed";
    case "NONE":
      return "none";
  }
}

export function serializeWaterLog(waterLog: WaterLog): WaterLogItem {
  return {
    id: waterLog.id,
    occurredAt: waterLog.occurredAt.toISOString(),
    amountMl: waterLog.amountMl,
    source: fromPrismaWaterLogSource(waterLog.source),
    createdAt: waterLog.createdAt.toISOString(),
  };
}

export function serializeMealLog(mealLog: MealLog): MealLogItem {
  return {
    id: mealLog.id,
    occurredAt: mealLog.occurredAt.toISOString(),
    mealSlot: fromPrismaMealSlot(mealLog.mealSlot),
    mealTemplateId: mealLog.mealTemplateId,
    mealPlanEntryId: mealLog.mealPlanEntryId,
    description: mealLog.description,
    loggingQuality: fromPrismaMealLoggingQuality(mealLog.loggingQuality),
    createdAt: mealLog.createdAt.toISOString(),
  };
}

export function serializeMealTemplate(mealTemplate: {
  id: string;
  name: string;
  mealSlot: PrismaMealSlot | null;
  templatePayloadJson: PrismaMealTemplate["templatePayloadJson"];
  createdAt: Date;
  updatedAt: Date;
}): MealTemplateItem {
  const payload = parseMealTemplatePayload(mealTemplate.templatePayloadJson);

  return {
    id: mealTemplate.id,
    name: mealTemplate.name,
    mealSlot: fromPrismaMealSlot(mealTemplate.mealSlot),
    description: payload.description,
    servings: payload.servings,
    prepMinutes: payload.prepMinutes,
    cookMinutes: payload.cookMinutes,
    ingredients: payload.ingredients,
    instructions: payload.instructions,
    tags: payload.tags,
    notes: payload.notes,
    createdAt: mealTemplate.createdAt.toISOString(),
    updatedAt: mealTemplate.updatedAt.toISOString(),
  };
}

export function serializeWorkoutDay(workoutDay: WorkoutDay): WorkoutDayItem {
  return {
    id: workoutDay.id,
    date: toIsoDateString(workoutDay.date),
    planType: fromPrismaWorkoutPlanType(workoutDay.planType),
    plannedLabel: workoutDay.plannedLabel,
    actualStatus: fromPrismaWorkoutActualStatus(workoutDay.actualStatus),
    note: workoutDay.note,
    updatedAt: workoutDay.updatedAt.toISOString(),
  };
}

export function serializeWeightLog(weightLog: WeightLog): WeightLogItem {
  return {
    id: weightLog.id,
    measuredOn: toIsoDateString(weightLog.measuredOn),
    weightValue: Number(weightLog.weightValue),
    unit: weightLog.unit,
    note: weightLog.note,
    createdAt: weightLog.createdAt.toISOString(),
  };
}
