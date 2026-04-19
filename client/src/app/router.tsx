import { Navigate, createBrowserRouter } from "react-router-dom";

import { LoginPage } from "../features/auth/LoginPage";
import { FinancePage } from "../features/finance/FinancePage";
import { GoalsPage } from "../features/goals/GoalsPage";
import { HabitsPage } from "../features/habits/HabitsPage";
import { HealthPage } from "../features/health/HealthPage";
import { MealPlannerPage } from "../features/health/MealPlannerPage";
import { HomePage } from "../features/home/HomePage";
import { InboxPage } from "../features/inbox/InboxPage";
import { OnboardingPage } from "../features/onboarding/OnboardingPage";
import { ReviewsPage } from "../features/reviews/ReviewsPage";
import { ReviewHistoryPage } from "../features/reviews/ReviewHistoryPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { TodayPage } from "../features/today/TodayPage";
import {
  useOnboardingStateQuery,
  useSettingsProfileQuery,
  useSessionQuery,
} from "../shared/lib/api";
import { LoadingIndicator } from "../shared/ui/PageState";
import { resolveLandingPagePath } from "../shared/lib/landing-page";
import { AppShell } from "./shell/AppShell";

function RouteLoading() {
  return (
    <div className="auth-layout">
      <div className="auth-layout__panel auth-layout__panel--loading" role="status" aria-live="polite">
        <LoadingIndicator label="Connecting" />
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

function DefaultLandingRoute() {
  const settingsQuery = useSettingsProfileQuery();

  if (settingsQuery.isLoading && !settingsQuery.data) {
    return <RouteLoading />;
  }

  if (settingsQuery.isError || !settingsQuery.data) {
    return <Navigate to="/home" replace />;
  }

  return (
    <Navigate
      to={resolveLandingPagePath(settingsQuery.data.preferences.defaultLandingPage)}
      replace
    />
  );
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
        element: <DefaultLandingRoute />,
      },
      {
        path: "home",
        element: <HomePage />,
      },
      {
        path: "inbox",
        element: <InboxPage />,
      },
      {
        path: "today",
        element: <TodayPage routeMode="execute" />,
      },
      {
        path: "planner",
        element: <TodayPage routeMode="plan" />,
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
        path: "health/meals",
        element: <Navigate to="/meals" replace />,
      },
      {
        path: "meals",
        element: <MealPlannerPage />,
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
        path: "reviews/history",
        element: <ReviewHistoryPage />,
      },
      {
        path: "reviews/:cadence",
        element: <ReviewsPage />,
      },
      {
        path: "settings",
        element: <SettingsPage />,
      },
    ],
  },
]);
