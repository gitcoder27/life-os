import type { IsoDateString } from "@life-os/contracts";

import {
  formatShortDate,
  getWeekStartDate,
  toIsoDate,
  type MealPlanGroceryItem,
  type MealTemplateIngredient,
  type SaveMealPlanWeekPayload,
} from "../../shared/lib/api";

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

export const SLOT_ICONS: Record<MealSlot, string> = {
  breakfast: "\u2600",
  lunch: "\u25D1",
  dinner: "\u263D",
  snack: "\u2726",
};

export const CATEGORIES: { key: MealSlot; label: string }[] = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snacks" },
];

export const MEAL_PLAN_AUTOSAVE_DELAY_MS = 800;

export type DraftEntry = {
  id?: string;
  date: string;
  mealSlot: MealSlot;
  mealTemplateId: string;
  mealTemplateName: string;
  servings: number | null;
  note: string | null;
  sortOrder: number;
  isLogged: boolean;
};

export type DraftPrepSession = {
  id?: string;
  scheduledForDate: string;
  title: string;
  notes: string | null;
  taskId?: string | null;
  taskStatus?: "pending" | "completed" | "dropped" | null;
  sortOrder: number;
};

export type DraftGroceryItem = {
  id?: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  section: string | null;
  note: string | null;
  isChecked: boolean;
  sortOrder: number;
};

export function getWeekDates(startDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(`${startDate}T12:00:00`);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(toIsoDate(d));
  }
  return dates;
}

export function formatDayLabel(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
  });
}

export function formatDayNumber(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
  });
}

export function formatWeekRange(startDate: string, endDate: string): string {
  return `${formatShortDate(startDate)}\u2009\u2014\u2009${formatShortDate(endDate)}`;
}

export function shiftWeek(startDate: string, direction: number): string {
  const d = new Date(`${startDate}T12:00:00`);
  d.setDate(d.getDate() + 7 * direction);
  return getWeekStartDate(toIsoDate(d));
}

export function buildIngredientText(ingredients: MealTemplateIngredient[]) {
  return ingredients
    .map((ingredient) => {
      const amount = ingredient.quantity ? `${ingredient.quantity}` : "";
      const unit = ingredient.unit ? ` ${ingredient.unit}` : "";
      return `${amount}${unit}${amount || unit ? " " : ""}${ingredient.name}`.trim();
    })
    .join("\n");
}

export function buildMealPlanSavePayload({
  notes,
  entries,
  prepSessions,
  manualGroceries,
  groceryItems,
}: {
  notes: string;
  entries: DraftEntry[];
  prepSessions: DraftPrepSession[];
  manualGroceries: DraftGroceryItem[];
  groceryItems: MealPlanGroceryItem[];
}): SaveMealPlanWeekPayload {
  return {
    notes: notes || null,
    entries: entries.map((entry, index) => ({
      id: entry.id,
      date: entry.date as IsoDateString,
      mealSlot: entry.mealSlot,
      mealTemplateId: entry.mealTemplateId,
      servings: entry.servings,
      note: entry.note,
      sortOrder: index,
    })),
    prepSessions: prepSessions.map((session, index) => ({
      id: session.id,
      scheduledForDate: session.scheduledForDate as IsoDateString,
      title: session.title,
      notes: session.notes,
      sortOrder: index,
    })),
    manualGroceryItems: manualGroceries.map((item, index) => ({
      id: item.id?.startsWith("manual-") ? undefined : item.id,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      section: item.section,
      note: item.note,
      isChecked: item.isChecked,
      sortOrder: index,
    })),
    plannedGroceryItems: groceryItems
      .filter((item) => item.sourceType === "planned")
      .map((item) => ({
        name: item.name,
        unit: item.unit,
        isChecked: item.isChecked,
      })),
  };
}
