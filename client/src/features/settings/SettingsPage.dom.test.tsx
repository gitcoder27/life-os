// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsPage } from "./SettingsPage";

const apiMocks = vi.hoisted(() => ({
  updateSettings: vi.fn(),
  logout: vi.fn(),
  resetWorkspace: vi.fn(),
  setPreferredTimezone: vi.fn(),
  setPreferredWeekStart: vi.fn(),
  settingsProfile: {
    user: {
      email: "owner@example.com",
      displayName: "Owner",
    },
    preferences: {
      timezone: "UTC",
      currencyCode: "USD",
      weekStartsOn: 1,
      dailyWaterTargetMl: 2000,
      dailyReviewStartTime: "17:00",
      dailyReviewEndTime: "17:30",
      defaultLandingPage: "home",
      notificationPreferences: {
        task: { enabled: true, minSeverity: "warning", repeatCadence: "off" },
        inbox: { enabled: true, minSeverity: "info", repeatCadence: "off" },
        review: { enabled: true, minSeverity: "info", repeatCadence: "hourly" },
        finance: { enabled: true, minSeverity: "warning", repeatCadence: "every_3_hours" },
        health: { enabled: true, minSeverity: "warning", repeatCadence: "off" },
        habit: { enabled: true, minSeverity: "warning", repeatCadence: "off" },
        routine: { enabled: true, minSeverity: "warning", repeatCadence: "off" },
        behavior: { enabled: true, minSeverity: "warning", repeatCadence: "off" },
      },
    },
  },
}));

vi.mock("../../shared/lib/api", () => ({
  setPreferredTimezone: apiMocks.setPreferredTimezone,
  setPreferredWeekStart: apiMocks.setPreferredWeekStart,
  useLogoutMutation: () => ({
    error: null,
    isPending: false,
    mutateAsync: apiMocks.logout,
  }),
  useOnboardingStateQuery: () => ({
    data: {
      isComplete: true,
    },
  }),
  useResetWorkspaceMutation: () => ({
    error: null,
    isPending: false,
    mutateAsync: apiMocks.resetWorkspace,
  }),
  useSettingsProfileQuery: () => ({
    data: apiMocks.settingsProfile,
    error: null,
    isError: false,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useUpdateSettingsProfileMutation: () => ({
    error: null,
    isPending: false,
    mutateAsync: apiMocks.updateSettings,
  }),
}));

vi.mock("./GoalDomainManager", () => ({
  GoalDomainManager: () => <div data-testid="goal-domain-manager" />,
}));

vi.mock("./GoalHorizonManager", () => ({
  GoalHorizonManager: () => <div data-testid="goal-horizon-manager" />,
}));

const renderSettings = () =>
  render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  apiMocks.updateSettings.mockResolvedValue({});
  apiMocks.logout.mockResolvedValue({});
  apiMocks.resetWorkspace.mockResolvedValue({});
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SettingsPage", () => {
  it("saves Behavior notification preferences from the settings UI", async () => {
    renderSettings();

    fireEvent.click(screen.getByLabelText("Enable Behavior notifications"));
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => {
      expect(apiMocks.updateSettings).toHaveBeenCalledWith(expect.objectContaining({
        notificationPreferences: expect.objectContaining({
          behavior: expect.objectContaining({
            enabled: false,
            minSeverity: "warning",
            repeatCadence: "off",
          }),
        }),
      }));
    });
  });
});
