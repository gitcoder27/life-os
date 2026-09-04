// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TodayPage } from "./TodayPage";

const apiMocks = vi.hoisted(() => {
  const refetch = vi.fn();
  const mutate = vi.fn();
  const mutateAsync = vi.fn();
  const emptyDayPlan = {
    tasks: [],
    priorities: [],
    plannerBlocks: [],
    launch: null,
    mustWinTask: null,
    rescueSuggestion: null,
    goalNudges: [],
  };

  return {
    emptyDayPlan,
    mutation: {
      error: null,
      isPending: false,
      mutate,
      mutateAsync,
    },
    query: {
      data: emptyDayPlan,
      error: null,
      isError: false,
      isLoading: false,
      refetch,
    },
    refetch,
  };
});

const todayDataMock = vi.hoisted(() => ({
  today: "2026-05-19",
  isLoading: false,
  isError: false,
  error: null,
  priorities: [],
  launch: null,
  mustWinTask: null,
  rescueSuggestion: null,
  executionTasks: [],
  completedTasks: [],
  taskGroups: [],
  completedTaskCount: 0,
  totalTaskCount: 0,
  quickCaptureTasks: [],
  timedTasks: [],
  goalNudges: [],
  plannerBlocks: [],
  plannedTaskIds: new Set<string>(),
  unplannedTasks: [],
  plannedPendingTaskCount: 0,
  unplannedPendingTaskCount: 0,
  overdueTasks: [],
  overdueTasksQuery: {
    error: null,
    isError: false,
    refetch: vi.fn(),
  },
  completedTodayTasksQuery: {
    error: null,
    isError: false,
    refetch: vi.fn(),
  },
  currentDay: null,
  activeGoals: [],
  score: null,
  scoreQuery: {
    error: null,
    isError: false,
    refetch: vi.fn(),
  },
  healthQuery: {
    error: null,
    isError: false,
    refetch: vi.fn(),
  },
  goalsListQuery: {
    error: null,
    isError: false,
    refetch: vi.fn(),
  },
  dayPlanQuery: {
    data: {
      tasks: [],
      priorities: [],
      plannerBlocks: [],
      launch: null,
      mustWinTask: null,
      rescueSuggestion: null,
      goalNudges: [],
    },
    error: null,
    isError: false,
    isLoading: false,
    refetch: vi.fn(),
  },
  weekPlan: null,
  weekPlanQuery: {
    error: null,
    isError: false,
    refetch: vi.fn(),
  },
  sectionErrors: {
    completedTodayTasks: null,
    goals: null,
    health: null,
    overdueTasks: null,
    score: null,
    weekPlan: null,
  },
  refetchAll: vi.fn(),
}));

const taskActionsMock = vi.hoisted(() => ({
  isPending: false,
  mutationError: null,
  getRescheduleDate: vi.fn(),
  setRescheduleDate: vi.fn(),
  changeStatus: vi.fn(),
  changeStatuses: vi.fn(),
  carryForward: vi.fn(),
  carryForwardTasks: vi.fn(),
  moveToToday: vi.fn(),
  moveToTodayAndReturn: vi.fn(),
  moveTasksToToday: vi.fn(),
  moveToTomorrow: vi.fn(),
  moveTasksToTomorrow: vi.fn(),
  reorderTasks: vi.fn(),
  reschedule: vi.fn(),
  tomorrow: "2026-05-20",
}));

const plannerActionsMock = vi.hoisted(() => ({
  isPending: false,
  mutationError: null,
  addBlock: vi.fn(),
  duplicateBlock: vi.fn(),
  editBlock: vi.fn(),
  removeBlock: vi.fn(),
  reorder: vi.fn(),
  assignTaskToBlock: vi.fn(),
  assignTasksToBlock: vi.fn(),
  removeTaskFromBlock: vi.fn(),
  clearTimeline: vi.fn(),
  unplanTaskIdsFromBlock: vi.fn(),
  unplanPendingTasksFromBlocks: vi.fn(),
  reorderTasksInBlock: vi.fn(),
  moveTaskToBlock: vi.fn(),
  splitBlock: vi.fn(),
  carryPendingTasksToBlock: vi.fn(),
}));

