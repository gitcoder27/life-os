import type {
  GoalDomainInput,
  GoalHorizonInput,
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
import { getUtcDateForLocalTime, getUserLocalTime } from "../../lib/time/user-time.js";
import {
  ensureGoalConfigSeeded,
  normalizeGoalDomainInputs,
  normalizeGoalHorizonInputs,
} from "./goal-config.js";
import {
  serializeDayPlannerBlock,
  serializeGoalDomainConfig,
  serializeGoalHorizonConfig,
  serializeGoalMilestone,
  serializePriority,
  toPrismaGoalDomainSystemKey,
  toPrismaGoalHorizonSystemKey,
  toPrismaGoalMilestoneStatus,
} from "./planning-mappers.js";
import { dayPlannerBlockWithTasksInclude, goalSummaryInclude } from "./planning-record-shapes.js";
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
          goal: {
            include: goalSummaryInclude,
          },
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

export async function seedPlannerBlocksFromMostRecentDay(
  prisma: any,
  input: {
    userId: string;
    date: IsoDateString;
    planningCycleId: string;
    timezone?: string | null;
  },
) {
  const existingBlocksCount = await prisma.dayPlannerBlock.count({
    where: {
      planningCycleId: input.planningCycleId,
    },
  });

  if (existingBlocksCount > 0) {
    return false;
  }

  const sourceCycle = await (prisma.planningCycle?.findFirst?.({
    where: {
      userId: input.userId,
      cycleType: "DAY",
      cycleStartDate: {
        lt: parseIsoDate(input.date),
      },
      plannerBlocks: {
        some: {},
      },
    },
    orderBy: {
      cycleStartDate: "desc",
    },
    select: {
      id: true,
    },
  }) ?? Promise.resolve(null));

  if (!sourceCycle) {
    return false;
  }

  const sourceBlocks = await prisma.dayPlannerBlock.findMany({
    where: {
      planningCycleId: sourceCycle.id,
    },
    orderBy: {
      sortOrder: "asc",
    },
    select: {
      title: true,
      startsAt: true,
      endsAt: true,
      sortOrder: true,
    },
  });

  if (sourceBlocks.length === 0) {
    return false;
  }

  await prisma.$transaction(async (tx: any) => {
    const targetBlockCount = await tx.dayPlannerBlock.count({
      where: {
        planningCycleId: input.planningCycleId,
      },
    });

    if (targetBlockCount > 0) {
      return;
    }

    for (const [index, block] of sourceBlocks.entries()) {
      await tx.dayPlannerBlock.create({
        data: {
          planningCycleId: input.planningCycleId,
          title: block.title,
          startsAt: getUtcDateForLocalTime(
            input.date,
            getUserLocalTime(block.startsAt, input.timezone),
            input.timezone,
          ),
          endsAt: getUtcDateForLocalTime(
            input.date,
            getUserLocalTime(block.endsAt, input.timezone),
            input.timezone,
          ),
          sortOrder: index + 1,
        },
      });
    }
  });

  return true;
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
      goal: {
        include: goalSummaryInclude,
      },
    },
  });

  return refreshed.map(serializePriority);
}

function assertUniqueIds(label: string, ids: Array<string | undefined>) {
  const definedIds = ids.filter((value): value is string => Boolean(value));
  if (new Set(definedIds).size !== definedIds.length) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: `${label} IDs must be unique`,
    });
  }
}

function assertUniqueNullableKeys(label: string, values: Array<string | null | undefined>) {
  const definedValues = values.filter((value): value is string => Boolean(value));
  if (new Set(definedValues).size !== definedValues.length) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: `${label} keys must be unique`,
    });
  }
}

export async function loadGoalConfig(app: PlanningApp, userId: string) {
  await ensureGoalConfigSeeded(app.prisma, userId);
  const [domains, horizons] = await Promise.all([
    app.prisma.goalDomainConfig.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    app.prisma.goalHorizonConfig.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  return {
    domains: domains.map(serializeGoalDomainConfig),
    horizons: horizons.map(serializeGoalHorizonConfig),
  };
}

export async function findOwnedGoalDomainConfig(app: PlanningApp, userId: string, domainId: string) {
  await ensureGoalConfigSeeded(app.prisma, userId);
  const domain = await app.prisma.goalDomainConfig.findFirst({
    where: {
      id: domainId,
      userId,
    },
  });

  if (!domain) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Goal domain not found",
    });
  }

  return domain;
}

