import type { ReviewCadence } from "../../shared/lib/api";

const REVIEW_DRAFT_STORAGE_PREFIX = "lifeos:review-draft";

export type StoredReviewDraft<T> = {
  version: 1;
  savedAt: string;
  value: T;
};

export const createReviewDraftStorageKey = (
  cadence: ReviewCadence,
  periodKey: string,
) => `${REVIEW_DRAFT_STORAGE_PREFIX}:${cadence}:${periodKey}`;

export const readStoredReviewDraft = <T,>(storageKey: string): StoredReviewDraft<T> | null => {
  try {
    const rawValue = localStorage.getItem(storageKey);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as Partial<StoredReviewDraft<T>>;
    if (
      parsed.version !== 1 ||
      typeof parsed.savedAt !== "string" ||
      !("value" in parsed)
    ) {
      localStorage.removeItem(storageKey);
      return null;
    }

    return {
      version: 1,
      savedAt: parsed.savedAt,
      value: parsed.value as T,
    };
  } catch {
    return null;
  }
};

export const writeStoredReviewDraft = <T,>(
  storageKey: string,
  value: T,
): StoredReviewDraft<T> | null => {
  try {
    const draft = {
      version: 1 as const,
      savedAt: new Date().toISOString(),
      value,
    };

    localStorage.setItem(storageKey, JSON.stringify(draft));
    return draft;
  } catch {
    return null;
  }
};

export const clearStoredReviewDraft = (storageKey: string) => {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    return;
  }
};
