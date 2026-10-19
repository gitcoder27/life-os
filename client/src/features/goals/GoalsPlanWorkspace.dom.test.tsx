// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  GoalDetailItem,
  GoalDomainItem,
  GoalHorizonItem,
  GoalOverviewItem,
  GoalsWorkspaceTodayAlignment,
  MonthPlanResponse,
  WeekPlanResponse,
} from "../../shared/lib/api";
import { emptyGoalForm } from "./GoalFormDialog";
import { NODE_H, NODE_W } from "./goal-graph-layout";
import { GOAL_DRAG_MIME } from "./GoalsPlanCommitmentsRail";
import { GoalsPlanWorkspace } from "./GoalsPlanWorkspace";

/* ── Fixture ── */

const timestamp = "2026-10-01T00:00:00.000Z";

const domains: GoalDomainItem[] = [
  { id: "domain-health", systemKey: "health", name: "Health", sortOrder: 1, isArchived: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "domain-work", systemKey: "work_growth", name: "Work", sortOrder: 2, isArchived: false, createdAt: timestamp, updatedAt: timestamp },
];

const horizons: GoalHorizonItem[] = [
  { id: "h-year", systemKey: "one_year", name: "1 year", sortOrder: 1, spanMonths: 12, isArchived: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "h-quarter", systemKey: "quarter", name: "Quarter", sortOrder: 2, spanMonths: 3, isArchived: false, createdAt: timestamp, updatedAt: timestamp },
];

const goal = (
  id: string,
  title: string,
  sortOrder: number,
  overrides: Partial<GoalOverviewItem>,
): GoalOverviewItem => ({
  id,
  title,
  domainId: "domain-work",
  domain: "Work",
  domainSystemKey: "work_growth",
  status: "active",
  engagementState: null,
  horizonId: "h-year",
  horizonName: "1 year",
  horizonSystemKey: "one_year",
  horizonSpanMonths: 12,
  parentGoalId: null,
  why: null,
  targetDate: null,
  notes: null,
  weeklyProofText: null,
  knownObstacle: null,
  parkingRule: null,
  sortOrder,
  createdAt: timestamp,
  updatedAt: timestamp,
  progressPercent: 0,
  health: "on_track",
  nextBestAction: null,
  milestoneCounts: { total: 0, completed: 0, pending: 0, overdue: 0 },
  momentum: { trend: "steady", buckets: [] },
  linkedSummary: {
    currentDayPriorities: 0,
    currentWeekPriorities: 0,
    currentMonthPriorities: 0,
    pendingTasks: 0,
    activeHabits: 0,
    dueHabitsToday: 0,
  },
  lastActivityAt: null,
  ...overrides,
});

const healthDomain = { domainId: "domain-health", domain: "Health", domainSystemKey: "health" } as const;
const quarterHorizon = { horizonId: "h-quarter", horizonName: "Quarter", horizonSystemKey: "quarter", horizonSpanMonths: 3 } as const;

const goals: GoalOverviewItem[] = [
  goal("g-marathon", "Run a marathon", 1, healthDomain),
  goal("g-base", "Build a running base", 2, { ...healthDomain, ...quarterHorizon, parentGoalId: "g-marathon" }),
  goal("g-consultancy", "Grow the consultancy", 3, {}),
  goal("g-clients", "Sign two new clients", 4, { ...quarterHorizon, parentGoalId: "g-consultancy" }),
];

const goalById = new Map(goals.map((item) => [item.id, item]));

const monthPlan: MonthPlanResponse = {
  generatedAt: timestamp,
  startDate: "2026-10-01",
  endDate: "2026-10-31",
  theme: null,
  topOutcomes: [
    {
      id: "month-1",
      slot: 1,
      title: "Finish the base block",
      status: "pending",
      goalId: "g-base",
      goal: {
        id: "g-base",
        title: "Build a running base",
        domainId: "domain-health",
        domain: "Health",
        domainSystemKey: "health",
        status: "active",
        engagementState: null,
      },
      completedAt: null,
    },
  ],
};