export async function findOwnedGoalHorizonConfig(app: PlanningApp, userId: string, horizonId: string) {
  await ensureGoalConfigSeeded(app.prisma, userId);
  const horizon = await app.prisma.goalHorizonConfig.findFirst({
    where: {
      id: horizonId,
      userId,
    },
  });

  if (!horizon) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Goal horizon not found",
    });
  }

  return horizon;
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

export async function assertOwnedGoalDomainReference(
  app: PlanningApp,
  userId: string,
  domainId: string,
) {
  await findOwnedGoalDomainConfig(app, userId, domainId);
}

export async function assertOwnedGoalHorizonReference(
  app: PlanningApp,
  userId: string,
  horizonId: string | null | undefined,
) {
  if (!horizonId) {
    return;
  }

  await findOwnedGoalHorizonConfig(app, userId, horizonId);
}

export async function assertValidGoalParentReference(
  app: PlanningApp,
  userId: string,
  goalId: string | null,
  parentGoalId: string | null | undefined,
) {
  if (!parentGoalId) {
    return null;
  }

  if (goalId && goalId === parentGoalId) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "A goal cannot parent itself",
    });
  }

  const parent = await findOwnedGoal(app, userId, parentGoalId);
  let cursor = parent.parentGoalId;
  while (cursor) {
    if (cursor === goalId) {
      throw new AppError({
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "A goal cannot be reparented beneath its own descendant",
      });
    }

    const ancestor = await app.prisma.goal.findFirst({
      where: {
        id: cursor,
        userId,
      },
      select: {
        parentGoalId: true,
      },
    });
    cursor = ancestor?.parentGoalId ?? null;
  }

  return parent;
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