vi.mock("../../shared/lib/api", () => ({
  getTodayDate: () => "2026-05-19",
  useActiveFocusSessionQuery: () => ({
    data: {
      session: null,
    },
    error: null,
    refetch: vi.fn(),
  }),
  useCreateTaskMutation: () => apiMocks.mutation,
  useDayPlanQuery: () => apiMocks.query,
  useHabitCheckinMutation: () => apiMocks.mutation,
  useHabitsQuery: () => ({
    data: {
      dueHabits: [],
      routines: [],
    },
    error: null,
    refetch: vi.fn(),
  }),
  useRoutineCheckinMutation: () => apiMocks.mutation,
  useSkipHabitMutation: () => apiMocks.mutation,
  useUpsertDayLaunchMutation: () => apiMocks.mutation,
}));

vi.mock("./hooks/useTodayData", () => ({
  useTodayData: () => todayDataMock,
}));

vi.mock("./hooks/usePriorityDraft", () => ({
  usePriorityDraft: () => ({
    draft: [],
    mutationError: null,
  }),
}));

vi.mock("./hooks/useTaskActions", () => ({
  useTaskActions: () => taskActionsMock,
}));

vi.mock("./hooks/usePlannerActions", () => ({
  usePlannerActions: () => plannerActionsMock,
}));

vi.mock("./hooks/useAdaptiveToday", () => ({
  useAdaptiveToday: () => ({
    behaviorState: null,
    capacity: null,
    error: null,
    isLoading: false,
    nextMove: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("./helpers/workbench-layout", () => ({
  DEFAULT_WORKBENCH_RAIL_WIDTH: 360,
  clampWorkbenchRailWidth: (width: number) => width,
  clearStoredWorkbenchRailWidth: vi.fn(),
  readStoredWorkbenchRailWidth: () => 360,
  writeStoredWorkbenchRailWidth: vi.fn(),
}));

vi.mock("./components/TodayTopRail", () => ({
  TodayTopRail: ({ commandBarProps, topRailRef }: {
    commandBarProps: {
      mode: "execute" | "plan";
      onModeChange: (mode: "execute" | "plan") => void;
    };
    topRailRef: (node: HTMLDivElement | null) => void;
  }) => (
    <div ref={topRailRef}>
      <span data-testid="today-mode">{commandBarProps.mode}</span>
      <button type="button" onClick={() => commandBarProps.onModeChange("plan")}>
        Plan mode
      </button>
      <button type="button" onClick={() => commandBarProps.onModeChange("execute")}>
        Execute mode
      </button>
    </div>
  ),
}));

vi.mock("./components/TodayExecuteWorkspace", () => ({
  TodayExecuteWorkspace: () => <section>Execute workspace</section>,
}));

vi.mock("./components/TodayPlannerWorkspace", () => ({
  TodayPlannerWorkspace: ({ plannerView }: { plannerView: string }) => (
    <section>Planner workspace: {plannerView}</section>
  ),
}));

vi.mock("./components/DriftRecoverySheet", () => ({
  DriftRecoverySheet: () => null,
}));

vi.mock("./components/TodayTaskCaptureSheet", () => ({
  TodayTaskCaptureSheet: () => null,
}));

vi.mock("./components/ShapeDaySheet", () => ({
  ShapeDaySheet: () => null,
}));

vi.mock("./components/SizeTasksSheet", () => ({
  SizeTasksSheet: () => null,
}));

vi.mock("./components/StartProtocolSheet", () => ({
  StartProtocolSheet: () => null,
}));

vi.mock("../tasks/TaskEditSheet", () => ({
  TaskEditSheet: () => null,
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

const renderToday = (initialEntry = "/today") =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <TodayPage />
      <LocationProbe />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class ResizeObserverMock {
    observe() {
      return undefined;
    }

    disconnect() {
      return undefined;
    }
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("TodayPage", () => {
  it("switches between execute and planner workspaces through the top rail", async () => {
    renderToday();

    expect(await screen.findByText("Execute workspace")).toBeTruthy();
    expect(screen.getByTestId("today-mode").textContent).toBe("execute");
    expect(screen.getByTestId("location").textContent).toBe("/today");

    fireEvent.click(screen.getByRole("button", { name: "Plan mode" }));

    await waitFor(() => {
      expect(screen.getByText("Planner workspace: today")).toBeTruthy();
    });
    expect(screen.getByTestId("today-mode").textContent).toBe("plan");
    expect(screen.getByTestId("location").textContent).toBe("/planner");

    fireEvent.click(screen.getByRole("button", { name: "Execute mode" }));

    await waitFor(() => {
      expect(screen.getByText("Execute workspace")).toBeTruthy();
    });
    expect(screen.getByTestId("today-mode").textContent).toBe("execute");
    expect(screen.getByTestId("location").textContent).toBe("/today");
  });
});
