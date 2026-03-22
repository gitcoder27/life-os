import type { IsoDateString } from "@life-os/contracts";
import type { Prisma, PrismaClient, RecurrenceException, RecurrenceRule, Task } from "@prisma/client";

import { toIsoDateString } from "../time/date.js";
import { getUtcDateForLocalTime } from "../time/user-time.js";
import { getNextRecurrenceDateAfter, listRecurrenceDatesInRange, normalizeRecurrenceRule } from "./rules.js";
import { coerceExceptionItems, fromPrismaCarryPolicy, upsertRecurrenceException } from "./store.js";

type Tx = PrismaClient | Prisma.TransactionClient;

type TaskRecurrenceRule = RecurrenceRule & {
  exceptions: RecurrenceException[];
  tasks: Task[];
};

function getPrototypeTask(record: TaskRecurrenceRule) {
  return record.tasks.find((task) => task.id === record.ownerId) ?? record.tasks[0] ?? null;
}

function hasTaskOnIsoDate(record: TaskRecurrenceRule, isoDate: IsoDateString) {
  return record.tasks.some(
    (task) => task.scheduledForDate && toIsoDateString(task.scheduledForDate) === isoDate,
  );
}

async function createTaskOccurrence(
  tx: Tx,
  prototype: Task,
  recurrenceRuleId: string,
  scheduledForDate: IsoDateString,
  carriedFromTaskId: string | null,
) {
  const preferences = await tx.userPreference.findUnique({
    where: {
      userId: prototype.userId,
    },
    select: {
      timezone: true,
    },
  });

  return tx.task.create({
    data: {
      userId: prototype.userId,
      title: prototype.title,
      notes: prototype.notes,
      kind: prototype.kind,
      reminderAt:
        prototype.kind === "REMINDER"
          ? getUtcDateForLocalTime(scheduledForDate, "00:00", preferences?.timezone)
          : prototype.reminderAt,
      reminderTriggeredAt: null,
      scheduledForDate: new Date(`${scheduledForDate}T00:00:00.000Z`),
      dueAt: prototype.dueAt,
      goalId: prototype.goalId,
      originType: "RECURRING",
      carriedFromTaskId,
      recurrenceRuleId,
    },
    include: {
      goal: true,
      recurrenceRule: {
        include: {
          exceptions: {
            orderBy: {
              occurrenceDate: "asc",
            },
          },
        },
      },
    },
  });
}

async function loadTaskRecurrenceRule(tx: Tx, userId: string, recurrenceRuleId: string) {
  return tx.recurrenceRule.findFirst({
    where: {
      id: recurrenceRuleId,
      tasks: {
        some: {
          userId,
        },
      },
    },
    include: {
      exceptions: {
        orderBy: {
          occurrenceDate: "asc",
        },
      },
      tasks: {
        where: {
          userId,
        },
        orderBy: [
          { scheduledForDate: "asc" },
          { createdAt: "asc" },
        ],
      },
    },
  });
}

export async function materializeRecurringTasksInRange(
  tx: Tx,
  userId: string,
  startDate: Date,
  endDate: Date,
) {
  const startIsoDate = toIsoDateString(startDate);
  const endIsoDate = toIsoDateString(endDate);
  const rules = await tx.recurrenceRule.findMany({
    where: {
      ownerType: "TASK",
      tasks: {
        some: {
          userId,
        },
      },
    },
    include: {
      exceptions: {
        orderBy: {
          occurrenceDate: "asc",
        },
      },
      tasks: {
        where: {
          userId,
        },
        orderBy: [
          { scheduledForDate: "asc" },
          { createdAt: "asc" },
        ],
      },
    },
  });

  let created = 0;
  for (const ruleRecord of rules) {
    const rule = normalizeRecurrenceRule(ruleRecord.ruleJson);
    const prototype = getPrototypeTask(ruleRecord);
    if (!rule || !prototype) {
      continue;
    }

    const dueDates = listRecurrenceDatesInRange(
      rule,
      startIsoDate,
      endIsoDate,
      coerceExceptionItems(ruleRecord.exceptions),
    );

    for (const dueDate of dueDates) {
      if (hasTaskOnIsoDate(ruleRecord, dueDate)) {
        continue;
      }
      const createdTask = await createTaskOccurrence(tx, prototype, ruleRecord.id, dueDate, null);
      ruleRecord.tasks.push(createdTask as unknown as Task);
      created += 1;
    }
  }

  return created;
}

