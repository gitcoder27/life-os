import type {
  FocusSessionDepth,
  FocusSessionExitReason,
  FocusSessionItem,
  FocusSessionTaskOutcome,
} from "@life-os/contracts";
import type { Prisma } from "@prisma/client";

import { AppError } from "../../lib/errors/app-error.js";
import {
  fromPrismaGoalDomainSystemKey,
  fromPrismaGoalEngagementState,
  fromPrismaGoalStatus,
  fromPrismaTaskProgressState,
  fromPrismaTaskStatus,
} from "../planning/planning-mappers.js";
import { planningTaskInclude } from "../planning/planning-record-shapes.js";
import {
  buildFocusTaskInsight,
  getFocusSessionActualMinutes,
} from "./focus-insights.js";

const focusSessionInclude = {
  task: {
    include: planningTaskInclude,
  },
} as const;

type FocusSessionRecord = Prisma.FocusSessionGetPayload<{
  include: typeof focusSessionInclude;
}>;

const focusInsightSessionSelect = {
  id: true,
  depth: true,
  plannedMinutes: true,
  startedAt: true,
  endedAt: true,
  status: true,
  exitReason: true,
} as const;

type FocusInsightSessionRecord = Prisma.FocusSessionGetPayload<{
  select: typeof focusInsightSessionSelect;
}>;

function fromPrismaFocusSessionDepth(depth: "DEEP" | "SHALLOW"): FocusSessionDepth {
  return depth === "SHALLOW" ? "shallow" : "deep";
}

function toPrismaFocusSessionDepth(depth: FocusSessionDepth) {
  return depth === "shallow" ? "SHALLOW" : "DEEP";
}

function fromPrismaFocusSessionStatus(status: "ACTIVE" | "COMPLETED" | "ABORTED"): FocusSessionItem["status"] {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "COMPLETED":
      return "completed";
    case "ABORTED":
      return "aborted";
  }
}

function fromPrismaFocusSessionExitReason(
  exitReason: "INTERRUPTED" | "LOW_ENERGY" | "UNCLEAR" | "SWITCHED_CONTEXT" | "DONE_ENOUGH" | null,
): FocusSessionExitReason | null {
  switch (exitReason) {
    case "INTERRUPTED":
      return "interrupted";
    case "LOW_ENERGY":
      return "low_energy";
    case "UNCLEAR":
      return "unclear";
    case "SWITCHED_CONTEXT":
      return "switched_context";
    case "DONE_ENOUGH":
      return "done_enough";
    default:
      return null;
  }
}

