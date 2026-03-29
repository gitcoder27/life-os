import type { FastifyPluginAsync } from "fastify";
import type {
  ApplyTaskTemplateResponse,
  CreateTaskTemplateRequest,
  TaskTemplateMutationResponse,
  TaskTemplatesResponse,
  UpdateTaskTemplateRequest,
} from "@life-os/contracts";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import {
  compareTaskTemplates,
  normalizeTaskTemplateDescription,
  parseTaskTemplateTasks,
  serializeTask,
  serializeTaskTemplate,
} from "./planning-mappers.js";
import { findOwnedTaskTemplate } from "./planning-repository.js";
import {
  createTaskTemplateSchema,
  updateTaskTemplateSchema,
} from "./planning-schemas.js";

export const registerPlanningTaskTemplateRoutes: FastifyPluginAsync = async (app) => {
  app.get("/task-templates", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const taskTemplates = await app.prisma.taskTemplate.findMany({
      where: {
        userId: user.id,
        archivedAt: null,
      },
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    });

    const response: TaskTemplatesResponse = withGeneratedAt({
      taskTemplates: [...taskTemplates].sort(compareTaskTemplates).map(serializeTaskTemplate),
    });

    return reply.send(response);
  });

  app.post("/task-templates", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createTaskTemplateSchema, request.body as CreateTaskTemplateRequest);
    const taskTemplate = await app.prisma.taskTemplate.create({
      data: {
        userId: user.id,
        name: payload.name,
        description: normalizeTaskTemplateDescription(payload.description),
        templatePayloadJson: payload.tasks.map((task) => ({ title: task.title })),
      },
    });

    const response: TaskTemplateMutationResponse = withGeneratedAt({
      taskTemplate: serializeTaskTemplate(taskTemplate),
    });

    return reply.status(201).send(response);
  });

  app.patch("/task-templates/:taskTemplateId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(updateTaskTemplateSchema, request.body as UpdateTaskTemplateRequest);
    const { taskTemplateId } = request.params as { taskTemplateId: string };
    await findOwnedTaskTemplate(app, user.id, taskTemplateId);

    const taskTemplate = await app.prisma.taskTemplate.update({
      where: {
        id: taskTemplateId,
      },
      data: {
        name: payload.name,
        description:
          payload.description === undefined
            ? undefined
            : normalizeTaskTemplateDescription(payload.description),
        templatePayloadJson:
          payload.tasks === undefined
            ? undefined
            : payload.tasks.map((task) => ({ title: task.title })),
        archivedAt: payload.archived === undefined ? undefined : payload.archived ? new Date() : null,
      },
    });

    const response: TaskTemplateMutationResponse = withGeneratedAt({
      taskTemplate: serializeTaskTemplate(taskTemplate),
    });

    return reply.send(response);
  });

  app.post("/task-templates/:taskTemplateId/apply", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const { taskTemplateId } = request.params as { taskTemplateId: string };
    const taskTemplate = await findOwnedTaskTemplate(app, user.id, taskTemplateId, {
      activeOnly: true,
    });
    const templateTasks = parseTaskTemplateTasks(taskTemplate.templatePayloadJson);
    const appliedAt = new Date();

    const result = await app.prisma.$transaction(async (tx) => {
      const tasks = await Promise.all(
        templateTasks.map((templateTask) =>
          tx.task.create({
            data: {
              userId: user.id,
              title: templateTask.title,
              originType: "TEMPLATE",
            },
          }),
        ),
      );
      const updatedTaskTemplate = await tx.taskTemplate.update({
        where: {
          id: taskTemplate.id,
        },
        data: {
          lastAppliedAt: appliedAt,
        },
      });

      return {
        tasks,
        taskTemplate: updatedTaskTemplate,
      };
    });

    const response: ApplyTaskTemplateResponse = withGeneratedAt({
      taskTemplate: serializeTaskTemplate(result.taskTemplate),
      tasks: result.tasks.map(serializeTask),
    });

    return reply.status(201).send(response);
  });
};
