export type ReviewSubmissionWindowStatus =
  | "open"
  | "too_early"
  | "too_late"
  | "wrong_period"
  | "no_open_window";

export type ReviewWindowPresentation = {
  status: ReviewSubmissionWindowStatus;
  isOpen: boolean;
  headline: string;
  description: string;
  opensAtLocal: string | null;
  closesAtLocal: string | null;
  timezone: string;
  allowedDate: string | null;
  tagLabel: string;
  tagVariant: "positive" | "warning" | "negative" | "neutral";
};

type SubmissionWindow = {
  isOpen: boolean;
  status: ReviewSubmissionWindowStatus;
  requestedDate: string;
  allowedDate: string | null;
  opensAt: string | null;
  closesAt: string | null;
  timezone: string;
};

type Cadence = "daily" | "weekly" | "monthly";

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateShort(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const cadenceLabels: Record<Cadence, string> = {
  daily: "daily",
  weekly: "weekly",
  monthly: "monthly",
};

function buildOpenPresentation(
  window: SubmissionWindow,
  cadence: Cadence,
): Pick<ReviewWindowPresentation, "headline" | "description"> {
  const closesStr = window.closesAt ? formatTimestamp(window.closesAt) : null;

  if (cadence === "daily") {
    const hour = window.opensAt ? new Date(window.opensAt).getHours() : null;
    const isGracePeriod = hour !== null && hour < 12;
    return {
      headline: isGracePeriod
        ? "Morning grace window — submit now"
        : "Evening review window is open",
      description: closesStr
        ? `This window closes ${closesStr} (${window.timezone})`
        : "Submit your review for today",
    };
  }

  return {
    headline: `${cadence === "weekly" ? "Weekly" : "Monthly"} review window is open`,
    description: closesStr
      ? `Submit before ${closesStr} (${window.timezone})`
      : `The ${cadenceLabels[cadence]} review is ready for submission`,
  };
}

export function deriveReviewWindowPresentation(
  window: SubmissionWindow,
  cadence: Cadence,
): ReviewWindowPresentation {
  const opensAtLocal = window.opensAt ? formatTimestamp(window.opensAt) : null;
  const closesAtLocal = window.closesAt ? formatTimestamp(window.closesAt) : null;
  const base = {
    status: window.status,
    isOpen: window.isOpen,
    opensAtLocal,
    closesAtLocal,
    timezone: window.timezone,
    allowedDate: window.allowedDate,
  };

  if (window.status === "open") {
    const copy = buildOpenPresentation(window, cadence);
    return {
      ...base,
      ...copy,
      tagLabel: "Open",
      tagVariant: "positive",
    };
  }

  if (window.status === "too_early") {
    return {
      ...base,
      headline: "This review period is not open yet",
      description: opensAtLocal
        ? `The submission window opens ${opensAtLocal} (${window.timezone})`
        : "Check back later — the window has not opened",
      tagLabel: "Too early",
      tagVariant: "warning",
    };
  }

  if (window.status === "too_late") {
    return {
      ...base,
      headline: "This review window has closed",
      description: closesAtLocal
        ? `The window closed ${closesAtLocal} (${window.timezone})`
        : "The submission deadline for this period has passed",
      tagLabel: "Closed",
      tagVariant: "negative",
    };
  }

  if (window.status === "wrong_period") {
    const allowedStr = window.allowedDate
      ? formatDateShort(window.allowedDate)
      : null;
    return {
      ...base,
      headline: "This is not the currently eligible period",
      description: allowedStr
        ? `The open ${cadenceLabels[cadence]} review is for ${allowedStr}`
        : `Navigate to the current period to submit your ${cadenceLabels[cadence]} review`,
      tagLabel: "Wrong period",
      tagVariant: "warning",
    };
  }

  // no_open_window
  return {
    ...base,
    headline: cadence === "daily"
      ? "No daily review window is open right now"
      : `No ${cadenceLabels[cadence]} review window is currently open`,
    description: opensAtLocal
      ? `The next window opens ${opensAtLocal} (${window.timezone})`
      : cadence === "daily"
        ? "The daily review opens in the evening and closes the next morning"
        : `Check back when the next ${cadenceLabels[cadence]} review period begins`,
    tagLabel: "Closed",
    tagVariant: "neutral",
  };
}

export function isOutOfWindowError(error: unknown): boolean {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code: string }).code === "REVIEW_OUT_OF_WINDOW"
  ) {
    return true;
  }
  return false;
}
