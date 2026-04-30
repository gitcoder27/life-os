import type { MealTemplateIngredient } from "@life-os/contracts";
import type { Prisma } from "@prisma/client";

export type MealTemplatePayload = {
  description: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredients: MealTemplateIngredient[];
  instructions: string[];
  tags: string[];
  notes: string | null;
};

export type MealTemplatePayloadInput = {
  description?: string | null;
  servings?: number | null;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  ingredients?: Array<{
    name: string;
    quantity?: number | null;
    unit?: string | null;
    section?: string | null;
    note?: string | null;
  }>;
  instructions?: string[];
  tags?: string[];
  notes?: string | null;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function trimToNull(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeIngredientInput(input: MealTemplateIngredient): MealTemplateIngredient {
  return {
    name: input.name.trim(),
    quantity: input.quantity ?? null,
    unit: trimToNull(input.unit),
    section: trimToNull(input.section),
    note: trimToNull(input.note),
  };
}

function readStringArray(value: unknown, maxLength: number) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, maxLength);
}

function readNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readIngredientArray(value: unknown): MealTemplateIngredient[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isPlainObject)
    .map((item) => {
      const name = trimToNull(typeof item.name === "string" ? item.name : null);
      if (!name) {
        return null;
      }

      return normalizeIngredientInput({
        name,
        quantity: readNullableNumber(item.quantity),
        unit: typeof item.unit === "string" ? item.unit : null,
        section: typeof item.section === "string" ? item.section : null,
        note: typeof item.note === "string" ? item.note : null,
      });
    })
    .filter((item): item is MealTemplateIngredient => item !== null);
}

export function parseMealTemplatePayload(templatePayloadJson: unknown): MealTemplatePayload {
  const payload = isPlainObject(templatePayloadJson) ? templatePayloadJson : {};

  return {
    description: trimToNull(typeof payload.description === "string" ? payload.description : null),
    servings: readNullableNumber(payload.servings),
    prepMinutes: readNullableNumber(payload.prepMinutes),
    cookMinutes: readNullableNumber(payload.cookMinutes),
    ingredients: readIngredientArray(payload.ingredients),
    instructions: readStringArray(payload.instructions, 200),
    tags: readStringArray(payload.tags, 40),
    notes: trimToNull(typeof payload.notes === "string" ? payload.notes : null),
  };
}

export function normalizeMealTemplatePayloadInput(
  input: MealTemplatePayloadInput,
  existing?: MealTemplatePayload,
): Prisma.InputJsonObject {
  const normalizedIngredients = input.ingredients === undefined
    ? (existing?.ingredients ?? []).map((ingredient) => ({
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        section: ingredient.section,
        note: ingredient.note,
      }))
    : input.ingredients.map((ingredient) => normalizeIngredientInput({
        name: ingredient.name,
        quantity: ingredient.quantity ?? null,
        unit: ingredient.unit ?? null,
        section: ingredient.section ?? null,
        note: ingredient.note ?? null,
      }));

  return {
    description: input.description === undefined
      ? existing?.description ?? null
      : trimToNull(input.description),
    servings: input.servings === undefined ? existing?.servings ?? null : input.servings ?? null,
    prepMinutes: input.prepMinutes === undefined ? existing?.prepMinutes ?? null : input.prepMinutes ?? null,
    cookMinutes: input.cookMinutes === undefined ? existing?.cookMinutes ?? null : input.cookMinutes ?? null,
    ingredients: normalizedIngredients as unknown as Prisma.InputJsonValue,
    instructions: input.instructions === undefined
      ? existing?.instructions ?? []
      : input.instructions.map((item) => item.trim()).filter((item) => item.length > 0),
    tags: input.tags === undefined
      ? existing?.tags ?? []
      : input.tags.map((item) => item.trim()).filter((item) => item.length > 0),
    notes: input.notes === undefined ? existing?.notes ?? null : trimToNull(input.notes),
  };
}
