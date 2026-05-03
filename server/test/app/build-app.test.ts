import { describe, expect, it } from "vitest";

import { buildApiErrorResponse } from "../../src/app/build-app.js";
import { AppError } from "../../src/lib/errors/app-error.js";

describe("buildApiErrorResponse", () => {
  it("redacts unexpected internal 500 messages from client responses", () => {
    const response = buildApiErrorResponse(
      new Error("Prisma failed with DATABASE_URL=postgresql://user:pass@host/db"),
      500,
      "2026-05-03T00:00:00.000Z",
    );

    expect(response).toEqual({
      success: false,
      code: "INTERNAL_ERROR",
      message: "Unexpected server error",
      fieldErrors: undefined,
      generatedAt: "2026-05-03T00:00:00.000Z",
    });
  });

  it("preserves known AppError messages and fields", () => {
    const response = buildApiErrorResponse(
      new AppError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        fieldErrors: [{ field: "date", message: "Invalid date" }],
      }),
      400,
      "2026-05-03T00:00:00.000Z",
    );

    expect(response).toEqual({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      fieldErrors: [{ field: "date", message: "Invalid date" }],
      generatedAt: "2026-05-03T00:00:00.000Z",
    });
  });
});
