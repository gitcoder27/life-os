export type LandingPagePreference = "home" | "today" | "planner" | "meals";

export const landingPageOptions: Array<{
  value: LandingPagePreference;
  label: string;
  description: string;
}> = [
  {
    value: "home",
    label: "Home",
    description: "Open the command center first.",
  },
  {
    value: "today",
    label: "Today",
    description: "Start in the execution workspace.",
  },
  {
    value: "planner",
    label: "Planner",
    description: "Go straight to the day timeline.",
  },
  {
    value: "meals",
    label: "Meals",
    description: "Jump into the weekly meal planner.",
  },
];

export function resolveLandingPagePath(preference: LandingPagePreference) {
  switch (preference) {
    case "today":
      return "/today";
    case "planner":
      return "/planner";
    case "meals":
      return "/meals";
    case "home":
    default:
      return "/home";
  }
}
