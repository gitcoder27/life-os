import { afterEach, describe, expect, it } from "vitest";

import { setPreferredTimezone } from "./date";
import {
  getQuickCaptureDisplayText,
  getQuickCaptureText,
  isQuickCaptureReferenceTask,
} from "./quickCapture";

afterEach(() => {
  setPreferredTimezone("");
});

describe("quick capture helpers", () => {
  it("identifies quick-capture reference notes and reminders", () => {
    expect(isQuickCaptureReferenceTask({ originType: "quick_capture", kind: "note" })).toBe(true);
    expect(isQuickCaptureReferenceTask({ originType: "quick_capture", kind: "reminder" })).toBe(true);
    expect(isQuickCaptureReferenceTask({ originType: "quick_capture", kind: "task" })).toBe(false);
    expect(isQuickCaptureReferenceTask({ originType: "manual", kind: "note" })).toBe(false);
  });

  it("uses trimmed notes with a fallback for display text", () => {
    expect(getQuickCaptureText({ notes: "  capture this  " })).toBe("capture this");
    expect(getQuickCaptureText({ notes: " " }, "Fallback")).toBe("Fallback");
    expect(getQuickCaptureDisplayText({ kind: "note", notes: "", reminderAt: null }, "Untitled")).toBe("Untitled");
  });

  it("includes reminder date context when available", () => {
    setPreferredTimezone("UTC");

    expect(
      getQuickCaptureDisplayText({
        kind: "reminder",
        notes: "Call bank",
        reminderAt: "2026-05-03T15:30:00.000Z",
      }),
    ).toBe("Reminder for 2026-05-03: Call bank");
    expect(
      getQuickCaptureDisplayText({
        kind: "reminder",
        notes: "",
        reminderAt: null,
      }),
    ).toBe("Reminder: Reminder");
  });
});
