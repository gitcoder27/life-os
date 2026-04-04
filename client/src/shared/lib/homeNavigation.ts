import type { To } from "react-router-dom";

import type {
  HomeAction,
  HomeDestination,
} from "./api/home";

export type HomeDestinationState = {
  homeDestination?: HomeDestination;
};

export type HomeNavigationTarget = {
  to: To;
  state?: HomeDestinationState;
};

function toSearchString(params: URLSearchParams) {
  const search = params.toString();
  return search ? `?${search}` : "";
}

export function resolveHomeDestinationTarget(destination: HomeDestination): HomeNavigationTarget {
  switch (destination.kind) {
    case "today_planning": {
      const search = new URLSearchParams();
      search.set("mode", "plan");
      search.set("planDate", destination.date);
      return {
        to: {
          pathname: "/today",
          search: toSearchString(search),
        },
      };
    }
    case "today_execute":
      return {
        to: "/today",
        state: {
          homeDestination: destination,
        },
      };
    case "today_overdue": {
      const search = new URLSearchParams();
      search.set("view", "overdue");
      if (destination.taskId) {
        search.set("taskId", destination.taskId);
      }
      return {
        to: {
          pathname: "/today",
          search: toSearchString(search),
        },
      };
    }
    case "inbox_triage":
      return {
        to: "/inbox",
        state: {
          homeDestination: destination,
        },
      };
    case "habit_focus":
      return {
        to: "/habits",
        state: {
          homeDestination: destination,
        },
      };
    case "health_focus":
      return {
        to: "/health",
        state: {
          homeDestination: destination,
        },
      };
    case "finance_bills":
      return {
        to: "/finance",
        state: {
          homeDestination: destination,
        },
      };
    case "goal_plan":
      return {
        to: "/goals",
        state: {
          homeDestination: destination,
        },
      };
    case "review": {
      const search = new URLSearchParams();
      search.set("date", destination.date);
      return {
        to: {
          pathname: `/reviews/${destination.cadence}`,
          search: toSearchString(search),
        },
      };
    }
  }
}

export function resolveHomeActionTarget(action: HomeAction): HomeNavigationTarget {
  switch (action.type) {
    case "open_review":
    case "open_route":
      return {
        to: action.route,
      };
    case "open_destination":
      return resolveHomeDestinationTarget(action.destination);
  }
}

export function readHomeDestinationState(state: unknown): HomeDestination | null {
  if (!state || typeof state !== "object") {
    return null;
  }

  const maybeState = state as HomeDestinationState;
  if (!maybeState.homeDestination || typeof maybeState.homeDestination !== "object") {
    return null;
  }

  const destination = maybeState.homeDestination as Partial<HomeDestination>;
  return typeof destination.kind === "string"
    ? (destination as HomeDestination)
    : null;
}
