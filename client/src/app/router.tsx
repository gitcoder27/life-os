import { Navigate, createBrowserRouter } from "react-router-dom";

import { LoginPage } from "../features/auth/LoginPage";
import { FinancePage } from "../features/finance/FinancePage";
import { GoalsPage } from "../features/goals/GoalsPage";
import { HabitsPage } from "../features/habits/HabitsPage";
import { HealthPage } from "../features/health/HealthPage";
import { HomePage } from "../features/home/HomePage";
import { NotificationsPage } from "../features/notifications/NotificationsPage";
import { OnboardingPage } from "../features/onboarding/OnboardingPage";
import { ReviewsPage } from "../features/reviews/ReviewsPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { TodayPage } from "../features/today/TodayPage";
import {
  useOnboardingStateQuery,
  useSessionQuery,
} from "../shared/lib/api";
import { AppShell } from "./shell/AppShell";

function RouteLoading() {
  return (
    <div className="auth-layout">
      <div className="auth-layout__panel">
        <span className="page-eyebrow">Connecting</span>
        <h1 className="auth-layout__title">Checking your session</h1>
        <p className="auth-layout__copy">
          Syncing frontend state with the backend.
        </p>
      </div>
    </div>
  );
}

function GuestRoute({ children }: { children: JSX.Element }) {
  const sessionQuery = useSessionQuery();

  if (sessionQuery.isLoading) {
    return <RouteLoading />;
  }

  if (!sessionQuery.data?.authenticated) {
    return children;
  }

  return <Navigate to="/" replace />;
}

function ProtectedRoute({
  children,
  allowIncompleteOnboarding = false,
}: {
  children: JSX.Element;
  allowIncompleteOnboarding?: boolean;
}) {
  const sessionQuery = useSessionQuery();
  const onboardingQuery = useOnboardingStateQuery(
    allowIncompleteOnboarding && Boolean(sessionQuery.data?.authenticated),
  );

  if (sessionQuery.isLoading) {
    return <RouteLoading />;
  }

  if (!sessionQuery.data?.authenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowIncompleteOnboarding) {
    if (onboardingQuery.isLoading) {
      return <RouteLoading />;
    }

    if (onboardingQuery.data?.isComplete) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: (
      <GuestRoute>
        <LoginPage />
      </GuestRoute>
    ),
  },
  {
    path: "/onboarding",
    element: (
      <ProtectedRoute allowIncompleteOnboarding>
        <OnboardingPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: "today",
        element: <TodayPage />,
      },
      {
        path: "habits",
        element: <HabitsPage />,
      },
      {
        path: "health",
        element: <HealthPage />,
      },
      {
        path: "finance",
        element: <FinancePage />,
      },
      {
        path: "goals",
        element: <GoalsPage />,
      },
      {
        path: "reviews/:cadence",
        element: <ReviewsPage />,
      },
      {
        path: "notifications",
        element: <NotificationsPage />,
      },
      {
        path: "settings",
        element: <SettingsPage />,
      },
    ],
  },
]);
