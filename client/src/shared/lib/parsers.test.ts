import { describe, expect, it } from "vitest";

import {
  parseAmountToMinor,
  parseNumberValue,
  splitEntries,
  toPriorityInputs,
} from "./parsers";

describe("parsers", () => {
  it("parses loose money and numeric input into stable values", () => {
    expect(parseAmountToMinor("$1,234.56")).toBe(123456);
    expect(parseAmountToMinor("")).toBeNull();
    expect(parseAmountToMinor("abc")).toBeNull();
    expect(parseNumberValue("about 7.5 hours")).toBe(7.5);
    expect(parseNumberValue("none")).toBeNull();
  });

  it("splits free-form entries and caps priority inputs to three slots", () => {
    expect(splitEntries("First, Second\nThird\n\n")).toEqual(["First", "Second", "Third"]);
    expect(toPriorityInputs(["A", "", "B", "C", "D"])).toEqual([
      { slot: 1, title: "A" },
      { slot: 2, title: "B" },
      { slot: 3, title: "C" },
    ]);
  });
});
