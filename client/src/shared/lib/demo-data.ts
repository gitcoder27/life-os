export const navItems = [
  { to: "/", label: "Home", hint: "daily command center" },
  { to: "/today", label: "Today", hint: "execution lane" },
  { to: "/habits", label: "Habits", hint: "consistency system" },
  { to: "/health", label: "Health", hint: "body basics" },
  { to: "/finance", label: "Finance", hint: "spend visibility" },
  { to: "/goals", label: "Goals", hint: "weekly and monthly direction" },
  { to: "/reviews/daily", label: "Reviews", hint: "reflection loop" },
] as const;

export const homeMetrics = [
  { label: "Weekly momentum", value: "74" },
  { label: "Strong day streak", value: "6 days" },
  { label: "Review readiness", value: "Daily open" },
];

export const attentionItems = [
  { title: "Water target trailing", detail: "1.1L behind plan at 6:30 PM" },
  { title: "Third priority still open", detail: "Schedule the final 45 minutes" },
  { title: "Weekly review window opens tomorrow", detail: "Prepare wins and misses" },
];

export const priorityStack = [
  { title: "Finalize repo bootstrap", done: true },
  { title: "Define first backend contracts", done: true },
  { title: "Close the day with review prompts", done: false },
];

export const taskItems = [
  { title: "Review push strategy", detail: "GitHub remote still pending" },
  { title: "Outline API payload gaps", detail: "Onboarding, reviews, Home overview" },
  { title: "Prepare tomorrow top 3", detail: "Daily review will seed them" },
];

export const routines = [
  { title: "Morning routine", detail: "4 of 5 complete" },
  { title: "Evening routine", detail: "1 of 3 complete" },
];

export const healthSnapshot = [
  { label: "Water", value: "2.4L / 3.5L" },
  { label: "Meals", value: "2 meaningful logs" },
  { label: "Workout", value: "Strength session complete" },
  { label: "Body weight", value: "79.8 kg latest" },
];

export const financeSnapshot = [
  { label: "Month spend", value: "$1,280" },
  { label: "Top category", value: "Food and groceries" },
  { label: "Upcoming bill", value: "Internet due in 2 days" },
];

export const todayPlan = {
  priorities: [
    "Publish bootstrap state",
    "Prepare agent handoff",
    "Capture the review rhythm",
  ],
  tasks: [
    { title: "Review auth shell copy", detail: "Keep owner-only framing" },
    { title: "Refine review screen hierarchy", detail: "Summary first, prompts second" },
  ],
  blocks: [
    "07:00 - 09:00 | deep work block",
    "11:00 - 11:45 | workout",
    "20:30 - 20:45 | daily review",
  ],
  planBits: [
    "Lunch template queued",
    "Workout marked complete",
    "Dinner still unplanned",
  ],
};

export const habits = [
  { title: "Morning sunlight", detail: "Streak 9", state: "Complete" },
  { title: "Read 20 min", detail: "Streak 5", state: "Open" },
  { title: "No junk food", detail: "Consistency 81%", state: "Open" },
];

export const goals = [
  { title: "Reach 75 kg with consistent training", domain: "health" },
  { title: "Stabilize monthly spending", domain: "money" },
  { title: "Ship Life OS MVP", domain: "work_growth" },
];

export const onboardingSteps = [
  {
    title: "Life priorities",
    summary: "Capture the areas that should influence the dashboard first.",
    items: ["Health", "Work growth", "Money", "Home admin"],
  },
  {
    title: "Top goals",
    summary: "Seed the first meaningful outcomes.",
    items: ["1 monthly theme", "3 outcomes", "1 focus habit"],
  },
  {
    title: "Routines and habits",
    summary: "Build the minimum default structure.",
    items: ["Morning routine", "Evening routine", "3 daily habits"],
  },
  {
    title: "Health defaults",
    summary: "Set water and workout expectations.",
    items: ["Water target", "Meal logging mode", "Workout cadence"],
  },
  {
    title: "Expense categories",
    summary: "Create enough visibility to start tracking immediately.",
    items: ["Food", "Rent", "Utilities", "Subscriptions"],
  },
  {
    title: "Review preferences",
    summary: "Choose the reflection windows.",
    items: ["Daily review time", "Week start", "Monthly review window"],
  },
];

