import type { FastifyPluginAsync } from "fastify";
import type {
  CreateMealTemplateRequest,
  MealTemplateMutationResponse,
  MealTemplatesResponse,
  UpdateMealTemplateRequest,
} from "@life-os/contracts";
import { z } from "zod";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { AppError } from "../../lib/errors/app-error.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import { serializeMealTemplate, toPrismaMealSlot } from "./health-mappers.js";
import {
  normalizeMealTemplatePayloadInput,
  parseMealTemplatePayload,
} from "./meal-template-payload.js";

const mealSlotSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);
const decimalSchema = z.number().positive().max(100000).nullable().optional();
const shortTextSchema = z.string().trim().min(1).max(200);
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

export const registerHealthMealTemplateRoutes: FastifyPluginAsync = async (app) => {
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
};
