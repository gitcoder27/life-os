import type { Task } from "@prisma/client";

import { AppError } from "../../lib/errors/app-error.js";

export const TASK_LIST_DEFAULT_LIMIT = 50;

interface TaskListCursorPayload {
  createdAt: string;
  id: string;
}

export type TaskListCursorDirection = "newest" | "oldest";

export function encodeTaskListCursor(task: Pick<Task, "id" | "createdAt">) {
  return Buffer.from(
    JSON.stringify({
      id: task.id,
      createdAt: task.createdAt.toISOString(),
    } satisfies TaskListCursorPayload),
  ).toString("base64url");
}

function decodeTaskListCursor(cursor: string): TaskListCursorPayload {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<TaskListCursorPayload>;

    if (
      !parsed ||
      typeof parsed.id !== "string" ||
      typeof parsed.createdAt !== "string" ||
      Number.isNaN(new Date(parsed.createdAt).getTime())
    ) {
      throw new Error("Invalid cursor payload");
    }

    return parsed as TaskListCursorPayload;
  } catch {
    throw new AppError({
      statusCode: 400,
      code: "BAD_REQUEST",
      message: "Invalid task cursor",
    });
  }
}

export function buildTaskListCursorWhere(cursor: string, direction: TaskListCursorDirection = "newest") {
  const decoded = decodeTaskListCursor(cursor);
  const createdAt = new Date(decoded.createdAt);
  const createdAtOperator = direction === "oldest" ? "gt" : "lt";
  const idOperator = direction === "oldest" ? "gt" : "lt";

  return {
    OR: [
      {
        createdAt: {
          [createdAtOperator]: createdAt,
        },
      },
      {
        createdAt,
        id: {
          [idOperator]: decoded.id,
        },
      },
    ],
  };
}
