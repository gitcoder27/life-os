import type { FastifyPluginAsync } from "fastify";
import type {
  BulkTaskMutationResponse,
  BulkUpdateTasksRequest,
  CarryForwardTaskRequest,
  CreateTaskRequest,
  PlanningTaskItem,
  TaskMutationResponse,
  TasksResponse,
  UpdateTaskRequest,
} from "@life-os/contracts";
import type { Prisma, Task } from "@prisma/client";

import { requireAuthenticatedUser } from "../../lib/auth/require-auth.js";
import { AppError } from "../../lib/errors/app-error.js";
import { withGeneratedAt } from "../../lib/http/response.js";
import { applyRecurringTaskCarryForward, materializeNextRecurringTaskOccurrence, materializeRecurringTasksInRange } from "../../lib/recurrence/tasks.js";
import { addDays, parseIsoDate } from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import { countStaleInboxTasks, recordInboxZeroIfEarned } from "./inbox-zero.js";
import {
  getUserTimezone,
  resolveReminderAtForUpdate,
  toTaskReminderAt,
} from "./planning-context.js";
import {
  serializeTask,
  toPrismaTaskKind,
  toPrismaTaskOriginType,
  toPrismaTaskStatus,
} from "./planning-mappers.js";
import { planningTaskInclude } from "./planning-record-shapes.js";
import {
  assertOwnedGoalReference,
  removePlannerAssignmentForTask,
  syncTaskRecurrence,
} from "./planning-repository.js";
import {
  bulkUpdateTasksSchema,
  carryForwardTaskSchema,
  createTaskSchema,
  taskListQuerySchema,
  updateTaskSchema,
} from "./planning-schemas.js";
import {
  buildTaskListCursorWhere,
  encodeTaskListCursor,
  TASK_LIST_DEFAULT_LIMIT,
} from "./task-list-pagination.js";

type PlanningTaskRecord = Prisma.TaskGetPayload<{
  include: typeof planningTaskInclude;
}>;

function buildBulkTaskUpdateData(
  task: Pick<Task, "kind">,
  action: BulkUpdateTasksRequest["action"],
  now: Date,
  timezone?: string | null,
) {
  if (action.type === "schedule") {
    return {
      scheduledForDate: parseIsoDate(action.scheduledForDate),
      dueAt: null,
      reminderAt: task.kind === "REMINDER" ? toTaskReminderAt(action.scheduledForDate, timezone) : undefined,
      reminderTriggeredAt: task.kind === "REMINDER" ? null : undefined,
    };
  }

  if (action.type === "status") {
    return {
      status: toPrismaTaskStatus(action.status),
      completedAt:
        action.status === "completed"
          ? now
          : action.status === "pending" || action.status === "dropped"
            ? null
            : undefined,
    };
  }

  if (action.type === "link_goal") {
    return {
      goalId: action.goalId,
    };
  }

  return {
    status: toPrismaTaskStatus("dropped"),
    completedAt: null,
  };
}

function shouldTrackInboxZeroForBulkAction(action: BulkUpdateTasksRequest["action"]) {
  return action.type !== "link_goal";
}

function getBulkInboxZeroMutationSource(action: BulkUpdateTasksRequest["action"]) {
  switch (action.type) {
    case "schedule":
      return "task_bulk_schedule" as const;
    case "status":
      return "task_bulk_status" as const;
    case "carry_forward":
      return "task_bulk_carry_forward" as const;
    case "archive":
      return "task_bulk_archive" as const;
    case "link_goal":
      return null;
  }
}

async function carryForwardTask(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    task: PlanningTaskRecord;
    targetDate: CarryForwardTaskRequest["targetDate"];
    timezone?: string | null;
    hasPlannerAssignment: boolean;
  },
) {
  const { hasPlannerAssignment, targetDate, task, timezone, userId } = input;

  if (task.recurrenceRuleId) {
    const recurringTask = await applyRecurringTaskCarryForward(tx, userId, task, targetDate);
    if (recurringTask) {
      if (hasPlannerAssignment && recurringTask.id !== task.id) {
        return tx.task.update({
          where: {
            id: recurringTask.id,
          },
          data: {
            dueAt: null,
          },
          include: planningTaskInclude,
        });
      }

      return recurringTask;
    }
  }

  await tx.task.update({
    where: {
      id: task.id,
    },
    data: {
      status: "DROPPED",
    },
  });

  return tx.task.create({
    data: {
      userId,
      title: task.title,
      notes: task.notes,
      kind: task.kind,
      reminderAt:
        task.kind === "REMINDER"
          ? toTaskReminderAt(targetDate, timezone) ?? null
          : task.reminderAt,
      reminderTriggeredAt: null,
      scheduledForDate: parseIsoDate(targetDate),
      dueAt: hasPlannerAssignment ? null : task.dueAt,
      goalId: task.goalId,
      originType: "CARRY_FORWARD",
      carriedFromTaskId: task.id,
    },
    include: planningTaskInclude,
  });
}

