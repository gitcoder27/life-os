import type {
  RecurrenceDefinition,
  RecurrenceExceptionItem,
  RecurrenceInput,
  RecurringTaskCarryPolicy,
} from "@life-os/contracts";
import type {
  Prisma,
  PrismaClient,
  RecurrenceCarryPolicy as PrismaRecurrenceCarryPolicy,
  RecurrenceException as PrismaRecurrenceException,
  RecurrenceExceptionAction as PrismaRecurrenceExceptionAction,
  RecurrenceOwnerType as PrismaRecurrenceOwnerType,
  RecurrenceRule as PrismaRecurrenceRule,
} from "@prisma/client";

import { toIsoDateString } from "../time/date.js";
import { normalizeRecurrenceExceptions, normalizeRecurrenceRule } from "./rules.js";

type Tx = PrismaClient | Prisma.TransactionClient;

export type StoredRecurrenceRule = PrismaRecurrenceRule & {
  exceptions: PrismaRecurrenceException[];
};

type SerializableRecurrenceRuleRecord = {
  id?: string;
  ruleJson: unknown;
  exceptions?: Array<{
    occurrenceDate: Date;
    action: PrismaRecurrenceExceptionAction | unknown;
    targetDate: Date | null;
  }>;
  carryPolicy?: PrismaRecurrenceCarryPolicy | null | unknown;
  legacyRuleText?: string | null;
};

export function toPrismaCarryPolicy(
  policy: RecurringTaskCarryPolicy | null | undefined,
): PrismaRecurrenceCarryPolicy | null | undefined {
  if (policy === undefined) {
    return undefined;
  }
  if (policy === null) {
    return null;
  }
  switch (policy) {
    case "complete_and_clone":
      return "COMPLETE_AND_CLONE";
    case "move_due_date":
      return "MOVE_DUE_DATE";
    case "cancel":
      return "CANCEL";
  }
}

export function fromPrismaCarryPolicy(
  policy: PrismaRecurrenceCarryPolicy | null | undefined,
): RecurringTaskCarryPolicy | null {
  if (!policy) {
    return null;
  }
  switch (policy) {
    case "COMPLETE_AND_CLONE":
      return "complete_and_clone";
    case "MOVE_DUE_DATE":
      return "move_due_date";
    case "CANCEL":
      return "cancel";
  }
}

export function toPrismaExceptionAction(
  action: RecurrenceExceptionItem["action"],
): PrismaRecurrenceExceptionAction {
  switch (action) {
    case "skip":
      return "SKIP";
    case "do_once":
      return "DO_ONCE";
    case "reschedule":
      return "RESCHEDULE";
  }
}

export function fromPrismaExceptionAction(
  action: PrismaRecurrenceExceptionAction,
): RecurrenceExceptionItem["action"] {
  switch (action) {
    case "SKIP":
      return "skip";
    case "DO_ONCE":
      return "do_once";
    case "RESCHEDULE":
      return "reschedule";
  }
}

export function serializeRecurrenceDefinition(
  record: SerializableRecurrenceRuleRecord | null | undefined,
): RecurrenceDefinition | null {
  if (!record?.id) {
    return null;
  }

  const rule = normalizeRecurrenceRule(record.ruleJson);
  if (!rule) {
    return null;
  }

  return {
    id: record.id,
    rule,
    exceptions: (record.exceptions ?? []).map((exception) => ({
      occurrenceDate: toIsoDateString(exception.occurrenceDate),
      action: fromPrismaExceptionAction(exception.action as PrismaRecurrenceExceptionAction),
      targetDate: exception.targetDate ? toIsoDateString(exception.targetDate) : null,
    })),
    carryPolicy: fromPrismaCarryPolicy(record.carryPolicy as PrismaRecurrenceCarryPolicy | null | undefined),
    legacyRuleText: record.legacyRuleText ?? null,
  };
}

export async function upsertRecurrenceRuleRecord(
  tx: Tx,
  input: {
    ownerType: PrismaRecurrenceOwnerType;
    ownerId: string;
    recurrence: RecurrenceInput;
    carryPolicy?: RecurringTaskCarryPolicy | null;
    legacyRuleText?: string | null;
  },
) {
  const normalizedRule = normalizeRecurrenceRule(input.recurrence.rule);
  if (!normalizedRule) {
    throw new Error("Invalid recurrence rule payload");
  }
  const normalizedExceptions = normalizeRecurrenceExceptions(input.recurrence.exceptions ?? []);
  const ruleJson = normalizedRule as unknown as Prisma.InputJsonValue;

  const record = await tx.recurrenceRule.upsert({
    where: {
      ownerType_ownerId: {
        ownerType: input.ownerType,
        ownerId: input.ownerId,
      },
    },
    update: {
      ruleJson,
      carryPolicy: toPrismaCarryPolicy(input.carryPolicy),
      legacyRuleText: input.legacyRuleText ?? null,
    },
    create: {
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      ruleJson,
      carryPolicy: toPrismaCarryPolicy(input.carryPolicy) ?? null,
      legacyRuleText: input.legacyRuleText ?? null,
    },
  });

  await tx.recurrenceException.deleteMany({
    where: {
      recurrenceRuleId: record.id,
    },
  });

  if (normalizedExceptions.length > 0) {
    await tx.recurrenceException.createMany({
      data: normalizedExceptions.map((exception) => ({
        recurrenceRuleId: record.id,
        occurrenceDate: new Date(`${exception.occurrenceDate}T00:00:00.000Z`),
        action: toPrismaExceptionAction(exception.action),
        targetDate: exception.targetDate ? new Date(`${exception.targetDate}T00:00:00.000Z`) : null,
      })),
    });
  }

  return tx.recurrenceRule.findUniqueOrThrow({
    where: {
      id: record.id,
    },
    include: {
      exceptions: {
        orderBy: {
          occurrenceDate: "asc",
        },
      },
    },
  });
}

export async function upsertRecurrenceException(
  tx: Tx,
  recurrenceRuleId: string,
  input: RecurrenceExceptionItem,
) {
  return tx.recurrenceException.upsert({
    where: {
      recurrenceRuleId_occurrenceDate: {
        recurrenceRuleId,
        occurrenceDate: new Date(`${input.occurrenceDate}T00:00:00.000Z`),
      },
    },
    update: {
      action: toPrismaExceptionAction(input.action),
      targetDate: input.targetDate ? new Date(`${input.targetDate}T00:00:00.000Z`) : null,
    },
    create: {
      recurrenceRuleId,
      occurrenceDate: new Date(`${input.occurrenceDate}T00:00:00.000Z`),
      action: toPrismaExceptionAction(input.action),
      targetDate: input.targetDate ? new Date(`${input.targetDate}T00:00:00.000Z`) : null,
    },
  });
}

export function coerceExceptionItems(
  exceptions: Array<{ occurrenceDate: Date; action: PrismaRecurrenceExceptionAction; targetDate: Date | null }>,
) {
  return exceptions.map((exception) => ({
    occurrenceDate: toIsoDateString(exception.occurrenceDate),
    action: fromPrismaExceptionAction(exception.action),
    targetDate: exception.targetDate ? toIsoDateString(exception.targetDate) : null,
  }));
}
