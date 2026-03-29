export const formatMinorCurrency = (amountMinor: number | null, currencyCode = "USD") => {
  if (amountMinor === null) {
    return "TBD";
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
};

export const formatMajorCurrency = (amount: number, currencyCode = "USD") =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(amount);

export const formatPercent = (value: number) => `${Math.round(value)}%`;

export const formatMealSlotLabel = (
  mealSlot: "breakfast" | "lunch" | "dinner" | "snack" | null,
) => {
  if (!mealSlot) {
    return "Any time";
  }

  return mealSlot.charAt(0).toUpperCase() + mealSlot.slice(1);
};

export const formatWorkoutStatus = (
  status: "completed" | "recovery_respected" | "fallback" | "missed" | "none" | null | undefined,
) => {
  if (!status || status === "none") {
    return "Not logged";
  }

  return status.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
};