export const registerPlanningTaskRoutes: FastifyPluginAsync = async (app) => {
  app.get("/tasks", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const query = parseOrThrow(taskListQuerySchema, request.query);
    const includeSummary = query.includeSummary === "true";
    const limit = query.limit ?? (query.cursor ? TASK_LIST_DEFAULT_LIMIT : undefined);
    const scheduledForDate = query.scheduledForDate ? parseIsoDate(query.scheduledForDate) : null;
    const fromDate = query.from ? parseIsoDate(query.from) : null;
    const toDateExclusive = query.to ? addDays(parseIsoDate(query.to), 1) : null;
    const scheduledDateFilter =
      scheduledForDate
        ? scheduledForDate
        : fromDate && toDateExclusive
          ? {
              gte: fromDate,
              lt: toDateExclusive,
            }
          : query.scheduledState === "scheduled"
            ? { not: null }
            : query.scheduledState === "unscheduled"
              ? null
              : undefined;
    if (scheduledForDate) {
      await materializeRecurringTasksInRange(app.prisma, user.id, scheduledForDate, scheduledForDate);
    } else if (fromDate && toDateExclusive) {
      await materializeRecurringTasksInRange(app.prisma, user.id, fromDate, addDays(toDateExclusive, -1));
    }

    const summaryWhere = {
      userId: user.id,
      status: query.status ? toPrismaTaskStatus(query.status) : undefined,
      originType: query.originType ? toPrismaTaskOriginType(query.originType) : undefined,
      scheduledForDate: scheduledDateFilter,
    };
    const listWhere = query.cursor
      ? {
          AND: [
            {
              ...summaryWhere,
              kind: query.kind ? toPrismaTaskKind(query.kind) : undefined,
            },
            buildTaskListCursorWhere(query.cursor),
          ],
        }
      : {
          ...summaryWhere,
          kind: query.kind ? toPrismaTaskKind(query.kind) : undefined,
        };

    const [tasks, counts] = await Promise.all([
      app.prisma.task.findMany({
        where: listWhere,
        take: limit ? limit + 1 : undefined,
        orderBy: limit ? [{ createdAt: "desc" }, { id: "desc" }] : [{ scheduledForDate: "asc" }, { createdAt: "asc" }],
        include: planningTaskInclude,
      }),
      includeSummary
        ? Promise.all([
            app.prisma.task.count({ where: summaryWhere }),
            app.prisma.task.count({
              where: {
                ...summaryWhere,
                kind: "TASK",
              },
            }),
            app.prisma.task.count({
              where: {
                ...summaryWhere,
                kind: "NOTE",
              },
            }),
            app.prisma.task.count({
              where: {
                ...summaryWhere,
                kind: "REMINDER",
              },
            }),
          ]).then(([all, task, note, reminder]) => ({
            all,
            task,
            note,
            reminder,
          }))
        : Promise.resolve(undefined),
    ]);

    const page = limit ? tasks.slice(0, limit) : tasks;
    const nextCursor = limit && tasks.length > limit ? encodeTaskListCursor(page[page.length - 1]!) : null;

    const response: TasksResponse = withGeneratedAt({
      tasks: page.map(serializeTask),
      nextCursor,
      counts,
    });

    return reply.send(response);
  });

  app.post("/tasks", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(createTaskSchema, request.body as CreateTaskRequest);
    await assertOwnedGoalReference(app, user.id, payload.goalId);
    const timezone = await getUserTimezone(app, user.id);
    const task = await app.prisma.$transaction(async (tx) => {
      const createdTask = await tx.task.create({
        data: {
          userId: user.id,
          title: payload.title,
          notes: payload.notes ?? null,
          kind: toPrismaTaskKind(payload.kind ?? "task"),
          reminderAt:
            payload.kind === "reminder" ? (toTaskReminderAt(payload.reminderAt, timezone) ?? null) : null,
          scheduledForDate: payload.scheduledForDate ? parseIsoDate(payload.scheduledForDate) : null,
          dueAt: payload.dueAt ? new Date(payload.dueAt) : null,
          goalId: payload.goalId ?? null,
          originType: toPrismaTaskOriginType(payload.recurrence ? "recurring" : (payload.originType ?? "manual")),
        },
      });

      await syncTaskRecurrence(tx, createdTask.id, payload.recurrence, payload.carryPolicy);

      return tx.task.findUniqueOrThrow({
        where: {
          id: createdTask.id,
        },
        include: planningTaskInclude,
      });
    });

    const response: TaskMutationResponse = withGeneratedAt({
      task: serializeTask(task),
    });

    return reply.status(201).send(response);
  });

  app.patch("/tasks/bulk", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(bulkUpdateTasksSchema, request.body as BulkUpdateTasksRequest);
    const timezone = await getUserTimezone(app, user.id);
    const now = new Date();

    if (payload.action.type === "link_goal") {
      await assertOwnedGoalReference(app, user.id, payload.action.goalId);
    }

    const existingTasks = await app.prisma.task.findMany({
      where: {
        id: {
          in: payload.taskIds,
        },
        userId: user.id,
      },
      include: planningTaskInclude,
    });

    if (existingTasks.length !== payload.taskIds.length) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Task not found",
      });
    }

    const taskById = new Map(existingTasks.map((task) => [task.id, task]));
    const shouldTrackInboxZero = shouldTrackInboxZeroForBulkAction(payload.action);
    const plannerAssignmentTaskIds =
      payload.action.type === "carry_forward"
        ? new Set(
            (
              await app.prisma.dayPlannerBlockTask.findMany({
                where: {
                  taskId: {
                    in: payload.taskIds,
                  },
                },
                select: {
                  taskId: true,
                },
              })
            ).map((assignment) => assignment.taskId),
          )
        : new Set<string>();

    const tasks = await app.prisma.$transaction(async (tx) => {
      const staleCountBefore = shouldTrackInboxZero
        ? await countStaleInboxTasks(tx, {
            userId: user.id,
            targetDate: now,
            timezone,
          })
        : 0;
      const affectedTaskIds = new Set<string>();
      const carriedForwardTasks: PlanningTaskRecord[] = [];

      for (const taskId of payload.taskIds) {
        const task = taskById.get(taskId);

        if (!task) {
          throw new AppError({
            statusCode: 404,
            code: "NOT_FOUND",
            message: "Task not found",
          });
        }

        if (payload.action.type === "carry_forward") {
          const nextTask = await carryForwardTask(tx, {
            userId: user.id,
            task,
            targetDate: payload.action.targetDate,
            timezone,
            hasPlannerAssignment: plannerAssignmentTaskIds.has(taskId),
          });

          carriedForwardTasks.push(nextTask);
          affectedTaskIds.add(task.id);
          affectedTaskIds.add(nextTask.id);
          continue;
        }

        await tx.task.update({
          where: {
            id: taskId,
          },
          data: buildBulkTaskUpdateData(task, payload.action, now, timezone),
        });
        affectedTaskIds.add(taskId);

        if (payload.action.type === "status" && payload.action.status === "completed" && task.recurrenceRuleId && task.scheduledForDate) {
          await materializeNextRecurringTaskOccurrence(
            tx,
            user.id,
            task.recurrenceRuleId,
            toIsoDateString(task.scheduledForDate),
          );
        }
      }

      if (payload.action.type === "schedule") {
        for (const taskId of payload.taskIds) {
          await removePlannerAssignmentForTask(tx, taskId);
        }
      }

      const mutationSource = getBulkInboxZeroMutationSource(payload.action);

      if (shouldTrackInboxZero && mutationSource) {
        await recordInboxZeroIfEarned(tx, {
          userId: user.id,
          targetDate: now,
          timezone,
          staleCountBefore,
          mutationSource,
          affectedTaskIds: [...affectedTaskIds],
        });
      }

      if (payload.action.type === "carry_forward") {
        return carriedForwardTasks;
      }

      return tx.task.findMany({
        where: {
          id: {
            in: payload.taskIds,
          },
        },
        include: planningTaskInclude,
      });
    });

    const serializedTasksById = new Map(tasks.map((task) => [task.id, serializeTask(task)]));
    const response: BulkTaskMutationResponse = withGeneratedAt({
      tasks:
        payload.action.type === "carry_forward"
          ? tasks.map(serializeTask)
          : payload.taskIds
              .map((taskId) => serializedTasksById.get(taskId))
              .filter((task): task is PlanningTaskItem => Boolean(task)),
    });

    return reply.send(response);
  });

  app.patch("/tasks/:taskId", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(updateTaskSchema, request.body as UpdateTaskRequest);
    const { taskId } = request.params as { taskId: string };
    const timezone = await getUserTimezone(app, user.id);
    const now = new Date();
    const existingTask = await app.prisma.task.findFirst({
      where: {
        id: taskId,
        userId: user.id,
      },
      include: planningTaskInclude,
    });
    if (!existingTask) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Task not found",
      });
    }
    const existingPlannerAssignment = await app.prisma.dayPlannerBlockTask.findUnique({
      where: {
        taskId,
      },
      select: {
        blockId: true,
      },
    });
    const existingScheduledForDate = existingTask.scheduledForDate ? toIsoDateString(existingTask.scheduledForDate) : null;
    const nextScheduledForDate =
      payload.scheduledForDate === undefined ? existingScheduledForDate : payload.scheduledForDate;
    const shouldRemovePlannerAssignment =
      Boolean(existingPlannerAssignment) &&
      (payload.dueAt !== undefined || nextScheduledForDate !== existingScheduledForDate);
    const shouldClearPlannerDueAt = shouldRemovePlannerAssignment && payload.dueAt === undefined;
    await assertOwnedGoalReference(app, user.id, payload.goalId);
    const shouldTrackInboxZero = payload.status !== undefined || payload.scheduledForDate !== undefined;
    const task = await app.prisma.$transaction(async (tx) => {
      const staleCountBefore = shouldTrackInboxZero
        ? await countStaleInboxTasks(tx, {
            userId: user.id,
            targetDate: now,
            timezone,
          })
        : 0;

      await tx.task.update({
        where: {
          id: taskId,
        },
        data: {
          title: payload.title,
          notes: payload.notes,
          kind: payload.kind ? toPrismaTaskKind(payload.kind) : undefined,
          reminderAt: resolveReminderAtForUpdate(payload, existingTask.kind, timezone),
          reminderTriggeredAt:
            payload.kind !== undefined || payload.reminderAt !== undefined ? null : undefined,
          status: payload.status ? toPrismaTaskStatus(payload.status) : undefined,
          scheduledForDate:
            payload.scheduledForDate === undefined
              ? undefined
              : payload.scheduledForDate === null
                ? null
                : parseIsoDate(payload.scheduledForDate),
          dueAt:
            payload.dueAt === undefined
              ? shouldClearPlannerDueAt
                ? null
                : undefined
              : payload.dueAt === null
                ? null
                : new Date(payload.dueAt),
          goalId: payload.goalId,
          completedAt:
            payload.status === "completed"
              ? new Date()
              : payload.status === "pending" || payload.status === "dropped"
                ? null
                : undefined,
          originType:
            payload.recurrence || existingTask.recurrenceRuleId
              ? toPrismaTaskOriginType("recurring")
              : undefined,
        },
      });

      await syncTaskRecurrence(
        tx,
        taskId,
        payload.recurrence,
        payload.carryPolicy === undefined ? undefined : payload.carryPolicy,
      );

      if (payload.status === "completed" && existingTask.recurrenceRuleId && existingTask.scheduledForDate) {
        await materializeNextRecurringTaskOccurrence(
          tx,
          user.id,
          existingTask.recurrenceRuleId,
          toIsoDateString(existingTask.scheduledForDate),
        );
      }

      if (shouldTrackInboxZero) {
        await recordInboxZeroIfEarned(tx, {
          userId: user.id,
          targetDate: now,
          timezone,
          staleCountBefore,
          mutationSource: "task_update",
          affectedTaskIds: [taskId],
        });
      }

      if (shouldRemovePlannerAssignment) {
        await removePlannerAssignmentForTask(tx, taskId);
      }

      return tx.task.findUniqueOrThrow({
        where: {
          id: taskId,
        },
        include: planningTaskInclude,
      });
    });

    const response: TaskMutationResponse = withGeneratedAt({
      task: serializeTask(task),
    });

    return reply.send(response);
  });

  app.post("/tasks/:taskId/carry-forward", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(carryForwardTaskSchema, request.body as CarryForwardTaskRequest);
    const { taskId } = request.params as { taskId: string };
    const timezone = await getUserTimezone(app, user.id);
    const now = new Date();
    const existingTask = await app.prisma.task.findFirst({
      where: {
        id: taskId,
        userId: user.id,
      },
      include: planningTaskInclude,
    });
    if (!existingTask) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Task not found",
      });
    }
    const existingPlannerAssignment = await app.prisma.dayPlannerBlockTask.findUnique({
      where: {
        taskId,
      },
      select: {
        blockId: true,
      },
    });

    const task = await app.prisma.$transaction(async (tx) => {
      const staleCountBefore = await countStaleInboxTasks(tx, {
        userId: user.id,
        targetDate: now,
        timezone,
      });
      const nextTask = await carryForwardTask(tx, {
        userId: user.id,
        task: existingTask,
        targetDate: payload.targetDate,
        timezone,
        hasPlannerAssignment: Boolean(existingPlannerAssignment),
      });

      await recordInboxZeroIfEarned(tx, {
        userId: user.id,
        targetDate: now,
        timezone,
        staleCountBefore,
        mutationSource: "task_carry_forward",
        affectedTaskIds: [existingTask.id, nextTask.id],
      });

      return nextTask;
    });

    const response: TaskMutationResponse = withGeneratedAt({
      task: serializeTask(task),
    });

    return reply.status(201).send(response);
  });
};
