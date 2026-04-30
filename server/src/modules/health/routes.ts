import type { FastifyPluginAsync } from "fastify";
import type {
  CreateMealTemplateRequest,
  CreateMealLogRequest,
  CreateWaterLogRequest,
  CreateWeightLogRequest,
  DeleteMealLogResponse,
  DeleteWaterLogResponse,
  DeleteWeightLogResponse,
  HealthSummaryResponse,
  IsoDateString,
  MealLogItem,
  MealPlanWeekResponse,
  MealLogsResponse,
  MealLogMutationResponse,
  MealLoggingQuality,
  MealTemplateMutationResponse,
  MealTemplateItem,
  SaveMealPlanWeekRequest,
  MealTemplatesResponse,
  MealSlot,
  PlannedMealTodayItem,
  UpdateMealLogRequest,
  UpdateMealTemplateRequest,
  UpdateWaterLogRequest,
  UpdateWeightLogRequest,
  UpdateWorkoutDayRequest,
  WaterLogItem,
  WaterLogsResponse,
  WaterLogMutationResponse,
  WaterLogSource,
  WeightLogItem,
  WeightLogMutationResponse,
  WorkoutActualStatus,
  WorkoutDayItem,
  WorkoutDayMutationResponse,
  WorkoutPlanType,
} from "@life-os/contracts";
import type {
  MealLog,
  MealLoggingQuality as PrismaMealLoggingQuality,
  MealPlanEntry,
  MealPlanGroceryItem as PrismaMealPlanGroceryItem,
  MealPlanGrocerySourceType as PrismaMealPlanGrocerySourceType,
  MealPlanWeek,
  MealSlot as PrismaMealSlot,
  MealTemplate as PrismaMealTemplate,
  MealPrepSession,
  Task,
  WaterLog,
  WaterLogSource as PrismaWaterLogSource,
  WeightLog,
  WorkoutActualStatus as PrismaWorkoutActualStatus,
  WorkoutDay,
  WorkoutPlanType as PrismaWorkoutPlanType,
} from "@prisma/client";
import { z } from "zod";

import { AppError } from "../../lib/errors/app-error.js";
import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { fromPrismaTaskStatus, toPrismaTaskOriginType, toPrismaTaskStatus } from "../planning/planning-mappers.js";
import { addIsoDays, getWeekEndDate, getWeekStartIsoDate, parseIsoDate } from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import {
  getDateRangeWindowUtc,
  getDayWindowUtc,
  getUserLocalDate,
  getUserLocalHour,
} from "../../lib/time/user-time.js";
import { createIsoDateRangeQuerySchema, isoDateStringSchema } from "../../lib/validation/date-range.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import { buildHealthSummaryEnhancements } from "./summary-builder.js";
import {
  normalizeMealTemplatePayloadInput,
  parseMealTemplatePayload,
  trimToNull,
} from "./meal-template-payload.js";

const isoDateSchema = isoDateStringSchema;
const isoDateTimeSchema = z.string().datetime({ offset: true });
const waterLogSourceSchema = z.enum(["tap", "quick_capture", "manual"]);
const mealSlotSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);
const mealLoggingQualitySchema = z.enum(["partial", "meaningful", "full"]);
const workoutPlanTypeSchema = z.enum(["workout", "recovery", "none"]);
const workoutActualStatusSchema = z.enum([
  "completed",
  "recovery_respected",
  "fallback",
  "missed",
  "none",
]);

const healthSummaryQuerySchema = createIsoDateRangeQuerySchema({ maxDays: 93 });

const byDateQuerySchema = z.object({
  date: isoDateSchema,
});

const createWaterLogSchema = z.object({
  occurredAt: isoDateTimeSchema.optional(),
  amountMl: z.number().int().positive().max(10000),
  source: waterLogSourceSchema.optional(),
});

