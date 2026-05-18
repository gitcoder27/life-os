import { describe, expect, it } from "vitest";

import {
  readHomeDestinationState,
  resolveHomeActionTarget,
  resolveHomeDestinationTarget,
} from "./homeNavigation";

describe("home navigation helpers", () => {
  it("builds route targets for destinations with search params and state", () => {
    expect(resolveHomeDestinationTarget({
      kind: "today_planning",
      date: "2026-05-03",
    })).toEqual({
      to: {
        pathname: "/planner",
        search: "?planDate=2026-05-03",
      },
    });
    expect(resolveHomeDestinationTarget({
      kind: "today_execute",
    })).toEqual({
      to: "/today",
      state: {
        homeDestination: {
          kind: "today_execute",
        },
      },
    });
  });

  it("resolves actions and validates navigation state defensively", () => {
    expect(resolveHomeActionTarget({
      type: "open_route",
      route: "/finance",
    })).toEqual({ to: "/finance" });
    expect(resolveHomeActionTarget({
      type: "open_destination",
      destination: {
        kind: "review",
        cadence: "weekly",
        date: "2026-05-04",
      },
    })).toEqual({
      to: {
        pathname: "/reviews/weekly",
        search: "?date=2026-05-04",
      },
    });
    expect(readHomeDestinationState(null)).toBeNull();
    expect(readHomeDestinationState({ homeDestination: { kind: "habit_focus" } })).toEqual({
      kind: "habit_focus",
    });
  });
});
