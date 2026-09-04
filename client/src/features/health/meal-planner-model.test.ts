import { describe, expect, it } from "vitest";

import {
  buildIngredientText,
  buildMealPlanSavePayload,
  getWeekDates,
  shiftWeek,
  type DraftEntry,
  type DraftGroceryItem,
  type DraftPrepSession,
} from "./meal-planner-model";
import type { MealPlanGroceryItem } from "../../shared/lib/api";

describe("meal planner model", () => {
  it("builds the seven dates for a selected week", () => {
    expect(getWeekDates("2026-05-18")).toEqual([
      "2026-05-18",
      "2026-05-19",
      "2026-05-20",
      "2026-05-21",
      "2026-05-22",
      "2026-05-23",
      "2026-05-24",
    ]);
  });

  it("shifts by whole weeks and normalizes to the week start", () => {
    expect(shiftWeek("2026-05-18", 1)).toBe("2026-05-25");
    expect(shiftWeek("2026-05-18", -1)).toBe("2026-05-11");
  });

  it("formats recipe ingredients for editing", () => {
    expect(buildIngredientText([
      { name: "Rice", quantity: 1, unit: "cup", section: null, note: null },
      { name: "Salt", quantity: null, unit: null, section: null, note: null },
    ])).toBe("1 cup Rice\nSalt");
  });

  it("builds a save payload from draft meal-plan state", () => {
    const entries: DraftEntry[] = [
      {
        id: "entry-1",
        date: "2026-05-18",
        mealSlot: "breakfast",
        mealTemplateId: "template-1",
        mealTemplateName: "Oats",
        servings: 1,
        note: "Add fruit",
        sortOrder: 99,
        isLogged: false,
      },
    ];
    const prepSessions: DraftPrepSession[] = [
      {
        id: "prep-1",
        scheduledForDate: "2026-05-19",
        title: "Chop vegetables",
        notes: null,
        taskId: "task-1",
        taskStatus: "pending",
        sortOrder: 10,
      },
    ];
    const manualGroceries: DraftGroceryItem[] = [
      {
        id: "manual-temp",
        name: "Bananas",
        quantity: 6,
        unit: null,
        section: "Produce",
        note: null,
        isChecked: false,
        sortOrder: 5,
      },
    ];
    const groceryItems: MealPlanGroceryItem[] = [
      {
        id: "planned-1",
        name: "Oats",
        quantity: 1,
        unit: "kg",
        section: "Pantry",
        note: null,
        sourceType: "planned",
        isChecked: true,
        sortOrder: 0,
        createdAt: "2026-05-18T00:00:00.000Z",
        updatedAt: "2026-05-18T00:00:00.000Z",
      },
      {
        id: "manual-temp",
        name: "Bananas",
        quantity: 6,
        unit: null,
        section: "Produce",
        note: null,
        sourceType: "manual",
        isChecked: false,
        sortOrder: 1,
        createdAt: "2026-05-18T00:00:00.000Z",
        updatedAt: "2026-05-18T00:00:00.000Z",
      },
    ];

    expect(buildMealPlanSavePayload({
      notes: "",
      entries,
      prepSessions,
      manualGroceries,
      groceryItems,
    })).toEqual({
      notes: null,
      entries: [
        {
          id: "entry-1",
          date: "2026-05-18",
          mealSlot: "breakfast",
          mealTemplateId: "template-1",
          servings: 1,
          note: "Add fruit",
          sortOrder: 0,
        },
      ],
      prepSessions: [
        {
          id: "prep-1",
          scheduledForDate: "2026-05-19",
          title: "Chop vegetables",
          notes: null,
          sortOrder: 0,
        },
      ],
      manualGroceryItems: [
        {
          id: undefined,
          name: "Bananas",
          quantity: 6,
          unit: null,
          section: "Produce",
          note: null,
          isChecked: false,
          sortOrder: 0,
        },
      ],
      plannedGroceryItems: [
        {
          name: "Oats",
          unit: "kg",
          isChecked: true,
        },
      ],
    });
  });
});
