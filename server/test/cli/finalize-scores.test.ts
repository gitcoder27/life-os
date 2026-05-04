import { describe, expect, it, vi } from "vitest";

import {
  parseFinalizeScoresArgs,
  runScoreFinalization,
} from "../../src/cli/finalize-scores.js";

describe("finalize scores CLI", () => {
  it("defaults to the current time when no timestamp is provided", () => {
    const now = new Date("2026-05-05T10:00:00.000Z");

    expect(parseFinalizeScoresArgs([], () => now)).toEqual({ now });
  });

  it("parses explicit --now timestamps", () => {
    expect(parseFinalizeScoresArgs(["--now", "2026-05-05T15:00:00.000Z"]).now.toISOString()).toBe(
      "2026-05-05T15:00:00.000Z",
    );
    expect(parseFinalizeScoresArgs(["--now=2026-05-05"]).now.toISOString()).toBe(
      "2026-05-05T00:00:00.000Z",
    );
  });

  it("rejects unknown or invalid arguments", () => {
    expect(() => parseFinalizeScoresArgs(["--dry-run"])).toThrow(/Unsupported argument/);
    expect(() => parseFinalizeScoresArgs(["--now"])).toThrow(/Missing value/);
    expect(() => parseFinalizeScoresArgs(["--now", "not-a-date"])).toThrow(/Invalid --now/);
  });

  it("runs score finalization with the parsed timestamp", async () => {
    const prisma = {} as any;
    const now = new Date("2026-05-05T15:00:00.000Z");
    const finalizer = vi.fn().mockResolvedValue({ finalizedCount: 3 });

    await expect(runScoreFinalization(prisma, { now }, finalizer)).resolves.toEqual({
      finalizedCount: 3,
    });
    expect(finalizer).toHaveBeenCalledWith(prisma, now);
  });
});