const weekPlan: WeekPlanResponse = {
  generatedAt: timestamp,
  startDate: "2026-10-19",
  endDate: "2026-10-25",
  priorities: [],
  capacityProfile: { capacityMode: "standard", deepWorkBlockTarget: 4 },
  capacityAssessment: {
    status: "healthy",
    plannedPriorityCount: 0,
    scheduledTaskCount: 0,
    estimatedMinutesTotal: 0,
    unsizedTaskCount: 0,
    focusGoalCount: 0,
    primaryMessage: "Room to plan.",
    signals: [],
  },
  capacityProgress: {
    completedDeepBlocks: 1,
    remainingDeepBlocks: 3,
    overBudgetBlocks: 0,
    status: "within_budget",
    message: "On budget.",
  },
};

const todayAlignment: GoalsWorkspaceTodayAlignment = {
  date: "2026-10-19",
  priorities: [],
  tasks: [],
  representedGoalIds: [],
};

const toGoalDetail = (goalId: string): GoalDetailItem => ({
  ...goalById.get(goalId)!,
  milestones: [],
  parent: null,
  children: [],
  ancestors: [],
  linkedPriorities: [],
  currentWeekPriorities: [],
  currentMonthOutcomes: [],
  linkedTasks: [],
  linkedHabits: [],
});

/* ── API mocks ── */

const apiMocks = vi.hoisted(() => ({
  mutation: {
    error: null,
    isPending: false,
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
  },
  refetch: vi.fn(),
}));

vi.mock("../../shared/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../shared/lib/api")>()),
  useCreateGoalMutation: () => apiMocks.mutation,
  useUpdateGoalMutation: () => apiMocks.mutation,
  useUpdateMonthFocusMutation: () => apiMocks.mutation,
  useUpdateWeekPrioritiesMutation: () => apiMocks.mutation,
  useUpdateWeekCapacityMutation: () => apiMocks.mutation,
  useUpdateGoalMilestonesMutation: () => apiMocks.mutation,
  useUpdateDayPrioritiesMutation: () => apiMocks.mutation,
  useDayPlanQuery: () => ({
    data: { priorities: [] },
    error: null,
    isError: false,
    isLoading: false,
    refetch: apiMocks.refetch,
  }),
  useGoalDetailQuery: (goalId: string) => ({
    data: { generatedAt: timestamp, contextDate: "2026-10-19", goal: toGoalDetail(goalId) },
    error: null,
    isError: false,
    isLoading: false,
    refetch: apiMocks.refetch,
  }),
}));

/* ── Harness ── */

const onOpenCreateGoal = vi.fn();
const noop = () => undefined;
const childForm = emptyGoalForm();

/* Selection is owned by GoalsPage; the harness keeps it in state the same way. */
function PlanHarness({ goalList = goals }: { goalList?: GoalOverviewItem[] }) {
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  return (
    <GoalsPlanWorkspace
      goals={goalList}
      domains={domains}
      horizons={horizons}
      weekPlan={weekPlan}
      monthPlan={monthPlan}
      todayAlignment={todayAlignment}
      selectedGoalId={selectedGoalId}
      onSelectGoal={setSelectedGoalId}
      onClearSelectedGoal={() => setSelectedGoalId(null)}
      onOpenCreateGoal={onOpenCreateGoal}
      onEditGoal={noop}
      onStartCreateChild={noop}
      showChildForm={false}
      childFormParent={null}
      childForm={childForm}
      onChangeChildForm={noop}
      onSubmitChildForm={noop}
      onCancelChildForm={noop}
      createIsPending={false}
    />
  );
}

const renderPlan = () =>
  render(
    <MemoryRouter>
      <PlanHarness />
    </MemoryRouter>,
  );

/* Keys go to <body> (nothing focused) unless a target is given; the map's
   keyboard handler listens on window. */
const pressKey = (key: string, target: Element = document.body) => {
  fireEvent.keyDown(target, { key });
};