export const reviewCadences = {
  daily: {
    label: "Daily",
    title: "Close the day and seed tomorrow",
    description:
      "The daily review should stay short, practical, and tied to carry-forward decisions.",
    summary: ["Daily score breakdown", "Open items", "Health snapshot", "Expense logging state"],
    prompts: [
      "What went well today?",
      "What created the most friction?",
      "How was your energy?",
      "What moves to tomorrow?",
      "What are tomorrow's top 3?",
    ],
  },
  weekly: {
    label: "Weekly",
    title: "Review the pattern, not just the day",
    description:
      "Weekly review pulls together score trend, habits, health, and spending so next-week planning is grounded.",
    summary: ["Weekly momentum", "Strong day count", "Top friction tags", "Spend summary"],
    prompts: [
      "What was the biggest win?",
      "What hurt progress most?",
      "What should continue next week?",
      "What should change next week?",
      "Which habit matters most next week?",
    ],
  },
  monthly: {
    label: "Monthly",
    title: "Reset the larger system",
    description:
      "Monthly review should reframe direction and simplify the next month instead of becoming a giant questionnaire.",
    summary: ["Trend overview", "Best and worst weeks", "Goal summary", "Category spend"],
    prompts: [
      "How did this month go in one sentence?",
      "What mattered most?",
      "What leaked time, energy, or money?",
      "What is next month's theme?",
      "What three outcomes matter most next month?",
    ],
  },
} as const;

export const captureTypes = [
  "Task",
  "Expense",
  "Water",
  "Meal",
  "Workout",
  "Weight",
  "Note",
  "Reminder",
];

export const morningRoutine = [
  { title: "Wake at 6:30 AM", done: true },
  { title: "Cold water + vitamins", done: true },
  { title: "Sunlight walk", done: true },
  { title: "Review priorities", done: true },
  { title: "First deep work block", done: false },
];

export const eveningRoutine = [
  { title: "Screen off by 10 PM", done: false },
  { title: "Journal entry", done: false },
  { title: "Prepare tomorrow", done: true },
];

export const waterProgress = { current: 2.4, target: 3.5, unit: "L" };

export const mealLogs = [
  { name: "Breakfast", time: "7:30 AM", logged: true },
  { name: "Lunch", time: "12:30 PM", logged: true },
  { name: "Dinner", time: "7:00 PM", logged: false },
];

export const workoutStatus = {
  type: "Strength",
  status: "Complete",
  duration: "45 min",
};

export const weightLogs = [
  { date: "Mar 14", value: "79.8 kg" },
  { date: "Mar 12", value: "80.0 kg" },
  { date: "Mar 10", value: "80.2 kg" },
  { date: "Mar 8", value: "79.9 kg" },
];

export const financeCategories = [
  { label: "Food & groceries", amount: "$480", pct: 38 },
  { label: "Transport", amount: "$220", pct: 17 },
  { label: "Subscriptions", amount: "$145", pct: 11 },
  { label: "Utilities", amount: "$180", pct: 14 },
  { label: "Health", amount: "$95", pct: 8 },
  { label: "Other", amount: "$160", pct: 12 },
];

export const recentExpenses = [
  { title: "Grocery haul", category: "Food", amount: "$65.40", date: "Today" },
  { title: "Metro pass reload", category: "Transport", amount: "$40.00", date: "Yesterday" },
  { title: "Cloud hosting", category: "Subscriptions", amount: "$12.00", date: "Mar 12" },
  { title: "Pharmacy", category: "Health", amount: "$28.50", date: "Mar 11" },
];

export const recurringExpenses = [
  { title: "Internet", amount: "$59", dueIn: "2 days" },
  { title: "Gym membership", amount: "$45", dueIn: "9 days" },
  { title: "Streaming services", amount: "$32", dueIn: "15 days" },
];

export const scoreBuckets = [
  { label: "Plan", earned: 23, possible: 30 },
  { label: "Routines", earned: 19.5, possible: 25 },
  { label: "Health", earned: 22, possible: 25 },
  { label: "Finance", earned: 0, possible: 0 },
  { label: "Review", earned: 10, possible: 10 },
];

export const weeklyPriorities = [
  "Ship the first usable Life OS build",
  "Stabilize morning routine consistency",
  "Close March spending to under $1,400",
];
