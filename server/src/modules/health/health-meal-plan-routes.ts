import type { FastifyPluginAsync } from "fastify";
import type {
  IsoDateString,
  SaveMealPlanWeekRequest,
} from "@life-os/contracts";
import { z } from "zod";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { isoDateStringSchema } from "../../lib/validation/date-range.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import {
  buildMealPlanWeekResponse,
  saveMealPlanWeek,
} from "./health-meal-plan-service.js";

const isoDateSchema = isoDateStringSchema;
const mealSlotSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);

const entityIdSchema = z.string().uuid();
const decimalSchema = z.number().positive().max(100000).nullable().optional();
const sortOrderSchema = z.number().int().min(0).optional();
const shortTextSchema = z.string().trim().min(1).max(200);
const optionalNoteSchema = z.string().trim().max(4000).nullable().optional();
const optionalSectionSchema = z.string().trim().max(80).nullable().optional();
const optionalUnitSchema = z.string().trim().max(64).nullable().optional();

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

export const registerHealthMealPlanRoutes: FastifyPluginAsync = async (app) => {
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
};
