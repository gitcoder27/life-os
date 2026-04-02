export const goalSummaryInclude = {
  domain: true,
} as const;

export const planningTaskInclude = {
  goal: {
    include: goalSummaryInclude,
  },
  recurrenceRule: {
    include: {
      exceptions: {
        orderBy: {
          occurrenceDate: "asc",
        },
      },
    },
  },
} as const;

export const goalWithMilestonesInclude = {
  domain: true,
  horizon: true,
  milestones: {
    orderBy: {
      sortOrder: "asc",
    },
  },
} as const;

export const dayPlannerBlockWithTasksInclude = {
  taskLinks: {
    orderBy: {
      sortOrder: "asc",
    },
    include: {
      task: {
        include: planningTaskInclude,
      },
    },
  },
} as const;
