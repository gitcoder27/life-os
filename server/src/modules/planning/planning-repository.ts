import type {
  GoalMilestoneInput,
  IsoDateString,
  PlanningPriorityInput,
  RecurrenceInput,
  RecurringTaskCarryPolicy,
} from "@life-os/contracts";
import type { PlanningCycle, PlanningCycleType } from "@prisma/client";

import { AppError } from "../../lib/errors/app-error.js";
import { upsertRecurrenceRuleRecord } from "../../lib/recurrence/store.js";
import { parseIsoDate } from "../../lib/time/cycle.js";
import { toIsoDateString } from "../../lib/time/date.js";
import {
  serializeDayPlannerBlock,
  serializeGoalMilestone,
  serializePriority,
  toPrismaGoalMilestoneStatus,
} from "./planning-mappers.js";
import { dayPlannerBlockWithTasksInclude } from "./planning-record-shapes.js";
import type { PlanningApp } from "./planning-types.js";

const dayPlannerBlockWithPlanningCycleInclude = {
  ...dayPlannerBlockWithTasksInclude,
  planningCycle: {
    select: {
      id: true,
      cycleStartDate: true,
    },
  },
} as const;

export async function replaceGoalMilestones(
  app: PlanningApp,
  goalId: string,
  milestones: GoalMilestoneInput[],
) {
  const existingMilestones = await app.prisma.goalMilestone.findMany({
    where: {
      goalId,
    },
    orderBy: {
      sortOrder: "asc",
    },
  });
  const existingById = new Map(existingMilestones.map((milestone) => [milestone.id, milestone]));
  const inputIds = milestones.flatMap((milestone) => (milestone.id ? [milestone.id] : []));

  if (new Set(inputIds).size !== inputIds.length) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Milestone IDs must be unique",
    });
  }

  for (const milestoneId of inputIds) {
    if (!existingById.has(milestoneId)) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Milestone not found",
      });
    }
  }

  await app.prisma.$transaction(async (tx) => {
    const keptIds = new Set(inputIds);
    const milestoneIdsToDelete = existingMilestones
      .filter((milestone) => !keptIds.has(milestone.id))
      .map((milestone) => milestone.id);

    if (milestoneIdsToDelete.length > 0) {
      await tx.goalMilestone.deleteMany({
        where: {
          id: {
            in: milestoneIdsToDelete,
          },
        },
      });
    }

    const referencedMilestones = milestones.filter(
      (milestone): milestone is GoalMilestoneInput & { id: string } => Boolean(milestone.id),
    );

    for (const [index, milestone] of referencedMilestones.entries()) {
      await tx.goalMilestone.update({
        where: {
          id: milestone.id,
        },
        data: {
          sortOrder: 100 + index,
        },
      });
    }

    for (const [index, milestone] of milestones.entries()) {
      const status = toPrismaGoalMilestoneStatus(milestone.status);
      const existingMilestone = milestone.id ? existingById.get(milestone.id) : null;
      const completedAt = status === "COMPLETED" ? existingMilestone?.completedAt ?? new Date() : null;
      const data = {
        title: milestone.title,
        targetDate:
          milestone.targetDate === undefined
            ? null
            : milestone.targetDate === null
              ? null
              : parseIsoDate(milestone.targetDate),
        status,
        completedAt,
        sortOrder: index + 1,
      };

      if (milestone.id) {
        await tx.goalMilestone.update({
          where: {
            id: milestone.id,
          },
          data,
        });
        continue;
      }

      await tx.goalMilestone.create({
        data: {
          goalId,
          ...data,
        },
      });
    }
  });

  const refreshed = await app.prisma.goalMilestone.findMany({
    where: {
      goalId,
    },
    orderBy: {
      sortOrder: "asc",
    },
  });

  return refreshed.map(serializeGoalMilestone);
}

