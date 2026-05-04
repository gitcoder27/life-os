import type { FastifyPluginAsync } from "fastify";
import type {
  BulkTaskMutationResponse,
  BulkUpdateTasksRequest,
  CarryForwardTaskRequest,
  CommitTaskRequest,
  CreateTaskRequest,
  LogTaskStuckRequest,
  PlanningTaskItem,
  ReorderTasksRequest,
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
import { getDayWindowUtc } from "../../lib/time/user-time.js";
import { parseOrThrow } from "../../lib/validation/parse.js";
import { countStaleInboxTasks, recordInboxZeroIfEarned } from "./inbox-zero.js";
import {
  getUserTimezone,
  resolveReminderAtForUpdate,
  toTaskReminderAt,
} from "./planning-context.js";
import {
  fromPrismaTaskKind,
  serializeTask,
  toPrismaTaskKind,
  toPrismaTaskOriginType,
  toPrismaTaskProgressState,
  toPrismaTaskStatus,
  toPrismaTaskStuckAction,
  toPrismaTaskStuckReason,
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
  commitTaskSchema,
  createTaskSchema,
  logTaskStuckSchema,
  reorderTasksSchema,
  taskListQuerySchema,
  updateTaskSchema,
} from "./planning-schemas.js";
import {
  buildTaskCommitmentFieldErrors,
  buildTaskCommitmentGuidance,
  mergeTaskCommitmentRequest,
} from "./task-commitment.js";
import {
  buildTaskListCursorWhere,
  encodeTaskListCursor,
  TASK_LIST_DEFAULT_LIMIT,
} from "./task-list-pagination.js";

type PlanningTaskRecord = Prisma.TaskGetPayload<{
  include: typeof planningTaskInclude;
}>;

function serializeTaskWithCommitmentGuidance(task: PlanningTaskRecord): PlanningTaskItem {
  return {
    ...serializeTask(task),
    commitmentGuidance: buildTaskCommitmentGuidance({
      kind: fromPrismaTaskKind(task.kind),
      nextAction: task.nextAction ?? null,
      fiveMinuteVersion: task.fiveMinuteVersion ?? null,
      estimatedDurationMinutes: task.estimatedDurationMinutes ?? null,
      likelyObstacle: task.likelyObstacle ?? null,
      focusLengthMinutes: task.focusLengthMinutes ?? null,
    }),
  };
}

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

function buildTaskProtocolData(
  payload: Pick<
    CreateTaskRequest,
    | "nextAction"
    | "fiveMinuteVersion"
    | "estimatedDurationMinutes"
    | "likelyObstacle"
    | "focusLengthMinutes"
    | "progressState"
    | "startedAt"
  >,
) {
  return {
    nextAction: payload.nextAction ?? null,
    fiveMinuteVersion: payload.fiveMinuteVersion ?? null,
    estimatedDurationMinutes: payload.estimatedDurationMinutes ?? null,
    likelyObstacle: payload.likelyObstacle ?? null,
    focusLengthMinutes: payload.focusLengthMinutes ?? null,
    progressState: toPrismaTaskProgressState(payload.progressState ?? "not_started"),
    startedAt: payload.startedAt ? new Date(payload.startedAt) : null,
  };
}

async function getNextTodaySortOrder(
  tx: Prisma.TransactionClient,
  userId: string,
  scheduledForDate: Date | null,
) {
  if (!scheduledForDate) {
    return 0;
  }

  const lastTask = await tx.task.findFirst({
    where: {
      userId,
      scheduledForDate,
    },
    orderBy: [{ todaySortOrder: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    select: {
      todaySortOrder: true,
    },
  });

  return (lastTask?.todaySortOrder ?? -1) + 1;
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
  const targetScheduledForDate = parseIsoDate(targetDate);

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
          todaySortOrder: await getNextTodaySortOrder(tx, userId, targetScheduledForDate),
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
      scheduledForDate: targetScheduledForDate,
      dueAt: hasPlannerAssignment ? null : task.dueAt,
      goalId: task.goalId,
      originType: "CARRY_FORWARD",
      carriedFromTaskId: task.id,
      todaySortOrder: await getNextTodaySortOrder(tx, userId, targetScheduledForDate),
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
    const listSort = query.sort ?? "newest";
    const scheduledForDate = query.scheduledForDate ? parseIsoDate(query.scheduledForDate) : null;
    const fromDate = query.from ? parseIsoDate(query.from) : null;
    const toDateExclusive = query.to ? addDays(parseIsoDate(query.to), 1) : null;
    const completedOnWindow = query.completedOn
      ? getDayWindowUtc(query.completedOn, await getUserTimezone(app, user.id))
      : null;
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
      completedAt: completedOnWindow
        ? {
            gte: completedOnWindow.start,
            lt: completedOnWindow.end,
          }
        : undefined,
    };
    const listWhere = query.cursor
      ? {
          AND: [
            {
              ...summaryWhere,
              kind: query.kind ? toPrismaTaskKind(query.kind) : undefined,
            },
            buildTaskListCursorWhere(query.cursor, listSort),
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
        orderBy: limit
          ? listSort === "oldest"
            ? [{ createdAt: "asc" }, { id: "asc" }]
            : [{ createdAt: "desc" }, { id: "desc" }]
          : [{ scheduledForDate: "asc" }, { todaySortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
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
      tasks: page.map(serializeTaskWithCommitmentGuidance),
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
      const scheduledForDate = payload.scheduledForDate ? parseIsoDate(payload.scheduledForDate) : null;
      const createdTask = await tx.task.create({
        data: {
          userId: user.id,
          title: payload.title,
          notes: payload.notes ?? null,
          kind: toPrismaTaskKind(payload.kind ?? "task"),
          reminderAt:
            payload.kind === "reminder" ? (toTaskReminderAt(payload.reminderAt, timezone) ?? null) : null,
          scheduledForDate,
          dueAt: payload.dueAt ? new Date(payload.dueAt) : null,
          goalId: payload.goalId ?? null,
          originType: toPrismaTaskOriginType(payload.recurrence ? "recurring" : (payload.originType ?? "manual")),
          todaySortOrder: await getNextTodaySortOrder(tx, user.id, scheduledForDate),
          ...buildTaskProtocolData(payload),
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
      task: serializeTaskWithCommitmentGuidance(task),
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

        const updateData = {
          ...buildBulkTaskUpdateData(task, payload.action, now, timezone),
          ...(payload.action.type === "schedule"
            ? {
                todaySortOrder: await getNextTodaySortOrder(
                  tx,
                  user.id,
                  parseIsoDate(payload.action.scheduledForDate),
                ),
              }
            : {}),
        };

        await tx.task.update({
          where: {
            id: taskId,
          },
          data: updateData,
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

    const serializedTasksById = new Map(
      tasks.map((task) => [task.id, serializeTaskWithCommitmentGuidance(task)]),
    );
    const response: BulkTaskMutationResponse = withGeneratedAt({
      tasks:
        payload.action.type === "carry_forward"
          ? tasks.map(serializeTaskWithCommitmentGuidance)
          : payload.taskIds
              .map((taskId) => serializedTasksById.get(taskId))
              .filter((task): task is PlanningTaskItem => Boolean(task)),
    });

    return reply.send(response);
  });

  app.put("/tasks/order", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(reorderTasksSchema, request.body as ReorderTasksRequest);
    const uniqueTaskIds = new Set(payload.taskIds);

    if (uniqueTaskIds.size !== payload.taskIds.length) {
      throw new AppError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Task order payload must include each task once.",
      });
    }

    const tasks = await app.prisma.$transaction(async (tx) => {
      const ownedTasks = await tx.task.findMany({
        where: {
          userId: user.id,
          id: {
            in: payload.taskIds,
          },
        },
        select: {
          id: true,
        },
      });

      if (ownedTasks.length !== payload.taskIds.length) {
        throw new AppError({
          statusCode: 404,
          code: "NOT_FOUND",
          message: "One or more tasks were not found.",
        });
      }

      await Promise.all(
        payload.taskIds.map((taskId, index) =>
          tx.task.update({
            where: {
              id: taskId,
            },
            data: {
              todaySortOrder: index,
            },
          }),
        ),
      );

      const updatedTasks = await tx.task.findMany({
        where: {
          userId: user.id,
          id: {
            in: payload.taskIds,
          },
        },
        include: planningTaskInclude,
      });
      const updatedById = new Map(updatedTasks.map((task) => [task.id, task]));

      return payload.taskIds.map((taskId) => updatedById.get(taskId)!);
    });

    const response: BulkTaskMutationResponse = withGeneratedAt({
      tasks: tasks.map(serializeTaskWithCommitmentGuidance),
    });

    return reply.send(response);
  });

  app.post("/tasks/:taskId/commit", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(commitTaskSchema, request.body as CommitTaskRequest);
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

    if (existingTask.status !== "PENDING") {
      throw new AppError({
        statusCode: 409,
        code: "CONFLICT",
        message: "Only pending tasks can be committed.",
      });
    }

    const commitmentTask = mergeTaskCommitmentRequest(
      {
        kind: fromPrismaTaskKind(existingTask.kind),
        nextAction: existingTask.nextAction ?? null,
        fiveMinuteVersion: existingTask.fiveMinuteVersion ?? null,
        estimatedDurationMinutes: existingTask.estimatedDurationMinutes ?? null,
        likelyObstacle: existingTask.likelyObstacle ?? null,
        focusLengthMinutes: existingTask.focusLengthMinutes ?? null,
      },
      payload,
    );
    const commitmentGuidance = buildTaskCommitmentGuidance(commitmentTask);

    if (commitmentGuidance.readiness === "needs_clarification") {
      throw new AppError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: commitmentGuidance.primaryMessage,
        fieldErrors: buildTaskCommitmentFieldErrors(commitmentGuidance),
      });
    }

    const task = await app.prisma.$transaction(async (tx) => {
      const staleCountBefore = await countStaleInboxTasks(tx, {
        userId: user.id,
        targetDate: now,
        timezone,
      });
      const scheduledForDate = parseIsoDate(payload.scheduledForDate);

      await tx.task.update({
        where: {
          id: taskId,
        },
        data: {
          scheduledForDate,
          dueAt: null,
          todaySortOrder: await getNextTodaySortOrder(tx, user.id, scheduledForDate),
          reminderAt:
            existingTask.kind === "REMINDER"
              ? toTaskReminderAt(payload.scheduledForDate, timezone) ?? null
              : undefined,
          reminderTriggeredAt: existingTask.kind === "REMINDER" ? null : undefined,
          nextAction: commitmentTask.nextAction,
          fiveMinuteVersion: commitmentTask.fiveMinuteVersion,
          estimatedDurationMinutes: commitmentTask.estimatedDurationMinutes,
          likelyObstacle: commitmentTask.likelyObstacle,
          focusLengthMinutes: commitmentTask.focusLengthMinutes,
        },
      });

      await removePlannerAssignmentForTask(tx, taskId);

      await recordInboxZeroIfEarned(tx, {
        userId: user.id,
        targetDate: now,
        timezone,
        staleCountBefore,
        mutationSource: "task_update",
        affectedTaskIds: [taskId],
      });

      return tx.task.findUniqueOrThrow({
        where: {
          id: taskId,
        },
        include: planningTaskInclude,
      });
    });

    const response: TaskMutationResponse = withGeneratedAt({
      task: serializeTaskWithCommitmentGuidance(task),
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
    const nextProgressState =
      payload.status === "completed"
        ? "advanced"
        : payload.progressState;
    const nextStartedAt =
      payload.startedAt !== undefined
        ? payload.startedAt
        : nextProgressState === "started" || nextProgressState === "advanced" || payload.status === "completed"
          ? existingTask.startedAt?.toISOString() ?? now.toISOString()
          : undefined;
    const task = await app.prisma.$transaction(async (tx) => {
      const staleCountBefore = shouldTrackInboxZero
        ? await countStaleInboxTasks(tx, {
            userId: user.id,
            targetDate: now,
            timezone,
          })
        : 0;
      const parsedScheduledForDate =
        payload.scheduledForDate === undefined || payload.scheduledForDate === null
          ? null
          : parseIsoDate(payload.scheduledForDate);
      const shouldAppendToSchedule =
        parsedScheduledForDate !== null && payload.scheduledForDate !== existingScheduledForDate;

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
                : parsedScheduledForDate,
          todaySortOrder: shouldAppendToSchedule
            ? await getNextTodaySortOrder(tx, user.id, parsedScheduledForDate)
            : undefined,
          dueAt:
            payload.dueAt === undefined
              ? shouldClearPlannerDueAt
                ? null
                : undefined
              : payload.dueAt === null
                ? null
                : new Date(payload.dueAt),
          goalId: payload.goalId,
          nextAction: payload.nextAction,
          fiveMinuteVersion: payload.fiveMinuteVersion,
          estimatedDurationMinutes: payload.estimatedDurationMinutes,
          likelyObstacle: payload.likelyObstacle,
          focusLengthMinutes: payload.focusLengthMinutes,
          progressState:
            nextProgressState === undefined ? undefined : toPrismaTaskProgressState(nextProgressState),
          startedAt:
            nextStartedAt === undefined
              ? undefined
              : nextStartedAt === null
                ? null
                : new Date(nextStartedAt),
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
      task: serializeTaskWithCommitmentGuidance(task),
    });

    return reply.send(response);
  });

  app.post("/tasks/:taskId/stuck", async (request, reply) => {
    const user = requireAuthenticatedUser(request);
    const payload = parseOrThrow(logTaskStuckSchema, request.body as LogTaskStuckRequest);
    const { taskId } = request.params as { taskId: string };

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

    const now = new Date();
    const task = await app.prisma.$transaction(async (tx) => {
      await tx.taskStuckEvent.create({
        data: {
          userId: user.id,
          taskId,
          reason: toPrismaTaskStuckReason(payload.reason),
          actionTaken: toPrismaTaskStuckAction(payload.actionTaken),
          note: payload.note ?? null,
          targetDate: payload.targetDate ? parseIsoDate(payload.targetDate) : null,
        },
      });

      await tx.task.update({
        where: {
          id: taskId,
        },
        data: {
          lastStuckAt: now,
        },
      });

      return tx.task.findUniqueOrThrow({
        where: {
          id: taskId,
        },
        include: planningTaskInclude,
      });
    });

    const response: TaskMutationResponse = withGeneratedAt({
      task: serializeTaskWithCommitmentGuidance(task),
    });

    return reply.status(201).send(response);
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
      task: serializeTaskWithCommitmentGuidance(task),
    });

    return reply.status(201).send(response);
  });
};