const goalNode = (title: string) => screen.getByRole("treeitem", { name: new RegExp(`^${title}`) });

const selectedGoalTitles = () =>
  screen
    .queryAllByRole("treeitem")
    .filter((node) => node.getAttribute("aria-selected") === "true")
    .map((node) => node.querySelector(".graph-goal-node__title")?.textContent);

const monthLabel = new Date(`${monthPlan.startDate}T12:00:00`).toLocaleDateString(undefined, { month: "long" });

const monthLane = () => screen.getByRole("heading", { name: monthLabel }).closest("section") as HTMLElement;

const focusButton = () => screen.getByRole("button", { name: /^Focus/ });

const focusPanel = () => screen.queryByRole("complementary", { name: "Month and week focus" });

/* happy-dom has no DataTransfer for synthetic drag events; this carries the
   goal id the way the browser would. */
const goalDataTransfer = () => {
  const data = new Map<string, string>();
  return {
    types: [GOAL_DRAG_MIME],
    effectAllowed: "all",
    dropEffect: "none",
    setData: (type: string, value: string) => data.set(type, value),
    getData: (type: string) => data.get(type) ?? "",
  };
};

const shortcutSheet = () => screen.queryByRole("dialog", { name: "Keyboard shortcuts and legend" });

/* React Flow measures the pane and every node through ResizeObserver and
   offsetWidth/offsetHeight, and reads zoom from DOMMatrixReadOnly. happy-dom
   has no layout, so report a 1200×800 pane and node-sized nodes; otherwise the
   nodes stay visibility: hidden. */
class ResizeObserverMock {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element) {
    this.callback([{ target } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }

  unobserve() {
    return undefined;
  }

  disconnect() {
    return undefined;
  }
}

class DOMMatrixReadOnlyMock {
  m22: number;

  constructor(transform?: string) {
    const scale = transform?.match(/scale\(([\d.]+)\)/)?.[1];
    this.m22 = scale !== undefined ? Number(scale) : 1;
  }
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  vi.stubGlobal("DOMMatrixReadOnly", DOMMatrixReadOnlyMock);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) {
    return this.classList.contains("react-flow") ? 1200 : NODE_W;
  });
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
    return this.classList.contains("react-flow") ? 800 : NODE_H;
  });
  apiMocks.mutation.mutateAsync.mockResolvedValue({});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

/* ── Tests ── */