export async function ensurePlanningCycle(
  app: PlanningApp,
  input: {
    userId: string;
    cycleType: PlanningCycleType;
    cycleStartDate: Date;
    cycleEndDate: Date;
  },
) {
  return app.prisma.planningCycle.upsert({
    where: {
      userId_cycleType_cycleStartDate: {
        userId: input.userId,
        cycleType: input.cycleType,
        cycleStartDate: input.cycleStartDate,
      },
    },
    update: {
      cycleEndDate: input.cycleEndDate,
    },
    create: input,
    include: {
      priorities: {
        orderBy: {
          slot: "asc",
        },
        include: {
          goal: true,
        },
      },
    },
  });
}

export async function loadPlannerBlockWithTasks(prisma: any, blockId: string) {
  return prisma.dayPlannerBlock.findUniqueOrThrow({
    where: {
      id: blockId,
    },
    include: dayPlannerBlockWithTasksInclude,
  });
}

export async function loadPlannerBlocks(prisma: any, planningCycleId: string) {
  const blocks = await prisma.dayPlannerBlock.findMany({
    where: {
      planningCycleId,
    },
    orderBy: {
      sortOrder: "asc",
    },
    include: dayPlannerBlockWithTasksInclude,
  });

  return blocks.map(serializeDayPlannerBlock);
}

export async function findOwnedDayPlannerBlock(
  app: PlanningApp,
  userId: string,
  date: IsoDateString,
  blockId: string,
) {
  const cycleStartDate = parseIsoDate(date);
  const block = await app.prisma.dayPlannerBlock.findFirst({
    where: {
      id: blockId,
      planningCycle: {
        userId,
        cycleType: "DAY",
        cycleStartDate,
      },
    },
    include: dayPlannerBlockWithPlanningCycleInclude,
  });

  if (!block) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Planner block not found",
    });
  }

  return block;
}

export async function assertNoPlannerBlockOverlap(
  prisma: any,
  planningCycleId: string,
  startsAt: Date,
  endsAt: Date,
  options?: { ignoreBlockId?: string },
) {
  const overlappingBlock = await prisma.dayPlannerBlock.findFirst({
    where: {
      planningCycleId,
      id: options?.ignoreBlockId
        ? {
            not: options.ignoreBlockId,
          }
        : undefined,
      startsAt: {
        lt: endsAt,
      },
      endsAt: {
        gt: startsAt,
      },
    },
    select: {
      id: true,
    },
  });

  if (overlappingBlock) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Planner blocks cannot overlap",
    });
  }
}

export async function normalizePlannerBlockSortOrders(tx: any, planningCycleId: string) {
  const blocks = await tx.dayPlannerBlock.findMany({
    where: {
      planningCycleId,
    },
    orderBy: {
      sortOrder: "asc",
    },
    select: {
      id: true,
      sortOrder: true,
    },
  });

  await Promise.all(
    blocks.map((block: { id: string; sortOrder: number }, index: number) =>
      block.sortOrder === index + 1
        ? Promise.resolve()
        : tx.dayPlannerBlock.update({
            where: {
              id: block.id,
            },
            data: {
              sortOrder: index + 1,
            },
          }),
    ),
  );
}

export async function normalizePlannerBlockTaskSortOrders(tx: any, blockId: string) {
  const taskLinks = await tx.dayPlannerBlockTask.findMany({
    where: {
      blockId,
    },
    orderBy: {
      sortOrder: "asc",
    },
    select: {
      id: true,
      sortOrder: true,
    },
  });

  await Promise.all(
    taskLinks.map((taskLink: { id: string; sortOrder: number }, index: number) =>
      taskLink.sortOrder === index + 1
        ? Promise.resolve()
        : tx.dayPlannerBlockTask.update({
            where: {
              id: taskLink.id,
            },
            data: {
              sortOrder: index + 1,
            },
          }),
    ),
  );
}

