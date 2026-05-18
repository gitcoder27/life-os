import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearStoredReviewDraft,
  createReviewDraftStorageKey,
  readStoredReviewDraft,
  writeStoredReviewDraft,
} from "./reviewDraftStorage";

const createStorage = () => {
  const values = new Map<string, string>();

  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
    values,
  };
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("review draft storage", () => {
  it("creates stable per-cadence storage keys", () => {
    expect(createReviewDraftStorageKey("daily", "2026-05-03")).toBe(
      "lifeos:review-draft:daily:2026-05-03",
    );
  });

  it("writes and reads versioned drafts", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-03T12:00:00.000Z"));
    const storage = createStorage();
    vi.stubGlobal("localStorage", storage);

    const draft = writeStoredReviewDraft("draft-key", { biggestWin: "Shipped" });

    expect(draft).toEqual({
      version: 1,
      savedAt: "2026-05-03T12:00:00.000Z",
      value: { biggestWin: "Shipped" },
    });
    expect(readStoredReviewDraft<{ biggestWin: string }>("draft-key")).toEqual(draft);
  });

  it("removes malformed draft payloads and ignores storage failures", () => {
    const storage = createStorage();
    storage.values.set("bad-version", JSON.stringify({
      version: 2,
      savedAt: "2026-05-03T12:00:00.000Z",
      value: {},
    }));
    storage.values.set("bad-json", "{");
    vi.stubGlobal("localStorage", storage);

    expect(readStoredReviewDraft("bad-version")).toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith("bad-version");
    expect(readStoredReviewDraft("bad-json")).toBeNull();
    clearStoredReviewDraft("bad-json");
    expect(storage.removeItem).toHaveBeenCalledWith("bad-json");

    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => {
        throw new Error("blocked");
      }),
      setItem: vi.fn(() => {
        throw new Error("blocked");
      }),
      removeItem: vi.fn(() => {
        throw new Error("blocked");
      }),
    });

    expect(readStoredReviewDraft("blocked")).toBeNull();
    expect(writeStoredReviewDraft("blocked", {})).toBeNull();
    expect(() => clearStoredReviewDraft("blocked")).not.toThrow();
  });
});
