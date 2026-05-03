import { Suspense, lazy } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";
import {
  useOnboardingStateQuery,
  useSettingsProfileQuery,
  useSessionQuery,
} from "../shared/lib/api";
import { BrandMark } from "../shared/ui/BrandMark";
import { LoadingIndicator } from "../shared/ui/PageState";
import { resolveLandingPagePath } from "../shared/lib/landing-page";
import { AppShell } from "./shell/AppShell";

const LoginPage = lazy(() => import("../features/auth/LoginPage").then((module) => ({ default: module.LoginPage })));
const FinancePage = lazy(() => import("../features/finance/FinancePage").then((module) => ({ default: module.FinancePage })));
const GoalsPage = lazy(() => import("../features/goals/GoalsPage").then((module) => ({ default: module.GoalsPage })));
const HabitsPage = lazy(() => import("../features/habits/HabitsPage").then((module) => ({ default: module.HabitsPage })));
const HealthPage = lazy(() => import("../features/health/HealthPage").then((module) => ({ default: module.HealthPage })));
const MealPlannerPage = lazy(() => import("../features/health/MealPlannerPage").then((module) => ({ default: module.MealPlannerPage })));
const HomePage = lazy(() => import("../features/home/HomePage").then((module) => ({ default: module.HomePage })));
const InboxPage = lazy(() => import("../features/inbox/InboxPage").then((module) => ({ default: module.InboxPage })));
const OnboardingPage = lazy(() => import("../features/onboarding/OnboardingPage").then((module) => ({ default: module.OnboardingPage })));
const ReviewsPage = lazy(() => import("../features/reviews/ReviewsPage").then((module) => ({ default: module.ReviewsPage })));
const ReviewHistoryPage = lazy(() => import("../features/reviews/ReviewHistoryPage").then((module) => ({ default: module.ReviewHistoryPage })));
const SettingsPage = lazy(() => import("../features/settings/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const TodayPage = lazy(() => import("../features/today/TodayPage").then((module) => ({ default: module.TodayPage })));

function RouteLoading() {
  return (
    <div className="auth-layout">
      <div className="auth-layout__panel auth-layout__panel--loading" role="status" aria-live="polite">
        <div className="auth-brand auth-brand--loading">
          <BrandMark className="auth-brand__mark" alt="" />
          <div className="auth-brand__copy">
            <span className="page-eyebrow">Connecting</span>
            <span className="auth-brand__name">Life OS</span>
          </div>
        </div>
        <LoadingIndicator label="Connecting" />
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

function lazyRoute(element: JSX.Element) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: (
      <GuestRoute>
        {lazyRoute(<LoginPage />)}
      </GuestRoute>
    ),
  },
  {
    path: "/onboarding",
    element: (
      <ProtectedRoute allowIncompleteOnboarding>
        {lazyRoute(<OnboardingPage />)}
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
        element: lazyRoute(<HomePage />),
      },
      {
        path: "inbox",
        element: lazyRoute(<InboxPage />),
      },
      {
        path: "today",
        element: lazyRoute(<TodayPage routeMode="execute" />),
      },
      {
        path: "planner",
        element: lazyRoute(<TodayPage routeMode="plan" />),
      },
      {
        path: "habits",
        element: lazyRoute(<HabitsPage />),
      },
      {
        path: "health",
        element: lazyRoute(<HealthPage />),
      },
      {
        path: "health/meals",
        element: <Navigate to="/meals" replace />,
      },
      {
        path: "meals",
        element: lazyRoute(<MealPlannerPage />),
      },
      {
        path: "finance",
        element: lazyRoute(<FinancePage />),
      },
      {
        path: "goals",
        element: lazyRoute(<GoalsPage />),
      },
      {
        path: "reviews/history",
        element: lazyRoute(<ReviewHistoryPage />),
      },
      {
        path: "reviews/:cadence",
        element: lazyRoute(<ReviewsPage />),
      },
      {
        path: "settings",
        element: lazyRoute(<SettingsPage />),
      },
    ],
  },
]);
