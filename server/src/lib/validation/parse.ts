import type { ApiFieldError } from "@life-os/contracts";
import type { ZodType } from "zod";
import { ZodError } from "zod";

import { AppError } from "../errors/app-error.js";

function toFieldErrors(error: ZodError): ApiFieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path.map(String).join(".") || "root",
    message: issue.message,
  }));
}

export function parseOrThrow<T>(schema: ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    throw new AppError({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      fieldErrors: toFieldErrors(parsed.error),
    });
  }

  return parsed.data;
}