export async function materializeNextRecurringTaskOccurrence(
  tx: Tx,
  userId: string,
  recurrenceRuleId: string,
  afterIsoDate: IsoDateString,
) {
  const ruleRecord = await loadTaskRecurrenceRule(tx, userId, recurrenceRuleId);
  if (!ruleRecord) {
    return null;
  }

  const rule = normalizeRecurrenceRule(ruleRecord.ruleJson);
  const prototype = getPrototypeTask(ruleRecord);
  if (!rule || !prototype) {
    return null;
  }

  const nextDueDate = getNextRecurrenceDateAfter(rule, afterIsoDate, coerceExceptionItems(ruleRecord.exceptions));
  if (!nextDueDate || hasTaskOnIsoDate(ruleRecord, nextDueDate)) {
    return null;
  }

  return createTaskOccurrence(tx, prototype, recurrenceRuleId, nextDueDate, null);
}

export async function applyRecurringTaskCarryForward(
  tx: Tx,
  userId: string,
  task: Task & { recurrenceRuleId: string | null },
  targetDate: IsoDateString,
) {
  if (!task.recurrenceRuleId || !task.scheduledForDate) {
    return null;
  }

  const ruleRecord = await loadTaskRecurrenceRule(tx, userId, task.recurrenceRuleId);
  if (!ruleRecord) {
    return null;
  }

  const originalIsoDate = toIsoDateString(task.scheduledForDate);
  await upsertRecurrenceException(tx, ruleRecord.id, {
    occurrenceDate: originalIsoDate,
    action: "reschedule",
    targetDate,
  });

  const carryPolicy = fromPrismaCarryPolicy(ruleRecord.carryPolicy) ?? "complete_and_clone";
  if (carryPolicy === "move_due_date") {
    const preferences = await tx.userPreference.findUnique({
      where: {
        userId,
      },
      select: {
        timezone: true,
      },
    });

    return tx.task.update({
      where: {
        id: task.id,
      },
      data: {
        scheduledForDate: new Date(`${targetDate}T00:00:00.000Z`),
        reminderAt:
          task.kind === "REMINDER"
            ? getUtcDateForLocalTime(targetDate, "00:00", preferences?.timezone)
            : undefined,
        reminderTriggeredAt: task.kind === "REMINDER" ? null : undefined,
        status: "PENDING",
        completedAt: null,
      },
      include: {
        goal: true,
        recurrenceRule: {
          include: {
            exceptions: {
              orderBy: {
                occurrenceDate: "asc",
              },
            },
          },
        },
      },
    });
  }

  await tx.task.update({
    where: {
      id: task.id,
    },
    data: {
      status: "DROPPED",
      completedAt: null,
    },
  });

  if (carryPolicy === "cancel") {
    const nextTask = await materializeNextRecurringTaskOccurrence(tx, userId, ruleRecord.id, originalIsoDate);
    if (nextTask) {
      return nextTask;
    }
    return tx.task.findUniqueOrThrow({
      where: {
        id: task.id,
      },
      include: {
        goal: true,
        recurrenceRule: {
          include: {
            exceptions: {
              orderBy: {
                occurrenceDate: "asc",
              },
            },
          },
        },
      },
    });
  }

  if (hasTaskOnIsoDate(ruleRecord, targetDate)) {
    return tx.task.findFirstOrThrow({
      where: {
        recurrenceRuleId: ruleRecord.id,
        scheduledForDate: new Date(`${targetDate}T00:00:00.000Z`),
      },
      include: {
        goal: true,
        recurrenceRule: {
          include: {
            exceptions: {
              orderBy: {
                occurrenceDate: "asc",
              },
            },
          },
        },
      },
    });
  }

  return createTaskOccurrence(tx, task, ruleRecord.id, targetDate, task.id);
}

export async function applyRecurringTaskSkip(
  tx: Tx,
  userId: string,
  task: Task & { recurrenceRuleId: string | null },
) {
  if (!task.recurrenceRuleId || !task.scheduledForDate) {
    return null;
  }

  await upsertRecurrenceException(tx, task.recurrenceRuleId, {
    occurrenceDate: toIsoDateString(task.scheduledForDate),
    action: "skip",
  });

  await tx.task.update({
    where: {
      id: task.id,
    },
    data: {
      status: "DROPPED",
      completedAt: null,
    },
  });

  return materializeNextRecurringTaskOccurrence(
    tx,
    userId,
    task.recurrenceRuleId,
    toIsoDateString(task.scheduledForDate),
  );
}