const updateWaterLogSchema = z
  .object({
    occurredAt: isoDateTimeSchema.optional(),
    amountMl: z.number().int().positive().max(10000).optional(),
    source: waterLogSourceSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

const updateWorkoutDaySchema = z
  .object({
    planType: workoutPlanTypeSchema.optional(),
    plannedLabel: z.string().max(200).nullable().optional(),
    actualStatus: workoutActualStatusSchema.optional(),
    note: z.string().max(4000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

const createWeightLogSchema = z.object({
  measuredOn: isoDateSchema.optional(),
  weightValue: z.number().positive().max(1000),
  unit: z.string().min(1).max(16).optional(),
  note: z.string().max(4000).nullable().optional(),
});

const updateWeightLogSchema = z
  .object({
    measuredOn: isoDateSchema.optional(),
    weightValue: z.number().positive().max(1000).optional(),
    unit: z.string().min(1).max(16).optional(),
    note: z.string().max(4000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

const entityIdSchema = z.string().uuid();
const decimalSchema = z.number().positive().max(100000).nullable().optional();
const sortOrderSchema = z.number().int().min(0).optional();
const shortTextSchema = z.string().trim().min(1).max(200);
const optionalShortTextSchema = z.string().trim().max(200).nullable().optional();
const optionalNoteSchema = z.string().trim().max(4000).nullable().optional();
const optionalSectionSchema = z.string().trim().max(80).nullable().optional();
const optionalUnitSchema = z.string().trim().max(64).nullable().optional();
const ingredientInputSchema = z.object({
  name: shortTextSchema,
  quantity: decimalSchema,
  unit: optionalUnitSchema,
  section: optionalSectionSchema,
  note: optionalNoteSchema,
});
const instructionInputSchema = z.string().trim().min(1).max(1000);
const tagInputSchema = z.string().trim().min(1).max(40);

const createMealTemplateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  mealSlot: mealSlotSchema.nullable().optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  servings: z.number().positive().max(1000).nullable().optional(),
  prepMinutes: z.number().int().positive().max(1440).nullable().optional(),
  cookMinutes: z.number().int().positive().max(1440).nullable().optional(),
  ingredients: z.array(ingredientInputSchema).max(200).optional(),
  instructions: z.array(instructionInputSchema).max(200).optional(),
  tags: z.array(tagInputSchema).max(40).optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
});

const updateMealTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    mealSlot: mealSlotSchema.nullable().optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    servings: z.number().positive().max(1000).nullable().optional(),
    prepMinutes: z.number().int().positive().max(1440).nullable().optional(),
    cookMinutes: z.number().int().positive().max(1440).nullable().optional(),
    ingredients: z.array(ingredientInputSchema).max(200).optional(),
    instructions: z.array(instructionInputSchema).max(200).optional(),
    tags: z.array(tagInputSchema).max(40).optional(),
    notes: z.string().trim().max(4000).nullable().optional(),
    archived: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

const createMealLogSchema = z.object({
  occurredAt: isoDateTimeSchema.optional(),
  mealSlot: mealSlotSchema.nullable().optional(),
  mealTemplateId: z.string().uuid().nullable().optional(),
  mealPlanEntryId: z.string().uuid().nullable().optional(),
  description: z.string().trim().min(1).max(4000),
  loggingQuality: mealLoggingQualitySchema,
});

const updateMealLogSchema = z
  .object({
    occurredAt: isoDateTimeSchema.optional(),
    mealSlot: mealSlotSchema.nullable().optional(),
    mealTemplateId: z.string().uuid().nullable().optional(),
    mealPlanEntryId: z.string().uuid().nullable().optional(),
    description: z.string().trim().min(1).max(4000).optional(),
    loggingQuality: mealLoggingQualitySchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

const mealPlanEntryInputSchema = z.object({
  id: entityIdSchema.optional(),
  date: isoDateSchema,
  mealSlot: mealSlotSchema,
  mealTemplateId: entityIdSchema,
  servings: z.number().positive().max(1000).nullable().optional(),
  note: optionalNoteSchema,
  sortOrder: sortOrderSchema,
});

const mealPrepSessionInputSchema = z.object({
  id: entityIdSchema.optional(),
  scheduledForDate: isoDateSchema,
  title: z.string().trim().min(1).max(200),
  notes: optionalNoteSchema,
  sortOrder: sortOrderSchema,
});

const manualGroceryItemInputSchema = z.object({
  id: entityIdSchema.optional(),
  name: shortTextSchema,
  quantity: decimalSchema,
  unit: optionalUnitSchema,
  section: optionalSectionSchema,
  note: optionalNoteSchema,
  isChecked: z.boolean().optional(),
  sortOrder: sortOrderSchema,
});

const plannedGroceryCheckInputSchema = z.object({
  name: shortTextSchema,
  unit: optionalUnitSchema,
  isChecked: z.boolean().optional(),
});

const saveMealPlanWeekSchema = z.object({
  notes: z.string().trim().max(4000).nullable().optional(),
  entries: z.array(mealPlanEntryInputSchema).max(100),
  prepSessions: z.array(mealPrepSessionInputSchema).max(50),
  manualGroceryItems: z.array(manualGroceryItemInputSchema).max(300),
  plannedGroceryItems: z.array(plannedGroceryCheckInputSchema).max(300).optional().default([]),
});

function normalizeKeyPart(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase();
}

function getGroceryCheckKey(name: string, unit: string | null | undefined) {
  return `${normalizeKeyPart(name)}::${normalizeKeyPart(unit)}`;
}

function assertIsoDateWithinWeek(date: IsoDateString, startDate: IsoDateString, endDate: IsoDateString, field: string) {
  if (date < startDate || date > endDate) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: `${field} must stay within the selected week`,
    });
  }
}

function toPrismaMealPlanGrocerySourceType(sourceType: "planned" | "manual"): PrismaMealPlanGrocerySourceType {
  switch (sourceType) {
    case "planned":
      return "PLANNED";
    case "manual":
      return "MANUAL";
  }
}

function fromPrismaMealPlanGrocerySourceType(sourceType: PrismaMealPlanGrocerySourceType): "planned" | "manual" {
  switch (sourceType) {
    case "PLANNED":
      return "planned";
    case "MANUAL":
      return "manual";
  }
}

async function getTodayIsoDate(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
) {
  const preferences = await app.prisma.userPreference.findUnique({
    where: {
      userId,
    },
    select: {
      timezone: true,
    },
  });

  return getUserLocalDate(new Date(), preferences?.timezone);
}

function toPrismaWaterLogSource(source: WaterLogSource): PrismaWaterLogSource {
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

function toPrismaMealSlot(slot: MealSlot | null | undefined): PrismaMealSlot | null | undefined {
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

function fromPrismaMealSlot(slot: PrismaMealSlot | null): MealSlot | null {
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

function toPrismaMealLoggingQuality(
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

function toPrismaWorkoutPlanType(type: WorkoutPlanType): PrismaWorkoutPlanType {
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

function toPrismaWorkoutActualStatus(status: WorkoutActualStatus): PrismaWorkoutActualStatus {
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

function serializeWaterLog(waterLog: WaterLog): WaterLogItem {
  return {
    id: waterLog.id,
    occurredAt: waterLog.occurredAt.toISOString(),
    amountMl: waterLog.amountMl,
    source: fromPrismaWaterLogSource(waterLog.source),
    createdAt: waterLog.createdAt.toISOString(),
  };
}

function serializeMealLog(mealLog: MealLog): MealLogItem {
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

function serializeMealTemplate(mealTemplate: {
  id: string;
  name: string;
  mealSlot: PrismaMealSlot | null;
  templatePayloadJson: unknown;
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

function serializeWorkoutDay(workoutDay: WorkoutDay): WorkoutDayItem {
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

function serializeWeightLog(weightLog: WeightLog): WeightLogItem {
  return {
    id: weightLog.id,
    measuredOn: toIsoDateString(weightLog.measuredOn),
    weightValue: Number(weightLog.weightValue),
    unit: weightLog.unit,
    note: weightLog.note,
    createdAt: weightLog.createdAt.toISOString(),
  };
}

type MealPlanEntryRecord = MealPlanEntry & {
  mealTemplate: Pick<PrismaMealTemplate, "id" | "name" | "templatePayloadJson">;
  mealLogs: Array<Pick<MealLog, "id">>;
};

type MealPrepSessionRecord = MealPrepSession & {
  task: Pick<Task, "id" | "status"> | null;
};

type MealPlanWeekRecord = MealPlanWeek & {
  entries: MealPlanEntryRecord[];
  prepSessions: MealPrepSessionRecord[];
  groceryItems: PrismaMealPlanGroceryItem[];
};

function roundToTwoDecimals(value: number) {
  return Math.round(value * 100) / 100;
}

function serializeMealPlanEntry(entry: MealPlanEntryRecord) {
  return {
    id: entry.id,
    date: toIsoDateString(entry.date),
    mealSlot: fromPrismaMealSlot(entry.mealSlot) ?? "breakfast",
    mealTemplateId: entry.mealTemplateId,
    mealTemplateName: entry.mealTemplate.name,
    servings: entry.servings ? Number(entry.servings) : null,
    note: entry.note,
    sortOrder: entry.sortOrder,
    isLogged: entry.mealLogs.length > 0,
    loggedMealCount: entry.mealLogs.length,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

function serializeMealPrepSession(session: MealPrepSessionRecord) {
  return {
    id: session.id,
    scheduledForDate: toIsoDateString(session.scheduledForDate),
    title: session.title,
    notes: session.notes,
    taskId: session.taskId,
    taskStatus: session.task ? fromPrismaTaskStatus(session.task.status) : null,
    sortOrder: session.sortOrder,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

function serializeMealPlanGroceryItem(groceryItem: PrismaMealPlanGroceryItem) {
  return {
    id: groceryItem.id,
    name: groceryItem.name,
    quantity: groceryItem.quantity ? Number(groceryItem.quantity) : null,
    unit: groceryItem.unit,
    section: groceryItem.section,
    note: groceryItem.note,
    sourceType: fromPrismaMealPlanGrocerySourceType(groceryItem.sourceType),
    isChecked: groceryItem.isChecked,
    sortOrder: groceryItem.sortOrder,
    createdAt: groceryItem.createdAt.toISOString(),
    updatedAt: groceryItem.updatedAt.toISOString(),
  };
}

function serializePlannedMealToday(entry: MealPlanEntryRecord): PlannedMealTodayItem {
  return {
    mealPlanEntryId: entry.id,
    date: toIsoDateString(entry.date),
    mealSlot: fromPrismaMealSlot(entry.mealSlot) ?? "breakfast",
    mealTemplateId: entry.mealTemplateId,
    title: entry.mealTemplate.name,
    servings: entry.servings ? Number(entry.servings) : null,
    note: entry.note,
    isLogged: entry.mealLogs.length > 0,
  };
}

function buildMealPlanWeekSummary(week: MealPlanWeekRecord | null) {
  const entries = week?.entries ?? [];
  const prepSessions = week?.prepSessions ?? [];
  const groceryItems = week?.groceryItems ?? [];

  return {
    totalPlannedMeals: entries.length,
    loggedPlannedMeals: entries.filter((entry) => entry.mealLogs.length > 0).length,
    prepSessionsCount: prepSessions.length,
    completedPrepSessionsCount: prepSessions.filter((session) => session.task?.status === "COMPLETED").length,
    groceryItemCount: groceryItems.length,
  };
}

function buildPlannedGroceryRows(
  entries: SaveMealPlanWeekRequest["entries"],
  templateById: Map<string, Pick<PrismaMealTemplate, "id" | "templatePayloadJson">>,
  checkedByKey: Map<string, boolean>,
) {
  const aggregate = new Map<string, {
    name: string;
    quantity: number | null;
    unit: string | null;
    section: string | null;
    note: string | null;
  }>();

  entries.forEach((entry) => {
    const template = templateById.get(entry.mealTemplateId);
    if (!template) {
      return;
    }

    const payload = parseMealTemplatePayload(template.templatePayloadJson);
    const multiplier = payload.servings && entry.servings
      ? entry.servings / payload.servings
      : 1;

    payload.ingredients.forEach((ingredient) => {
      const key = `${normalizeKeyPart(ingredient.name)}::${normalizeKeyPart(ingredient.unit)}`;
      const scaledQuantity = ingredient.quantity === null ? null : roundToTwoDecimals(ingredient.quantity * multiplier);
      const existing = aggregate.get(key);

      if (!existing) {
        aggregate.set(key, {
          name: ingredient.name,
          quantity: scaledQuantity,
          unit: ingredient.unit,
          section: ingredient.section,
          note: ingredient.note,
        });
        return;
      }

      existing.quantity = existing.quantity !== null && scaledQuantity !== null
        ? roundToTwoDecimals(existing.quantity + scaledQuantity)
        : null;

      if (normalizeKeyPart(existing.section) !== normalizeKeyPart(ingredient.section)) {
        existing.section = null;
      }

      if (normalizeKeyPart(existing.note) !== normalizeKeyPart(ingredient.note)) {
        existing.note = null;
      }
    });
  });

  return [...aggregate.values()]
    .sort((left, right) => {
      const sectionCompare = normalizeKeyPart(left.section).localeCompare(normalizeKeyPart(right.section));
      if (sectionCompare !== 0) {
        return sectionCompare;
      }

      return left.name.localeCompare(right.name);
    })
    .map((item, index) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      section: item.section,
      note: item.note,
      sourceType: "planned" as const,
      isChecked: checkedByKey.get(getGroceryCheckKey(item.name, item.unit)) ?? false,
      sortOrder: index,
    }));
}

async function findOwnedMealPlanEntry(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  mealPlanEntryId: string | null | undefined,
) {
  if (!mealPlanEntryId) {
    return null;
  }

  const mealPlanEntry = await app.prisma.mealPlanEntry.findFirst({
    where: {
      id: mealPlanEntryId,
      mealPlanWeek: {
        userId,
      },
    },
  });

  if (!mealPlanEntry) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Planned meal not found",
    });
  }

  return mealPlanEntry;
}

async function getTodayPlannedMeals(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  todayIsoDate: IsoDateString,
  weekStartsOn: number,
) {
  const weekStartIsoDate = getWeekStartIsoDate(todayIsoDate, weekStartsOn);
  const mealPlanWeek = await app.prisma.mealPlanWeek.findUnique({
    where: {
      userId_startDate: {
        userId,
        startDate: parseIsoDate(weekStartIsoDate),
      },
    },
    include: {
      entries: {
        where: {
          date: parseIsoDate(todayIsoDate),
        },
        include: {
          mealTemplate: {
            select: {
              id: true,
              name: true,
              templatePayloadJson: true,
            },
          },
          mealLogs: {
            select: {
              id: true,
            },
          },
        },
        orderBy: [{ mealSlot: "asc" }, { sortOrder: "asc" }],
      },
    },
  });

  return (mealPlanWeek?.entries ?? []).map(serializePlannedMealToday);
}

async function buildMealPlanWeekResponse(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  startDate: IsoDateString,
): Promise<MealPlanWeekResponse> {
  const startDateValue = parseIsoDate(startDate);
  const mealPlanWeek = await app.prisma.mealPlanWeek.findUnique({
    where: {
      userId_startDate: {
        userId,
        startDate: startDateValue,
      },
    },
    include: {
      entries: {
        include: {
          mealTemplate: {
            select: {
              id: true,
              name: true,
              templatePayloadJson: true,
            },
          },
          mealLogs: {
            select: {
              id: true,
            },
          },
        },
        orderBy: [{ date: "asc" }, { mealSlot: "asc" }, { sortOrder: "asc" }],
      },
      prepSessions: {
        include: {
          task: {
            select: {
              id: true,
              status: true,
            },
          },
        },
        orderBy: [{ scheduledForDate: "asc" }, { sortOrder: "asc" }],
      },
      groceryItems: {
        orderBy: [{ sourceType: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });
  const mealTemplates = await app.prisma.mealTemplate.findMany({
    where: {
      userId,
      archivedAt: null,
    },
    orderBy: [{ mealSlot: "asc" }, { name: "asc" }],
  });

  return withGeneratedAt({
    startDate,
    endDate: toIsoDateString(getWeekEndDate(startDateValue)),
    notes: mealPlanWeek?.notes ?? null,
    entries: (mealPlanWeek?.entries ?? []).map(serializeMealPlanEntry),
    prepSessions: (mealPlanWeek?.prepSessions ?? []).map(serializeMealPrepSession),
    groceryItems: (mealPlanWeek?.groceryItems ?? []).map(serializeMealPlanGroceryItem),
    summary: buildMealPlanWeekSummary(mealPlanWeek),
    mealTemplates: mealTemplates.map(serializeMealTemplate),
  });
}

async function saveMealPlanWeek(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  startDate: IsoDateString,
  payload: SaveMealPlanWeekRequest,
) {
  const startDateValue = parseIsoDate(startDate);
  const endDate = addIsoDays(startDate, 6);
  const mealTemplateIds = [...new Set(payload.entries.map((entry) => entry.mealTemplateId))];

  payload.entries.forEach((entry) => {
    assertIsoDateWithinWeek(entry.date, startDate, endDate, "Meal entry date");
  });
  payload.prepSessions.forEach((session) => {
    assertIsoDateWithinWeek(session.scheduledForDate, startDate, endDate, "Prep session date");
  });

  const [mealTemplates, existingWeek] = await Promise.all([
    app.prisma.mealTemplate.findMany({
      where: {
        userId,
        archivedAt: null,
        id: {
          in: mealTemplateIds,
        },
      },
      select: {
        id: true,
        templatePayloadJson: true,
      },
    }),
    app.prisma.mealPlanWeek.findUnique({
      where: {
        userId_startDate: {
          userId,
          startDate: startDateValue,
        },
      },
      include: {
        entries: true,
        prepSessions: true,
        groceryItems: {
          where: {
            sourceType: "MANUAL",
          },
        },
      },
    }),
  ]);

  if (mealTemplates.length !== mealTemplateIds.length) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Meal template not found",
    });
  }

  const existingEntryById = new Map((existingWeek?.entries ?? []).map((entry) => [entry.id, entry]));
  const existingPrepById = new Map((existingWeek?.prepSessions ?? []).map((session) => [session.id, session]));
  const existingManualGroceryById = new Map((existingWeek?.groceryItems ?? []).map((item) => [item.id, item]));

  payload.entries.forEach((entry) => {
    if (entry.id && !existingEntryById.has(entry.id)) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Meal plan entry not found",
      });
    }
  });
  payload.prepSessions.forEach((session) => {
    if (session.id && !existingPrepById.has(session.id)) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Prep session not found",
      });
    }
  });
  payload.manualGroceryItems.forEach((item) => {
    if (item.id && !existingManualGroceryById.has(item.id)) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Manual grocery item not found",
      });
    }
  });

  const mealTemplateById = new Map(mealTemplates.map((template) => [template.id, template]));
  const plannedCheckedByKey = new Map(
    (payload.plannedGroceryItems ?? []).map((item) => [
      getGroceryCheckKey(item.name, item.unit),
      item.isChecked ?? false,
    ]),
  );
  const submittedEntryIds = new Set(payload.entries.map((entry) => entry.id).filter((id): id is string => Boolean(id)));
  const submittedPrepIds = new Set(payload.prepSessions.map((session) => session.id).filter((id): id is string => Boolean(id)));
  const submittedManualGroceryIds = new Set(
    payload.manualGroceryItems.map((item) => item.id).filter((id): id is string => Boolean(id)),
  );

  await app.prisma.$transaction(async (tx) => {
    const mealPlanWeek = existingWeek
      ? await tx.mealPlanWeek.update({
          where: {
            id: existingWeek.id,
          },
          data: {
            notes: trimToNull(payload.notes) ?? null,
          },
        })
      : await tx.mealPlanWeek.create({
          data: {
            userId,
            startDate: startDateValue,
            notes: trimToNull(payload.notes) ?? null,
          },
        });

    const mealPlanWeekId = mealPlanWeek.id;

    const entryIdsToDelete = (existingWeek?.entries ?? [])
      .filter((entry) => !submittedEntryIds.has(entry.id))
      .map((entry) => entry.id);
    if (entryIdsToDelete.length > 0) {
      await tx.mealPlanEntry.deleteMany({
        where: {
          id: {
            in: entryIdsToDelete,
          },
        },
      });
    }

    for (const [index, entry] of payload.entries.entries()) {
      const sortOrder = entry.sortOrder ?? index;
      const data = {
        date: parseIsoDate(entry.date),
        mealSlot: toPrismaMealSlot(entry.mealSlot) ?? "BREAKFAST",
        mealTemplateId: entry.mealTemplateId,
        servings: entry.servings ?? null,
        note: trimToNull(entry.note) ?? null,
        sortOrder,
      };

      if (entry.id) {
        await tx.mealPlanEntry.update({
          where: {
            id: entry.id,
          },
          data,
        });
      } else {
        await tx.mealPlanEntry.create({
          data: {
            mealPlanWeekId,
            ...data,
          },
        });
      }
    }

    const prepSessionsToDelete = (existingWeek?.prepSessions ?? []).filter(
      (session) => !submittedPrepIds.has(session.id),
    );
    for (const prepSession of prepSessionsToDelete) {
      if (prepSession.taskId) {
        await tx.task.updateMany({
          where: {
            id: prepSession.taskId,
            userId,
          },
          data: {
            status: toPrismaTaskStatus("dropped"),
          },
        });
      }
    }
    if (prepSessionsToDelete.length > 0) {
      await tx.mealPrepSession.deleteMany({
        where: {
          id: {
            in: prepSessionsToDelete.map((session) => session.id),
          },
        },
      });
    }

    for (const [index, session] of payload.prepSessions.entries()) {
      const sortOrder = session.sortOrder ?? index;
      const existingSession = session.id ? existingPrepById.get(session.id) ?? null : null;
      let taskId = existingSession?.taskId ?? null;

      if (taskId) {
        const updatedTask = await tx.task.updateMany({
          where: {
            id: taskId,
            userId,
          },
          data: {
            title: session.title.trim(),
            notes: trimToNull(session.notes) ?? null,
            kind: "TASK",
            originType: toPrismaTaskOriginType("meal_plan"),
            scheduledForDate: parseIsoDate(session.scheduledForDate),
          },
        });

        if (updatedTask.count === 0) {
          taskId = null;
        }
      }

      if (!taskId) {
        const createdTask = await tx.task.create({
          data: {
            userId,
            title: session.title.trim(),
            notes: trimToNull(session.notes) ?? null,
            kind: "TASK",
            originType: toPrismaTaskOriginType("meal_plan"),
            scheduledForDate: parseIsoDate(session.scheduledForDate),
          },
        });
        taskId = createdTask.id;
      }

      const sessionData = {
        scheduledForDate: parseIsoDate(session.scheduledForDate),
        title: session.title.trim(),
        notes: trimToNull(session.notes) ?? null,
        taskId,
        sortOrder,
      };

      if (session.id) {
        await tx.mealPrepSession.update({
          where: {
            id: session.id,
          },
          data: sessionData,
        });
      } else {
        await tx.mealPrepSession.create({
          data: {
            mealPlanWeekId,
            ...sessionData,
          },
        });
      }
    }

    await tx.mealPlanGroceryItem.deleteMany({
      where: {
        mealPlanWeekId,
        sourceType: "PLANNED",
      },
    });

    const manualGroceryIdsToDelete = (existingWeek?.groceryItems ?? [])
      .filter((item) => !submittedManualGroceryIds.has(item.id))
      .map((item) => item.id);
    if (manualGroceryIdsToDelete.length > 0) {
      await tx.mealPlanGroceryItem.deleteMany({
        where: {
          id: {
            in: manualGroceryIdsToDelete,
          },
        },
      });
    }

    for (const [index, item] of payload.manualGroceryItems.entries()) {
      const sortOrder = item.sortOrder ?? index;
      const groceryData = {
        name: item.name.trim(),
        quantity: item.quantity ?? null,
        unit: trimToNull(item.unit),
        section: trimToNull(item.section),
        note: trimToNull(item.note),
        sourceType: toPrismaMealPlanGrocerySourceType("manual"),
        isChecked: item.isChecked ?? false,
        sortOrder,
      };

      if (item.id) {
        await tx.mealPlanGroceryItem.update({
          where: {
            id: item.id,
          },
          data: groceryData,
        });
      } else {
        await tx.mealPlanGroceryItem.create({
          data: {
            mealPlanWeekId,
            ...groceryData,
          },
        });
      }
    }

    const plannedGroceryRows = buildPlannedGroceryRows(payload.entries, mealTemplateById, plannedCheckedByKey);
    if (plannedGroceryRows.length > 0) {
      await tx.mealPlanGroceryItem.createMany({
        data: plannedGroceryRows.map((item) => ({
          mealPlanWeekId,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          section: item.section,
          note: item.note,
          sourceType: toPrismaMealPlanGrocerySourceType(item.sourceType),
          isChecked: item.isChecked,
          sortOrder: item.sortOrder,
        })),
      });
    }
  });
}

async function assertOwnedMealTemplate(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  mealTemplateId: string | null | undefined,
) {
  if (!mealTemplateId) {
    return;
  }

  const mealTemplate = await app.prisma.mealTemplate.findFirst({
    where: {
      id: mealTemplateId,
      userId,
      archivedAt: null,
    },
  });

  if (!mealTemplate) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Meal template not found",
    });
  }
}

async function findOwnedMealTemplate(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  mealTemplateId: string,
) {
  const mealTemplate = await app.prisma.mealTemplate.findFirst({
    where: {
      id: mealTemplateId,
      userId,
    },
  });

  if (!mealTemplate) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Meal template not found",
    });
  }

  return mealTemplate;
}

