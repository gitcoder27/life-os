import { z } from "zod";
import { describe, expect, it } from "vitest";

import { AppError } from "../../src/lib/errors/app-error.js";
import { parseOrThrow } from "../../src/lib/validation/parse.js";

const schema = z.object({
  title: z.string().min(1),
  count: z.number().int().positive(),
});

describe("parseOrThrow", () => {
  it("returns parsed data when input is valid", () => {
    expect(parseOrThrow(schema, { title: "task", count: 3 })).toEqual({
      title: "task",
      count: 3,
    });
  });

  it("throws validation AppError with field details when input is invalid", () => {
    try {
      parseOrThrow(schema, { title: "", count: -1 });
      expect.fail("Expected parseOrThrow to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("VALIDATION_ERROR");
      expect((error as AppError).statusCode).toBe(400);
      expect((error as AppError).fieldErrors).toHaveLength(2);
    }
  });
});
