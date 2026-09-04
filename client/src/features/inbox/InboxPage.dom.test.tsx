// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InboxPage } from "./InboxPage";

const apiMocks = vi.hoisted(() => ({
  bulkMutate: vi.fn(),
  commitMutate: vi.fn(),
  inboxData: {
    tasks: [
      {
        id: "task-1",
        title: "Clarify stale capture",
        notes: null,
        kind: "task",
        reminderAt: null,
        status: "pending",
        scheduledForDate: null,
        dueAt: null,
        goalId: null,
        goal: null,
        originType: "quick_capture",
        carriedFromTaskId: null,
        recurrence: null,
        nextAction: null,
        fiveMinuteVersion: null,
        estimatedDurationMinutes: null,
        likelyObstacle: null,
        focusLengthMinutes: null,
        progressState: "not_started",
        todaySortOrder: 0,
        startedAt: null,
        lastStuckAt: null,
        commitmentGuidance: null,
        completedAt: null,
        createdAt: "2026-05-14T08:00:00.000Z",
        updatedAt: "2026-05-14T08:00:00.000Z",
      },
    ],
    counts: {
      all: 1,
      task: 1,
      note: 0,
      reminder: 0,
    },
    nextCursor: null,
  },
  inboxQueryCalls: [] as unknown[],
  updateMutate: vi.fn(),
}));

vi.mock("../../app/providers", () => ({
  useAppFeedback: () => ({
    pushFeedback: vi.fn(),
  }),
}));

vi.mock("../../shared/lib/api", () => ({
  ApiClientError: class MockApiClientError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  getTodayDate: () => "2026-05-19",
  getReminderDate: (value: string | null) => value?.slice(0, 10) ?? null,
  useBulkUpdateTasksMutation: () => ({
    error: null,
    isPending: false,
    mutate: apiMocks.bulkMutate,
  }),
  useCommitTaskMutation: () => ({
    error: null,
    isPending: false,
    mutate: apiMocks.commitMutate,
  }),
  useGoalsListQuery: () => ({
    data: {
      goals: [],
    },
    isLoading: false,
    refetch: vi.fn(),
  }),
  useInboxQuery: (filters: unknown) => {
    apiMocks.inboxQueryCalls.push(filters);

    return {
      data: apiMocks.inboxData,
      error: null,
      isError: false,
      isLoading: false,
      refetch: vi.fn(),
    };
  },
  useUpdateTaskMutation: () => ({
    error: null,
    isPending: false,
    mutate: apiMocks.updateMutate,
  }),
}));

vi.mock("../tasks/TaskEditSheet", () => ({
  TaskEditSheet: () => null,
}));

const renderInbox = () =>
  render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: "/inbox",
          state: {
            homeDestination: {
              kind: "inbox_triage",
              focus: "stale",
            },
          },
        },
      ]}
    >
      <InboxPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  apiMocks.bulkMutate.mockReset();
  apiMocks.commitMutate.mockReset();
  apiMocks.inboxQueryCalls.length = 0;
  apiMocks.updateMutate.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("InboxPage", () => {
  it("honors stale-triage navigation state and can return to newest-first sorting", async () => {
    renderInbox();

    expect(await screen.findByText("Stale triage")).toBeTruthy();
    expect(screen.getByText("Clarify stale capture")).toBeTruthy();
    expect(apiMocks.inboxQueryCalls).toContainEqual(expect.objectContaining({
      sort: "oldest",
    }));

    fireEvent.click(screen.getByRole("button", { name: "View newest first" }));

    await waitFor(() => {
      expect(apiMocks.inboxQueryCalls).toContainEqual(expect.objectContaining({
        sort: "newest",
      }));
    });
    expect(screen.queryByText("Stale triage")).toBeNull();
  });

  it("bulk-schedules selected stale inbox items for today", async () => {
    renderInbox();

    fireEvent.click(await screen.findByLabelText("Select Clarify stale capture"));
    expect(screen.getByText("1 selected")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Do today" }));

    expect(apiMocks.bulkMutate).toHaveBeenCalledWith({
      taskIds: ["task-1"],
      action: {
        type: "schedule",
        scheduledForDate: "2026-05-19",
      },
    });
  });
});
