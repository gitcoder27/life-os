import { describe, expect, it } from "vitest";

import { AppError, isAppError } from "../../src/lib/errors/app-error.js";

describe("AppError", () => {
  it("exposes status and code metadata", () => {
    const error = new AppError({
      statusCode: 401,
      code: "UNAUTHENTICATED",
      message: "Auth required",
      fieldErrors: [{ field: "token", message: "required" }],
    });

    expect(error.statusCode).toBe(401);
    expect(error.code).toBe("UNAUTHENTICATED");
    expect(error.fieldErrors).toEqual([{ field: "token", message: "required" }]);
    expect(error.message).toBe("Auth required");
    expect(error.name).toBe("AppError");
  });

  it("detects AppError instances", () => {
    const error = new AppError({
      statusCode: 500,
      code: "INTERNAL_ERROR",
      message: "Oops",
    });

    expect(isAppError(error)).toBe(true);
    expect(isAppError(new Error("plain"))).toBe(false);
  });
});
