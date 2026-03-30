export const reviewCadences = {
  daily: {
    label: "Daily",
    title: "Close the day and seed tomorrow",
    description:
      "The daily review should stay short, practical, and tied to carry-forward decisions.",
  },
  weekly: {
    label: "Weekly",
    title: "Review the pattern, not just the day",
    description:
      "Weekly review pulls together score trend, habits, health, and spending so next-week planning is grounded.",
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
    prompts: [
      "How did this month go in one sentence?",
      "What mattered most?",
      "What leaked time, energy, or money?",
      "What is next month's theme?",
      "What three outcomes matter most next month?",
    ],
  },
} as const;

export type ReviewCadenceKey = keyof typeof reviewCadences;

export const reviewCadenceKeys = Object.keys(reviewCadences) as ReviewCadenceKey[];
