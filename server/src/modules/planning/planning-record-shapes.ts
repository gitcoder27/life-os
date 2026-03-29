export const planningTaskInclude = {
  goal: true,
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