describe("GoalsPlanWorkspace map", () => {
  it("renders the fixture's active goals as map nodes", () => {
    renderPlan();

    expect(screen.getAllByRole("treeitem")).toHaveLength(goals.length);
    expect(goalNode("Build a running base").getAttribute("aria-label")).toContain("month slot M1");
    expect(selectedGoalTitles()).toEqual([]);
  });

  /* The nodes handle their own clicks, toggles and HTML drag. React Flow sets
     pointer-events: none on node wrappers it thinks are inert, which made
     every click and drag fall through to the canvas pan. */
  it("keeps every node wrapper hit-testable", () => {
    const { container } = renderPlan();

    const wrappers = Array.from(container.querySelectorAll<HTMLElement>(".react-flow__node"));
    expect(wrappers).toHaveLength(goals.length);
    for (const wrapper of wrappers) {
      expect(wrapper.style.pointerEvents).toBe("all");
    }
  });

  it("selects a goal that appears after the first load", () => {
    const { rerender } = renderPlan();
    expect(selectedGoalTitles()).toEqual([]);

    const added = goal("g-book", "Write the book", 5, {});
    rerender(
      <MemoryRouter>
        <PlanHarness goalList={[...goals, added]} />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole("treeitem")).toHaveLength(goals.length + 1);
    expect(selectedGoalTitles()).toEqual(["Write the book"]);
  });

  it("moves the stage into document.body for full screen and back on Esc", () => {
    const { container } = renderPlan();
    const inlineStage = container.querySelector(".ghq-stage-slot .ghq-stage");
    expect(inlineStage).not.toBeNull();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search goals" }), { target: { value: "run" } });

    fireEvent.click(screen.getByRole("button", { name: "Full screen" }));

    const fullscreenStage = document.querySelector(".ghq-stage--fullscreen");
    expect(fullscreenStage).not.toBeNull();
    expect(fullscreenStage?.parentElement?.parentElement).toBe(document.body);
    expect(fullscreenStage?.closest(".ghq-stage-slot")).toBeNull();
    expect(container.contains(fullscreenStage)).toBe(false);
    expect(document.body.classList.contains("ghq-fullscreen-body")).toBe(true);
    // Same element, so the map stayed mounted and kept its search.
    expect(fullscreenStage).toBe(inlineStage);
    expect((screen.getByPlaceholderText("Search goals") as HTMLInputElement).value).toBe("run");
    expect(screen.getByRole("button", { name: "Exit full screen" })).toBeTruthy();

    pressKey("Escape");

    expect(document.querySelector(".ghq-stage--fullscreen")).toBeNull();
    expect(document.body.classList.contains("ghq-fullscreen-body")).toBe(false);
    expect(container.querySelector(".ghq-stage-slot .ghq-stage")).toBe(inlineStage);
  });

  it("toggles full screen with F when nothing is focused", () => {
    const { container } = renderPlan();
    expect(document.activeElement).toBe(document.body);

    pressKey("f");

    const fullscreenStage = document.querySelector(".ghq-stage--fullscreen");
    expect(fullscreenStage).not.toBeNull();
    expect(fullscreenStage?.closest(".ghq-stage-slot")).toBeNull();
    expect(document.body.classList.contains("ghq-fullscreen-body")).toBe(true);

    pressKey("f");

    expect(document.querySelector(".ghq-stage--fullscreen")).toBeNull();
    expect(container.querySelector(".ghq-stage-slot .ghq-stage")).not.toBeNull();
    expect(document.body.classList.contains("ghq-fullscreen-body")).toBe(false);
  });

  it("adds the selected goal to the first open month slot with M, without opening anything", async () => {
    renderPlan();

    fireEvent.click(goalNode("Grow the consultancy"));
    expect(selectedGoalTitles()).toEqual(["Grow the consultancy"]);

    pressKey("m");

    // M1 is taken, so the goal lands in M2 with its title as the first wording.
    expect(apiMocks.mutation.mutateAsync).toHaveBeenCalledWith({
      theme: null,
      topOutcomes: [
        { id: "month-1", slot: 1, title: "Finish the base block", goalId: "g-base" },
        { id: undefined, slot: 2, title: "Grow the consultancy", goalId: "g-consultancy" },
      ],
    });
    expect(await screen.findByText(`Added “Grow the consultancy” to ${monthLabel} as M2.`)).toBeTruthy();
    expect(focusPanel()).toBeNull();
    expect(selectedGoalTitles()).toEqual(["Grow the consultancy"]);
  });

  it("does not add a goal twice; it says where the goal already is", async () => {
    renderPlan();

    fireEvent.click(goalNode("Build a running base"));
    pressKey("m");

    expect(apiMocks.mutation.mutateAsync).not.toHaveBeenCalled();
    expect(await screen.findByText(`“Build a running base” is already in ${monthLabel} as M1.`)).toBeTruthy();
  });

  it("opens Focus from the toolbar and closes it with Esc, keeping the selection", () => {
    renderPlan();
    expect(focusPanel()).toBeNull();
    expect(focusButton().textContent).toContain("1/3 · 0/3");

    fireEvent.click(goalNode("Sign two new clients"));
    fireEvent.click(focusButton());

    expect(focusPanel()).not.toBeNull();
    expect(focusButton().getAttribute("aria-pressed")).toBe("true");
    expect(within(monthLane()).getByText("Finish the base block")).toBeTruthy();

    pressKey("Escape");

    expect(focusPanel()).toBeNull();
    expect(selectedGoalTitles()).toEqual(["Sign two new clients"]);
  });

  it("shows month and week drop targets while a goal is dragged and adds it on drop", () => {
    renderPlan();
    const dataTransfer = goalDataTransfer();
    expect(screen.queryByText("Add to this week")).toBeNull();

    fireEvent.dragStart(goalNode("Run a marathon"), { dataTransfer });

    const weekTarget = screen.getByText("Add to this week").parentElement as HTMLElement;
    expect(screen.getByText(`Add to ${monthLabel}`)).toBeTruthy();

    fireEvent.dragOver(weekTarget, { dataTransfer });
    fireEvent.drop(weekTarget, { dataTransfer });

    expect(apiMocks.mutation.mutateAsync).toHaveBeenCalledWith({
      priorities: [{ id: undefined, slot: 1, title: "Run a marathon", goalId: "g-marathon" }],
    });

    fireEvent.dragEnd(goalNode("Run a marathon"), { dataTransfer });
    expect(screen.queryByText("Add to this week")).toBeNull();
  });

  it("peels Esc one layer at a time: details, then the selection", () => {
    renderPlan();

    fireEvent.doubleClick(goalNode("Run a marathon"));

    const details = screen.getByRole("complementary", { name: "Goal details" });
    expect(within(details).getByRole("heading", { name: "Run a marathon" })).toBeTruthy();
    expect(selectedGoalTitles()).toEqual(["Run a marathon"]);

    pressKey("Escape");

    // The map stands alone again: no side column until Focus or details opens.
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(selectedGoalTitles()).toEqual(["Run a marathon"]);

    pressKey("Escape");

    expect(selectedGoalTitles()).toEqual([]);
  });

  it("jumps to search matches in tree order on Enter", () => {
    renderPlan();
    const search = screen.getByRole("searchbox", { name: "Search goals" });

    fireEvent.change(search, { target: { value: "run" } });
    expect(screen.getByText("2 found")).toBeTruthy();
    expect(selectedGoalTitles()).toEqual([]);

    pressKey("Enter", search);

    expect(screen.getByText("1 of 2")).toBeTruthy();
    expect(goalNode("Run a marathon").getAttribute("aria-selected")).toBe("true");
    expect(selectedGoalTitles()).toEqual(["Run a marathon"]);

    pressKey("Enter", search);

    expect(screen.getByText("2 of 2")).toBeTruthy();
    expect(selectedGoalTitles()).toEqual(["Build a running base"]);
  });

  it("ignores map shortcuts while a modal dialog is open", () => {
    renderPlan();
    fireEvent.click(goalNode("Grow the consultancy"));

    const modal = document.createElement("div");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    document.body.appendChild(modal);

    try {
      for (const key of ["f", "?", "m", "w", "n", "Escape"]) {
        pressKey(key);
      }

      expect(document.querySelector(".ghq-stage--fullscreen")).toBeNull();
      expect(document.body.classList.contains("ghq-fullscreen-body")).toBe(false);
      expect(shortcutSheet()).toBeNull();
      expect(apiMocks.mutation.mutateAsync).not.toHaveBeenCalled();
      expect(onOpenCreateGoal).not.toHaveBeenCalled();
      expect(selectedGoalTitles()).toEqual(["Grow the consultancy"]);
    } finally {
      modal.remove();
    }

    // With the modal gone the same keys work again.
    pressKey("?");
    expect(shortcutSheet()).not.toBeNull();
  });

  it("toggles the shortcut sheet with ? and closes it with Esc before touching the selection", () => {
    renderPlan();

    pressKey("?");
    expect(shortcutSheet()).not.toBeNull();

    pressKey("?");
    expect(shortcutSheet()).toBeNull();

    fireEvent.click(goalNode("Sign two new clients"));
    pressKey("?");
    expect(shortcutSheet()).not.toBeNull();

    pressKey("Escape");

    expect(shortcutSheet()).toBeNull();
    expect(selectedGoalTitles()).toEqual(["Sign two new clients"]);
  });
});