function toPrismaFocusSessionExitReason(exitReason: FocusSessionExitReason) {
  switch (exitReason) {
    case "interrupted":
      return "INTERRUPTED";
    case "low_energy":
      return "LOW_ENERGY";
    case "unclear":
      return "UNCLEAR";
    case "switched_context":
      return "SWITCHED_CONTEXT";
    case "done_enough":
      return "DONE_ENOUGH";
  }
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function appendLine(currentValue: string | null | undefined, nextLine: string | null) {
  if (!nextLine) {
    return currentValue ?? null;
  }

  return currentValue ? `${currentValue}\n${nextLine}` : nextLine;
}

function buildGoalSummary(goal: FocusSessionRecord["task"]["goal"]) {
  if (!goal) {
    return null;
  }

  return {
    id: goal.id,
    title: goal.title,
    domainId: goal.domainId,
    domain: goal.domain.name,
    domainSystemKey: fromPrismaGoalDomainSystemKey(goal.domain.systemKey),
    status: fromPrismaGoalStatus(goal.status),
    engagementState: fromPrismaGoalEngagementState(goal.engagementState),
  };
}

function serializeFocusSession(session: FocusSessionRecord): FocusSessionItem {
  return {
    id: session.id,
    taskId: session.taskId,
    task: {
      id: session.task.id,
      title: session.task.title,
      nextAction: session.task.nextAction ?? null,
      status: fromPrismaTaskStatus(session.task.status),
      progressState: fromPrismaTaskProgressState(session.task.progressState),
      goalId: session.task.goalId,
      goal: buildGoalSummary(session.task.goal),
      focusLengthMinutes: session.task.focusLengthMinutes ?? null,
      startedAt: session.task.startedAt?.toISOString() ?? null,
      completedAt: session.task.completedAt?.toISOString() ?? null,
    },
    depth: fromPrismaFocusSessionDepth(session.depth),
    plannedMinutes: session.plannedMinutes,
    actualMinutes: getFocusSessionActualMinutes(session.startedAt, session.endedAt),
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
    status: fromPrismaFocusSessionStatus(session.status),
    exitReason: fromPrismaFocusSessionExitReason(session.exitReason),
    distractionNotes: session.distractionNotes ?? null,
    completionNote: session.completionNote ?? null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

function serializeFocusInsightSession(session: FocusInsightSessionRecord) {
  return {
    id: session.id,
    depth: fromPrismaFocusSessionDepth(session.depth),
    plannedMinutes: session.plannedMinutes,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    status: fromPrismaFocusSessionStatus(session.status),
    exitReason: fromPrismaFocusSessionExitReason(session.exitReason),
  };
}

function ensureTaskCanStartFocus(task: FocusSessionRecord["task"] | null) {
  if (!task) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Task not found",
    });
  }

  if (task.kind !== "TASK") {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Only tasks can be used for focus sessions.",
    });
  }

  if (task.status !== "PENDING") {
    throw new AppError({
      statusCode: 409,
      code: "CONFLICT",
      message: "Only pending tasks can start a focus session.",
    });
  }

  return task;
}

function ensureTaskBelongsToUserForFocus(
  task: { id: string; kind: string } | null,
) {
  if (!task) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Task not found",
    });
  }

  if (task.kind !== "TASK") {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Only tasks can use focus insights.",
    });
  }

  return task;
}

function ensureSessionIsActive(session: FocusSessionRecord | null) {
  if (!session) {
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Focus session not found",
    });
  }

  if (session.status !== "ACTIVE") {
    throw new AppError({
      statusCode: 409,
      code: "CONFLICT",
      message: "Focus session has already ended.",
    });
  }

  return session;
}

function nextTaskProgressState(
  currentState: FocusSessionRecord["task"]["progressState"],
  taskOutcome: FocusSessionTaskOutcome,
) {
  if (taskOutcome === "completed" || taskOutcome === "advanced" || currentState === "ADVANCED") {
    return "ADVANCED" as const;
  }

  return "STARTED" as const;
}

export async function getActiveFocusSession(
  prisma: Pick<Prisma.TransactionClient, "focusSession">,
  userId: string,
) {
  const session = await prisma.focusSession.findFirst({
    where: {
      userId,
      status: "ACTIVE",
    },
    include: focusSessionInclude,
    orderBy: {
      startedAt: "desc",
    },
  });

  return session ? serializeFocusSession(session) : null;
}

export async function getFocusTaskInsight(
  prisma: Pick<Prisma.TransactionClient, "focusSession" | "task">,
  userId: string,
  taskId: string,
) {
  const task = ensureTaskBelongsToUserForFocus(await prisma.task.findFirst({
    where: {
      id: taskId,
      userId,
    },
    select: {
      id: true,
      kind: true,
    },
  }));

  const sessions = await prisma.focusSession.findMany({
    where: {
      userId,
      taskId,
      status: {
        in: ["COMPLETED", "ABORTED"],
      },
    },
    orderBy: {
      endedAt: "desc",
    },
    take: 5,
    select: focusInsightSessionSelect,
  });

  return buildFocusTaskInsight(task.id, sessions.map(serializeFocusInsightSession));
}

