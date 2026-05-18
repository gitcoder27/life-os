import { describe, expect, it } from "vitest";

import {
  deriveReviewWindowPresentation,
  isAlreadySubmittedError,
  isOutOfWindowError,
} from "./reviewWindowModel";

describe("review window model", () => {
  it("builds open daily and weekly presentation copy", () => {
    expect(deriveReviewWindowPresentation({
      isOpen: true,
      status: "open",
      requestedDate: "2026-05-03",
      allowedDate: "2026-05-03",
      opensAt: "2026-05-03T08:00:00",
      closesAt: "2026-05-03T09:00:00",
      timezone: "UTC",
    }, "daily")).toMatchObject({
      isOpen: true,
      tagLabel: "Open",
      tagVariant: "positive",
      headline: expect.stringContaining("Morning grace window"),
      allowedDate: "2026-05-03",
    });
    expect(deriveReviewWindowPresentation({
      isOpen: true,
      status: "open",
      requestedDate: "2026-05-04",
      allowedDate: "2026-05-04",
      opensAt: null,
      closesAt: null,
      timezone: "UTC",
    }, "weekly")).toMatchObject({
      headline: "Weekly review window is open",
      description: "The weekly review is ready for submission",
    });
  });

  it("describes closed, early, wrong-period, and missing windows", () => {
    expect(deriveReviewWindowPresentation({
      isOpen: false,
      status: "too_early",
      requestedDate: "2026-05-03",
      allowedDate: "2026-05-03",
      opensAt: "2026-05-03T18:00:00",
      closesAt: null,
      timezone: "UTC",
    }, "daily")).toMatchObject({
      tagLabel: "Too early",
      tagVariant: "warning",
      headline: "This review period is not open yet",
    });
    expect(deriveReviewWindowPresentation({
      isOpen: false,
      status: "too_late",
      requestedDate: "2026-05-03",
      allowedDate: "2026-05-03",
      opensAt: null,
      closesAt: "2026-05-04T09:00:00",
      timezone: "UTC",
    }, "daily")).toMatchObject({
      tagLabel: "Closed",
      tagVariant: "negative",
    });
    expect(deriveReviewWindowPresentation({
      isOpen: false,
      status: "wrong_period",
      requestedDate: "2026-04-01",
      allowedDate: "2026-05-01",
      opensAt: null,
      closesAt: null,
      timezone: "UTC",
    }, "monthly")).toMatchObject({
      tagLabel: "Wrong period",
      tagVariant: "warning",
      description: expect.stringContaining("open monthly review"),
    });
    expect(deriveReviewWindowPresentation({
      isOpen: false,
      status: "no_open_window",
      requestedDate: "2026-05-03",
      allowedDate: null,
      opensAt: null,
      closesAt: null,
      timezone: "UTC",
    }, "daily")).toMatchObject({
      tagLabel: "Closed",
      tagVariant: "neutral",
      headline: "No daily review window is open right now",
    });
  });

  it("detects review API error codes", () => {
    expect(isOutOfWindowError({ code: "REVIEW_OUT_OF_WINDOW" })).toBe(true);
    expect(isOutOfWindowError({ code: "OTHER" })).toBe(false);
    expect(isAlreadySubmittedError({ code: "REVIEW_ALREADY_SUBMITTED" })).toBe(true);
    expect(isAlreadySubmittedError(null)).toBe(false);
  });
});
