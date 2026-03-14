import type { ApiErrorCode, ApiFieldError } from "@life-os/contracts";

interface AppErrorOptions {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
  fieldErrors?: ApiFieldError[];
}

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ApiErrorCode;
  readonly fieldErrors?: ApiFieldError[];

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = "AppError";
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.fieldErrors = options.fieldErrors;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
