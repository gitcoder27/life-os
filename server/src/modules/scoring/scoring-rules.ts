type ScoringRules = {
  planAndPriorities: {
    launchCompletion: number;
    mustWinComplete: number;
    mustWinAdvanced: number;
    mustWinStarted: number;
    supportPriorityPoints: Record<number, number>;
    supportTaskCompletion: number;
  };
  routinesAndHabits: {
    habitCompletion: number;
    habitPunctuality: number;
  };
  healthBasics: {
    water: number;
    workout: number;
    workoutFallback: number;
    defaultMealTargetCount: number;
    defaultWaterTargetMl: number;
  };
  financeAndAdmin: {
    expenseLogging: number;
    expenseTargetCount: number;
    dueAdmin: number;
  };
  reviewAndReset: {
    reviewCompletion: number;
    tomorrowPrepared: number;
  };
};

export const SCORING_RULES: ScoringRules = {
  planAndPriorities: {
    launchCompletion: 4,
    mustWinComplete: 10,
    mustWinAdvanced: 7,
    mustWinStarted: 4,
    supportPriorityPoints: {
      1: 8,
      2: 6,
    },
    supportTaskCompletion: 2,
  },
  routinesAndHabits: {
    habitCompletion: 12,
    habitPunctuality: 3,
  },
  healthBasics: {
    water: 8,
    workout: 10,
    workoutFallback: 5,
    defaultMealTargetCount: 3,
    defaultWaterTargetMl: 2500,
  },
  financeAndAdmin: {
    expenseLogging: 5,
    expenseTargetCount: 2,
    dueAdmin: 5,
  },
  reviewAndReset: {
    reviewCompletion: 6,
    tomorrowPrepared: 4,
  },
};

export const STRONG_DAY_STREAK_THRESHOLD = 70;
