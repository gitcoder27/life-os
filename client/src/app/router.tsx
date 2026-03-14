import { createBrowserRouter } from "react-router-dom";

import { LoginPage } from "../features/auth/LoginPage";
import { FinancePage } from "../features/finance/FinancePage";
import { GoalsPage } from "../features/goals/GoalsPage";
import { HabitsPage } from "../features/habits/HabitsPage";
import { HealthPage } from "../features/health/HealthPage";
import { HomePage } from "../features/home/HomePage";
import { OnboardingPage } from "../features/onboarding/OnboardingPage";
import { ReviewsPage } from "../features/reviews/ReviewsPage";
import { TodayPage } from "../features/today/TodayPage";
import { AppShell } from "./shell/AppShell";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/onboarding",
    element: <OnboardingPage />,
  },
  {
    path: "/",
    element: <AppShell />,
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
    ],
  },
]);
