import type { FastifyPluginAsync } from "fastify";
import type {
  AdminItemMutationResponse,
  AdminItemRecord,
  AdminItemsResponse,
  AdminItemStatus,
  AdminItemType,
  IsoDateString,
  UpdateAdminItemRequest,
} from "@life-os/contracts";
import type {
  AdminItem,
  AdminItemStatus as PrismaAdminItemStatus,
  AdminItemType as PrismaAdminItemType,
} from "@prisma/client";
import { z } from "zod";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { AppError } from "../../lib/errors/app-error.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { parseIsoDate } from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import { parseOrThrow } from "../../lib/validation/parse.js";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/) as unknown as z.ZodType<IsoDateString>;
const adminItemStatusSchema = z.enum(["pending", "done", "rescheduled", "dropped"]);

const adminItemsQuerySchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  status: adminItemStatusSchema.optional(),
});

const updateAdminItemSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    dueOn: isoDateSchema.optional(),
    status: adminItemStatusSchema.optional(),
    relatedTaskId: z.string().uuid().nullable().optional(),
    amountMinor: z.number().int().positive().nullable().optional(),
    note: z.string().max(4000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated");

function fromPrismaAdminItemStatus(status: PrismaAdminItemStatus): AdminItemStatus {
  switch (status) {
    case "PENDING":
      return "pending";
    case "DONE":
      return "done";
    case "RESCHEDULED":
      return "rescheduled";
    case "DROPPED":
      return "dropped";
  }
}

function toPrismaAdminItemStatus(status: AdminItemStatus): PrismaAdminItemStatus {
  switch (status) {
    case "pending":
      return "PENDING";
    case "done":
      return "DONE";
    case "rescheduled":
      return "RESCHEDULED";
    case "dropped":
      return "DROPPED";
  }
}

function fromPrismaAdminItemType(itemType: PrismaAdminItemType): AdminItemType {
  switch (itemType) {
    case "BILL":
      return "bill";
    case "ADMIN":
      return "admin";
  }
}

function serializeAdminItem(adminItem: AdminItem): AdminItemRecord {
  return {
    id: adminItem.id,
    title: adminItem.title,
    itemType: fromPrismaAdminItemType(adminItem.itemType),
    dueOn: toIsoDateString(adminItem.dueOn),
    status: fromPrismaAdminItemStatus(adminItem.status),
    relatedTaskId: adminItem.relatedTaskId,
    recurringExpenseTemplateId: adminItem.recurringExpenseTemplateId,
    amountMinor: adminItem.amountMinor,
    note: adminItem.note,
    completedAt: adminItem.completedAt?.toISOString() ?? null,
    createdAt: adminItem.createdAt.toISOString(),
    updatedAt: adminItem.updatedAt.toISOString(),
  };
}

async function findOwnedAdminItem(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  adminItemId: string,
) {
  const adminItem = await app.prisma.adminItem.findFirst({
    where: {
      id: adminItemId,
      userId,
    },
  });

  if (!adminItem) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Admin item not found",
    });
  }

  return adminItem;
}

async function assertOwnedTask(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  taskId: string | null | undefined,
) {
  if (!taskId) {
    return;
  }

  const task = await app.prisma.task.findFirst({
    where: {
      id: taskId,
      userId,
    },
  });

  if (!task) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Related task not found",
    });
  }
}

export const registerAdminRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin-items", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(adminItemsQuerySchema, request.query);
    const fromDate = query.from ? parseIsoDate(query.from) : null;
    const toDateExclusive = query.to
      ? new Date(parseIsoDate(query.to).getTime() + 24 * 60 * 60 * 1000)
      : null;
    const adminItems = await app.prisma.adminItem.findMany({
      where: {
        userId: user.id,
        status: query.status ? toPrismaAdminItemStatus(query.status) : undefined,
        dueOn:
          fromDate && toDateExclusive
            ? {
                gte: fromDate,
                lt: toDateExclusive,
              }
            : undefined,
      },
      orderBy: [{ dueOn: "asc" }, { createdAt: "asc" }],
    });

    const response: AdminItemsResponse = withGeneratedAt({
      adminItems: adminItems.map(serializeAdminItem),
    });

    return reply.send(response);
  });

  app.patch("/admin-items/:id", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { id } = request.params as { id: string };
    const payload = parseOrThrow(updateAdminItemSchema, request.body as UpdateAdminItemRequest);

    await findOwnedAdminItem(app, user.id, id);
    await assertOwnedTask(app, user.id, payload.relatedTaskId);

    const adminItem = await app.prisma.adminItem.update({
      where: {
        id,
      },
      data: {
        title: payload.title,
        dueOn: payload.dueOn ? parseIsoDate(payload.dueOn) : undefined,
        status: payload.status ? toPrismaAdminItemStatus(payload.status) : undefined,
        relatedTaskId: payload.relatedTaskId,
        amountMinor: payload.amountMinor,
        note: payload.note,
        completedAt:
          payload.status === "done"
            ? new Date()
            : payload.status === "pending" || payload.status === "rescheduled" || payload.status === "dropped"
              ? null
              : undefined,
      },
    });

    const response: AdminItemMutationResponse = withGeneratedAt({
      adminItem: serializeAdminItem(adminItem),
    });

    return reply.send(response);
  });
};
