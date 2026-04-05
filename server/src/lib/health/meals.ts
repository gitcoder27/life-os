type MealLoggingQualityLike =
  | "partial"
  | "meaningful"
  | "full"
  | "PARTIAL"
  | "MEANINGFUL"
  | "FULL";

interface MealLogLike {
  loggingQuality: MealLoggingQualityLike;
}

export function getMealTargetCountForHour(hour: number) {
  if (hour < 9) {
    return 0;
  }

  if (hour < 13) {
    return 1;
  }

  if (hour < 17) {
    return 2;
  }

  return 3;
}

function getMealCredits(mealLogs: MealLogLike[]) {
  return mealLogs.reduce((sum, meal) => {
    if (meal.loggingQuality === "partial" || meal.loggingQuality === "PARTIAL") {
      return sum + 0.5;
    }

    return sum + 1;
  }, 0);
}

export function scoreMealConsistency(
  mealLogs: MealLogLike[],
  targetCount: number,
) {
  const mealCredits = getMealCredits(mealLogs);

  if (targetCount <= 0) {
    return {
      earnedPoints: 0,
      applicablePoints: 0,
      mealCredits,
    };
  }

  if (mealCredits >= targetCount) {
    return {
      earnedPoints: 7,
      applicablePoints: 7,
      mealCredits,
    };
  }

  if (mealCredits > 0) {
    return {
      earnedPoints: 4,
      applicablePoints: 7,
      mealCredits,
    };
  }

  return {
    earnedPoints: 0,
    applicablePoints: 7,
    mealCredits,
  };
}