async function findOwnedWaterLog(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  waterLogId: string,
) {
  const waterLog = await app.prisma.waterLog.findFirst({
    where: {
      id: waterLogId,
      userId,
    },
  });

  if (!waterLog) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Water log not found",
    });
  }

  return waterLog;
}

async function findOwnedMealLog(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  mealLogId: string,
) {
  const mealLog = await app.prisma.mealLog.findFirst({
    where: {
      id: mealLogId,
      userId,
    },
  });

  if (!mealLog) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Meal log not found",
    });
  }

  return mealLog;
}

async function findOwnedWeightLog(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  weightLogId: string,
) {
  const weightLog = await app.prisma.weightLog.findFirst({
    where: {
      id: weightLogId,
      userId,
    },
  });

  if (!weightLog) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Weight log not found",
    });
  }

  return weightLog;
}

export const registerHealthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/water-logs", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(byDateQuerySchema, request.query);
    const preferences = await app.prisma.userPreference.findUnique({
      where: {
        userId: user.id,
      },
      select: {
        timezone: true,
      },
    });
    const dayWindow = getDayWindowUtc(query.date, preferences?.timezone);
    const waterLogs = await app.prisma.waterLog.findMany({
      where: {
        userId: user.id,
        occurredAt: {
          gte: dayWindow.start,
          lt: dayWindow.end,
        },
      },
      orderBy: {
        occurredAt: "asc",
      },
    });

    const response: WaterLogsResponse = withGeneratedAt({
      date: query.date,
      waterLogs: waterLogs.map(serializeWaterLog),
    });

    return reply.send(response);
  });

  app.get("/meal-templates", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const mealTemplates = await app.prisma.mealTemplate.findMany({
      where: {
        userId: user.id,
        archivedAt: null,
      },
      orderBy: [{ mealSlot: "asc" }, { name: "asc" }],
    });

    const response: MealTemplatesResponse = withGeneratedAt({
      mealTemplates: mealTemplates.map(serializeMealTemplate),
    });

    return reply.send(response);
  });

  app.post("/meal-templates", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(
      createMealTemplateSchema,
      request.body as CreateMealTemplateRequest,
    );
    const mealTemplate = await app.prisma.mealTemplate.create({
      data: {
        userId: user.id,
        name: payload.name.trim(),
        mealSlot: toPrismaMealSlot(payload.mealSlot),
        templatePayloadJson: normalizeMealTemplatePayloadInput(payload),
      },
    });

    const response: MealTemplateMutationResponse = withGeneratedAt({
      mealTemplate: serializeMealTemplate(mealTemplate),
    });

    return reply.status(201).send(response);
  });

  app.patch("/meal-templates/:mealTemplateId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { mealTemplateId } = request.params as { mealTemplateId: string };
    const payload = parseOrThrow(
      updateMealTemplateSchema,
      request.body as UpdateMealTemplateRequest,
    );

    const existingTemplate = await findOwnedMealTemplate(app, user.id, mealTemplateId);
    const existingPayload = parseMealTemplatePayload(existingTemplate.templatePayloadJson);
    const mealTemplate = await app.prisma.mealTemplate.update({
      where: {
        id: mealTemplateId,
      },
      data: {
        name: payload.name?.trim(),
        mealSlot: toPrismaMealSlot(payload.mealSlot),
        templatePayloadJson: normalizeMealTemplatePayloadInput(payload, existingPayload),
        archivedAt:
          payload.archived === undefined
            ? undefined
            : payload.archived
              ? new Date()
              : null,
      },
    });

    const response: MealTemplateMutationResponse = withGeneratedAt({
      mealTemplate: serializeMealTemplate(mealTemplate),
    });

    return reply.send(response);
  });

  app.get("/meal-plans/weeks/:startDate", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { startDate } = request.params as { startDate: IsoDateString };
    const parsedStartDate = parseOrThrow(isoDateSchema, startDate);

    return reply.send(await buildMealPlanWeekResponse(app, user.id, parsedStartDate));
  });

  app.put("/meal-plans/weeks/:startDate", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { startDate } = request.params as { startDate: IsoDateString };
    const parsedStartDate = parseOrThrow(isoDateSchema, startDate);
    const payload = parseOrThrow(saveMealPlanWeekSchema, request.body as SaveMealPlanWeekRequest);

    await saveMealPlanWeek(app, user.id, parsedStartDate, payload);

    return reply.send(await buildMealPlanWeekResponse(app, user.id, parsedStartDate));
  });

  app.get("/meal-logs", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(byDateQuerySchema, request.query);
    const preferences = await app.prisma.userPreference.findUnique({
      where: {
        userId: user.id,
      },
      select: {
        timezone: true,
      },
    });
    const dayWindow = getDayWindowUtc(query.date, preferences?.timezone);
    const mealLogs = await app.prisma.mealLog.findMany({
      where: {
        userId: user.id,
        occurredAt: {
          gte: dayWindow.start,
          lt: dayWindow.end,
        },
      },
      orderBy: {
        occurredAt: "asc",
      },
    });

    const response: MealLogsResponse = withGeneratedAt({
      date: query.date,
      mealLogs: mealLogs.map(serializeMealLog),
    });

    return reply.send(response);
  });

  app.get("/summary", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(healthSummaryQuerySchema, request.query);
    const preferences = await app.prisma.userPreference.findUnique({
      where: {
        userId: user.id,
      },
    });
    const rangeWindow = getDateRangeWindowUtc(query.from, query.to, preferences?.timezone);
    const now = new Date();
    const todayIsoDate = getUserLocalDate(now, preferences?.timezone);
    const currentHour = getUserLocalHour(now, preferences?.timezone);
    const todayDate = parseIsoDate(todayIsoDate);
    const todayWindow = getDayWindowUtc(todayIsoDate, preferences?.timezone);

    const [
      rangeWaterLogs,
      rangeMealLogs,
      workoutDays,
      rangeWeightHistory,
      currentWorkout,
      currentDayWaterLogs,
      currentDayMealLogs,
      latestWeight,
      todayPlannedMeals,
    ] = await Promise.all([
      app.prisma.waterLog.findMany({
        where: {
          userId: user.id,
          occurredAt: {
            gte: rangeWindow.start,
            lt: rangeWindow.end,
          },
        },
        orderBy: {
          occurredAt: "asc",
        },
      }),
      app.prisma.mealLog.findMany({
        where: {
          userId: user.id,
          occurredAt: {
            gte: rangeWindow.start,
            lt: rangeWindow.end,
          },
        },
        orderBy: {
          occurredAt: "desc",
        },
      }),
      app.prisma.workoutDay.findMany({
        where: {
          userId: user.id,
          date: {
            gte: parseIsoDate(query.from),
            lte: parseIsoDate(query.to),
          },
        },
        orderBy: {
          date: "desc",
        },
      }),
      app.prisma.weightLog.findMany({
        where: {
          userId: user.id,
          measuredOn: {
            gte: parseIsoDate(query.from),
            lte: parseIsoDate(query.to),
          },
        },
        orderBy: [{ measuredOn: "desc" }, { createdAt: "desc" }],
      }),
      app.prisma.workoutDay.findUnique({
        where: {
          userId_date: {
            userId: user.id,
            date: todayDate,
          },
        },
      }),
      app.prisma.waterLog.findMany({
        where: {
          userId: user.id,
          occurredAt: {
            gte: todayWindow.start,
            lt: todayWindow.end,
          },
        },
        orderBy: {
          occurredAt: "asc",
        },
      }),
      app.prisma.mealLog.findMany({
        where: {
          userId: user.id,
          occurredAt: {
            gte: todayWindow.start,
            lt: todayWindow.end,
          },
        },
        orderBy: {
          occurredAt: "asc",
        },
      }),
      app.prisma.weightLog.findFirst({
        where: {
          userId: user.id,
        },
        orderBy: [{ measuredOn: "desc" }, { createdAt: "desc" }],
      }),
      getTodayPlannedMeals(app, user.id, todayIsoDate, preferences?.weekStartsOn ?? 1),
    ]);

    const currentDayWaterMl = currentDayWaterLogs.reduce(
      (total, waterLog) => total + waterLog.amountMl,
      0,
    );
    const serializedRangeWaterLogs = rangeWaterLogs.map(serializeWaterLog);
    const serializedRangeMealLogs = rangeMealLogs.map(serializeMealLog);
    const serializedWorkoutDays = workoutDays.map(serializeWorkoutDay);
    const serializedRangeWeightHistory = rangeWeightHistory.map(serializeWeightLog);
    const enhancements = buildHealthSummaryEnhancements({
      currentIsoDate: todayIsoDate,
      currentHour,
      timezone: preferences?.timezone,
      waterTargetMl: preferences?.dailyWaterTargetMl ?? 2500,
      currentDayWaterMl,
      currentDayWaterLogs: currentDayWaterLogs.map(serializeWaterLog),
      currentDayMealLogs: currentDayMealLogs.map(serializeMealLog),
      currentWorkout: currentWorkout ? serializeWorkoutDay(currentWorkout) : null,
      latestWeight: latestWeight ? serializeWeightLog(latestWeight) : null,
      rangeWaterLogs: serializedRangeWaterLogs,
      rangeMealLogs: serializedRangeMealLogs,
      rangeWorkoutDays: serializedWorkoutDays,
      rangeWeightHistory: serializedRangeWeightHistory,
    });

    const response: HealthSummaryResponse = withGeneratedAt({
      from: query.from,
      to: query.to,
      currentDay: {
        date: todayIsoDate,
        phase: enhancements.currentDay.phase,
        waterMl: currentDayWaterMl,
        waterTargetMl: preferences?.dailyWaterTargetMl ?? 2500,
        mealCount: currentDayMealLogs.length,
        meaningfulMealCount: currentDayMealLogs.filter(
          (mealLog) => mealLog.loggingQuality === "MEANINGFUL" || mealLog.loggingQuality === "FULL",
        ).length,
        workoutDay: currentWorkout ? serializeWorkoutDay(currentWorkout) : null,
        latestWeight: latestWeight ? serializeWeightLog(latestWeight) : null,
        signals: enhancements.currentDay.signals,
        plannedMeals: todayPlannedMeals,
        score: enhancements.currentDay.score,
        timeline: enhancements.currentDay.timeline,
      },
      range: {
        totalWaterMl: rangeWaterLogs.reduce((total, waterLog) => total + waterLog.amountMl, 0),
        totalMealsLogged: rangeMealLogs.length,
        workoutsCompleted: workoutDays.filter(
          (workoutDay) =>
            workoutDay.actualStatus === "COMPLETED" ||
            workoutDay.actualStatus === "RECOVERY_RESPECTED",
        ).length,
        workoutsPlanned: workoutDays.filter((workoutDay) => workoutDay.planType !== "NONE").length,
        insights: enhancements.range.insights,
      },
      guidance: enhancements.guidance,
      mealLogs: serializedRangeMealLogs,
      weightHistory: serializedRangeWeightHistory,
    });

    return reply.send(response);
  });

  app.post("/water-logs", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createWaterLogSchema, request.body as CreateWaterLogRequest);
    const waterLog = await app.prisma.waterLog.create({
      data: {
        userId: user.id,
        occurredAt: payload.occurredAt ? new Date(payload.occurredAt) : new Date(),
        amountMl: payload.amountMl,
        source: toPrismaWaterLogSource(payload.source ?? "tap"),
      },
    });
    const response: WaterLogMutationResponse = withGeneratedAt({
      waterLog: serializeWaterLog(waterLog),
    });

    return reply.status(201).send(response);
  });

  app.patch("/water-logs/:waterLogId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { waterLogId } = request.params as { waterLogId: string };
    const payload = parseOrThrow(updateWaterLogSchema, request.body as UpdateWaterLogRequest);

    await findOwnedWaterLog(app, user.id, waterLogId);

    const waterLog = await app.prisma.waterLog.update({
      where: {
        id: waterLogId,
      },
      data: {
        occurredAt: payload.occurredAt ? new Date(payload.occurredAt) : undefined,
        amountMl: payload.amountMl,
        source: payload.source ? toPrismaWaterLogSource(payload.source) : undefined,
      },
    });
    const response: WaterLogMutationResponse = withGeneratedAt({
      waterLog: serializeWaterLog(waterLog),
    });

    return reply.send(response);
  });

  app.delete("/water-logs/:waterLogId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { waterLogId } = request.params as { waterLogId: string };

    await findOwnedWaterLog(app, user.id, waterLogId);
    await app.prisma.waterLog.delete({
      where: {
        id: waterLogId,
      },
    });

    const response: DeleteWaterLogResponse = withGeneratedAt({
      deleted: true,
      waterLogId,
    });

    return reply.send(response);
  });

  app.post("/meal-logs", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createMealLogSchema, request.body as CreateMealLogRequest);
    const [mealPlanEntry] = await Promise.all([
      findOwnedMealPlanEntry(app, user.id, payload.mealPlanEntryId),
      assertOwnedMealTemplate(app, user.id, payload.mealTemplateId),
    ]);

    if (mealPlanEntry && payload.mealTemplateId && payload.mealTemplateId !== mealPlanEntry.mealTemplateId) {
      throw new AppError({
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Planned meal template does not match the selected template",
      });
    }

    const mealLog = await app.prisma.mealLog.create({
      data: {
        userId: user.id,
        occurredAt: payload.occurredAt ? new Date(payload.occurredAt) : new Date(),
        mealSlot: toPrismaMealSlot(payload.mealSlot ?? fromPrismaMealSlot(mealPlanEntry?.mealSlot ?? null) ?? undefined),
        mealTemplateId: payload.mealTemplateId ?? mealPlanEntry?.mealTemplateId ?? null,
        mealPlanEntryId: payload.mealPlanEntryId ?? null,
        description: payload.description.trim(),
        loggingQuality: toPrismaMealLoggingQuality(payload.loggingQuality),
      },
    });
    const response: MealLogMutationResponse = withGeneratedAt({
      mealLog: serializeMealLog(mealLog),
    });

    return reply.status(201).send(response);
  });

  app.patch("/meal-logs/:mealLogId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { mealLogId } = request.params as { mealLogId: string };
    const payload = parseOrThrow(updateMealLogSchema, request.body as UpdateMealLogRequest);

    const [existingMealLog, , mealPlanEntry] = await Promise.all([
      findOwnedMealLog(app, user.id, mealLogId),
      assertOwnedMealTemplate(app, user.id, payload.mealTemplateId),
      findOwnedMealPlanEntry(app, user.id, payload.mealPlanEntryId),
    ]);

    const effectiveMealTemplateId = payload.mealTemplateId !== undefined
      ? payload.mealTemplateId
      : mealPlanEntry
        ? mealPlanEntry.mealTemplateId
        : undefined;

    if (mealPlanEntry && effectiveMealTemplateId && effectiveMealTemplateId !== mealPlanEntry.mealTemplateId) {
      throw new AppError({
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Planned meal template does not match the selected template",
      });
    }

    const mealLog = await app.prisma.mealLog.update({
      where: {
        id: mealLogId,
      },
      data: {
        occurredAt: payload.occurredAt ? new Date(payload.occurredAt) : undefined,
        mealSlot: payload.mealSlot === undefined
          ? mealPlanEntry
            ? mealPlanEntry.mealSlot
            : undefined
          : toPrismaMealSlot(payload.mealSlot),
        mealTemplateId: effectiveMealTemplateId,
        mealPlanEntryId: payload.mealPlanEntryId === undefined
          ? undefined
          : payload.mealPlanEntryId,
        description: payload.description?.trim() ?? existingMealLog.description,
        loggingQuality: payload.loggingQuality
          ? toPrismaMealLoggingQuality(payload.loggingQuality)
          : undefined,
      },
    });
    const response: MealLogMutationResponse = withGeneratedAt({
      mealLog: serializeMealLog(mealLog),
    });

    return reply.send(response);
  });

  app.delete("/meal-logs/:mealLogId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { mealLogId } = request.params as { mealLogId: string };

    await findOwnedMealLog(app, user.id, mealLogId);
    await app.prisma.mealLog.delete({
      where: {
        id: mealLogId,
      },
    });

    const response: DeleteMealLogResponse = withGeneratedAt({
      deleted: true,
      mealLogId,
    });

    return reply.send(response);
  });

  app.put("/workout-days/:date", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(updateWorkoutDaySchema, request.body as UpdateWorkoutDayRequest);
    const { date } = request.params as { date: IsoDateString };
    const targetDate = parseIsoDate(parseOrThrow(isoDateSchema, date));
    const workoutDay = await app.prisma.workoutDay.upsert({
      where: {
        userId_date: {
          userId: user.id,
          date: targetDate,
        },
      },
      update: {
        planType: payload.planType ? toPrismaWorkoutPlanType(payload.planType) : undefined,
        plannedLabel: payload.plannedLabel,
        actualStatus: payload.actualStatus
          ? toPrismaWorkoutActualStatus(payload.actualStatus)
          : undefined,
        note: payload.note,
      },
      create: {
        userId: user.id,
        date: targetDate,
        planType: payload.planType ? toPrismaWorkoutPlanType(payload.planType) : "NONE",
        plannedLabel: payload.plannedLabel ?? null,
        actualStatus: payload.actualStatus
          ? toPrismaWorkoutActualStatus(payload.actualStatus)
          : "NONE",
        note: payload.note ?? null,
      },
    });
    const response: WorkoutDayMutationResponse = withGeneratedAt({
      workoutDay: serializeWorkoutDay(workoutDay),
    });

    return reply.send(response);
  });

  app.post("/weight-logs", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createWeightLogSchema, request.body as CreateWeightLogRequest);
    const weightLog = await app.prisma.weightLog.create({
      data: {
        userId: user.id,
        measuredOn: payload.measuredOn
          ? parseIsoDate(payload.measuredOn)
          : parseIsoDate(await getTodayIsoDate(app, user.id)),
        weightValue: payload.weightValue,
        unit: payload.unit ?? "kg",
        note: payload.note ?? null,
      },
    });
    const response: WeightLogMutationResponse = withGeneratedAt({
      weightLog: serializeWeightLog(weightLog),
    });

    return reply.status(201).send(response);
  });

  app.patch("/weight-logs/:weightLogId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { weightLogId } = request.params as { weightLogId: string };
    const payload = parseOrThrow(updateWeightLogSchema, request.body as UpdateWeightLogRequest);

    await findOwnedWeightLog(app, user.id, weightLogId);

    const weightLog = await app.prisma.weightLog.update({
      where: {
        id: weightLogId,
      },
      data: {
        measuredOn: payload.measuredOn ? parseIsoDate(payload.measuredOn) : undefined,
        weightValue: payload.weightValue,
        unit: payload.unit,
        note: payload.note,
      },
    });
    const response: WeightLogMutationResponse = withGeneratedAt({
      weightLog: serializeWeightLog(weightLog),
    });

    return reply.send(response);
  });

  app.delete("/weight-logs/:weightLogId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { weightLogId } = request.params as { weightLogId: string };

    await findOwnedWeightLog(app, user.id, weightLogId);
    await app.prisma.weightLog.delete({
      where: {
        id: weightLogId,
      },
    });

    const response: DeleteWeightLogResponse = withGeneratedAt({
      deleted: true,
      weightLogId,
    });

    return reply.send(response);
  });
};
