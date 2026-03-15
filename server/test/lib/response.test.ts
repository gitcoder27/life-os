import { describe, expect, it } from "vitest";

import { getGeneratedAt, withGeneratedAt, withWriteSuccess } from "../../src/lib/http/response.js";

describe("HTTP response helpers", () => {
  it("adds generatedAt to any payload", () => {
    const response = withGeneratedAt({ value: "ok" });

    expect(response.value).toBe("ok");
    expect(typeof response.generatedAt).toBe("string");
    expect(new Date(response.generatedAt).toISOString()).toBe(response.generatedAt);
  });

  it("adds write-success envelope with generatedAt", () => {
    const response = withWriteSuccess({ userId: "user-1" });

    expect(response.success).toBe(true);
    expect(response.userId).toBe("user-1");
    expect(typeof response.generatedAt).toBe("string");
  });

  it("returns current generated time from getGeneratedAt", () => {
    const generatedAt = getGeneratedAt();

    expect(new Date(generatedAt).toISOString()).toBe(generatedAt);
  });
});