export async function removePlannerAssignmentForTask(tx: any, taskId: string) {
  const plannerAssignment = await tx.dayPlannerBlockTask.findUnique({
    where: {
      taskId,
    },
    select: {
      id: true,
      blockId: true,
    },
  });

  if (!plannerAssignment) {
    return null;
  }

  await tx.dayPlannerBlockTask.delete({
    where: {
      taskId,
    },
  });
  await normalizePlannerBlockTaskSortOrders(tx, plannerAssignment.blockId);

  return plannerAssignment;
}

export async function replacePlannerBlockTasks(
  tx: any,
  input: {
    userId: string;
    date: IsoDateString;
    blockId: string;
    blockStartsAt: Date;
    taskIds: string[];
  },
) {
  const requestedTaskIds = input.taskIds;
  const requestedTasks = requestedTaskIds.length
    ? await tx.task.findMany({
        where: {
          id: {
            in: requestedTaskIds,
          },
          userId: input.userId,
        },
        select: {
          id: true,
          kind: true,
          scheduledForDate: true,
        },
      })
    : [];

  if (requestedTasks.length !== requestedTaskIds.length) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Task not found",
    });
  }

  const invalidTask = requestedTasks.find(
    (task: { kind: string; scheduledForDate: Date | null }) =>
      task.kind !== "TASK" ||
      !task.scheduledForDate ||
      toIsoDateString(task.scheduledForDate) !== input.date,
  );
  if (invalidTask) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Only today's scheduled tasks can be assigned to planner blocks",
    });
  }

  const currentBlockLinks = await tx.dayPlannerBlockTask.findMany({
    where: {
      blockId: input.blockId,
    },
    orderBy: {
      sortOrder: "asc",
    },
    select: {
      taskId: true,
    },
  });
  const currentTaskIds = currentBlockLinks.map((link: { taskId: string }) => link.taskId);
  const removedTaskIds = currentTaskIds.filter((taskId: string) => !requestedTaskIds.includes(taskId));

  const reassignedLinks = requestedTaskIds.length
    ? await tx.dayPlannerBlockTask.findMany({
        where: {
          taskId: {
            in: requestedTaskIds,
          },
        },
        select: {
          taskId: true,
          blockId: true,
        },
      })
    : [];
  const affectedOtherBlockIds = [
    ...new Set<string>(
      reassignedLinks
        .filter((link: { blockId: string }) => link.blockId !== input.blockId)
        .map((link: { blockId: string }) => link.blockId),
    ),
  ];

  await tx.dayPlannerBlockTask.deleteMany({
    where: {
      OR: [
        {
          blockId: input.blockId,
        },
        requestedTaskIds.length > 0
          ? {
              taskId: {
                in: requestedTaskIds,
              },
            }
          : {
              id: "__never__",
            },
      ],
    },
  });

  if (requestedTaskIds.length > 0) {
    await tx.dayPlannerBlockTask.createMany({
      data: requestedTaskIds.map((taskId, index) => ({
        blockId: input.blockId,
        taskId,
        sortOrder: index + 1,
      })),
    });

    await tx.task.updateMany({
      where: {
        id: {
          in: requestedTaskIds,
        },
      },
      data: {
        dueAt: input.blockStartsAt,
      },
    });
  }

  if (removedTaskIds.length > 0) {
    await tx.task.updateMany({
      where: {
        id: {
          in: removedTaskIds,
        },
      },
      data: {
        dueAt: null,
      },
    });
  }

  await Promise.all(affectedOtherBlockIds.map((blockId) => normalizePlannerBlockTaskSortOrders(tx, blockId)));
}

export async function syncTaskRecurrence(
  tx: any,
  taskId: string,
  recurrence: RecurrenceInput | undefined,
  carryPolicy: RecurringTaskCarryPolicy | null | undefined,
) {
  if (!recurrence) {
    return null;
  }

  const recurrenceRecord = await upsertRecurrenceRuleRecord(tx, {
    ownerType: "TASK",
    ownerId: taskId,
    recurrence,
    carryPolicy,
  });

  await tx.task.update({
    where: {
      id: taskId,
    },
    data: {
      recurrenceRuleId: recurrenceRecord.id,
    },
  });

  return recurrenceRecord;
}