export async function replaceGoalDomainConfigs(
  app: PlanningApp,
  userId: string,
  domains: GoalDomainInput[],
) {
  const normalizedDomains = normalizeGoalDomainInputs(domains);
  if (!normalizedDomains.some((domain) => !domain.isArchived)) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "At least one active goal domain is required",
    });
  }

  await ensureGoalConfigSeeded(app.prisma, userId);
  const existingDomains = await app.prisma.goalDomainConfig.findMany({
    where: { userId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const existingById = new Map(existingDomains.map((domain) => [domain.id, domain]));
  assertUniqueIds("Goal domain", normalizedDomains.map((domain) => domain.id));
  assertUniqueNullableKeys("Goal domain", normalizedDomains.map((domain) => domain.systemKey));

  for (const domain of normalizedDomains) {
    if (domain.id && !existingById.has(domain.id)) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Goal domain not found",
      });
    }
  }

  await app.prisma.$transaction(async (tx) => {
    let nextArchivedSortOrder = normalizedDomains.length + 1;
    const requestedIds = new Set(normalizedDomains.flatMap((domain) => (domain.id ? [domain.id] : [])));
    const reorderSortOrderOffset = Math.max(
      normalizedDomains.length,
      ...existingDomains.map((domain) => domain.sortOrder),
    ) + existingDomains.length + 1;

    for (const existingDomain of existingDomains) {
      if (requestedIds.has(existingDomain.id)) {
        continue;
      }

      const usageCount = await tx.goal.count({
        where: {
          userId,
          domainId: existingDomain.id,
        },
      });

      if (usageCount > 0) {
        await tx.goalDomainConfig.update({
          where: { id: existingDomain.id },
          data: {
            isArchived: true,
            sortOrder: nextArchivedSortOrder++,
          },
        });
        continue;
      }

      await tx.goalDomainConfig.delete({
        where: { id: existingDomain.id },
      });
    }

    for (const [index, domain] of normalizedDomains.entries()) {
      if (!domain.id) {
        continue;
      }

      await tx.goalDomainConfig.update({
        where: { id: domain.id },
        data: {
          sortOrder: reorderSortOrderOffset + index,
        },
      });
    }

    for (const [index, domain] of normalizedDomains.entries()) {
      if (domain.id) {
        const existing = existingById.get(domain.id)!;
        if ((domain.systemKey ?? null) !== (existing.systemKey ? serializeGoalDomainConfig(existing).systemKey : null)) {
          throw new AppError({
            statusCode: 400,
            code: "BAD_REQUEST",
            message: "Goal domain system keys cannot be reassigned",
          });
        }

        await tx.goalDomainConfig.update({
          where: { id: domain.id },
          data: {
            name: domain.name,
            isArchived: domain.isArchived,
            sortOrder: index + 1,
          },
        });
        continue;
      }

      await tx.goalDomainConfig.create({
        data: {
          userId,
          systemKey: domain.systemKey ? toPrismaGoalDomainSystemKey(domain.systemKey) : null,
          name: domain.name,
          isArchived: domain.isArchived,
          sortOrder: index + 1,
        },
      });
    }
  });

  const refreshed = await app.prisma.goalDomainConfig.findMany({
    where: { userId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return refreshed.map(serializeGoalDomainConfig);
}

export async function replaceGoalHorizonConfigs(
  app: PlanningApp,
  userId: string,
  horizons: GoalHorizonInput[],
) {
  const normalizedHorizons = normalizeGoalHorizonInputs(horizons);
  if (!normalizedHorizons.some((horizon) => !horizon.isArchived)) {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "At least one active planning layer is required",
    });
  }

  await ensureGoalConfigSeeded(app.prisma, userId);
  const existingHorizons = await app.prisma.goalHorizonConfig.findMany({
    where: { userId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const existingById = new Map(existingHorizons.map((horizon) => [horizon.id, horizon]));
  assertUniqueIds("Goal horizon", normalizedHorizons.map((horizon) => horizon.id));
  assertUniqueNullableKeys("Goal horizon", normalizedHorizons.map((horizon) => horizon.systemKey));

  for (const horizon of normalizedHorizons) {
    if (horizon.id && !existingById.has(horizon.id)) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Goal horizon not found",
      });
    }
  }

  await app.prisma.$transaction(async (tx) => {
    let nextArchivedSortOrder = normalizedHorizons.length + 1;
    const requestedIds = new Set(normalizedHorizons.flatMap((horizon) => (horizon.id ? [horizon.id] : [])));
    const reorderSortOrderOffset = Math.max(
      normalizedHorizons.length,
      ...existingHorizons.map((horizon) => horizon.sortOrder),
    ) + existingHorizons.length + 1;

    for (const existingHorizon of existingHorizons) {
      if (requestedIds.has(existingHorizon.id)) {
        continue;
      }

      const usageCount = await tx.goal.count({
        where: {
          userId,
          horizonId: existingHorizon.id,
        },
      });

      if (usageCount > 0) {
        await tx.goalHorizonConfig.update({
          where: { id: existingHorizon.id },
          data: {
            isArchived: true,
            sortOrder: nextArchivedSortOrder++,
          },
        });
        continue;
      }

      await tx.goalHorizonConfig.delete({
        where: { id: existingHorizon.id },
      });
    }

    for (const [index, horizon] of normalizedHorizons.entries()) {
      if (!horizon.id) {
        continue;
      }

      await tx.goalHorizonConfig.update({
        where: { id: horizon.id },
        data: {
          sortOrder: reorderSortOrderOffset + index,
        },
      });
    }

    for (const [index, horizon] of normalizedHorizons.entries()) {
      if (horizon.id) {
        const existing = existingById.get(horizon.id)!;
        if ((horizon.systemKey ?? null) !== (existing.systemKey ? serializeGoalHorizonConfig(existing).systemKey : null)) {
          throw new AppError({
            statusCode: 400,
            code: "BAD_REQUEST",
            message: "Goal horizon system keys cannot be reassigned",
          });
        }

        await tx.goalHorizonConfig.update({
          where: { id: horizon.id },
          data: {
            name: horizon.name,
            spanMonths: horizon.spanMonths,
            isArchived: horizon.isArchived,
            sortOrder: index + 1,
          },
        });
        continue;
      }

      await tx.goalHorizonConfig.create({
        data: {
          userId,
          systemKey: horizon.systemKey ? toPrismaGoalHorizonSystemKey(horizon.systemKey) : null,
          name: horizon.name,
          spanMonths: horizon.spanMonths,
          isArchived: horizon.isArchived,
          sortOrder: index + 1,
        },
      });
    }
  });

  const refreshed = await app.prisma.goalHorizonConfig.findMany({
    where: { userId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return refreshed.map(serializeGoalHorizonConfig);
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
