// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProtectedRoute, router } from "./router";

const apiMocks = vi.hoisted(() => ({
  sessionQuery: {
    data: {
      authenticated: false,
    },
    isLoading: false,
  },
  onboardingQuery: {
    data: {
      isComplete: false,
    },
    isLoading: false,
  },
  settingsQuery: {
    data: {
      preferences: {
        defaultLandingPage: "home",
      },
    },
    isError: false,
    isLoading: false,
  },
}));

vi.mock("../shared/lib/api", () => ({
  useOnboardingStateQuery: () => apiMocks.onboardingQuery,
  useSessionQuery: () => apiMocks.sessionQuery,
  useSettingsProfileQuery: () => apiMocks.settingsQuery,
}));

afterEach(() => {
  cleanup();
});

describe("app router", () => {
  it("redirects /reviews to the daily review route", () => {
    const shellRoute = router.routes.find((route) => route.path === "/");
    const reviewsIndexRoute = shellRoute?.children?.find((route) => route.path === "reviews");

    expect(reviewsIndexRoute).toBeTruthy();
    expect(reviewsIndexRoute && "element" in reviewsIndexRoute ? reviewsIndexRoute.element : null).toMatchObject({
      type: Navigate,
      props: {
        to: "/reviews/daily",
        replace: true,
      },
    });
  });

  it("redirects protected routes to login when unauthenticated", async () => {
    render(
      <MemoryRouter initialEntries={["/today"]}>
        <Routes>
          <Route
            path="/today"
            element={(
              <ProtectedRoute>
                <div>Private workspace</div>
              </ProtectedRoute>
            )}
          />
          <Route path="/login" element={<div>Login screen</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Login screen")).toBeTruthy();
    expect(screen.queryByText("Private workspace")).toBeNull();
  });
});