export async function replaceCyclePriorities(
  app: PlanningApp,
  userId: string,
  cycle: PlanningCycle,
  priorities: PlanningPriorityInput[],
) {
  const existing = await app.prisma.cyclePriority.findMany({
    where: {
      planningCycleId: cycle.id,
    },
    orderBy: {
      slot: "asc",
    },
  });
  const existingById = new Map(existing.map((priority) => [priority.id, priority]));
  const inputIds = priorities.flatMap((priority) => (priority.id ? [priority.id] : []));
  const uniqueInputIds = new Set(inputIds);
  const uniqueSlots = new Set(priorities.map((priority) => priority.slot));

  if (uniqueInputIds.size !== inputIds.length) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Priority IDs must be unique",
    });
  }

  if (uniqueSlots.size !== priorities.length) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Priority slots must be unique",
    });
  }

  for (const priorityId of inputIds) {
    if (!existingById.has(priorityId)) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Priority not found",
      });
    }
  }

  await Promise.all(priorities.map((priority) => assertOwnedGoalReference(app, userId, priority.goalId)));

  await app.prisma.$transaction(async (tx) => {
    const keptIds = new Set(inputIds);
    const priorityIdsToDelete = existing
      .filter((priority) => !keptIds.has(priority.id))
      .map((priority) => priority.id);

    if (priorityIdsToDelete.length > 0) {
      await tx.cyclePriority.deleteMany({
        where: {
          id: {
            in: priorityIdsToDelete,
          },
        },
      });
    }

    const referencedPriorities = priorities.filter(
      (priority): priority is PlanningPriorityInput & { id: string } => Boolean(priority.id),
    );

    for (const [index, priority] of referencedPriorities.entries()) {
      await tx.cyclePriority.update({
        where: {
          id: priority.id,
        },
        data: {
          slot: 100 + index,
        },
      });
    }

    for (const priority of priorities) {
      if (priority.id) {
        await tx.cyclePriority.update({
          where: {
            id: priority.id,
          },
          data: {
            slot: priority.slot,
            title: priority.title,
            goalId: priority.goalId ?? null,
          },
        });
        continue;
      }

      await tx.cyclePriority.create({
        data: {
          planningCycleId: cycle.id,
          slot: priority.slot,
          title: priority.title,
          goalId: priority.goalId ?? null,
        },
      });
    }
  });

  const refreshed = await app.prisma.cyclePriority.findMany({
    where: {
      planningCycleId: cycle.id,
    },
    orderBy: {
      slot: "asc",
    },
    include: {
      goal: true,
    },
  });

  return refreshed.map(serializePriority);
}

export async function findOwnedGoal(app: PlanningApp, userId: string, goalId: string) {
  const goal = await app.prisma.goal.findFirst({
    where: {
      id: goalId,
      userId,
    },
  });

  if (!goal) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Goal not found",
    });
  }

  return goal;
}

export async function assertOwnedGoalReference(
  app: PlanningApp,
  userId: string,
  goalId: string | null | undefined,
) {
  if (!goalId) {
    return;
  }

  await findOwnedGoal(app, userId, goalId);
}

export async function findOwnedTaskTemplate(
  app: PlanningApp,
  userId: string,
  taskTemplateId: string,
  options?: { activeOnly?: boolean },
) {
  const taskTemplate = await app.prisma.taskTemplate.findFirst({
    where: {
      id: taskTemplateId,
      userId,
      archivedAt: options?.activeOnly ? null : undefined,
    },
  });

  if (!taskTemplate) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Task template not found",
    });
  }

  return taskTemplate;
}

export async function findOwnedPriority(
  app: PlanningApp,
  userId: string,
  priorityId: string,
) {
  const priority = await app.prisma.cyclePriority.findFirst({
    where: {
      id: priorityId,
      planningCycle: {
        userId,
      },
    },
  });

  if (!priority) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Priority not found",
    });
  }

  return priority;
}