export async function createFocusSession(
  prisma: Prisma.TransactionClient,
  input: {
    userId: string;
    taskId: string;
    depth: FocusSessionDepth;
    plannedMinutes: number;
  },
) {
  const activeSession = await prisma.focusSession.findFirst({
    where: {
      userId: input.userId,
      status: "ACTIVE",
    },
    include: focusSessionInclude,
  });

  if (activeSession) {
    throw new AppError({
      statusCode: 409,
      code: "CONFLICT",
      message: "Finish the current focus session before starting another one.",
    });
  }

  const task = ensureTaskCanStartFocus(await prisma.task.findFirst({
    where: {
      id: input.taskId,
      userId: input.userId,
    },
    include: planningTaskInclude,
  }));

  const now = new Date();
  if (!task.startedAt || task.progressState === "NOT_STARTED") {
    await prisma.task.update({
      where: {
        id: task.id,
      },
      data: {
        startedAt: task.startedAt ?? now,
        progressState: task.progressState === "NOT_STARTED" ? "STARTED" : undefined,
      },
    });
  }

  const session = await prisma.focusSession.create({
    data: {
      userId: input.userId,
      taskId: input.taskId,
      depth: toPrismaFocusSessionDepth(input.depth),
      plannedMinutes: input.plannedMinutes,
      startedAt: now,
    },
    include: focusSessionInclude,
  });

  return serializeFocusSession(session);
}

export async function captureFocusDistraction(
  prisma: Prisma.TransactionClient,
  input: {
    userId: string;
    sessionId: string;
    note: string;
  },
) {
  const existingSession = ensureSessionIsActive(await prisma.focusSession.findFirst({
    where: {
      id: input.sessionId,
      userId: input.userId,
    },
    include: focusSessionInclude,
  }));

  const session = await prisma.focusSession.update({
    where: {
      id: existingSession.id,
    },
    data: {
      distractionNotes: appendLine(existingSession.distractionNotes, normalizeOptionalText(input.note)),
    },
    include: focusSessionInclude,
  });

  return serializeFocusSession(session);
}

export async function completeFocusSession(
  prisma: Prisma.TransactionClient,
  input: {
    userId: string;
    sessionId: string;
    taskOutcome: FocusSessionTaskOutcome;
    completionNote?: string | null;
  },
) {
  const existingSession = ensureSessionIsActive(await prisma.focusSession.findFirst({
    where: {
      id: input.sessionId,
      userId: input.userId,
    },
    include: focusSessionInclude,
  }));

  const now = new Date();
  await prisma.task.update({
    where: {
      id: existingSession.taskId,
    },
    data: {
      startedAt: existingSession.task.startedAt ?? existingSession.startedAt,
      progressState: nextTaskProgressState(existingSession.task.progressState, input.taskOutcome),
      status: input.taskOutcome === "completed" ? "COMPLETED" : undefined,
      completedAt: input.taskOutcome === "completed" ? now : undefined,
    },
  });

  const session = await prisma.focusSession.update({
    where: {
      id: existingSession.id,
    },
    data: {
      status: "COMPLETED",
      endedAt: now,
      completionNote: normalizeOptionalText(input.completionNote),
    },
    include: focusSessionInclude,
  });

  return serializeFocusSession(session);
}

export async function abortFocusSession(
  prisma: Prisma.TransactionClient,
  input: {
    userId: string;
    sessionId: string;
    exitReason: FocusSessionExitReason;
    note?: string | null;
  },
) {
  const existingSession = ensureSessionIsActive(await prisma.focusSession.findFirst({
    where: {
      id: input.sessionId,
      userId: input.userId,
    },
    include: focusSessionInclude,
  }));

  const note = normalizeOptionalText(input.note);
  const session = await prisma.focusSession.update({
    where: {
      id: existingSession.id,
    },
    data: {
      status: "ABORTED",
      endedAt: new Date(),
      exitReason: toPrismaFocusSessionExitReason(input.exitReason),
      distractionNotes: appendLine(existingSession.distractionNotes, note ? `Exit note: ${note}` : null),
    },
    include: focusSessionInclude,
  });

  return serializeFocusSession(session);
}
