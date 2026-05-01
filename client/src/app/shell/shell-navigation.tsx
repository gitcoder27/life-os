import type { ComponentType, SVGProps } from "react";

type ShellIconProps = SVGProps<SVGSVGElement>;

const ShellIcon = ({ children, ...props }: ShellIconProps) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    {children}
  </svg>
);

const HomeIcon = (props: ShellIconProps) => (
  <ShellIcon {...props}>
    <path d="M3.5 8.5 10 3.5l6.5 5v7.25a.75.75 0 0 1-.75.75h-3.5v-4.5h-4.5v4.5h-3.5a.75.75 0 0 1-.75-.75V8.5Z" />
  </ShellIcon>
);

const InboxIcon = (props: ShellIconProps) => (
  <ShellIcon {...props}>
    <path d="M3.25 5.25h13.5v9.5a1 1 0 0 1-1 1H4.25a1 1 0 0 1-1-1v-9.5Z" />
    <path d="M3.25 10.25h3.5l1.5 2h3.5l1.5-2h3.5" />
  </ShellIcon>
);

const TodayIcon = (props: ShellIconProps) => (
  <ShellIcon {...props}>
    <rect x="3.25" y="4.25" width="13.5" height="12.5" rx="2" />
    <path d="M6.25 2.75v3M13.75 2.75v3M3.25 7.25h13.5" />
    <path d="m7.25 11 1.75 1.75 3.75-3.75" />
  </ShellIcon>
);

const PlannerIcon = (props: ShellIconProps) => (
  <ShellIcon {...props}>
    <rect x="3.25" y="4.25" width="13.5" height="12.5" rx="2" />
    <path d="M6 8.25h8M6 11h5.5M6 13.75h6.5" />
    <circle cx="14.5" cy="11" r="1.25" fill="currentColor" stroke="none" />
  </ShellIcon>
);

const HabitsIcon = (props: ShellIconProps) => (
  <ShellIcon {...props}>
    <path d="M6.5 5.5a4.5 4.5 0 0 1 7.4-1.66L15.5 5.5" />
    <path d="M13.5 14.5a4.5 4.5 0 0 1-7.4 1.66L4.5 14.5" />
    <path d="M15.5 3.75V6.5h-2.75M4.5 16.25V13.5h2.75" />
  </ShellIcon>
);

const HealthIcon = (props: ShellIconProps) => (
  <ShellIcon {...props}>
    <path d="M10 16.5s-5.75-3.4-5.75-7.75a3.25 3.25 0 0 1 5.75-2.08A3.25 3.25 0 0 1 15.75 8.75C15.75 13.1 10 16.5 10 16.5Z" />
    <path d="M6.5 10h2l1-2.25L11 12h2.5" />
  </ShellIcon>
);

const MealsIcon = (props: ShellIconProps) => (
  <ShellIcon {...props}>
    <path d="M6 3.5v5.75M4.75 3.5v5.75M7.25 3.5v5.75M6 9.25v7.25" />
    <path d="M12.75 3.5v6a2 2 0 0 0 2 2h.5V16.5" />
  </ShellIcon>
);

const FinanceIcon = (props: ShellIconProps) => (
  <ShellIcon {...props}>
    <rect x="2.75" y="5" width="14.5" height="10" rx="2.25" />
    <path d="M2.75 8.25h14.5M13.75 11.5h1.5" />
    <circle cx="8" cy="11.25" r="1.75" />
  </ShellIcon>
);

const GoalsIcon = (props: ShellIconProps) => (
  <ShellIcon {...props}>
    <circle cx="10" cy="10" r="6.25" />
    <circle cx="10" cy="10" r="3.25" />
    <circle cx="10" cy="10" r="1" fill="currentColor" stroke="none" />
  </ShellIcon>
);

const ReviewsIcon = (props: ShellIconProps) => (
  <ShellIcon {...props}>
    <path d="M5.25 3.5h7.5l2 2v11H5.25a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z" />
    <path d="M12.75 3.5v3h3M7.25 8h5.5M7.25 11h5.5M7.25 14h3.5" />
  </ShellIcon>
);

export const CaptureIcon = (props: ShellIconProps) => (
  <ShellIcon {...props}>
    <path d="M10 4.5v11M4.5 10h11" />
    <circle cx="10" cy="10" r="6.25" />
  </ShellIcon>
);

export const SettingsIcon = (props: ShellIconProps) => (
  <ShellIcon {...props}>
    <path d="M8.7 2.3l.5-1.3h1.6l.5 1.3c.6.2 1.1.6 1.6 1l1.3-.6 1.1 1.1-.6 1.3c.4.4.7.9 1 1.6l1.3.5v1.6l-1.3.5c-.2.6-.6 1.1-1 1.6l.6 1.3-1.1 1.1-1.3-.6c-.4.4-.9.7-1.6 1l-.5 1.3H9.2l-.5-1.3c-.6-.2-1.1-.6-1.6-1l-1.3.6-1.1-1.1.6-1.3c-.4-.4-.7-.9-1-1.6l-1.3-.5V9.4l1.3-.5c.2-.6.6-1.1 1-1.6l-.6-1.3L6.4 5l1.3.6C8 5.2 8.3 4.9 8.7 4.5V2.3z" />
    <circle cx="10" cy="10" r="2.5" />
  </ShellIcon>
);

export const CollapseIcon = (props: ShellIconProps) => (
  <ShellIcon {...props}>
    <path d="m11.5 5.5-4 4 4 4M15.25 5.5l-4 4 4 4" />
  </ShellIcon>
);

export const ExpandIcon = (props: ShellIconProps) => (
  <ShellIcon {...props}>
    <path d="m8.5 5.5 4 4-4 4M4.75 5.5l4 4-4 4" />
  </ShellIcon>
);

export type ShellNavItem = {
  to: string;
  label: string;
  hint: string;
  icon: ComponentType<ShellIconProps>;
};

export const shellNavItems: readonly ShellNavItem[] = [
  { to: "/home", label: "Home", hint: "dashboard and direction", icon: HomeIcon },
  { to: "/inbox", label: "Inbox", hint: "capture triage", icon: InboxIcon },
  { to: "/today", label: "Today", hint: "daily execution workspace", icon: TodayIcon },
  { to: "/planner", label: "Day Planner", hint: "timeline and day design", icon: PlannerIcon },
  { to: "/habits", label: "Habits", hint: "consistency system", icon: HabitsIcon },
  { to: "/health", label: "Health", hint: "body basics", icon: HealthIcon },
  { to: "/meals", label: "Meals", hint: "weekly meal planning", icon: MealsIcon },
  { to: "/finance", label: "Finance", hint: "spend visibility", icon: FinanceIcon },
  { to: "/goals", label: "Goals", hint: "weekly and monthly direction", icon: GoalsIcon },
  { to: "/reviews/daily", label: "Reviews", hint: "reflection loop", icon: ReviewsIcon },
] as const;
